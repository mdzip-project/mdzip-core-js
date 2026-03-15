# Release Process

This project uses [Changesets](https://github.com/changesets/changesets) for versioning and
changelog generation, following [Semantic Versioning](https://semver.org/).

## Overview

```
code change → add changeset → merge to main → Changeset Release PR auto-opens
→ merge Release PR → GitHub Actions publishes to npm + creates GitHub Release
```

## Step-by-step

### 1. Make your changes

Implement the feature or bug fix on a feature branch.

### 2. Add a changeset

```bash
npx changeset
```

The CLI will ask you:

- **Which packages changed?** — select `mdz-core-js`
- **Bump type?** — `patch` for fixes, `minor` for new features, `major` for breaking changes
- **Summary** — a brief, user-facing description of what changed

This creates a file in `.changeset/`.  Commit it alongside your code changes.

### 3. Open a pull request

Push your branch and open a PR against `main`.  CI will run the full quality gate.

### 4. Merge to main

Once the PR is approved and merged, the **Changeset Release** GitHub Action detects the pending
changeset and automatically opens a **Version PR** titled `chore: version packages`.

This PR:
- Bumps the version in `package.json`
- Updates `CHANGELOG.md`
- Removes the consumed changeset files

### 5. Merge the Version PR

Review and merge the Version PR.  This triggers a second run of the action which:

1. Builds the package
2. Publishes to npm (using the `NPM_TOKEN` secret)
3. Creates a GitHub Release with auto-generated notes

### 6. Verify the release

- Check [npm](https://www.npmjs.com/package/mdz-core-js) for the new version.
- Check [GitHub Releases](https://github.com/kylemwhite/mdz-core-js/releases) for the release notes.

---

## Manual (tagged) release

If you need to publish manually:

```bash
git checkout main && git pull
npm run clean && npm run build
npm run typecheck && npm run lint && npm test
npm version <patch|minor|major>
git push --follow-tags
```

The `release.yml` workflow will pick up the new tag and publish to npm.

---

## Required GitHub secrets and settings

> **Action required** — the following must be configured manually in GitHub before any automated
> publishing will work.

| Secret / Setting | Description |
|------------------|-------------|
| `NPM_TOKEN` | A classic npm token with `publish` permission for the `mdz-core-js` package.  Add under **Settings → Secrets → Actions → New repository secret**. |
| Branch protection on `main` | Enable **Require status checks to pass** and require the `CI / Install / Lint / Typecheck / Test / Build` job. |
| npm OIDC (optional) | For fully token-free trusted publishing, configure an [npm granular token or OIDC](https://docs.npmjs.com/generating-provenance-statements) and update `release.yml` accordingly. |
| Changeset release bot (optional) | Install the [Changesets GitHub App](https://github.com/apps/changeset-bot) to get PR comments showing the changeset status. |
