# Load tests (k6)

Stress tests for the CartePro API, written for [k6](https://k6.io). They run
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
k6 run tests/k6/smoke.js     # 1 VU, 5 iterations — check the target is up
k6 run tests/k6/stress.js    # ramping load, default profile
```

`npm run dev` serves HTTPS with a self-signed certificate, hence
`insecureSkipTLSVerify` in `config.js`. Point the tests elsewhere with
`BASE_URL`:

```bash
k6 run -e BASE_URL=http://localhost:3000 tests/k6/stress.js
```

## Files

- `config.js` — base URL, ramping stages and thresholds, all env-overridable.
- `smoke.js` — minimal reachability check.
- `stress.js` — the stress test itself.

## What `stress.js` exercises

| Group        | Endpoint              | Checks                          |
| ------------ | --------------------- | ------------------------------- |
| `health`     | `GET /health`         | 200, `version` present          |
| `categories` | `GET /api/v1/categories` | 200, `categories` is an array |
| `login`      | `POST /api/v1/login`  | 200, `token` present            |

The `login` group only runs when credentials are supplied — it writes nothing,
but it does hit password verification, which is the expensive path:

```bash
k6 run -e K6_EMAIL=user@example.com -e K6_PASSWORD='Passw0rd!' tests/k6/stress.js
```

## Tuning the profile

The default ramp is 10 → 50 → 100 VUs over 3 minutes. Every stage and target is
an environment variable:

| Variable                          | Default        | Meaning                     |
| --------------------------------- | -------------- | --------------------------- |
| `BASE_URL`                        | `https://localhost:3000` | Target instance   |
| `VUS_LOW` / `VUS_MID` / `VUS_HIGH`| `10` / `50` / `100` | VUs per stage          |
| `RAMP_UP` / `PLATEAU` / `PEAK` / `RAMP_DOWN` | `30s` / `1m` / `1m` / `30s` | Stage durations |
| `K6_EMAIL` / `K6_PASSWORD`        | unset          | Enables the login group     |

To find the breaking point, raise `VUS_HIGH` until the thresholds fail:

```bash
k6 run -e VUS_HIGH=500 -e PEAK=2m tests/k6/stress.js
```

## Thresholds

k6 exits non-zero when any threshold is breached, so these scripts can gate a
pipeline as-is:

- `http_req_failed` < 5%
- `http_req_duration` p(95) < 800 ms, p(99) < 2 s
- `checks` pass rate > 95%

Per-endpoint latency is also reported through the custom `health_duration`,
`categories_duration` and `login_duration` trends.
