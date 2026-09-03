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

**Trigger:** `workflow_run` — runs after the `CI` workflow completes.

Single job, **`create_release`**, on `ubuntu-24.04` with a 10 minute timeout, granted `contents: write`, `issues: write`, `pull-requests: write`, and `id-token: write` permissions:

- Checks out the repository.
- Sets up Node 24.
- Restores/rebuilds the `node_modules` cache (same key/strategy as CI).
- Runs `npm rebuild && npx semantic-release`, with `GITHUB_TOKEN` supplied from `secrets.GITHUB_TOKEN`.

---

The project doesn't require a deployment at this stage, so the CD workflow is only responsible for creating a GitHub release and changelog via `semantic-release` — there is no deploy/publish step.
