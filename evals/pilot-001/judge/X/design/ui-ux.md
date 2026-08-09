# Two-Minute UI and UX

- Kind: experience
- Status: prepared for Keeper

## Experience intent

The interface should feel like reopening a clear workbench, not receiving an automated performance
judgment. It reduces reorientation effort while keeping evidence and user agency visible.

## Users and contexts

Producer/designer, programmer, and artist use the same app separately, often after an interruption or
at the start of a remote workday. The prototype assumes Windows 11 with a Chromium-based browser at
1280x720 or larger, keyboard/mouse input, and no prior setup beyond Node and the launch script.

## Journey and information architecture

1. **Start:** concise purpose, folder picker, fixed role control, primary “Read project” action.
2. **Review:** project name and parse status; “Recent changes” in a compact secondary section.
3. **Decide:** up to three candidate cards ordered by relevance; each shows action-type badge, title,
   reason, quoted evidence locator, inference/unknown note, and Accept.
4. **Exit state:** accepted candidate summary or explicit “Skipped for now”; both allow changing role or
   choosing another folder.
5. **Return:** a small prior-choice banner states what was selected or skipped and when; it does not
   automatically reselect work.

## Interaction states and transitions

- `idle -> reading -> ready | input_error`.
- `ready -> accepted | skipped`; either can return to `ready` without losing parsed input.
- Role change recomputes candidates and resets any unconfirmed selection.
- Folder change clears parsed data before reading the new files.
- Loading prevents duplicate submissions but never blocks Skip after results exist.

The prototype requires `producer_designer`, `programmer`, or `artist`. It does not show a free-text
today-goal field.

## Content, visual, and accessibility direction

Use direct language: “Source fact”, “Possible impact”, “Unknown”, “Coordinate”, and “Clarify”. Never use
“AI says”, certainty theater, gamified streaks, or productivity scores. Candidate order is explained in
one sentence. Keyboard order follows the journey; controls have visible focus; meaning is not carried by
color alone; evidence remains selectable text; minimum target size is 40px and body copy 16px.

## Errors, empty states, and recovery

- Missing `BACKLOG.md`: explain that candidates cannot be made and how to select a compatible folder.
- Missing `GIT_LOG.txt`: allow backlog candidates but show recent changes unavailable only if the input
  contract permits degraded mode; for the sample acceptance path both files are required.
- Malformed lines: show file, line, and ignored content without crashing.
- Fewer than three defensible candidates: show only supported cards plus “Not enough distinct evidence
  for another candidate.” Do not create disabled fake cards.
- Corrupt saved state: ignore it, explain that prior choice could not be restored, and continue.

## Usability verification

From launch, a first-time user can select the sample folder, choose a role, explain the top candidate's
source, and accept or skip within two minutes. Programmer and artist journeys visibly differ. A keyboard-
only pass reaches every control. At 200% zoom the main journey remains usable without horizontal scroll.

## Related documents and capabilities

See `product.md`, `visual-direction.md`, `evidence-recommendation.md`, and `local-state.md`; shaped by
UI/UX design, visual art direction, cognitive psychology, and indie game production dossiers.
