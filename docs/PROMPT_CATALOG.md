# LOOM Prompt and Message Catalog

LOOM's prompts are cognitive interfaces, not a collection of role-playing personas. The exact live
inventory is emitted by:

```bash
loom prompts
```

The command is the auditable source of truth. It returns the complete text, placeholders, and composition
order as JSON, so documentation cannot quietly describe a different prompt from the one Agents receive.

## Instruction layers

| Layer | Message | Injected when | Purpose |
|---|---|---|---|
| Stable core | `layers.stable_core` | Every `loom context` | Durable collaboration judgment: user ownership, evidence classes, question threshold, corrections, reversible delegation |
| Runtime adaptation | `layers.runtime_protocol` | Every `loom context` | LOOM-specific disk model, document graph, capability boundaries, Work Map, and three production loops |
| Project state | `layers.project_state` | Every `loom context` | Dynamic status, uncertainty, assumptions, document/capability inventory, Task counts, and Keeper feedback |
| Current task | `layers.current_task` | Active Task or `--task` | Exact Task JSON followed by the exact contents of every path in `reads` |

This separation is deliberate. Project-specific expertise does not inflate the stable prompt; it lives in
field dossiers. One-off Task instructions do not become global doctrine. Host permissions and tools are not
claimed by prompt text.

## Workspace and document messages

`workspace_anchor` is the short block added to `AGENTS.md`. It tells an entering Agent to run `loom context`
and keeps CLI operation invisible to the human.

`templates.project_index` creates `.loom/PROJECT.md` as a concise whole and document map. It explicitly
prevents a large project's systems from being compressed into one file.

`templates.design_documents` contains all seven live design templates:

1. `product` — outcome, users, problem, product principles, scope, end-to-end behavior, success and failure.
2. `experience` — journey, information architecture, states, content, visual direction, accessibility, recovery, usability proof.
3. `system` — responsibilities, boundaries, control flow, data, interfaces, dependencies, failure, implementation, verification.
4. `contract` — consumers, schemas or commands, invariants, permissions, errors, compatibility, fixtures, contract tests.
5. `verification` — claims, environments, fixtures, acceptance matrix, commands, negative tests, blind spots.
6. `operations` — authority, procedures, commands, safety, failure recovery, evidence and audit trail.
7. `research` — decision, evidence, method, sources, findings, conflicts, consequences and follow-up proof.

These are possible document kinds, not a fixed seven-file checklist. The Agent creates as many actual
documents as the project's independent decision surfaces require.

`templates.professional_capability` is the only capability template. It enforces one recognizable field per
file, a project-specific diagnosis and stance, opened evidence, rejected generic defaults, concrete design and
verification consequences, failure modes, and links to adjacent fields without merging them.

`templates.decision_history` is the preamble for consequential superseding decisions. Current truth stays in
the project map and linked design documents.

## Keeper message

`keeper` is the exact independent handoff prompt. It binds a unique fresh-Agent `run_id` to a frozen
`prepared_digest`, asks the Keeper to navigate the whole corpus and attempt the first Task, and defines three
verdicts:

- `passed`: a fresh Agent can responsibly begin.
- `needs_revision`: concrete disk-truth gaps can be repaired.
- `blocked`: progress needs unavailable authority or external state.

A failed result is injected into the next project-state message. A retry requires changed project truth, a
new digest, and another fresh Keeper.

## Evil Eval messages

`evaluation.baseline_condition` gives a normal capable Agent the identical brief and ordinary tools without
LOOM. It does not weaken the baseline or prohibit normal planning.

`evaluation.loom_condition` gives the same brief, model class, tools, workspace facts, and budget, adding only
LOOM continuity infrastructure and no extra authority.

`evaluation.blind_judge` scores anonymized output on intent fidelity, question value, whole coverage,
professional depth, buildability, reset continuity, implementation evidence, human burden, and cost. It
penalizes ceremony and runs an order swap.

## Composition messages

`composition.normal_resume`, `composition.active_task`, and `composition.keeper_handoff` list the exact block
order. Keeper receives every design and capability document; a normal active Task receives only its declared
reads. This difference is intentional: Keeper audits whole-project coverage, while delivery protects context
focus.

## CLI operational messages

`loom --help` is the complete command-oriented message surface. JSON command results report state and the next
host action. Validation errors are contract enforcement rather than cognitive prompts; they reject unsafe
references, template-only readiness, missing design documents, open high-impact uncertainty, unchanged Keeper
retries, stale digests, duplicate run identities, Task dependency violations, missing or directory-level Task
reads, status bypasses, completion without evidence for every done condition, and reasonless reopening of a
disproven completion.

The short human fallback when the host cannot create a Keeper Agent remains:

```text
Please open a new window in this project, run loom keeper prompt, and follow it.
```
