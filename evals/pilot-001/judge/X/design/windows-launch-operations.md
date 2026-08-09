# Windows 11 Launch and Operation

- Kind: operations
- Status: prepared for Keeper

## Operational outcome

A user double-clicks `prototype/start-prototype.cmd`, receives a visible readiness/error message, and the
app opens in the default Chromium-based browser without installation or external connectivity.

## Preconditions and authority

Windows 11 and the documented Node major version are required. The script may start the repository's
local Node process, open one loopback browser URL, and create the application state directory under
LocalAppData. It has no authority to execute files or commands from the selected game project.

## Procedure and commands

The script resolves its own absolute prototype directory, checks `node --version`, launches
`src/server.mjs`, waits for a structured readiness line containing the assigned loopback URL, then uses
Windows `Start-Process` to open that exact URL. It keeps a visible console with shutdown guidance; Ctrl+C
stops only the process launched by this script.

Automated smoke command:

`powershell -NoProfile -ExecutionPolicy Bypass -File prototype/scripts/smoke-launch.ps1`

## Safety boundaries

Bind only to `127.0.0.1`, never `0.0.0.0`. Do not elevate, alter execution policy globally, install
packages at launch, mutate PATH, reuse HOME variables, scan processes, or terminate unrelated Node
processes. Browser navigation is limited to the emitted loopback URL. No shell input incorporates
project file content.

## Failure detection and recovery

Missing Node, server early exit, readiness timeout, browser-open failure, and state-directory permission
errors produce distinct messages and nonzero exit. Browser-open failure still prints the safe URL. A
stale state file is recoverable by the app; the launch script does not delete user data automatically.

## Evidence and audit trail

Smoke proof records Node version, loopback address, readiness, successful state round trip, graceful
shutdown, and process exit. Read-only and offline verification runs independently so a successful launch
cannot conceal unsafe behavior.

## Related documents and capabilities

See `application-architecture-contracts.md`, `local-state.md`, and `verification.md`; shaped by software
architecture, application security, and software testing dossiers.
