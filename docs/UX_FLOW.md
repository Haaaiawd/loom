# LOOM 2 Complete UX and Loop Specification

## Experience promise

The human experiences one capable Agent who understands, asks, decides, builds, and recovers. They do not experience
framework stages, role handoffs, status commands, or document maintenance. LOOM is the Agent's backstage continuity
system.

The system has three nested production loops and one external evaluation loop:

1. Understanding loop — converge on the whole, its design-document graph, and the professional fields it needs.
2. Readiness loop — let a fresh Keeper expose missing context and feed gaps back into understanding.
3. Delivery loop — execute one restartable Task, test, repair or reflow, attach evidence, and continue.
4. Evil Eval — compare the same Agent with no LOOM against the Agent using LOOM under equal conditions.

## Surfaces and responsibilities

| Surface | Human visible | Responsibility |
|---|---:|---|
| Natural conversation | Yes | Desired result, meaningful questions, delegated decisions, risk authority, progress and delivery |
| Workspace and product artifacts | When useful | The real code, files, commands, reports, or operational result |
| PROJECT.md, design docs, capability dossiers | Optional | Human-editable whole, detailed system decisions, and separate professional judgments |
| `loom context` and structured state | No | Agent continuity after compression or a new session |
| Work Map and active Task | Normally no | Broad coverage, current outcome, boundaries, relevant context, progress and evidence |
| Keeper prompt and attempts | Only if a new window is required | One readiness handoff, with revision loops before execution |
| Evil Eval harness | No during normal work | Controlled evidence about whether LOOM itself helps |

## 0. Resume or receive a request

The Agent runs `loom context` when LOOM exists. It then interprets the current request normally. Existing workspace
inspection is conditional: inspect only when the request depends on the existing project, not because LOOM demands a scan.

Human UX: nothing framework-specific appears.

## 1. Form the emerging whole

The Agent explains what it currently believes the finished result should be. This is conversational, not a mandatory
template recital. It is most useful initially, after a consequential correction, and before material execution.

The Agent identifies the current uncertainty frontier: decisions whose answers could materially change outcome,
experience, boundaries, architecture, risk, cost, or proof of completion.

## 2. Ask one dense, adaptive round

The Agent asks all currently visible high-value questions in a coherent round. It may group by a natural decision cluster,
but it does not follow a fixed domain list or question count.

It does not ask facts reliably discoverable from tools, professional decisions it can responsibly make, speculative future
details that do not affect the current whole, or framework questions whose only purpose is filling a schema.

| Human response | Agent behavior |
|---|---|
| Direct answer | Record confirmed fact and update current truth |
| Correction | Update PROJECT.md and affected design docs; append a superseding decision with impact |
| `You decide` | Make the best reversible Agent decision, explain the important tradeoff, and record it |
| `I don't know` | Research or decide when safe; ask again only if the human owns the missing preference or authority |
| `Skip questions and continue` | Name the concrete quality or risk loss, record skipped uncertainty, then proceed |

After every answer round, the Agent re-evaluates the whole. If material uncertainty remains, it loops to another adaptive
round. If only reversible local uncertainty remains, it continues.

### When no human response channel exists

Some unattended, sandboxed, or benchmark runs have no human to answer. The host invokes
`loom context --human-channel unavailable`; this does not create a synthetic user. The Agent first inspects
discoverable workspace facts and permitted tools, researches only objective external facts when the task permits it,
and never treats web research as a substitute for user intent, preference, or authority. It records a bounded
assumption and selects a safe reversible action, or blocks if the missing answer controls irreversible, high-risk,
or materially costly work.

## 3. Build project-specific capability

The Agent maps which established professional fields could change questions, design, implementation, risk, or verification.
It creates one dossier per recognizable field. UI/UX design, visual art direction, game design, psychology, biology, security,
and other fields remain separate when their evidence or judgments differ. Task techniques such as triage, ranking, parsing,
or caching are design mechanisms, not replacements for the capability map. Cross-field synthesis belongs in the affected
design document.

A useful dossier changes action. It contains its field boundary, specialist evidence, a falsifiable project stance,
deliberate refusals, decision-changing questions, implementation consequences, failure modes, verification signals, sources,
and tensions. Generic summaries and expert roleplay fail this step.

Research can be quiet. A natural update is enough: `I need to strengthen the privacy, cognitive-load and information-architecture judgment; I will bring the consequences back into the design.`

## 4. Shape the project corpus and Work Map

PROJECT.md is the concise entry point and map. DECISIONS.md holds only consequential supersession. The actual product,
experience, independent systems, contracts, verification, research, and operations decisions live under `.loom/design/`.
A document is split when its subject has independent responsibilities, interfaces, failure modes, or proof. Document count
therefore scales with project complexity: neither a fixed checklist nor an artificial one-file minimum.

The Agent creates a broad initial Work Map early. It may be thousands of lines because it remains on disk. Only the active
horizon receives detailed actions. Every Task states outcome, done conditions, boundaries, dependencies, relevant reads,
affected paths, progress, next action, and evidence.

## 5. Transition to readiness

Before engineering or other material execution, the Agent tells the human what is about to happen and which important
assumptions remain. Ordinary reversible work does not require another approval. Irreversible, high-risk, or materially costly
action requires explicit authority.

`loom project ready` verifies structural readiness and freezes a digest of the project map, design documents, capability dossiers, and Task
definitions for the next Keeper attempt.

## 6. Keeper readiness loop

A fresh Agent thread runs `loom keeper prompt` and `loom context --keeper`. It receives no prior conversation. Each attempt has
a unique `run_id`, attempt number, and prepared digest.

Keeper tests whether it can explain the whole, navigate every necessary design system, locate distinct professional capabilities, select the correct first Task, find all context,
name the first concrete action, and reproduce completion evidence.

### Passed

A pass requires independent review provenance (`review.mode: "independent"`, reviewer identity, evidence) and
`closure_results` covering every finding still open across all earlier attempts. A changed digest alone never
closes a finding. When no separate Agent is available, the maintainer records an explicit
`loom keeper skip --reason` instead of simulating a pass.

State becomes `build_ready`. Keeper leaves the normal workflow permanently; Task evidence now carries delivery quality.

### Needs revision or blocked

The result records summary, evidence, and exact gaps. State returns to `shaping`. The next `loom context` injects this feedback
as the highest-priority uncertainty.

The main Agent decides where the gap belongs, repairs everything it can, asks the human only for decisions they genuinely own,
changes the relevant disk truth, runs `loom project ready` again, and opens a new Keeper run with a new run_id and digest.

LOOM refuses an unchanged revision, a duplicate run_id, a result for the wrong digest, and a result written before ready.

If the host has no subagents, the human sees one short request: `Please open a new window in this project, run loom keeper prompt, and follow it.`

## 7. Delivery loop

The Agent selects `loom task next`, starts it, and runs `loom context`. Context contains the current whole, current Task, and the
exact design, capability, source, contract, and fixture files in `reads`—not the full Work Map or history.

- A local failure keeps the Task active. Update progress and evidence, repair, and test again.
- A missing permission, dependency, or upper-level contradiction uses `task block` with a reason and recovery conditions. `loom context` surfaces each blocked Task with its reason and recovery conditions until it is resolved.
- After the condition is repaired, use `task reopen --reason` describing how the recovery conditions were met, then start it again. A prior `done` may also be reopened with a concrete reason when its evidence is disproven; a done Task cannot be silently rewritten by `task update`.
- `task done` requires a check quoting every exact `done_when` criterion and mapping it to concrete evidence.
- Generic update cannot modify status, and imported Tasks must begin open.

When a Task is done, the Agent chooses the next dependency-ready Task. When every Task is done, project status becomes complete
and the Agent delivers the real result, evidence, remaining tradeoffs, and any user-owned follow-up.

## 8. Mid-build change

New user information is first evaluated for impact. A local reversible implementation detail updates the active Task. A change
to the desired whole updates PROJECT.md and affected design documents, records a superseding decision, revises affected Task definitions, and blocks or reopens
the active Task as needed. The one-time Keeper does not return after initial build-readiness; implementation evidence and explicit
human authority govern later changes.

## Recovery matrix

| Failure | Recovery |
|---|---|
| Context compressed | `loom context` compiles current truth and active horizon |
| User contradicts earlier answer | Update PROJECT.md and affected design docs; append superseding decision; revise affected Tasks |
| Important answer unavailable | Agent decides reversibly or records open or skipped uncertainty |
| Capability is generic or hybrid | Split into recognizable fields; move synthesis to design docs; add stance, consequences and proof |
| Keeper cannot start | Feedback returns to shaping; change disk truth; new digest and fresh run |
| Project changes after ready | Old Keeper result rejected as stale |
| Same Keeper identity reused | Duplicate run_id rejected |
| Local implementation test fails | Keep Task active, record observation, repair and repeat |
| Dependency or authority missing | Block Task with recovery conditions, then reopen |
| Attempt to mark done without evidence | CLI rejects it |
| Evidence disproves an earlier done state | Reopen with a reason, then repair, re-verify, or block |
| Host cannot spawn Keeper | Ask the human to open a new window with one short prompt |

## Flow diagrams

- [Production loops](loom-production-loop.drawio) — editable Draw.io source; [SVG](loom-production-loop.svg).
- [Evil Eval](loom-eval-loop.drawio) — editable Draw.io source; [SVG](loom-eval-loop.svg).

## Primary evaluation question

The causal baseline is a normal capable Agent with no LOOM—not LOOM v1. Both conditions receive the same raw brief, model,
tools, workspace, human-channel availability, user oracle when one exists, budget, and reset schedule. LOOM v1 may be added as a secondary regression condition, but it does
not answer whether the framework itself creates value over no framework.

For an unattended external benchmark, both conditions receive `human_channel: unavailable` and no fabricated user
oracle. A fresh LOOM sidecar sits outside the scored workspace and is passed through `--state-dir` on every LOOM
command, so framework state cannot alter task files or hidden-test behavior.

The anonymization harness must preserve runnable relative layout, record a file/digest manifest, and rerun each condition's
declared tests and smoke command before judging. Packet-construction failures are eval failures, never evidence against a run.
