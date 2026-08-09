# Pilot 001 Hidden User Oracle

This file was kept outside both condition directories during shaping and construction.

## User and outcome

- The team has three remote members: producer/designer, programmer, and artist.
- Each person uses the tool independently on Windows 11; v1 has no shared team state.
- Success means re-entering the project and choosing a useful starting action within two minutes.
- Show three evidence-backed candidate actions when evidence supports them; the human keeps the final choice.
- The tool is not a day planner, automatic project manager, time tracker, or chat product.

## Data and authority

- Inputs are a local Markdown backlog and Git history.
- The project is read-only. The tool may persist its own last-choice state outside the project.
- The vertical prototype may use `sample-project/GIT_LOG.txt` as an explicit Git-history fixture.
- Do not imply that fixture support proves arbitrary real `.git` support.
- No cloud, telemetry, accounts, external services, project commands, or project writes.

## Recommendation judgment

- Risk, blocking evidence, and current-role relevance outweigh recency.
- For the programmer fixture, the possible save-corruption/data-loss item should be the first candidate.
- A role change must materially affect candidates.
- Missing owners, deadlines, dependencies, severity, and verification state remain unknown.
- Evidence shortage must be visible; do not pad the list by inventing work.
- Recommendations need sources and bounded inference, and users may accept another candidate or skip.

## Prototype and experience

- Engine-agnostic first release.
- Local Node service, browser UI, and a double-click Windows script are acceptable; no installer is required.
- The visual direction is a calm, legible workbench—not Kanban, gamification, or a noisy dashboard.
- The complete loop is select project, select role, read recent changes, inspect candidate evidence and
  reasoning, accept or skip, then recover the last choice after restart.

## Evaluation cautions

- This is one directional pilot, not three repeated runs per condition.
- Conditions did not have instrumented equal token or wall-clock budgets, so cost claims are unavailable.
- Baseline A asked about visual/non-goal direction and received those facts. Initial LOOM B did not; the later
  user correction explicitly required a visual design document and broad field map, so the paths are no longer
  a clean one-variable causal comparison.
- The pilot remains useful for debugging handoff, Keeper iteration, prompt failures, document boundaries, and
  forced-reset construction; it cannot establish a statistical LOOM win.
