# Daily Start Assistant Product Definition

- Kind: product
- Status: prepared for Keeper

## Outcome and users

The product helps one member of a three-person remote indie game team resume useful work without first
reconstructing the whole project. The user is acting as producer/designer, programmer, or artist on a
Windows 11 machine. Within two minutes the user should understand what changed, why up to three actions
deserve attention, and retain authority to choose or skip.

## Problem and operating reality

Small teams leave context across terse backlogs and commits. Those traces mix disciplines and omit
owners, dates, dependencies, and severity. A universal ranking is therefore dishonest, while a plain
list does not reduce restart cost. The product must turn sparse evidence into bounded, role-aware
suggestions without pretending to know the entire production plan.

## Product principles

1. Evidence before recommendation: every candidate cites an open backlog item.
2. Resume, do not manage: restore enough context for the next decision, not a complete schedule.
3. Human final authority: accept, choose another, or skip are equally valid outcomes.
4. Risk and blockers outrank recency; current role constrains actionability.
5. Unknown stays unknown. Inference is labelled and never promoted to fact through confident copy.
6. Safety is product behavior: project data remains local and read-only.

## Scope and non-goals

The prototype supports the supplied `BACKLOG.md` and `GIT_LOG.txt`, three fixed roles, recent-change
presentation, up to three candidates, accept/skip, and last-choice persistence. It does not support
free-text goals, collaboration, external trackers, real `.git` parsing, engines, project mutation,
automatic work assignment, full planning, or installation.

## End-to-end behavior

Launch -> project-folder selection -> role selection -> safe parse -> recent changes -> candidate set ->
accept or skip -> local confirmation -> restart restores the last outcome. Invalid or incomplete inputs
lead to actionable recovery, not an empty dashboard.

## Success and failure signals

Success is the complete sample flow in under two minutes with understandable reasons, role variation,
and no unsafe side effects. It fails if users must inspect raw files to understand a reason, believe a
prediction is fact, cannot skip, or see three cards produced merely to fill space.

## Decisions and open questions

The prototype requires fixed role selection. A future iteration may test a free-text daily goal, but it
must not be inferred now. Candidate count is a target maximum: evidence-linked coordination or
clarification may supplement direct actions; if that still cannot support three, the product shows the
shortfall explicitly. There are no open product questions blocking the vertical slice.

## Related documents and capabilities

See `ui-ux.md`, `evidence-recommendation.md`, `verification.md`; informed by UI/UX design, cognitive
psychology, and indie game production capability dossiers.
