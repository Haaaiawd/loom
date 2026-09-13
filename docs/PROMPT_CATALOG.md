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
| Environment adaptation | `layers.environment_adaptation_available` or `layers.environment_adaptation_unavailable` | Every `loom context` | States whether a human can answer; routes uncertainty through inspection, permitted factual research, clarification, bounded assumption, or block |
| Runtime adaptation | `layers.runtime_protocol` | Every `loom context` | LOOM-specific disk model, document graph, capability boundaries, Work Map, and three production loops |
| Project state | `layers.project_state` | Every `loom context` | Dynamic status, uncertainty, assumptions, document/capability inventory, Task counts, blocked Tasks with reasons and recovery conditions, and Keeper feedback |
| Project state after failure | `layers.project_state_after_keeper_failure` | Keeper `needs_revision`/`blocked` | Prior finding text, the repair expectation, and the `loom project ready` → fresh-Keeper retry contract |
| Keeper review of prior failure | `layers.keeper_review_of_prior_failure` | `--keeper` after a failed attempt | The exact prior findings the fresh Keeper must re-verify before passing |
| Execution protocol | `layers.execution_protocol` | Active Task or `--task` | Recovery, workspace inspection, risk-based testing, progress persistence, exact proof, and delivery boundaries |
| Current task | `layers.current_task` | Active Task or `--task` | Exact Task JSON followed by the exact contents of every path in `reads` |
| On-demand map | `layers.on_demand_map` | Every `loom context` | Pointers to decision history, design documents, capability dossiers, and STRUCTURE.md for lazy loading |
| Keeper context | `layers.keeper_context` | `--keeper` | Full decision history, work-map summary, and every design and capability document for whole-corpus audit |

This separation is deliberate. Project-specific expertise does not inflate the stable prompt; it lives in
field dossiers. One-off Task instructions do not become global doctrine. Host permissions and tools are not
claimed by prompt text.

When the human channel is unavailable, the environment message explicitly forbids fabricated user interaction and
forbids treating web research as a substitute for user intent, preference, or authority. It preserves factual
research when the task and host actually permit it, then requires a reversible assumption or block for what cannot
be learned.

## Workspace and document messages

`workspace_anchor` is the short block added to `AGENTS.md`. It tells an entering or reset Agent to run
`loom context`, rerun it before editing after an interruption, persist state at meaningful boundaries rather
than before every tool call, and keep CLI operation invisible to the human. The anchor is durable-only:
`loom init` never rewrites existing `AGENTS.md` content, and current mechanics always reach the Agent through
`loom context` output rather than through the anchor text.

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

A `passed` verdict must carry independent review provenance (`review.mode: "independent"` plus a
`reviewer_id` and evidence that a separate Agent ran the review). A self-review or an unattested pass is
rejected at record time; a legacy unattested pass blocks `task start` and is an error in `loom check` until
replaced by a fresh review or an explicit `loom keeper skip --reason`.

Findings are cumulative across attempts: a pass must carry `closure_results` with evidence for every gap
still open from earlier rounds, not only the latest attempt's. A changed project digest proves that
something changed — never that findings were resolved. There is no auto-pass.

A failed result is injected into the next project-state message. A retry requires changed project truth, a
new digest, and another fresh Keeper. `loom review --help` describes the staging steps for opening that
fresh Agent without inherited conversation.

## Evil Eval messages

`evaluation.baseline_condition` gives a normal capable Agent the identical brief and ordinary tools without
LOOM. It does not weaken the baseline or prohibit normal planning.

`evaluation.loom_condition` gives the same brief, model class, tools, workspace facts, and budget, adding only
LOOM continuity infrastructure and no extra authority.

`evaluation.unattended_baseline_condition` and `evaluation.unattended_loom_condition` are the same two
conditions when no user response channel exists. The environment fact is equal in both arms; only the LOOM arm
uses `loom context --human-channel unavailable`.

`evaluation.blind_judge` scores anonymized output on intent fidelity, question value, whole coverage,
professional depth, buildability, reset continuity, implementation evidence, human burden, and cost. It
penalizes ceremony and runs an order swap.

## Composition messages

`composition.normal_resume`, `composition.active_task`, and `composition.keeper_handoff` list the exact block
order. Keeper receives every design and capability document; a normal active Task receives only its declared
reads. This difference is intentional: Keeper audits whole-project coverage, while delivery protects context
focus.

The active Task composition adds `execution_protocol` between the recovered project whole and the exact Task.
It requires inspection of current workspace/version-control reality, risk-appropriate tests, restartable
progress, and criterion-level proof. It does not force a unit test for non-code claims or a branch/PR for every
Task; those are selected when the behavior, human request, or repository workflow makes them meaningful.

## CLI operational messages

`loom --help` is the complete command-oriented message surface. `loom review` and `loom review --help` are
the read-only entry points an Agent uses to stage an independent Keeper handoff; `loom keeper --help` covers
`keeper prompt`, `keeper record`, and `keeper skip`. JSON command results report state and the next
host action. Validation errors are contract enforcement rather than cognitive prompts; they reject unsafe
references, template-only readiness, missing design documents, open high-impact uncertainty, unchanged Keeper
retries, stale digests, duplicate run identities, Task dependency violations, missing or directory-level Task
reads, Task references to nonexistent design sections or capability nodes, status bypasses, completion
without evidence for every done condition, silent rewriting of a done Task, and reasonless reopening of a
disproven completion or unmet block.

Warning channels are closable rather than permanent: a decision-affected done Task warns only until it is
reopened and re-completed after the decision, deliverable coverage distinguishes planned from delivered, and
blocked Tasks surface their recovery conditions in `loom context` until reopened with a concrete reason.

The short human fallback when the host cannot create a Keeper Agent remains:

```text
Please open a new window in this project, run loom keeper prompt, and follow it.
```
