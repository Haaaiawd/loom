# LOOM live-use diagnosis

## Facts observed

- The isolated workspace was initialized successfully and all LOOM state stayed under `workspace/.loom`.
- `context --human-channel unavailable` gave a useful shaping recommendation and explicitly prohibited fabricated user interaction.
- The full lifecycle completed: record, design, capability research/synthesis/confirmation, deliverables, task plan, project ready, Keeper record, task start/done, and final check.
- The shipped artifact is `workspace/afterthought.html`; `node tests/verify.mjs` passed with zero network patterns. Browser evidence showed direct `file:///` launch, local draft restoration after reload, and final summary after four stages. A screenshot is present in the workspace.

## Inferences

- LOOM's insistence on separating intent, design surfaces, capability reasoning, deliverables, and acceptance evidence materially reduced the chance of shipping a polished but privacy-incomplete page.
- The unavailable-human pathway is workable for reversible decisions, but it makes capability confirmation semantically odd: the CLI records “confirmed” even though this run used an agent-selected scenario.

## Unknowns this run cannot prove

- One browser/engine and one viewport do not establish cross-browser accessibility or mobile quality.
- The user’s preferred tone and prompts were not validated because the response channel was unavailable.
- LocalStorage behavior can vary under browser privacy settings and `file://` origin partitioning.

## Most important LOOM gaps and minimum fixes

1. Relative CLI examples are hazardous in a fresh external workspace: `node cli/bin/loom.js context` resolves under the workspace and fails. Minimum fix: context-aware help should show an absolute invocation when the CLI is outside the project, or provide a clear `--cli-root`/installed command path.
2. The unavailable-human protocol still allows `capability confirm` to produce a confirmed status from an agent-authored scenario. Minimum fix: support `provisional` confirmation (or require `keeper skip`/explicit assumption) when human confirmation is unavailable, and surface that status in context/check.
3. Generated LOOM templates are not immediately project-ready: `project ready` rejected untouched template instructions in every generated design/capability file, forcing manual replacement; task completion also required an undocumented top-level evidence field. Minimum fix: provide a `loom project scaffold` cleanup/validation hint and include a canonical acceptance evidence example in `--help` or generated files.

