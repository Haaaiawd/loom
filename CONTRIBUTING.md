# Contributing to LOOM

LOOM should become simpler when it changes. A contribution is strongest when it preserves the natural
human–Agent conversation, keeps project truth inspectable on disk, and proves its effect without adding
another ritual.

## Before changing code

1. Read [the system design](design.md) and [the UX loop](docs/UX_FLOW.md).
2. Run the current suite and CLI locally:

   ```bash
   npm test
   node cli/bin/loom.js --help
   node cli/bin/loom.js prompts
   ```

3. Keep a change inside one observable problem. If a contract or stored shape changes, update its design,
   prompt, help text, and tests together.

## Pull requests

A useful pull request explains:

- the user or Agent failure it fixes;
- the smallest complete change that fixes it;
- the exact command or artifact that proves the result;
- any compatibility, migration, or unverified boundary.

Prompt changes must remain visible through `loom prompts` and be reflected in
[`docs/PROMPT_CATALOG.md`](docs/PROMPT_CATALOG.md). Changes that claim better quality need a baseline-relative
proof; a nicer-looking output alone is not evidence that LOOM caused the improvement.

## Release checks

Run `npm test` and `npm pack --dry-run` before requesting release. See the
[release checklist](docs/RELEASE_CHECKLIST.md) for the maintainer flow.
