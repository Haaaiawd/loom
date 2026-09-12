# Afterthought project whole

## Intended result
Afterthought is a dependency-free, double-clickable single-page reflection tool for the three minutes after a high-pressure meeting.

## People and operating reality
One person uses it privately on their own device immediately after a difficult meeting.

## Whole experience or behavior
The user starts a bounded four-stage flow, writes optional observations in their own words, chooses one next step, and receives a faithful local summary. Refresh preserves the draft; Clear local note deletes it.

## Boundaries and consequential assumptions
No diagnosis, therapy claims, user judgment, cloud sync, analytics, external dependencies, or network requests. Human channel is unavailable; visual/copy choices are reversible agent assumptions.

## Design document map
- `.loom/design/first-use-flow.md`: experience and tone.
- `.loom/design/offline-privacy.md`: local storage contract.
- `.loom/design/verification.md`: proof strategy.

## Professional capability map
- `.loom/capabilities/reflective-ux/capability.md`: agency-preserving prompts and local trust decisions.

## Project structure
See `.loom/STRUCTURE.md`; `afterthought.html` is the root artifact and `tests/` holds checks.

## Work map
See `.loom/tasks.json`; two tasks cover the four delivery units.

## Completion and failure
Success is a double-click launch, complete flow, persistence/clear behavior, no network dependency, and documented verification. A polished page that loses notes or calls a remote asset is a failure.
