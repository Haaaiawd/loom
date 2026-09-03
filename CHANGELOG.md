# Changelog

## Unreleased

- Added environment-aware clarification through `loom context --human-channel available|unavailable`. Unattended Agents inspect first, research only permitted objective facts, and then use bounded assumptions or blocks rather than fabricating users or substituting web search for intent.
- Added `--state-dir <outside-workspace-dir>` sidecars for isolated benchmark and sandbox runs. Sidecars preserve virtual `.loom/` Task references without mutating the scored workspace or its `AGENTS.md`.
- Added equal human-channel controls and unattended condition prompts to Evil Eval scaffolding.

## 2.1.0

- Added a current-state and recommended-action header to `loom context` output. Agents entering a project or resuming after compression now see project status, active task, work-map counts, and a recommended next action before the full protocol. The recommendation is advisory, not a script.
- Rewrote `AGENTS.md` with explicit LOOM trigger conditions (project entry, context reset, before substantial work, between Tasks) and a standard work rhythm that keeps Agent judgment while making the next step obvious.
- Integrated Crux integrity-chain review into the Keeper handoff. The Keeper now checks that responsible intent, project promises, design and capability decisions, Work Map, executable behavior, and human feedback loop form an intact chain, and looks for omission, substitution, drift, unsupported leaps, blindness, and ownerless gaps.
- Added staged visibility and review guidance to the project template and active-Task execution protocol. Tasks should prefer human-visible acceptance evidence, the Agent should show real working things at milestones, run `loom check` and project tests together before declaring a batch done, and prioritize reaching an exciting surface early to sustain the human's momentum.
- Strengthened capability source validation: `loom capability synthesize` now requires each decision-tree node's `source:` citation to reference a real `.md` file in the dossier's `research/` directory.
- Added `research/_guide.md` generation in `loom capability research` so Agents know what good research material looks like, what to avoid, and how to cite sources.
- Added `.loom/STRUCTURE.md` as a fifth project-truth layer declaring where source code, tests, docs, assets, and configuration files live. `loom check` warns when it is missing or still templated.
- Added `loom decision --json-file` for recording consequential superseding decisions with affected files and tasks. `loom check` warns when a done Task is marked affected by a later decision.
- Added `acceptance[]` as the primary Task completion structure, pairing `criterion`, `verify_by`, and `evidence`. Legacy `done_when[]` remains supported.
- Added Keeper auto-pass: when all Keeper gaps are minor and 3 or fewer, fixing them and running `loom project ready` auto-passes without another Keeper round.
- Added deliverable coverage tracking through `loom deliverable add` and Task `covers` field. `loom check` reports uncovered delivery units.
- Added `loom capability research → synthesize → confirm` lifecycle with status tracking per dossier.
- Updated help text with a typical first-pass flow and capability lifecycle sequence.

## 2.0.1

- Added an active-Task execution protocol that restores workspace-aware coding guidance, risk-based testing, restartable progress, criterion-level proof, and conditional commit/PR boundaries after context resets.
- Strengthened the generated `AGENTS.md` anchor so Agents reload LOOM at project entry, after context loss, and before resumed editing without invoking it before every tool call.

## 2.0.0

- Rebuilt LOOM as invisible Agent infrastructure around project understanding, a scalable design-document graph, separate professional-field dossiers, a broad Work Map, and one active Task.
- Replaced fixed roles and stages with an adaptive clarification protocol and explicit convergence conditions.
- Added human-editable project truth, structured continuity state, and superseding decision history.
- Added context selection that keeps very large Task maps on disk and injects only the active horizon.
- Added seven adaptable design-document templates and `loom prompts` as a complete live prompt inventory.
- Reduced Keeper to one independent build-readiness handoff with revision, changed-digest, fresh-run, and stale-state enforcement.
- Added controlled Evil Eval scaffolding for equal-condition, repeated, reset-heavy blind comparison.
- Added bilingual English/Chinese release documentation and a flat, minimal visual system with editable loop diagrams.
- Deliberately stopped automatic mutation of legacy `.loom/v1` projects.
