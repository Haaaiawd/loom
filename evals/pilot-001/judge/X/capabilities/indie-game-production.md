# Indie Game Production Workflow

## Field identity and boundary

Small-team game production: cross-disciplinary planning, build risk, role handoffs, content/code
coordination, and pragmatic prioritization. It does not own UI interaction, security, or parser design.

## Project decisions this field changes

How programmer, producer/designer, and artist relevance is interpreted; why potential save corruption
outranks polish for a programmer; how unresolved design decisions become clarification rather than
implementation; how cross-role high-risk items become coordination actions; and why commits represent
recent activity rather than unfinished work.

## Project-specific diagnosis

The sample mixes a camera defect, tutorial sequencing decision, ambience replacement, possible save
corruption, and playtest marketing art. There is no milestone, owner, severity, or dependency data. A
global “top task” would therefore be theater. The tool can responsibly identify risk and role fit, then
make the handoff type explicit.

## Principles, evidence, and sources

Opened project sources are `sample-project/BACKLOG.md`, `sample-project/GIT_LOG.txt`, and `ANSWERS.md`.
They show distinct disciplines and sparse metadata. Applied production principles are protect player
data/build integrity, distinguish decisions from execution, surface blockers, respect role handoffs, and
avoid treating activity as value. No external research was used.

## Distinctive stance and rejected defaults

For programmers, investigate possible corruption first; camera repair is directly actionable; tutorial
order needs design clarification. For artists, ambience and capsule images are direct; save-risk ownership
can be coordinated but is not disguised as art work. Reject universal keyword scores, automatic owners,
deadlines inferred from “next playtest,” and commit-frequency ranking.

## Consequences for design, implementation, and verification

`evidence-recommendation.md` separates direct, coordination, and clarification, requires distinct backlog
anchors, and bounds inference. Fixtures must prove role-specific changes and the programmer-first risk
case. UI copy says “coordinate” or “clarify” rather than flattening every card into “do.”

## Questions that could change the stance

Real milestones, owners, build status, or verified severity would materially change ranking, but these
sources are deliberately outside the prototype. Their absence remains visible rather than guessed.

## Failure modes and proof signals

Failure: artists receive three programming tasks, tutorial uncertainty becomes a coding order, completed
commits reappear as work, or playtest art receives an invented deadline. Proof: action types match actual
handoffs, source text is cited, roles differ, and absent production metadata is marked unknown.

## Relationships without merger

Cognitive psychology governs how many choices users can compare; UI/UX presents handoff types; software
testing proves policy invariants. Production workflow owns whether the actions are credible in a game team.
