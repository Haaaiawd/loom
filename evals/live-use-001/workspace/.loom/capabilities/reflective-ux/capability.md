# Reflective interface design

## Field identity and boundary
Reflective UX design for bounded, non-clinical sense-making tools. It does not provide therapy, diagnosis, or clinical safety guidance.

## Project scenario
A stressed knowledge worker wants a short, optional, non-clinical local reflection immediately after a difficult meeting.

## Decision tree

### C1: Orient before interpretation
- entry_when: The first screen and each prompt are being designed.
- options:
  - A: Bounded explanation and one low-effort observation prompt → leads_to: C2
  - B: Detailed account immediately → leads_to: higher cognitive load
- decide_by: Stress and attention limits in the use context; preserve skip/back.
- source: research/bounded-reflection.md
- counterexample: A calm journaling session may call for an open blank page.
- output: Four optional one-at-a-time stages.

### C2: Mirror agency
- entry_when: Copy, labels, and summary behavior are being chosen.
- options:
  - A: Reflect authored words and ask for a chosen next action → leads_to: C3
  - B: Score, diagnose, or prescribe → leads_to: prohibited boundary
- decide_by: The brief excludes treatment and substitution of judgment.
- source: research/bounded-reflection.md
- counterexample: Accessibility errors may need stronger guidance, but reflection prompts remain optional.
- output: Neutral prompts, no rating, user-selected next step.

### C3: Make local trust observable
- entry_when: Persistence and release verification are being implemented.
- options:
  - A: Inline app with localStorage and clear action → leads_to: release verification
  - B: Remote sync or opaque persistence → leads_to: prohibited boundary
- decide_by: Sensitive notes require explicit local storage and deletion proof.
- source: research/offline-trust.md
- counterexample: Some users may prefer no persistence at all; clear action and disclosure preserve choice.
- output: No network calls, local disclosure, clear control.

## Stance and rejected defaults
Use direct, quiet, non-clinical language and user-authored meaning. Refuse ratings, streaks, diagnoses, urgency, and advice presented as truth.

## Failure signals
The interface feels like an assessment, forces completion, loses notes on refresh, or makes an unsupported privacy promise.

## Relationships without merger
This capability informs first-use-flow and offline-privacy; verification owns proof.
