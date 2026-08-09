# Visual Direction

- Kind: experience
- Status: prepared for Keeper

## Experience intent

Create an authored, calm studio-tool aesthetic: a warm neutral work surface with crisp evidence layers,
not a corporate analytics dashboard, cyberpunk terminal, or game-themed novelty UI.

## Visual system

- Warm off-white canvas, charcoal text, muted slate secondary text, and a restrained cobalt action
  accent. Amber communicates uncertain inference; red is reserved for actual input/safety errors, never
  ordinary high-priority work.
- Use a locally available Windows system sans stack for interface text and a monospace stack only for
  commit hashes and source locators. No external fonts or assets.
- One-column reading flow capped near 1100px. Recent changes are compact; candidate cards receive the
  largest visual weight. Avoid dense bento grids, gradients, glass effects, and decorative dashboards.
- Spacing follows a small 4/8px rhythm. Borders and tonal surfaces establish hierarchy; shadows remain
  subtle and never carry state alone.

## Component direction

Candidate cards use a clear rank number, action-type label, action title, two-line rationale, evidence
excerpt, and a quiet unknown line. Accepted state uses a solid accent edge rather than confetti. The
shortfall state occupies one honest explanatory row, not a fake third card. Loading uses stable skeleton
blocks to avoid layout jumps.

## Responsive and accessibility behavior

At 1280px, evidence and reason may share a two-column inner grid; below 800px they stack. At 200% zoom,
the layout remains a single readable column. Contrast targets WCAG AA; focus rings are at least 2px and
visually distinct. Motion is limited to 120–180ms state transitions and disabled under reduced-motion.

## Rejected defaults

No kanban metaphor, percentage-complete rings, streak counters, red urgency everywhere, mascot, remote
images, or “AI glow”. These imply certainty, surveillance, or entertainment that conflicts with a quiet
human decision aid.

## Proof signals

Rendered review at initial, ready, error, accepted, and evidence-shortfall states; keyboard focus is
visible; rank remains clear without color; 1280x720 and 200%-zoom captures preserve the complete decision
flow; no remote asset request appears in browser network logs.

## Related documents and capabilities

Implements `ui-ux.md`; informed by visual art direction and UI/UX design capability dossiers.
