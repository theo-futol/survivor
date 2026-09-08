# Load tests (k6)

Load tests for the CartePro API, written for [k6](https://k6.io). They run
against a **running instance** (unlike the Jest suites in `tests/api/`, which
import the route handlers directly with mocked storage), so a server and a
reachable database are required.

## Install k6

```bash
brew install k6            # macOS
# or: docker run --rm -i grafana/k6 run - < tests/k6/stress.js
```

## Run

Start the app first (`npm run dev` from `CartePro/`, or
`docker compose --profile dev up` from the repo root), then:

```bash
k6 run tests/k6/smoke.js          # 1 VU, 5 iterations — check the target is up
k6 run tests/k6/average-load.js   # typical traffic, ~7 min
k6 run tests/k6/stress.js         # ramping load past the expected peak, ~3 min
```

`npm run dev` serves HTTPS with a self-signed certificate, hence
`insecureSkipTLSVerify` in `config.js`. Point the tests elsewhere with
`BASE_URL`:

```bash
k6 run -e BASE_URL=http://localhost:3000 tests/k6/average-load.js
```

## Files

- `config.js` — base URL and the two load profiles (stages + thresholds), all env-overridable.
- `scenario.js` — the request flow shared by every profile.
- `smoke.js` — minimal reachability check.
- `average-load.js` — average-load test.
- `stress.js` — stress test.

## Which test to run

| Test              | Profile                          | Question it answers                     |
| ----------------- | -------------------------------- | --------------------------------------- |
| `smoke.js`        | 1 VU, 5 iterations               | Is the target reachable and correct?    |
| `average-load.js` | 20 VUs held for 5 min            | Is the API healthy under normal usage?  |
| `stress.js`       | 10 → 50 → 100 VUs over 3 min     | Where does it start degrading?          |

`average-load.js` holds a steady plateau long enough for connection pools,
caches and GC to settle, so it catches slow drifts (leaks, pool exhaustion)
that a short ramp hides. Its thresholds are deliberately stricter than the
stress ones — under normal load, degradation is a regression, not an
acceptable trade-off.

## What the scenario exercises

Both profiles run the same flow from `scenario.js`, one iteration per
simulated visitor, with 1 s of think time:

| Group        | Endpoint                 | Checks                        |
| ------------ | ------------------------ | ----------------------------- |
| `health`     | `GET /health`            | 200, `version` present        |
| `categories` | `GET /api/v1/categories` | 200, `categories` is an array |
| `login`      | `POST /api/v1/login`     | 200, `token` present          |

The `login` group only runs when credentials are supplied — it writes nothing,
but it does hit password verification, which is the expensive path:

```bash
k6 run -e K6_EMAIL=user@example.com -e K6_PASSWORD='Passw0rd!' tests/k6/average-load.js
```

## Tuning the profiles

| Variable                                     | Default                     | Applies to     |
| -------------------------------------------- | --------------------------- | -------------- |
| `BASE_URL`                                    | `https://localhost:3000`    | all            |
| `K6_EMAIL` / `K6_PASSWORD`                    | unset                       | all            |
| `VUS_LOW` / `VUS_MID` / `VUS_HIGH`            | `10` / `50` / `100`         | `stress.js`    |
| `RAMP_UP` / `PLATEAU` / `PEAK` / `RAMP_DOWN`  | `30s` / `1m` / `1m` / `30s` | `stress.js`    |
| `AVG_VUS`                                     | `20`                        | `average-load.js` |
| `AVG_RAMP_UP` / `AVG_DURATION` / `AVG_RAMP_DOWN` | `1m` / `5m` / `1m`       | `average-load.js` |

Set `AVG_VUS` to whatever production actually sees; to find the breaking point
instead, raise `VUS_HIGH` until the stress thresholds fail:

```bash
k6 run -e AVG_VUS=35 -e AVG_DURATION=15m tests/k6/average-load.js
k6 run -e VUS_HIGH=500 -e PEAK=2m tests/k6/stress.js
```

## Thresholds

k6 exits non-zero when any threshold is breached, so these scripts can gate a
pipeline as-is.

| Metric              | `average-load.js`     | `stress.js`           |
| ------------------- | --------------------- | --------------------- |
| `http_req_failed`   | < 1%                  | < 5%                  |
| `http_req_duration` | p(95) < 500 ms, p(99) < 1 s | p(95) < 800 ms, p(99) < 2 s |
| `checks`            | > 99%                 | > 95%                 |

Per-endpoint latency is also reported through the custom `health_duration`,
`categories_duration` and `login_duration` trends.
