# Vertical Slice Verification

- Kind: verification
- Status: prepared for Keeper

## Claims under test

The prototype reads sample evidence rather than hardcoding it; separates recent change from priority;
produces deterministic role-sensitive candidates; labels coordination/clarification and shortfall;
persists accepted/skipped outcomes; remains project-read-only and externally offline; and launches by
double click on Windows 11.

## Environments and fixtures

Primary environment is Windows 11 with the project Node version and Chromium Edge. The source fixture is
`sample-project`; tests copy it to an explicit temporary directory before mutation. Test state uses an
explicit temporary `INDIE_START_ASSISTANT_DATA_DIR`. Tests never edit the original sample.

## Acceptance matrix

| Claim | Proof |
| --- | --- |
| Contract is restartable | Contract test loads schemas and programmer/artist expected fixtures |
| Parser is real | Copied backlog/log mutations change output and provenance |
| Role matters | Programmer and artist candidate anchors/action types differ |
| Risk is bounded | Save corruption ranks first for programmer; data loss remains inference |
| No padding | Distinct anchors, valid supplement labels, and explicit shortfall case |
| Human authority | Accept any candidate and skip paths both persist |
| Read-only/offline | Before/after project hashes match; external-request trap records zero |
| Local persistence | Restart restores valid choice; corrupt state recovers |
| Windows operation | Double-click smoke starts, becomes ready, opens loopback, and shuts down |
| Usability/visual | Two-minute, keyboard, 200% zoom, and state screenshots reviewed |

## Commands and evidence

- `node --test prototype/test/contracts/recommendation-contract.test.mjs`
- `node --test prototype/test/unit/*.test.mjs`
- `node --test prototype/test/integration/*.test.mjs`
- `node prototype/scripts/verify-readonly.mjs sample-project`
- `node prototype/scripts/verify-offline.mjs`
- `powershell -NoProfile -ExecutionPolicy Bypass -File prototype/scripts/smoke-launch.ps1`
- `npm test --prefix prototype` aggregates non-interactive checks.

Each command must exit zero and its output is recorded in Task evidence. Visual review stores local
screenshots for idle, ready/programmer, ready/artist, shortfall, error, accepted, and restored states.

## Negative and failure tests

Malformed/oversized/missing files, command-looking input, invalid role, duplicate anchors, fewer than
three sources, corrupt/future state, hostile API origin/Host, unavailable Node, and attempted outbound
request all have explicit expected errors. Project hashes must remain identical even when tests fail.

## Known blind spots

The prototype does not prove real `.git` support, browsers other than Chromium Edge, multiuser state,
arbitrary Markdown conventions, or installed-app lifecycle. These must not appear in delivery claims.

## Related documents and capabilities

Verifies every design document; shaped by software testing, application security, UI/UX design, and
visual art direction dossiers.
