# Condition B Shaping Summary

## Result shaped

A Windows 11 local start-of-work assistant for a three-person remote indie game team. A user selects
the sample folder and one fixed current role, sees recent changes and up to three evidence-backed
candidates, then accepts one or skips. The prototype is offline except for its own loopback service,
project-read-only, engine-independent, and remembers only the last decision in its own LocalAppData.

## Consequential correction preserved

The earlier single-file product description and `evidence-grounded-triage` hybrid capability were
superseded. `.loom/DECISIONS.md` records why: project design now lives in independently owned design
documents, while professional capabilities are separate recognizable fields. The valid recommendation
policy was migrated into the recommendation system design; the old capability file was deleted.

## Design document inventory

1. `product.md` — product outcome and scope.
2. `ui-ux.md` — complete two-minute experience and all interaction states.
3. `visual-direction.md` — authored visual system and render behavior.
4. `input-parsing.md` — file formats, provenance, errors, and read-only parsing.
5. `evidence-recommendation.md` — role policy, evidence model, ordering, supplementation, and shortfall.
6. `local-state.md` — minimal state schema, location, privacy, and recovery.
7. `application-architecture-contracts.md` — component split, APIs, repository paths, and schemas.
8. `verification.md` — acceptance matrix, exact commands, negative cases, and known blind spots.
9. `windows-launch-operations.md` — double-click lifecycle, permissions, safety, and recovery.

## Professional capability inventory

- UI and UX design
- Visual art direction
- Cognitive psychology and task resumption
- Indie game production workflow
- Local application software architecture
- Local application security
- Software testing and quality assurance

Each dossier states its own field boundary, project-specific stance, rejected defaults, consequences,
failure modes, proof signals, and handoffs to adjacent fields. No hybrid task-method dossier remains.

## Keeper attempt 1 gaps absorbed

- TASK-001 reads the recommendation/input/architecture/verification designs, five relevant capability
  dossiers, and both sample source files.
- TASK-001 names exact JSON Schema, expected fixture, and Node test paths plus the reproducible command
  `node --test prototype/test/contracts/recommendation-contract.test.mjs`.
- TASK-002 depends on TASK-001, TASK-003 on TASK-002, and TASK-004 on TASK-003.
- Prototype input is consistently one fixed role; free-text daily goals are deferred.
- Candidate policy prefers direct actions, then permits one evidence-linked coordination and one
  evidence-linked clarification supplement with distinct backlog anchors. Remaining shortage is shown
  explicitly; candidates are never padded.

## Work Map

TASK-001 creates executable evidence/recommendation contracts; TASK-002 builds the pure analysis core;
TASK-003 builds the full browser/local-state loop; TASK-004 packages and proves the Windows slice. All
Tasks remain open and none has started.

## Readiness

The revised source CLI reports `healthy: true` with no errors or warnings. `context --task TASK-001`
loads every declared design, professional capability, and both sample inputs; its Task states exact
touches and the first reproducible command.

`loom project ready` reports `ready_for_keeper: true` with digest
`9a1ea0442465b554b6d2af2a571e6c96599576a0fe52a0e88dc4a301f274b471`.

The project is stopped before execution. This document does not perform Keeper review; a new fresh
Keeper run is still required.
