# Visual Art Direction

## Field identity and boundary

Visual design and art direction for the interface's authored character, hierarchy, color, type, and
motion. It does not decide interaction flow, candidate policy, or production priority.

## Project decisions this field changes

How a local indie-team tool feels credible rather than corporate or AI-generated; how uncertainty,
evidence, selection, and error states differ without alarmism; how the candidate layer dominates recent
changes; and how the interface stays coherent with only local assets.

## Project-specific diagnosis

The product sits between a dev utility and a reflective decision aid. Spreadsheet gray would feel like
administration; neon game motifs would trivialize save risk; saturated red priority cards would imply an
unsupported severity model. The right visual temperature is a calm studio workbench with editorial
clarity and restrained state color.

## Principles, evidence, and sources

The direction derives from the user's local/offline constraint and the semantic distinction required by
the recommendation system. No external visual references were opened. Hierarchy uses scale, spacing,
border, label, and position before color. System fonts and CSS shapes keep the prototype offline and
remove asset-loading ambiguity.

## Distinctive stance and rejected defaults

Use warm neutral surfaces, charcoal text, cobalt interaction accent, amber only for inference, and red
only for actual errors. Candidate cards are visually dominant; Git history is quiet. Reject gradients,
glass, glow, gamification, productivity scores, mascot decoration, remote imagery, bento dashboards, and
confetti on selection.

## Consequences for design, implementation, and verification

`visual-direction.md` defines tokens, density, typography, components, responsive stacking, focus, and
reduced motion. UI states need render captures at 1280x720 and 200% zoom. Network checks prove no fonts or
images leave the machine.

## Questions that could change the stance

None block the vertical slice. Brand identity and dark-mode preference would require later evidence and
must not be guessed now.

## Failure modes and proof signals

Failure: a generic admin template, color-only priority, visual urgency unsupported by evidence, or a
beautiful layout that hides source text. Proof: hierarchy survives grayscale; inference remains distinct
from error; focus is visible; candidate evidence is readable at first glance; all visuals render offline.

## Relationships without merger

UI/UX design owns journey and accessibility behavior. Cognitive psychology challenges visual density and
salience. Application security constrains remote assets. This dossier supplies art direction without
deciding those fields.
