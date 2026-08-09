# LOOM release checklist

This checklist stops a documentation-complete release from becoming a runtime-incomplete release.

## 1. Confirm the release surface

```bash
node cli/bin/loom.js --version
node cli/bin/loom.js --help
node cli/bin/loom.js prompts
npm test
npm pack --dry-run
```

Confirm that the package contains the CLI runtime, English and Chinese READMEs, design, prompt catalog, UX flow, Evil Eval
protocol, changelog, license, contribution guide, and security policy. Check that it does not contain pilot
workspaces, eval artifacts, temporary browser profiles, or local project state.

## 2. Confirm metadata and registry state

```bash
npm whoami
npm view @haaaiawd/loom version
git status --short
git diff --check
```

The version in `package.json`, `CHANGELOG.md`, and `loom --version` must agree. The new version must not
already exist in the registry.

## 3. Publish deliberately

```bash
git tag v2.0.0
git push origin HEAD
git push origin v2.0.0
npm publish --access public
```

Run these commands only after reviewing the final diff and confirming the authenticated GitHub remote and
npm identity. Tags and published npm versions are externally visible and should not be used as test steps.

## 4. Verify from the outside

In a clean temporary directory:

```bash
npm view @haaaiawd/loom version
npx @haaaiawd/loom@2.0.0 --version
```

Then open the GitHub README and npm package page to confirm the SVG header, diagrams, links, and changelog
render correctly. Record any unverified platform boundary instead of silently declaring it passed.
