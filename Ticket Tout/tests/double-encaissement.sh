#!/usr/bin/env bash
#
# double-encaissement.sh — live-stack race test for the overdraft guard.
#
# POST /api/v1/salaries/:salarieId/transactions protects the balance with a
# "SELECT balance ... FOR UPDATE" row lock inside withTransaction(). The Jest
# suite cannot cover that lock: it runs against tests/mocks/mock-postgres.ts,
# which stands in for the raw SQL lane, so there is no real lock and no real
# concurrency. This script needs a real Postgres and a real HTTP server.
#
# It arms the seeded EMPLOYEE with exactly AMOUNT, then releases 2 threads x 2
# concurrent payments of AMOUNT through a start gate. Exactly one payment may
# win; the balance must land on 0 and never go negative.
#
# Run it from anywhere:
#
#   ./"Ticket Tout"/tests/double-encaissement.sh
#   ROUNDS=20 AMOUNT=500 ./"Ticket Tout"/tests/double-encaissement.sh
#
# Env knobs:
#   BASE_URL    default http://localhost:3000
#   AMOUNT      default 1000 — per-payment amount, and the armed balance
#   ROUNDS      default 1 — races are probabilistic, repeat to widen the window
#   KEEP_STACK  1 to skip the teardown
#   CONFIRM     0 to skip the interactive confirmations (implied when stdin is
#               not a tty, so the script never hangs unattended)

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
AMOUNT="${AMOUNT:-1000}"
ROUNDS="${ROUNDS:-1}"
KEEP_STACK="${KEEP_STACK:-0}"
CONFIRM="${CONFIRM:-1}"

for arg in "$@"; do
  case "$arg" in
    --yes|-y) CONFIRM=0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [ ! -t 0 ]; then
  CONFIRM=0
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

COMPOSE=(docker compose --env-file .env.development --profile dev)

# The EMPLOYEE from mocks/seed-roles.sql, credentials in mocks/login.txt.
SALARIE_ID="a0000000-0000-4000-8000-000000000004"
# PARTNER is allowed to POST this route (lib/roles-config.ts) and the handler
# runs no ownership check on POST.
PARTNER_EMAIL="employee@tickettout.test"
PARTNER_PASSWORD="EmployeePass1!"

TMP="$(mktemp -d)"
STACK_STARTED=0
FAILURES=0

cleanup() {
  local status=$?
  rm -rf "$TMP"
  if [ "$STACK_STARTED" = "1" ] && [ "$KEEP_STACK" != "1" ]; then
    echo ""
    echo "▸ Teardown (volumes kept)..."
    "${COMPOSE[@]}" down >/dev/null 2>&1 || true
  elif [ "$STACK_STARTED" = "1" ]; then
    echo ""
    echo "▸ KEEP_STACK=1 — stack left running."
  fi
  exit "$status"
}
trap cleanup EXIT

say()  { echo "▸ $*"; }
ok()   { echo "  ✔ $*"; }
bad()  { echo "  ✘ $*"; FAILURES=$((FAILURES + 1)); }

confirm() {
  if [ "$CONFIRM" != "1" ]; then
    return 0
  fi
  local reply=""
  read -r -p "$1 [y/N] " reply
  case "$reply" in
    y|Y|yes|YES) return 0 ;;
    *) echo "Aborted."; exit 1 ;;
  esac
}

# psql inside the db container, reading SQL from stdin. -tA gives bare values.
psql_q() {
  docker exec -i ticket_tout_db bash -c \
    'PGPASSWORD=$POSTGRES_PASSWORD psql -U $POSTGRES_USER -d $POSTGRES_DB -tA -v ON_ERROR_STOP=1'
}

sql() {
  printf '%s\n' "$1" | psql_q | tr -d '[:space:]'
}

# ---------------------------------------------------------------- stack ----

echo "Double encaissement — live stack test"
echo "  base url : $BASE_URL"
echo "  amount   : $AMOUNT (armed balance = $AMOUNT, so 1 of 4 payments may win)"
echo "  rounds   : $ROUNDS"
echo ""

confirm "Build and start the dev stack (db, redis, ticket_tout_app_dev)?"

say "Starting the stack..."
"${COMPOSE[@]}" up -d --build
STACK_STARTED=1

say "Waiting for Postgres..."
for i in $(seq 1 60); do
  if docker exec ticket_tout_db pg_isready -q 2>/dev/null; then
    ok "Postgres ready."
    break
  fi
  if [ "$i" = "60" ]; then
    bad "Postgres never became ready."
    docker logs --tail 40 ticket_tout_db || true
    exit 1
  fi
  sleep 2
done

say "Waiting for $BASE_URL/health (the first build compiles, this can take a while)..."
for i in $(seq 1 120); do
  if curl -fsS "$BASE_URL/health" >/dev/null 2>&1; then
    ok "App healthy: $(curl -fsS "$BASE_URL/health")"
    break
  fi
  if [ "$i" = "120" ]; then
    bad "App never answered on $BASE_URL/health."
    docker logs --tail 40 ticket_tout_app_dev || true
    exit 1
  fi
  sleep 2
done

# ----------------------------------------------------------------- seed ----

say "Migrating and seeding (mocks/seed.sql, then mocks/seed-roles.sql)..."
# Every insert in both files is ON CONFLICT DO NOTHING, so re-seeding an
# existing data_sql volume is safe.
docker exec ticket_tout_app_dev bash -c "./migration.sh" >/dev/null
./dev/seed-db.sh mocks/seed.sql >/dev/null
./dev/seed-db.sh mocks/seed-roles.sql >/dev/null
ok "Seeded."

if [ "$(sql "SELECT count(*) FROM users WHERE id = '$SALARIE_ID';")" != "1" ]; then
  bad "Seeded employee $SALARIE_ID not found — seeding did not take."
  exit 1
fi

# ---------------------------------------------------------------- login ----

say "Logging in as $PARTNER_EMAIL (PARTNER)..."
LOGIN_BODY="$(curl -sS -X POST "$BASE_URL/api/v1/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$PARTNER_EMAIL\",\"password\":\"$PARTNER_PASSWORD\"}")"

TOKEN="$(printf '%s' "$LOGIN_BODY" | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"

if [ -z "$TOKEN" ]; then
  bad "Login failed: $LOGIN_BODY"
  exit 1
fi
ok "Token acquired."

# lib/services/redis_service.ts guards its connection with a plain
# `redisConnected` boolean, so a cold burst of concurrent requests all call
# redisClient.connect() at once and authorize() answers 503. That is a real bug
# (see the note at the bottom of tests/README.md), but it is not the bug this
# script measures — one sequential request opens the connection first, so the
# race below exercises the balance lock rather than the redis start.
#
# The warm-up must hit *this* route: `next dev` compiles a separate bundle per
# route, so each route handler holds its own redis_service module instance and
# its own client. It carries a deliberately invalid body (negative amount), so
# it is rejected at the zod schema after authorize() has run — the connection
# opens, nothing is written.
say "Warming the auth path on this route (expect 400)..."
warm_code="$(curl -sS -o /dev/null -w '%{http_code}' \
  -X POST "$BASE_URL/api/v1/salaries/$SALARIE_ID/transactions" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"amount":-1,"status":"VALIDER","type":"PAYMENT"}')"
if [ "$warm_code" = "400" ]; then
  ok "Auth path warm (HTTP 400 as expected)."
else
  echo "  ! Warm-up returned HTTP $warm_code, expected 400 — continuing anyway."
fi

# ----------------------------------------------------------------- race ----

confirm "Overwrite employee $SALARIE_ID's balance and DELETE their transaction rows?"

post_payment() {
  local label="$1"
  # Every worker blocks here until the gate file appears, so all four hit the
  # row lock inside the same window.
  while [ ! -f "$TMP/go" ]; do
    sleep 0.01
  done
  curl -sS -o "$TMP/body.$label" -w '%{http_code}' \
    -X POST "$BASE_URL/api/v1/salaries/$SALARIE_ID/transactions" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"amount\":$AMOUNT,\"status\":\"VALIDER\",\"type\":\"PAYMENT\"}" \
    > "$TMP/code.$label" 2>/dev/null || echo "000" > "$TMP/code.$label"
}

for round in $(seq 1 "$ROUNDS"); do
  echo ""
  say "Round $round/$ROUNDS"

  rm -f "$TMP"/go "$TMP"/code.* "$TMP"/body.*

  sql "DELETE FROM public.transaction WHERE \"userId\" = '$SALARIE_ID';" >/dev/null
  sql "UPDATE public.users SET balance = $AMOUNT WHERE id = '$SALARIE_ID';" >/dev/null

  start_balance="$(sql "SELECT balance FROM public.users WHERE id = '$SALARIE_ID';")"
  echo "  start balance: $start_balance"

  # 2 threads, each posting 2 payments — 4 in flight at once.
  for thread in 1 2; do
    (
      for payment in 1 2; do
        post_payment "t${thread}p${payment}" &
      done
      wait
    ) &
  done

  # Let the workers reach the gate, then release them together.
  sleep 0.5
  touch "$TMP/go"
  wait

  # -------------------------------------------------------------- assert ----

  echo "  responses:"
  codes_ok=1
  for thread in 1 2; do
    for payment in 1 2; do
      label="t${thread}p${payment}"
      code="$(cat "$TMP/code.$label" 2>/dev/null || echo "???")"
      body="$(cat "$TMP/body.$label" 2>/dev/null || echo "")"
      printf '    thread %s payment %s  HTTP %s  %s\n' "$thread" "$payment" "$code" "$body"
      [ "$code" = "201" ] || codes_ok=0
    done
  done

  final_balance="$(sql "SELECT balance FROM public.users WHERE id = '$SALARIE_ID';")"
  n_total="$(sql "SELECT count(*) FROM public.transaction WHERE \"userId\" = '$SALARIE_ID';")"
  n_valider="$(sql "SELECT count(*) FROM public.transaction WHERE \"userId\" = '$SALARIE_ID' AND status = 'VALIDER';")"
  n_refuser="$(sql "SELECT count(*) FROM public.transaction WHERE \"userId\" = '$SALARIE_ID' AND status = 'REFUSER';")"
  n_bad_amount="$(sql "SELECT count(*) FROM public.transaction WHERE \"userId\" = '$SALARIE_ID' AND amount <> $AMOUNT;")"
  n_negative="$(sql "SELECT count(*) FROM public.transaction WHERE \"userId\" = '$SALARIE_ID' AND \"newBalance\" < 0;")"
  valider_new_balance="$(sql "SELECT coalesce(max(\"newBalance\"), -1) FROM public.transaction WHERE \"userId\" = '$SALARIE_ID' AND status = 'VALIDER';")"

  echo "  final balance: $final_balance   rows: $n_total (VALIDER $n_valider / REFUSER $n_refuser)"

  # The route answers 201 even when it refuses — it persists a REFUSER row
  # rather than returning the 400 docs/API.md describes. Assert on DB state.
  if [ "$codes_ok" = "1" ]; then
    ok "All 4 requests returned 201."
  else
    bad "Not every request returned 201."
  fi

  # The one that matters: a negative balance means the row lock was bypassed
  # and the same money was spent twice.
  if [ "$final_balance" = "0" ]; then
    ok "Final balance is exactly 0."
  else
    bad "Final balance is $final_balance, expected 0 (negative = double encaissement)."
  fi

  if [ "$n_valider" = "1" ]; then
    ok "Exactly 1 payment accepted."
  else
    bad "$n_valider payments accepted, expected exactly 1."
  fi

  if [ "$n_refuser" = "3" ]; then
    ok "Exactly 3 payments refused."
  else
    bad "$n_refuser payments refused, expected exactly 3."
  fi

  if [ "$n_total" = "4" ]; then
    ok "4 transaction rows persisted."
  else
    bad "$n_total transaction rows persisted, expected 4."
  fi

  if [ "$valider_new_balance" = "0" ]; then
    ok "Accepted payment recorded newBalance 0."
  else
    bad "Accepted payment recorded newBalance $valider_new_balance, expected 0."
  fi

  if [ "$n_bad_amount" = "0" ]; then
    ok "Every row carries amount $AMOUNT."
  else
    bad "$n_bad_amount rows carry an unexpected amount."
  fi

  if [ "$n_negative" = "0" ]; then
    ok "No row recorded a negative newBalance."
  else
    bad "$n_negative rows recorded a negative newBalance."
  fi
done

echo ""
if [ "$FAILURES" = "0" ]; then
  echo "PASS — the FOR UPDATE lock held across $ROUNDS round(s)."
  exit 0
fi

echo "FAIL — $FAILURES assertion(s) failed."
exit 1
