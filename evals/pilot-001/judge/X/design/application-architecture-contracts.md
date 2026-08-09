# Local Application Architecture and Contracts

- Kind: system and contract
- Status: prepared for Keeper

## Responsibility in the whole

Define a small, deterministic browser application served by a local Node process, with project files
read by the browser and only selection state handled by the service.

## Components and control flow

1. `prototype/start-prototype.cmd` launches `prototype/src/server.mjs`.
2. The server binds only `127.0.0.1` on an OS-assigned port, creates a per-launch token, serves static
   assets, and opens the exact local URL in the default browser.
3. The browser uses `<input type="file" webkitdirectory multiple>` to receive read-only File objects.
4. Pure modules parse inputs and generate deterministic role candidates in browser memory.
5. The browser sends only accepted/skipped local state to the loopback state API.

No endpoint accepts an arbitrary project path; the server never traverses the selected project.

## Repository layout and owned contracts

- `prototype/src/core/` — parser and recommendation modules.
- `prototype/src/ui/` — HTML/CSS/client controller.
- `prototype/src/server.mjs` and `prototype/src/state/` — static/loopback service and persistence.
- `prototype/contracts/evidence.schema.json`
- `prototype/contracts/recommendation.schema.json`
- `prototype/contracts/local-state.schema.json`
- `prototype/test/contracts/`, `unit/`, `integration/`, `e2e/`, and `fixtures/`.
- `prototype/scripts/` — deterministic safety and Windows smoke checks.

Contract objects use JSON-compatible values, reject unknown top-level fields, carry `schemaVersion: 1`,
and return typed errors `{ code, message, source?, line? }`. UI copy may translate messages but cannot
discard codes or provenance.

## Loopback API and permissions

Only `/`, static assets, `GET /api/state`, and `PUT /api/state` exist. State writes require the launch
token in a header and `Content-Type: application/json`. CORS is disabled, Host must be loopback, body
size is capped, and the server makes no outbound requests. Shutdown closes the listener cleanly.

## Errors and compatibility

Unsupported browsers receive a clear Chromium/Edge requirement before folder selection. Port conflicts
are avoided by port 0. Missing Node produces a launch-script message and nonzero exit. Contracts are
versioned; unknown versions fail closed with recovery guidance.

## Contract tests

TASK-001 establishes JSON Schemas, expected role fixtures, and a Node built-in test harness. Exact first
proof command:

`node --test prototype/test/contracts/recommendation-contract.test.mjs`

Later aggregate command: `npm test --prefix prototype`.

## Related documents and capabilities

See `input-parsing.md`, `evidence-recommendation.md`, `local-state.md`, and
`windows-launch-operations.md`; shaped by software architecture, application security, and software
testing dossiers.
