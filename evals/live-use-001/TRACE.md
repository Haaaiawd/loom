# LOOM live-use trace

## 2026-09-12 — startup

- Tried `node cli/bin/loom.js context` from the requested workspace before initialization. It failed because the relative CLI path was resolved under the workspace; this exposed that the help's relative example is easy to misread for a fresh external workspace.
- Created the empty workspace directory, then used the absolute CLI path.
- Ran `loom --help`: it clearly listed the intended lifecycle and the `--human-channel unavailable` escape hatch.
- Ran `loom init`: created the isolated `.loom/` skeleton successfully.
- Ran `loom context --human-channel unavailable`: recommended shaping first; no facts, assumptions, questions, design, capabilities, or tasks existed. This was sufficient to choose the next action.

## Shaping and delivery

- Recorded four brief facts, three bounded assumptions, one low-impact unresolved preference, and two decisions. The first record attempt failed because `apply_patch` placed the JSON beside (not inside) the workspace; copying it into the workspace resolved the path issue.
- Added three design docs and one reflective-UX capability. Capability synthesis initially failed because the CLI parser did not recognize `### C2 — ...`; changing nodes to the documented `### C2: ...` form fixed it. Confirmation accepted the scenario despite unavailable human channel; this is a provisional agent assumption recorded above.
- Added four deliverables and two acceptance-based Tasks. `project ready` first rejected template text in generated docs; replacing those templates with concise project truth enabled Keeper pass.
- Started and completed both Tasks. First completion attempt failed because the CLI requires a non-empty top-level `evidence` array in addition to `acceptance_results[]`; added it and retried successfully.
- Browser check opened the file directly, entered `test persistence`, reloaded, and observed the note restored. Browser eval advanced through all stages to `Your afterthought`; screenshot saved as `screenshot-1789186988395.png`. Static check passed with zero network patterns. Final `loom check` is healthy with no warnings and all 4 deliverables covered.
