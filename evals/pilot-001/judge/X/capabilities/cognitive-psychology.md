# Cognitive Psychology and Task Resumption

## Field identity and boundary

Cognitive psychology of attention, interruption recovery, prospective memory, and decision load. It
explains how people regain a mental task set; it does not determine game-production priority or visual
style.

## Project decisions this field changes

Why the tool shows recent changes before choices; why candidates are few, comparable, and reasoned;
why previous selection is a cue rather than an automatic command; why current role is selected explicitly;
and why opaque scoring or an open-ended prompt would increase rather than reduce restart effort.

## Project-specific diagnosis

At daily startup the user lacks active context, not necessarily motivation. Useful cues should reconstruct
“what was moving, what remains open, and what can I do in my role.” Commit messages support recognition
but should not capture attention as priority. Three candidates provide manageable comparison only when
each is meaningfully distinct; padding destroys trust and adds decision noise.

## Principles, evidence, and sources

The project applies recognition over recall, context reinstatement, limited choice, externalized
prospective memory, salience proportional to evidence, and user-controlled commitment. No external source
was opened in this iteration; these claims are operationalized as tests rather than presented as measured
effects for this team.

## Distinctive stance and rejected defaults

Restore the smallest sufficient context, then ask for a reversible decision. Show last choice as a memory
cue with timestamp, not an obligation. Reject productivity guilt, streaks, full-project summaries, a chat
box asking users to remember their situation, and confidence percentages that imply calibration we do
not possess.

## Consequences for design, implementation, and verification

`product.md` limits the outcome; `ui-ux.md` uses a linear journey; `evidence-recommendation.md` caps at
three and requires honest shortfall. Usability proof measures whether a user can state the evidence and
make/skip a choice within two minutes, not whether they click the recommended first card.

## Questions that could change the stance

Future observation may show whether recent changes help resumption or distract from open work. The
prototype keeps them secondary so this can be evaluated without conflating recency and priority.

## Failure modes and proof signals

Failure: users reread raw files, cannot distinguish why cards differ, feel forced to accept, or mistake
last choice for today's assignment. Proof: users orient without recall-heavy entry, understand card
differences, change role deliberately, and treat skip as normal.

## Relationships without merger

UI/UX translates cognitive requirements into interaction. Indie game production supplies operationally
meaningful actions. Visual art direction controls salience. None of those fields is reduced to cognition.
