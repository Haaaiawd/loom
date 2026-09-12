# Root review of live-use-001

## Bounded conclusion

The Luna run produced a usable, local-only single-file application and completed LOOM's visible lifecycle. The run also shows that LOOM currently records and reports structural completion more reliably than it enforces the semantic integrity promised by that lifecycle. A healthy final check did not mean that Keeper was independent, capability decisions were activated by Tasks, or every declared output existed.

This is an observational single run, not a causal comparison. It identifies reproducible product defects and evaluation hypotheses; it does not establish the size of LOOM's benefit over an equally capable baseline Agent.

## What worked

- `context --human-channel unavailable` gave a useful first shaping direction and discouraged fabricated user answers.
- The Agent separated product intent, experience, privacy, verification, delivery units, and task evidence.
- The result is a real artifact: `workspace/afterthought.html` opens directly, the static verification passes, and browser evidence shows the flow and local persistence.
- The final state is compact enough for inspection: two Tasks cover four delivery units.

## Integrity breaks

### 1. Keeper independence is asserted but not enforced

Fact: the same Luna Agent shaped the project and authored `workspace/keeper.json`; `loom keeper record` accepted the result and marked Keeper passed. The JSON's self-description as a fresh review was sufficient.

Impact: the one-time handoff can collapse into self-review while the state reports the strongest readiness status. This removes the mechanism that is supposed to expose missing context before execution.

Minimum correction: bind Keeper preparation and recording to a host-issued handoff token or distinct execution identity when the host supports it. Where this cannot be enforced, record the result as `self_reviewed` or `keeper_skipped`, never `passed`.

### 2. Capability activation is optional in practice and invisible when absent

Fact: the project created and confirmed `reflective-ux`, but both completed Tasks have `implements: ""` and `capability_hooks: []`. `loom check` returned healthy with no warnings.

Impact: a capability dossier may become ceremony. The Agent can read or ignore the whole dossier, while the intended chain `capability node -> design decision -> Task hook -> produced evidence` is absent and undetected.

Minimum correction: when confirmed capabilities exist, make Task planning/checking require either concrete `capability_hooks`/`implements` links or an explicit per-Task declaration that no capability node applies. Check that referenced design decisions and required hook outputs exist before a Task can complete.

### 3. Human authority is lost at capability confirmation

Fact: the run declared the human channel unavailable and recorded the scenario as an Agent assumption. `capability confirm` nevertheless changed the dossier status to `confirmed`; the command has no human-channel or provenance parameter and confirmation is unconditional after synthesis.

Impact: disk state overstates certainty and authority. A resumed Agent cannot distinguish human-confirmed professional framing from a reversible Agent hypothesis.

Minimum correction: add `provisional` as a first-class status with provenance (`human`, `agent-assumption`, or imported evidence). Only a human-sourced confirmation should become `confirmed`; context and check should surface provisional dossiers and prevent them from silently satisfying a confirmation gate.

### 4. Healthy completion does not reconcile declared outputs with reality

Fact: TASK-002 declares `tests/verification.txt` in `touches`, and `.loom/STRUCTURE.md` says that file stores verification output. The file does not exist. Both Tasks are done and `loom check` reports healthy with no warnings.

Impact: the Work Map, structure map, and filesystem can disagree without any visible drift signal. A future Agent will follow a nonexistent artifact.

Minimum correction: on Task completion and `loom check`, verify that concrete file paths in `touches` exist (with an explicit exemption for external or deleted outputs), and flag STRUCTURE references that claim required artifacts which are missing.

### 5. First-use discovery still forces source hunting and trial-and-error

Facts from the trace: the first relative CLI invocation failed outside the LOOM repository; capability synthesis rejected a subtly different heading syntax; untouched templates blocked readiness; Task completion required a non-empty top-level `evidence` field in addition to `acceptance_results`. The main help lists commands but does not provide subcommand JSON schemas.

Impact: an Agent has to infer payloads, search repository docs/source, or fail forward. That is exactly the behavior the product is meant to remove from the human-facing collaboration loop.

Minimum correction: add `--example` or real subcommand help that prints canonical JSON for every structured write, and make validation errors include the complete smallest valid payload plus the next command. The generated AGENTS anchor should use an invocation that is valid in the installed environment.

## Crux

If LOOM cannot distinguish a written claim from a satisfied cross-layer invariant, we should not add more mechanisms yet. The next design move should be to define a small set of enforceable integrity invariants and make `context`, transition commands, and `check` expose violations. Otherwise each new feature increases the amount of plausible-looking state an Agent can create without actually using it.

## Recommended next experiment

Implement no broad redesign yet. First create failing end-to-end tests for these four observable cases:

1. a self-recorded Keeper cannot produce `passed`;
2. a Task in a capability-bearing project cannot silently omit activation/provenance;
3. an Agent-selected capability scenario remains provisional;
4. a done Task with a missing concrete `touches` file makes `loom check` unhealthy or explicitly warned.

Then repeat the same Afterthought brief with a fresh Luna Agent. The decisive signal is not fewer documents; it is whether the second Agent reaches the artifact without source hunting and whether the final green state corresponds to the actual integrity chain.
