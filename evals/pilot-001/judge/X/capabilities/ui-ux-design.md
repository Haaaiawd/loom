# UI and UX Design

## Field identity and boundary

Interaction design, information architecture, accessibility, and usability for the two-minute decision
journey. This field owns what users see, understand, and can do; visual mood belongs to visual art
direction, resumption mechanisms to cognitive psychology, and ranking semantics to production workflow.

## Project decisions this field changes

Whether recent changes and recommendations are distinguishable; how evidence, inference, and unknowns
fit on a candidate; how Accept, alternative selection, Skip, errors, shortfall, and restored state remain
usable without dashboard clutter; and how role selection becomes an explicit input rather than hidden
personalization.

## Project-specific diagnosis

The user arrives with low context and wants one decision, not an overview of the entire project. Raw
backlog density would recreate the original burden. Conversely, a single opaque recommendation would
remove agency. The useful middle is a linear flow with a compact context layer and a small comparison
set whose reasons can be inspected in place.

## Principles, evidence, and sources

Project evidence comes from `ANSWERS.md` and sample inputs; no external research was opened in this
iteration. Applied principles are recognition over recall, visible system status, consistent recovery,
progressive disclosure, keyboard access, and not encoding meaning through color alone. These become
explicit checks in `.loom/design/ui-ux.md` rather than generic aspirations.

## Distinctive stance and rejected defaults

Use one guided reading column: select -> understand change -> compare candidates -> decide. Keep evidence
on the card, not behind modal archaeology. Treat Skip and evidence shortfall as valid states. Reject
kanban boards, dashboard metrics, hidden hover evidence, forced choice, chat-first interaction, and a
free-text goal box that the prototype cannot interpret reliably.

## Consequences for design, implementation, and verification

`ui-ux.md` specifies all states and transitions; `visual-direction.md` provides accessible hierarchy.
Candidate contracts must carry everything the UI needs without inventing copy. Verification includes a
two-minute novice flow, keyboard-only completion, 200% zoom, recoverable input errors, and role-change
behavior.

## Questions that could change the stance

None block the prototype. Real user observation could later show whether evidence should expand by
default or whether role selection belongs before folder selection.

## Failure modes and proof signals

Failure: a pretty backlog list, unexplained rank, modal-heavy evidence, dead-end errors, role selector
that changes nothing, or disabled fake third card. Proof: a user can explain why the first candidate is
present, choose another or skip, recover from bad input, and complete the path by keyboard in two minutes.

## Relationships without merger

Visual art direction owns appearance; cognitive psychology owns resumption and cognitive load; indie
game production owns whether recommendations make operational sense. UI/UX integrates their outputs but
does not absorb their expertise.
