# Local State and Persistence

- Kind: system
- Status: prepared for Keeper

## Responsibility in the whole

Remember the user's last accepted candidate or explicit skip without copying project content or
creating shared team state.

## State schema

`prototype/contracts/local-state.schema.json` defines versioned state:

`{ schemaVersion, projectLabel, role, outcome: "accepted"|"skipped", candidateSnapshot?, recordedAt }`.

The optional snapshot contains only candidate id/title/action type and evidence locators needed to
explain the prior choice. It excludes raw backlog/Git contents and absolute project paths.

## Location and ownership

The local Node service stores one JSON file beneath
`%LOCALAPPDATA%\IndieStartAssistant\state.json`. It creates only that application directory. Tests
override the root through `INDIE_START_ASSISTANT_DATA_DIR`; production never repurposes HOME variables.

## Interfaces

- `GET /api/state` returns valid state or `{ state: null, warning? }`.
- `PUT /api/state` accepts only contract-valid accepted/skipped outcomes and uses an atomic temp-file
  replace within the application directory.
- `DELETE /api/state` is intentionally absent from the prototype; a new choice supersedes old state.

## Safety and recovery

Requests require the per-launch loopback token. State size is capped at 16 KiB. Corrupt, future-version,
or partially written state is ignored with a recoverable warning; it never blocks project reading.
Absolute project paths, file contents, and arbitrary JSON properties are rejected.

## Verification strategy

Integration tests use a temporary explicit data directory, prove accepted and skipped outcomes survive
service restart, prove corrupt state recovers, and assert no files appear beneath the sample project.

## Related documents and capabilities

See `application-architecture-contracts.md`, `ui-ux.md`, and `verification.md`; shaped by software
architecture, application security, and software testing dossiers.
