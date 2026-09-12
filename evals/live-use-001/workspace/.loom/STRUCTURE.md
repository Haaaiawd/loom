# Project structure

## Source code
`afterthought.html` is the self-contained application artifact at workspace root.

## Tests
`tests/verify.mjs` is the static offline/privacy check; `verification.txt` stores its output.

## Documents
`README.md` explains double-click launch and verification.

## Configuration and build
No build configuration or dependencies; the HTML is opened directly.

## Assets and fixtures
No external assets or fixtures.

## Conventions
Keep the shipped experience dependency-free and local-only. LOOM state remains under `.loom/`.
