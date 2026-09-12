# LOOM 2 System Design

Status: implemented core, evaluation pending independent trials.

## Product decision

LOOM is for the Agent, not the human. Its job is to make a normal capable Agent substantially better at
understanding a personalized project, acquiring the right professional judgment, continuing after context
loss, and completing real work. The human experience remains natural conversation.

The system therefore optimizes for four observable outcomes:

1. The Agent can explain the intended whole rather than mirror a feature list.
2. Consequential uncertainty becomes useful conversation instead of silent guessing or a fixed questionnaire.
3. Consequential product, experience, system, contract, and verification decisions remain navigable as
   separate documents rather than collapsing into one summary.
4. Each relevant professional field changes decisions and produces a distinctive project stance without
   being blended into an invented hybrid capability.
5. A fresh Agent can resume the current Task from disk without inherited chat memory.

Document production, role performance, stage completion, and graph density are not success metrics.

## Minimal closed loop

```text
Understand → Clarify → Record → Map professional fields
     ↑                              ↓
     └──── update whole ← Design document graph → Work Map
                            ↑                      ↓
                            └── Keeper gaps ← fresh Keeper
                                                   ↓ passed
                           blocked/reopen ← Active Task → Evidence → next Task
```

### Understand and clarify

The Agent inspects the workspace when the user's request makes it relevant. It describes the emerging
result naturally and identifies the current uncertainty frontier. The frontier contains only decisions
whose answers could materially change outcome, behavior, boundary, system, risk, or completion.

The prompt constrains judgment, not question content. It requires a coherent high-value round, adaptive
grouping, first-principles re-evaluation, and a convergence condition. It does not mandate headings,
question counts, or a universal sequence.

Convergence means the Agent can explain the whole result, its boundaries, the professional capability it
needs, and how completion will be observed. Remaining unknowns must be reversible and local, explicitly
delegated to the Agent, or explicitly skipped by the human after a concrete warning.

### Record

Markdown stores human-readable project truth. JSON stores machine state that people do not need to edit.
Important corrections do not leave contradictory truths scattered through the corpus: PROJECT.md maps the
current whole, `.loom/design/` owns detailed decisions, and DECISIONS.md records consequential supersession
with rationale and impact.

### Design document graph

`PROJECT.md` is an entry point, not a compression target. Product definition, experience, independent
systems, contracts, verification, operations, and research receive separate documents when they have their
own decisions, interfaces, failure modes, or proof. Project size determines document count. This keeps a small
project small while allowing a large system to become fully legible instead of “minimal” in the anemic sense.

### Acquire capability

Capabilities are project-scoped professional-field dossiers, not reusable expert personas or task methods.
One dossier maps to one recognizable field. UI/UX design, visual art direction, game design, psychology,
biology, security, and distributed systems remain separate when they use different evidence or judgments.
Cross-field synthesis lives in the design document whose decision it changes. A dossier contains:

- the field boundary, the decisions it changes, and the project reality grounding it;
- specialist principles, evidence, sources, conflicts, and uncertainty;
- an authored, falsifiable project stance and deliberate refusals;
- questions whose answers could change the decision;
- design and implementation consequences;
- generic failure modes and observable verification signals;
- opened sources, what each changed, conflicts, and uncertainty when research is used.

Acquisition can happen quietly. The Agent may briefly name the capability it is obtaining, but does not
turn research logistics into user workflow.

Scenario authority is explicit. `capability confirm --source human` records a confirmed scenario;
`--source agent` records a provisional, reversible selection when the human is unavailable. Context and
health checks preserve that distinction instead of allowing an Agent assumption to masquerade as user confirmation.

### Work Map and Task

Planning uses progressive resolution. A broad initial Work Map protects whole-project coverage and may be
very long. Only the active horizon receives detailed actions. The context compiler returns counts and the
current Task rather than injecting the whole plan.

Task is the single execution contract:

```json
{
  "id": "TASK-001",
  "title": "Implement restartable context",
  "outcome": "A fresh Agent receives only decision-relevant context",
  "done_when": ["A forced-reset transcript resumes correctly"],
  "boundaries": ["The human never operates LOOM"],
  "depends_on": [],
  "reads": [".loom/PROJECT.md", ".loom/design/context-system.md", ".loom/capabilities/human-agent-interaction.md", "fixtures/reset-case.md"],
  "touches": ["cli/src/context.js"],
  "implements": ".loom/design/context-system.md#Context selection",
  "capability_hooks": [{ "node": "human-agent-interaction#C1", "at": "selecting reset context" }],
  "status": "active",
  "progress": {
    "completed": [],
    "current": "Implementing selector",
    "next": "Run reset transcript"
  },
  "evidence": []
}
```

There is at most one active Task. Completion requires a concrete evidence mapping for every exact `done_when`
criterion. A completed Task can be reopened with a reason when later evidence disproves it. The Task plan may change without
human approval when the change is a reversible implementation refinement inside the agreed whole; outcome,
authority, risk, or material cost changes return to the conversation.

New Tasks must make design and capability applicability explicit: use `implements` and `capability_hooks`, or
record a concrete `design_exemption` / `capability_exemption`. Task start rejects an unclassified active horizon.
Completion verifies that every declared local `touches` path exists, and `loom check` detects later filesystem drift.

### One-time Keeper

Keeper is not a recurring role. It is a single isolation test at the transition from shaping to material
execution. A fresh Agent receives no prior conversation, runs `loom context --keeper`, explains the whole,
selects a first Task, navigates its design documents and professional capabilities, and identifies concrete evidence. Every attempt binds a unique
fresh-thread `run_id` to the digest frozen by `project ready`. A passing record also carries an explicit independent
review attestation (`review.mode`, reviewer identity, and isolation evidence); known self-review cannot be recorded as
passed. This is an auditable host assertion, not cryptographic identity proof. It may return gaps; summary, evidence and exact gaps
are injected into the main Agent's next context. Revision must change project truth or Task definitions before a
new digest and fresh Keeper run are allowed. Once passed, normal Task evidence replaces further Keeper ceremony.

If the host lacks subagents, LOOM supplies a one-sentence prompt for a new window. Explicit skip is possible
but must preserve a concrete reason and reduced confidence.

## Runtime structure

```text
cli/bin/loom.js       small command router
cli/src/store.js      state, design, capability, Task, Keeper, context and eval operations
cli/src/protocol.js   layered Agent prompts and every human-readable template
cli/test/run-all.js   end-to-end contract tests
```

The CLI has six responsibilities:

1. Initialize the minimal project backbone.
2. Record structured understanding and decision history safely.
3. Scaffold a scalable design-document graph and separate professional-field dossiers.
4. Maintain a large Work Map and a single active Task.
5. Compile only decision-relevant context after reset.
6. Adapt clarification to whether a human response channel is actually available.
7. Prepare one-time Keeper and controlled Evil Eval artifacts.

It does not orchestrate models, browse the web, generate project documents, or pretend that a CLI command
clears model memory. Those capabilities belong to the host Agent and its tools.

## State transition

Project status is a compact orientation signal, not a phase bureaucracy:

```text
shaping ⇄ question, design-document, and professional-capability loop
   ↓
ready_for_keeper ⇄ fresh Keeper needs_revision or blocked → shaping
   ↓ passed
build_ready → building ⇄ Task repair or block or reopen → complete
```

`project ready` checks only structural prerequisites: PROJECT.md is no longer a template, at least one design
document and a Work Map exist, and no high-impact open question remains. Keeper judges semantic build-readiness. Task start requires Keeper
pass or an explicit recorded skip. An unchanged revision, duplicate Keeper run, wrong digest, or stale prepared
state is rejected. Imported Tasks start open, `task start` rejects missing or directory-level context reads and
unclassified design/capability applicability, generic updates cannot change status, and completion requires
criterion-by-criterion evidence plus existence of every declared local output.

## Context selection

`loom context` always injects:

- the stable Agent protocol;
- compact state counts and open uncertainty;
- PROJECT.md, with decision history identified as on-demand context;
- the active Task, if one exists;
- the exact design, capability, source, contract, or fixture files named in that Task's `reads` list.

### Environment adaptation and isolated state

The host supplies human-channel availability at context time. With `available` (the default), the Agent may
ask the human for consequential intent, preference, authority, or facts that only they hold. With
`unavailable`, it must not fabricate a user exchange or replace an intent/authority question with web search.
It first inspects discoverable workspace facts and permitted tools, researches only objective external facts when
the task allows it, then records a bounded assumption and chooses a safe reversible action or blocks on
unavailable authority.

`--state-dir <outside-workspace-dir>` places LOOM's state tree in a per-run sidecar rather than the workspace.
This is for benchmark or sandbox runners whose scored workspace must remain pristine. The sidecar remains
semantically `.loom/` to LOOM documents and Task references, but initialization does not edit the workspace
or add an AGENTS.md anchor. Every command in that run must receive the same state directory.

When a Task is active, context also injects a short execution protocol. It tells a reset Agent to reconcile
the Task with the current workspace and version-control state, inspect relevant tests before editing, choose
verification according to risk and the exact `done_when` claims, persist `completed/current/next` at meaningful
handoff boundaries, and close only with reproducible criterion-level evidence. It deliberately does not require
a ceremonial unit test for every kind of work or a branch, commit, or pull request for every Task. Those
delivery mechanisms remain conditional on the human request and repository workflow.

Workspace code paths in `touches` are identified but not automatically copied into context. Full decision
history is not repeatedly injected because current truth belongs in PROJECT.md and linked design documents.
`loom context --keeper` includes history, every design document, and every professional capability dossier
because whole-project coverage and contradiction detection are exactly what the isolated handoff tests.

## Compatibility decision

LOOM 2 is a major redesign. It does not silently mutate `.loom/v1` projects and does not preserve the old command
surface. Encountering a legacy layout produces an explicit migration boundary. Git remains the recovery path;
an automated semantic migration can be designed only after real v1 projects reveal which history is valuable.

## Known boundaries

- External capability acquisition is represented but not automated yet; the host Agent performs research.
- Markdown is intentionally human-editable. LOOM validates file existence and structured state, not prose truth.
- Keeper independence depends on the host creating a fresh thread or window. LOOM requires and records the
  host's independent-review attestation but cannot cryptographically prove Agent identity.
- Evil Eval scaffolding controls experiment design but does not itself launch model runs.
- A one-time Keeper verifies build-readiness, not the eventual quality of every implementation Task.

These are honest capability boundaries, not deferred stages disguised as completion.
