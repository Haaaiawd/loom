# Evidence and Recommendation System

- Kind: system and decision synthesis
- Status: prepared for Keeper

## Responsibility in the whole

Convert a parsed evidence bundle and one required fixed role into at most three defensible next-action
candidates. This document owns the cross-domain synthesis formerly misplaced in the hybrid capability.

## Role scope

The prototype accepts exactly `producer_designer`, `programmer`, or `artist`. It does not interpret a
free-text daily goal. Role mappings are broad relevance rules, not claims about assignment or ownership.

## Evidence and candidate contract

An evidence item preserves `id`, `sourceType`, `locator`, `rawText`, and parsed kind. A candidate preserves
`id`, `actionType` (`direct`, `coordination`, `clarification`), `title`, `role`, distinct `evidenceRefs`,
reason entries classified as `source_fact` or `bounded_inference`, `unknowns`, and its ordering reasons.
CandidateSet contains role, recent changes, zero-to-three candidates, and optional `shortfall`.

JSON Schema artifacts are created by TASK-001 at:

- `prototype/contracts/evidence.schema.json`
- `prototype/contracts/recommendation.schema.json`

Executable sample expectations are:

- `prototype/test/fixtures/programmer.expected.json`
- `prototype/test/fixtures/artist.expected.json`
- `prototype/test/contracts/recommendation-contract.test.mjs`

## Candidate policy

1. Only open backlog items can anchor a candidate. Commits report recent changes and can contextualize a
   backlog item, but never become unfinished work by themselves.
2. Prefer `direct` items plausibly actionable by the selected role.
3. Within the same actionability class, textual evidence of potential irreversible loss or a blocker
   outranks routine polish. Recency only breaks an otherwise supported tie.
4. Never infer owner, deadline, verified severity, dependency, or completion state.
5. Each candidate must use a different anchor backlog item; paraphrases of one item do not fill slots.

## Evidence-linked supplementation without padding

If fewer than three direct candidates exist:

1. Add at most one `coordination` candidate anchored to a different cross-role risk or blocker. Its title
   must describe a concrete coordination action such as confirming ownership/status; it cannot relabel
   the underlying specialist work as executable by the current role.
2. Then add at most one `clarification` candidate anchored to a different item whose source explicitly
   says decide, investigate, placeholder, or otherwise exposes missing information. The reason states
   what must be clarified; it does not invent the answer.
3. If fewer than three distinct supported anchors remain, return fewer than three plus
   `shortfall: { code: "insufficient_distinct_evidence", missingCount, explanation }`.

For the sample artist role, ambience replacement and capsule images are direct candidates; confirming
ownership/status of the save-corruption risk is a labelled coordination candidate. For the programmer,
save-corruption investigation and camera-jitter repair are direct; the tutorial-order item can become a
labelled clarification/coordination action, not an invented implementation task.

## Ordering and explanation

No opaque numeric score is exposed. Order reasons are an ordered list: role actionability, explicit
risk/blocker evidence, action type, then weak recency context. The programmer's first sample candidate
is save-corruption investigation because the backlog explicitly reports corruption after force-close;
“may cause player data loss” is displayed as bounded inference, not confirmed outcome.

## Failure, safety, and recovery

If role is absent/invalid, candidate generation returns a typed error. Empty backlog produces no
candidates and an evidence-shortfall state. Candidate generation is deterministic for the same bundle
and role. No model, network, clock, or random input participates.

## Verification strategy

Contract tests assert schema, distinct anchors, permitted action types, programmer-first behavior,
artist supplementation labels, no invented owner/deadline/severity, shortfall behavior, and separation
of recent commits from open actions. Exact command:

`node --test prototype/test/contracts/recommendation-contract.test.mjs`

## Related documents and capabilities

Consumes `input-parsing.md`; feeds `ui-ux.md`; contracts live in
`application-architecture-contracts.md`. Synthesis is shaped separately by cognitive psychology, indie
game production, UI/UX design, application security, and software testing dossiers.
