# Contributing to mdz-core-js

Thank you for taking the time to contribute! 🎉

## Getting started

1. **Fork** the repository and clone your fork.
2. Run `npm install` to install dependencies.
3. Create a feature branch: `git checkout -b feat/my-feature`.
4. Make your changes and add tests.
5. Ensure all quality gates pass (see below).
6. Open a pull request against `main`.

## Development setup

```bash
git clone https://github.com/kylemwhite/mdz-core-js.git
cd mdz-core-js
npm install
```

## Quality gates

Before opening a PR, please ensure these all pass locally:

```bash
npm run format:check   # Prettier formatting
npm run lint           # ESLint
npm run typecheck      # TypeScript type-check
npm test               # Vitest unit tests
npm run build          # tsup build
```

You can auto-fix formatting and lint issues with:

```bash
npm run format
npm run lint:fix
```

## Commit message conventions

We loosely follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | When to use |
|--------|-------------|
| `feat:` | A new user-facing feature |
| `fix:` | A bug fix |
| `docs:` | Documentation changes only |
| `chore:` | Build/CI/tooling changes |
| `refactor:` | Code changes that neither fix a bug nor add a feature |
| `test:` | Adding or improving tests |
| `perf:` | Performance improvements |

## Adding a changeset

For any user-facing change (new feature, bug fix, breaking change) you **must** add a changeset:

```bash
npx changeset
```

Follow the interactive prompts to describe your change.  This is what generates the CHANGELOG
entry and version bump.  See [RELEASING.md](RELEASING.md) for more details.

## Testing

```bash
npm test                # run tests once
npm run test:watch      # run in watch mode
npm run test:coverage   # run with coverage report
```

Tests live in `tests/`.  Please add tests for any new functionality.

## Code style

- TypeScript with strict mode enabled.
- Prettier handles formatting; ESLint handles quality.
- Public API changes must update the JSDoc in `src/`.

## Reporting bugs

Please use the [Bug Report issue template](.github/ISSUE_TEMPLATE/bug_report.md).

## Proposing features

Please use the [Feature Request issue template](.github/ISSUE_TEMPLATE/feature_request.md).

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).
By participating you agree to abide by its terms.
