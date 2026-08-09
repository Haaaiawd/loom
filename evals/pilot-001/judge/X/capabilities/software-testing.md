# Software Testing and Quality Assurance

## Field identity and boundary

Contract, unit, integration, end-to-end, mutation, negative, and operational testing. This field decides
how claims become reproducible evidence; it does not decide product priority or interface style.

## Project decisions this field changes

How TASK-001 can be complete before the parser exists; how hardcoding is exposed; how candidate-policy
invariants are tested; how persistence survives restart; how read-only/external-offline claims are proven;
and what a Windows double-click smoke test must observe.

## Project-specific diagnosis

The largest false-positive risk is a polished sample demo with hardcoded cards and untested safety claims.
Static sample output is insufficient evidence. Tests must mutate copied input, compare role results,
exercise evidence shortages and hostile lines, snapshot project hashes, restart local state, and inspect
the actual launch process.

## Principles, evidence, and sources

Use contract-first tests, observable behavior over implementation detail, isolated temporary fixtures,
negative cases at boundaries, deterministic inputs, and evidence capture per Task. Project claims come
from `PROJECT.md` and the sample. No external testing source was opened.

## Distinctive stance and rejected defaults

TASK-001 creates JSON Schemas, role expectation fixtures, and a Node built-in contract test. Later tasks
reuse rather than rewrite that oracle. Reject screenshot-only acceptance, tests that edit the original
sample, a single happy path, manual “looks offline” claims, and tests whose commands are not recorded in
the Task.

## Consequences for design, implementation, and verification

`verification.md` owns the acceptance matrix and exact commands. `evidence-recommendation.md` enumerates
policy invariants. Work Map done conditions require zero-exit commands and stored evidence. Temporary
state and copied fixtures make failures reproducible and non-destructive.

## Questions that could change the stance

Browser automation availability may change the E2E harness, but not the required observable states. The
Task can select a local dependency only if it remains offline at runtime and is pinned during implementation.

## Failure modes and proof signals

Failure: tests pass while cards are hardcoded, roles share output, project files mutate, or outbound
requests occur. Proof: mutation-driven failures before implementation, distinct role fixtures, negative
policy cases, before/after hashes, external-request traps, state restart tests, and Windows smoke output.

## Relationships without merger

Each design/capability states claims; testing turns them into evidence. Application security supplies
adversarial cases, UI/UX supplies usability claims, and visual art direction supplies render review.
