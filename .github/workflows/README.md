# Workflows

Automated GitHub Actions workflows for this repository, chained end-to-end via `workflow_run`: a CI pipeline (`ci.yml`) installs dependencies, builds the project and runs tests; on success, a mirror workflow (`mirror.yml`) syncs the repository to a secondary remote; on success, a deploy workflow (`deploy.yml`) publishes a GitHub release and changelog via semantic-release, then builds and pushes the production Docker images.

```
push to main
  → CI (ci.yml)
      → MIRROR (mirror.yml)      [only if CI concluded "success"]
          → DEPLOY (deploy.yml)  [only if MIRROR concluded "success"]
```

Each hop in this chain is a separate workflow file triggered by `workflow_run`, which fires on `types: [completed]` regardless of outcome — every triggered job therefore also checks `github.event.workflow_run.conclusion == 'success'` in its `if:`, so a failed CI run (or a failed mirror) stops the chain instead of letting MIRROR/DEPLOY run against a broken build.

All app-level commands across these workflows operate on `Ticket Tout/` (the whole app, including `package-lock.json`, lives in that subdirectory — the repo root only holds Docker/CI config and docs), so every npm cache in these workflows is keyed and pathed off `Ticket Tout/package-lock.json` / `Ticket Tout/node_modules`, not the repo root.

## CI (`ci.yml`)

**Trigger:** on `push` to `main`, ignoring changes that only touch `**.md` files or the `docs/**` directory.

The workflow runs three jobs in sequence, each on `ubuntu-24.04` with a 5 minute timeout:

1. **`install_dependencies`**
   - Checks out the repository (`actions/checkout`, `persist-credentials: false`).
   - Sets up Node 24 (`actions/setup-node`) with npm caching keyed on `Ticket Tout/package-lock.json`.
   - Caches `Ticket Tout/node_modules` (`actions/cache`) under the key `node-modules-${{ runner.os }}-24-${{ hashFiles('Ticket Tout/package-lock.json') }}`.
   - Runs `npm ci --prefer-offline --no-audit --no-fund`, but only if the `node_modules` cache was not hit.

2. **`build`** (needs `install_dependencies`)
   - Checks out the repository and sets up Node 24 again (each job runs on a fresh runner, so setup/cache steps are repeated).
   - Restores the same `node_modules` cache, reinstalling if it misses.
   - Currently only installs dependencies — it does not yet run `npm run build` or upload a build artifact; the job exists as a placeholder/dependency gate ahead of `tests`.

3. **`tests`** (needs `build`)
   - Checks out the repository, sets up Node 24, restores/reinstalls the `node_modules` cache as above.
   - Runs `npm rebuild && JWT_SECRET=${{ secrets.JWT_SECRET }} npm run ci:test:backend:unit` (backend unit tests, not e2e).

Within this file, `needs:` already gates each job on the previous one's success by GitHub's default `if: success()` behavior — no extra condition is required here.

## MIRROR (`mirror.yml`)

**Trigger:** `workflow_run` — runs after the `CI` workflow completes, gated by `if: github.repository == 'theo-futol/survivor' && github.event.workflow_run.conclusion == 'success'` (so it's a no-op on forks and skipped entirely if CI failed or was cancelled).

One job, `mirror`, on `ubuntu-24.04` with a 10 minute timeout, granted `contents: write`, `issues: write`, `pull-requests: write`, and `id-token: write` permissions:
- Checks out the repository with full history (`fetch-depth: 0`).
- Pushes it to a secondary remote (`pixta-dev/repository-mirroring-action`) using `secrets.GIT_SSH_PRIVATE_KEY`.

## DEPLOY (`deploy.yml`)

**Trigger:** `workflow_run` — runs after the `MIRROR` workflow completes, gated the same way: `if: github.repository == 'theo-futol/survivor' && github.event.workflow_run.conclusion == 'success'`.

Two jobs:

1. **`create_release`**, on `ubuntu-24.04` with a 10 minute timeout, granted `contents: write`, `issues: write`, `pull-requests: write`, and `id-token: write` permissions:
   - Checks out the repository.
   - Sets up Node 24.
   - Restores/rebuilds the `Ticket Tout/node_modules` cache (same key/strategy as CI).
   - Runs `npm rebuild && npx semantic-release`, with `GITHUB_TOKEN` supplied from `secrets.GITHUB_TOKEN`. Since the app's `package.json` is `private: true`, the `@semantic-release/npm` plugin only bumps the local version (no `npm publish`); `@semantic-release/github` creates the GitHub release and changelog.
   - Compares `package.json`'s version before/after running `semantic-release` to detect whether a release actually happened, and exposes `released` (`'true'`/`'false'`) and `version` as job outputs.

2. **`build_and_push_image`** (needs `create_release`, only runs if `released == 'true'`), on `ubuntu-24.04` with a 15 minute timeout, granted `contents: read` and `packages: write` permissions:
   - Checks out the repository.
   - Sets up Docker Buildx and logs into `ghcr.io` using `github.actor` / `secrets.GITHUB_TOKEN`.
   - Builds the `prod-stage` target of `Ticket Tout/Dockerfile` and pushes it to `ghcr.io/theo-futol/survivor`, tagged with the released version and `latest`.
   - Builds and pushes the `garage-config` image from `garage-init/`, tagged the same way.

The `prod-stage` image runs Prisma migrations at **container startup** (via `Ticket Tout/docker-entrypoint.sh`), not at build time — this is what makes it possible to build and publish the image without a database available in CI, and it's the same image consumers pull to run standalone: `docker run -e DATABASE_URL=... -e JWT_SECRET=... -p 3000:3000 ghcr.io/theo-futol/survivor:<version>`.
