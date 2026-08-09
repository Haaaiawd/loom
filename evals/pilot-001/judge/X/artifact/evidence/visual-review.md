# Visual review record

## Environment

- Local Chromium session driven by `agent-browser 0.25.3` against the emitted `127.0.0.1` URL.
- Viewport set to 1280 x 720 before capture.
- No external URL was opened; the session was closed after capture.

## Visually inspected and passed

- `screenshots/idle.png`: the selection step fits the viewport without horizontal overflow; purpose, folder, role, and primary action are visually distinct; native Windows file-picker text is visible.
- `screenshots/programmer.png`: recent changes are visually secondary; all three programmer candidates are readable in a one-column flow; direct/clarify labels, evidence locators, bounded inference, unknowns, Accept, and Skip are visible.
- `screenshots/artist.png`: the role visibly changes to Artist; two direct art candidates and the save-risk coordination candidate are distinct; the coordination badge is not encoded by color alone.

## Not visually verified in this run

- Shortfall, input-error, accepted, and restored screenshots.
- Actual keyboard-only completion and visible-focus traversal.
- Browser zoom at 200 percent.
- Actual double-click browser opening and Ctrl+C behavior of `start-prototype.cmd` (the service/state/shutdown smoke path passed independently).

Automated tests prove the state/service contracts and code paths for shortfall, error, accepted, skipped, and restored behavior, but those tests are not presented as substitutes for the missing visual checks.
