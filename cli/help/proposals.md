# Capability Graph Change Proposals

New user requirements, research findings, and implementation discoveries are candidates, not silent changes to the official Capability Graph or current Intent.

```bash
loom capability proposal submit --json-file ./CGP-NEW-REQUIREMENT.json
loom capability proposal list
loom capability proposal get CGP-NEW-REQUIREMENT
loom capability proposal decide CGP-NEW-REQUIREMENT graph_update --rationale "..."
loom capability proposal close CGP-NEW-REQUIREMENT --resolution-file ./CGP-NEW-REQUIREMENT-resolution.json
```

Each proposal records an origin, provenance (source, observation time, concrete evidence), candidate kind, title and why-now. Candidate kinds are `outcome`, `constraint`, `capability`, `risk`, and `evidence`.

Only Architect decides whether it is already covered, needs a Graph update, changes an Intent or acceptance contract, belongs in Minor/Major, or is rejected. A decision still blocks the loop until a structured resolution closes it; an arbitrary path or prose string is not evidence.

The resolution is decision-specific and is checked against the current version after the decision baseline: `graph_update` names changed Graph nodes (which must carry the proposal ID); `intent_change` names changed Intents; `acceptance_change` names Intents whose acceptance artifact changed; `covered` names the already-effective Graph coverage plus a rationale; and `minor`, `major`, or `reject` references a newly written `03_DECISIONS/` artifact naming the proposal. A `constraint` decided as `graph_update` must additionally appear in the formal Graph `constraints` array with its affected node IDs.

For `covered_by`, use both `covered_by: "NODE-ID"` and a `{ "type": "covered_by", "target": "NODE-ID" }` relationship. The target must be a different, currently covered node with a direct route; chained or self-referential coverage is rejected.

Forge and Keeper may submit candidates but cannot use them to expand their active scope.
