# Evil Eval

Evil Eval asks a hostile question: does LOOM improve real Agent work, or does it merely generate more process
that resembles rigor?

## Core comparison

Each scenario runs two conditions:

- Baseline: a normal capable Agent receives the raw brief and all ordinary tools, but no LOOM.
- LOOM: the same model receives the same raw brief, workspace, tools, user answers, and budget, with LOOM available.

The baseline is not weakened. It may inspect files, browse, ask questions, plan, use memory supplied by the host,
and create any artifacts it normally would. The intended experimental variable is LOOM's protocol and persistent
state, not permission, information, or model quality.

This is the primary causal comparison: **no framework versus LOOM 2**. LOOM 1 may be added as a third regression
condition when we want to know whether the redesign improved on its ancestor, but it cannot replace the no-framework
baseline and does not answer whether LOOM itself adds value.

## Scenario shape

A scenario records:

- the identical raw brief;
- workspace setup and immutable snapshot;
- hidden user facts and a deterministic answer script;
- success criteria that judges can observe;
- context-reset points;
- equal token, time, and tool budgets;
- at least three repetitions per condition.

High-signal scenarios include ambiguous greenfield work, changes to an existing project, multidisciplinary
personalized products, operational command work, and a mid-project user correction that supersedes an earlier
decision.

## The evil parts

1. Force a context reset after clarification and again mid-Task.
2. Include one attractive but wrong implementation assumption.
3. Include a professional domain where generic advice is plausible but harmful.
4. Change one consequential user answer after the first plan is formed.
5. Give both conditions equal access to discoverable repository facts.
6. Penalize unnecessary questions, ceremony, document volume, time, and token cost.
7. Require an implementation attempt or operational transcript; documents alone cannot win.

## Measures

Every score cites observable evidence:

| Measure | What it asks |
|---|---|
| Intent fidelity | Did the result solve the user's actual problem without unauthorized expansion? |
| Question value | Did questions change decisions, and did the Agent avoid asking discoverable facts? |
| Whole-project coverage | Were important behaviors, boundaries, dependencies, and failure paths understood? |
| Capability depth | Did specialist knowledge produce a distinctive project decision rather than a summary? |
| Buildability | Could a fresh Agent select and begin the right work without guessing? |
| Reset continuity | What important truth survived forced context loss? |
| User burden | How much unnecessary explanation, questioning, and framework operation reached the human? |
| Cost and time | Was any quality gain worth its added tokens, latency, and artifacts? |

## Blinding and repetition

Runs are anonymized. A fresh judge receives A and B in randomized order without framework names. The judge scores
both, then receives the order swapped and judges again. Order-sensitive conclusions are marked unstable. Each
condition runs at least three times because a single model trajectory cannot distinguish a system effect from luck.

Anonymization may replace condition labels and framework metadata, but it must preserve each runnable artifact's
internal directory names and relative paths. Before the judge sees a packet, the harness records a source digest/file
manifest and reruns the condition's declared tests and smoke commands from the anonymized location. A missing file or
path failure introduced by copying is a harness failure, not a condition failure; repair the packet and rerun the judge
while preserving the erroneous first judgment as audit evidence.

Human judgment should be used for product taste or domain harm when an automated judge cannot observe it. An LLM
judge may organize evidence but does not become ground truth by being verbose.

## Ablations

If full LOOM wins, run smaller comparisons to find the causal mechanism:

- Task persistence only;
- project whole plus Task persistence;
- capability dossiers without the clarification protocol;
- full LOOM without forced resets.

LOOM should keep only mechanisms whose benefit survives ablation. If the same result comes from a smaller subset,
delete the rest.

## CLI scaffold

Create a scenario description:

```json
{
  "id": "EVAL-001",
  "title": "Ambiguous multidisciplinary build",
  "brief": "Build a calming recovery tool from this repository.",
  "hidden_user_facts": ["The user must retain manual control."],
  "success_criteria": ["A fresh Agent resumes correctly after a forced reset."],
  "context_reset_points": ["after-shaping", "mid-task"],
  "repetitions": 3
}
```

Then run:

```bash
loom eval scaffold --json-file scenario.json
```

LOOM writes a manifest, equalized condition prompts, and a blind judge prompt under `.loom/eval/<scenario>/`.
Launching isolated Agents remains host-specific; do not claim the evaluation ran merely because the scaffold exists.
