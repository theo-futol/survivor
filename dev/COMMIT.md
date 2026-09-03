# Conventional Commit Format

A conventional commit has the following structure:

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type (Required)
Must be one of:
- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that don't affect code meaning (formatting, semicolons, etc.)
- **refactor**: Code changes that neither fix a bug nor add a feature
- **perf**: Code changes that improve performance
- **test**: Adding or updating tests
- **chore**: Changes to build process, dependencies, or tooling
- **ci**: Changes to CI/CD configuration

#### Scope (Optional)
A noun describing the part of the codebase affected, e.g., `api`, `auth`, `ui`.

#### Subject (Required)
- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize the first letter
- No period at the end
- Maximum 50 characters

#### Body (Optional)
- Explain the motivation for the change
- Explain what the change does and why, not how
- Use imperative mood
- Separate from subject with a blank line
- Wrap at 72 characters

#### Footer (Optional)
- Reference issues: `Closes #123`
- Note breaking changes: `BREAKING CHANGE: description`
