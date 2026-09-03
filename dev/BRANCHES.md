# BRANCHES CONVENTION

## Why We Use Branches

Branches are a fundamental part of Git that allow us to work on different features, bug fixes, or experiments in isolation from the main codebase. By using branches, we can:

- Develop new features without affecting the stable version of the code.
- Fix bugs without introducing new issues to the main branch.
- Collaborate with other developers without conflicts.
- Test new ideas without risking the integrity of the main codebase.

---

## Branching Strategy

We follow a branching strategy organized by domain and development stage to keep work structured and maintain a stable production flow:

| Branch | Role |
|---|---|
| `main` | Always contains stable, production-ready code. |
| `dev` | Integration branch where all completed work is merged for testing and validation before release to `main`. |
| `server/main` | Base branch for all backend-related development. |
| `gui/main` | Base branch for all frontend/user interface development. |
| `ia/main` | Base branch for all AI-related development (models, logic, integrations). |

Each domain uses a structured sub-namespace for its branches:

- `<domain>/feat/` — Branches created for developing new features. Created from the relevant base branch (`server/main`, `gui/main`, or `ia/main`) and merged back into `dev` once completed and tested.
- `<domain>/bugfix/` — Branches created for fixing non-critical bugs. Created from the relevant base branch and merged back into `dev` after validation.
- `hotfix/` — Branches for urgent fixes applied directly to `main`. Branched from `main` and merged back into both `main` and `dev`. Hotfixes are **not domain-scoped** as they address cross-cutting production issues.

### Examples

```
# Base branches
server/main
gui/main
ia/main

# Features
server/feat/ipc-baseline
server/feat/auth-refactor
gui/feat/ipc
gui/feat/3d-logic
ia/feat/gpt-integration

# Bug fixes
server/bugfix/timeout-fix
gui/bugfix/button-overlap
ia/bugfix/model-crash
```
---

## Basic Rules

1. **Use Lowercase Alphanumerics, Hyphens, and Slashes** — Always use lowercase letters (a–z), numbers (0–9), hyphens (`-`) to separate words, and slashes (`/`) as namespace separators. Avoid special characters, underscores, or spaces.

2. **No Consecutive, Leading, or Trailing Hyphens or Dots** — Ensure hyphens and dots are not consecutive (e.g., `server/feat/new--login`) and do not appear at the start or end of any name segment (e.g., `server/feat/-new-login`).

3. **Keep It Clear and Concise** — Branch names should be descriptive yet concise, clearly indicating the purpose of the work.

4. **Include Issue Numbers** — If the branch is related to a specific issue or task, include the issue number in the branch name (e.g., `server/feat/123-ipc-baseline`, `gui/bugfix/456-button-overlap`).

5. **Never Use a Domain Name Alone** — Domain names (`server`, `gui`, `ia`) must never be used as standalone branch names. Always qualify them with a stage: `server/main`, `server/feat/...`, `server/bugfix/...`.
