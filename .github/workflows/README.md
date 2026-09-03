# Workflows

Automated GitHub Actions workflows for this repository: a CI pipeline that installs dependencies, builds the project and runs tests, and a release workflow that publishes a GitHub release and changelog via semantic-release.

## CI (`ci.yml`)

**Trigger:** on `push` to `main`, ignoring changes that only touch `**.md` files or the `docs/**` directory.

The workflow runs three jobs in sequence, each on `ubuntu-24.04` with a 5 minute timeout:

1. **`install_dependencies`**
   - Checks out the repository (`actions/checkout`, `persist-credentials: false`).
   - Sets up Node 24 (`actions/setup-node`) with npm caching keyed on `package-lock.json`.
   - Caches `node_modules` (`actions/cache`) under the key `node-modules-${{ runner.os }}-24-${{ hashFiles('package-lock.json') }}`.
   - Runs `npm ci --prefer-offline --no-audit --no-fund`, but only if the `node_modules` cache was not hit.

2. **`build`** (needs `install_dependencies`)
   - Checks out the repository and sets up Node 24 again (each job runs on a fresh runner, so setup/cache steps are repeated).
   - Restores the same `node_modules` cache, reinstalling if it misses.
   - Runs `npm rebuild && npm run build`.
   - Uploads the resulting `dist/` directory as a build artifact named `dist-production`, retained for 1 day. This artifact is available for download from the workflow run's summary page in the GitHub Actions UI.

3. **`tests`** (needs `build`)
   - Checks out the repository, sets up Node 24, restores/reinstalls the `node_modules` cache as above.
   - Runs `npm rebuild && JWT_SECRET=${{ secrets.JWT_SECRET }} npm run ci:test:backend:unit` (backend unit tests, not e2e).

## CD (`release.yml`)

**Trigger:** `workflow_run` — runs after the `MIRROR` workflow completes.

Two jobs:

1. **`create_release`**, on `ubuntu-24.04` with a 10 minute timeout, granted `contents: write`, `issues: write`, `pull-requests: write`, and `id-token: write` permissions:
   - Checks out the repository.
   - Sets up Node 24.
   - Restores/rebuilds the `node_modules` cache (same key/strategy as CI).
   - Runs `npm rebuild && npx semantic-release`, with `GITHUB_TOKEN` supplied from `secrets.GITHUB_TOKEN`. Since the app's `package.json` is `private: true`, the `@semantic-release/npm` plugin only bumps the local version (no `npm publish`); `@semantic-release/github` creates the GitHub release and changelog.
   - Compares `package.json`'s version before/after running `semantic-release` to detect whether a release actually happened, and exposes `released` (`'true'`/`'false'`) and `version` as job outputs.

2. **`build_and_push_image`** (needs `create_release`, only runs if `released == 'true'`), on `ubuntu-24.04` with a 15 minute timeout, granted `contents: read` and `packages: write` permissions:
   - Checks out the repository.
   - Sets up Docker Buildx and logs into `ghcr.io` using `github.actor` / `secrets.GITHUB_TOKEN`.
   - Builds the `prod-stage` target of `Ticket Tout/Dockerfile` and pushes it to `ghcr.io/theo-futol/survivor`, tagged with the released version and `latest`.

The `prod-stage` image runs Prisma migrations at **container startup** (via `Ticket Tout/docker-entrypoint.sh`), not at build time — this is what makes it possible to build and publish the image without a database available in CI, and it's the same image consumers pull to run standalone: `docker run -e DATABASE_URL=... -e JWT_SECRET=... -p 3000:3000 ghcr.io/theo-futol/survivor:<version>`.
