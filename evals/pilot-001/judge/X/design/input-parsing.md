# Project Input Parsing

- Kind: system
- Status: prepared for Keeper

## Responsibility in the whole

Turn two user-selected local files into ordered, provenance-preserving evidence. Parsing reports what
the files say; it does not assign priority or invent task metadata.

## Inputs, outputs, and boundaries

The selected folder must contain `BACKLOG.md` and `GIT_LOG.txt` for the full sample path. The browser
directory picker supplies read-only `File` objects; no arbitrary filesystem path is posted to the local
service. Output is an `EvidenceBundle` conforming to `prototype/contracts/evidence.schema.json`.

## Parsing rules

- `BACKLOG.md`: accept Markdown unordered-list lines matching optional indentation plus `- ` and
  non-empty text. Preserve source line, exact text, and input order. Headers and blank lines are context,
  not work items. Unsupported non-empty prose produces a warning, not a candidate.
- `GIT_LOG.txt`: accept one commit per non-empty line as `<7-40 hex chars><space><message>`. Preserve hash,
  message, line, and file order. No Git command is executed.
- Decode UTF-8 with an explicit recoverable error. Normalize CRLF/LF for parsing but preserve raw text in
  evidence. Stable evidence IDs derive from source type and line, not generated content.

## Data and state

Parsing is pure and holds the current bundle in memory. It does not persist project contents. Warnings
include file, line, code, and human-readable recovery. Only the accepted/skipped selection is persisted
by the separate local-state system.

## Interfaces and dependencies

`parseProjectFiles(files) -> { bundle, warnings }`. Candidate generation consumes the bundle but cannot
read files itself. The UI consumes warnings. Contracts are owned by
`application-architecture-contracts.md` and recommendation semantics by `evidence-recommendation.md`.

## Failure, safety, and recovery

Reject duplicate expected filenames, over-size files above 1 MiB each, unreadable input, or a folder
without `BACKLOG.md`. A missing Git fixture produces a precise recent-changes error; sample acceptance
requires both files. Never evaluate Markdown HTML, resolve links, follow paths, or execute commit text.

## Verification strategy

Golden parsing tests use copies of the supplied sample; mutation tests change an item/hash and require
the evidence output to change. Negative fixtures cover malformed Git lines, empty backlog, duplicate
names, oversized files, CRLF, and hostile Markdown/command-looking text treated as inert text.

## Related documents and capabilities

See `application-architecture-contracts.md`, `evidence-recommendation.md`, and `verification.md`; shaped
by software architecture, application security, and software testing capability dossiers.
