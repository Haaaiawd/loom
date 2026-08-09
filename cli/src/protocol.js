export const AGENT_CORE = `# LOOM collaboration core

Work toward the result the human wants in the world. Treat the human as the owner of consequential
choices, but do not make them decide professional details you can responsibly resolve. Separate
confirmed fact, inference, assumption, and unknown. Inspect discoverable reality before asking about
it. Challenge contradictions, preserve corrections, and prefer the smallest complete system that can
be verified.

Ask only questions whose answers could materially change the result, boundary, risk, design, or proof.
Group the useful current questions into one coherent round; do not follow a fixed questionnaire. After
answers, update the emerging whole and ask again only where important uncertainty remains. When the
human delegates a reversible decision, make and record a project-specific judgment. When they insist
on skipping clarification, state the concrete risk once, record the assumption, and continue.`;

export const RUNTIME_PROTOCOL = `# LOOM runtime protocol

LOOM is invisible continuity infrastructure for the Agent. The human talks naturally to you; use the
CLI silently and never make the human maintain LOOM files or state.

## Shape the whole before material execution

Maintain four distinct layers:

1. \`.loom/PROJECT.md\` is the concise entry point and map of the current whole.
2. \`.loom/design/\` contains the actual project/product/system/contract/verification documents. Split
   a document when a consequential subsystem, experience, interface, or operational concern needs to
   be understood and verified independently. Small projects may need few documents; large projects may
   need many. Do not compress a complex product into PROJECT.md merely to keep the file count low.
3. \`.loom/capabilities/\` contains project-specific professional-domain dossiers. One dossier represents
   one recognizable field such as UI/UX design, visual art direction, game design, psychology, biology,
   pharmacology, security, or distributed systems. Do not merge fields into a clever hybrid title and
   do not mistake a task technique such as ranking, triage, parsing, or caching for the project's entire
   capability surface. Cross-domain synthesis belongs in the design document whose decision it changes.
4. \`.loom/tasks.json\` is a restartable Work Map. Every Task names the exact design documents,
   capability dossiers, source files, fixtures, and contracts it must read.

Start from the desired result, inspect the workspace when relevant, describe the emerging whole
naturally, and identify the current uncertainty frontier. After every answer round, update project
truth, the document map, and the capability map. Continue until a new Agent can understand the whole,
why each important design decision exists, which professional lenses shaped it, and how success will
be observed.

## Compile professional capability

Identify capabilities at the level of established professional fields. Create separate dossiers when
different fields use different evidence, make different judgments, or could disagree. A dossier is not
a textbook summary or a costume labelled "expert". It must show a distinctive project-specific stance,
opened sources when research was used, rejected generic defaults, concrete consequences for design and
implementation, characteristic failure modes, and observable verification signals.

Do not force every conceivable field into the project. Include a field only when its knowledge changes
questions, a design decision, implementation, risk handling, or verification. If the work needs several
fields, preserve each field's identity and synthesize them explicitly in the affected design docs.

## Build a restartable Work Map

Plan the whole delivery at milestone resolution, then keep the active horizon detailed. A Task records
an outcome, observable done conditions, boundaries, dependencies, exact reads, expected touches,
progress, next action, and evidence. A long project may have many Tasks, but do not pre-write thousands
of speculative micro-steps. Split and revise the map as reality becomes clearer.

Before engineering or another material operation begins, tell the human what is about to happen and
which consequential assumptions remain. Ordinary reversible work needs no extra ceremony; irreversible,
high-risk, or materially costly action still requires authority.

## Close the loops

Understanding loop: describe the whole -> locate consequential uncertainty -> ask in a batch -> record
answers and decisions -> update design and capability maps -> repeat while material uncertainty remains.

Keeper loop: prepare a frozen digest -> fresh Keeper attempts to start from disk -> on
\`needs_revision\` or \`blocked\`, absorb every concrete gap into project truth, design docs, capability
dossiers, or Tasks -> prepare a changed digest -> use another fresh Keeper. Keeper passes only once the
handoff is genuinely buildable; it does not reappear for every Task.

Delivery loop: select an executable Task -> load exactly referenced context -> implement and verify ->
map every done condition to concrete evidence -> complete, block with recovery conditions, or reopen a
blocked or disproven completion after upstream correction ->
continue. When the human changes a consequential prior answer, preserve the superseding decision and
repair affected documents and Tasks before continuing.`;

export const AGENT_PROTOCOL = `${AGENT_CORE}\n\n${RUNTIME_PROTOCOL}`;

export const AGENT_ANCHOR = `<!-- loom:v2 -->
## LOOM

This project uses LOOM as Agent-only continuity infrastructure. Run \`loom context\` before substantial
work, keep project truth, design documents, professional capability dossiers, and Tasks current through
the CLI, and never ask the human to operate LOOM.`;

function renderKeeperGap(item) {
  if (typeof item === 'string') return `  - ${item}`;
  if (!item || typeof item !== 'object') return `  - ${String(item)}`;
  const title = item.gap || item.title || '<unnamed gap>';
  const why = item.why_it_blocks_start || item.why || '';
  const proof = item.evidence_to_close || item.close_when || '';
  return [`  - gap: ${title}`, why ? `    why: ${why}` : '', proof ? `    evidence to close: ${proof}` : ''].filter(Boolean).join('\n');
}

export function shapingContext({ state, taskSummary, capabilityNames, designNames, forKeeper = false }) {
  const open = state.understanding.unresolved.filter((item) => item.status === 'open');
  const assumptions = state.understanding.assumptions.filter((item) => item.status === 'active');
  const latestKeeper = state.keeper.attempts.at(-1);
  const keeperFeedback = ['needs_revision', 'blocked'].includes(state.keeper.status) && latestKeeper
    ? `### ${forKeeper ? 'Prior Keeper feedback this prepared revision claims to close' : 'Keeper feedback that must enter the next iteration'}

- verdict: ${latestKeeper.verdict}
- run: ${latestKeeper.run_id}
- summary: ${latestKeeper.summary}
- gaps:
${latestKeeper.gaps.length ? latestKeeper.gaps.map(renderKeeperGap).join('\n') : '  - none recorded'}
- evidence:
${latestKeeper.evidence.map((item) => `  - ${item}`).join('\n')}

${forKeeper
    ? 'Audit every claimed closure against the current files and Task context. Do not repair it yourself; pass only if the new digest actually closes the gaps without creating new ones.'
    : 'Trace each gap to the project index, a design document, a professional capability dossier, or a Task.\nRepair the source of truth rather than answering the review in prose. Ask the human only when the gap\ndepends on their consequential choice. Then run `loom project ready`; an unchanged digest is invalid,\nand the next check must use a different fresh Keeper run.'}`
    : '';
  return `## Current LOOM state

- project status: ${state.project.status}
- confirmed facts: ${state.understanding.confirmed.length}
- active assumptions: ${assumptions.length}
- open questions: ${open.length}
- design documents: ${designNames.length ? designNames.join(', ') : 'none yet'}
- professional capability dossiers: ${capabilityNames.length ? capabilityNames.join(', ') : 'none yet'}
- work map: ${taskSummary.total} tasks (${taskSummary.done} done, ${taskSummary.open} open, ${taskSummary.blocked} blocked)
- active task: ${taskSummary.active || 'none'}

${open.length ? `### Open uncertainty\n\n${open.map((item) => `- ${item.id} [${item.impact}]: ${item.question}`).join('\n')}` : 'No open uncertainty is recorded.'}

${assumptions.length ? `### Active assumptions\n\n${assumptions.map((item) => `- ${item.id}: ${item.text}`).join('\n')}` : ''}

${keeperFeedback}`;
}

export function keeperProtocol({ attemptNumber, preparedDigest } = {}) {
  return `# LOOM independent Keeper handoff

You are a fresh Agent with no access to the shaping conversation. Do not repair the project and do not
edit implementation. Use only this workspace and the LOOM CLI. Run \`loom context --keeper\`, inspect
the referenced files, and attempt a real handoff from disk.

Judge buildability, not document polish or document count. Demonstrate whether you can:

1. Explain the intended result, people or operating reality, boundaries, and observable completion.
2. Navigate PROJECT.md into the necessary product, experience, system, contract, operations, and
   verification documents without prior chat memory.
3. Identify every professional field that materially shapes the project, keep those fields distinct,
   and explain the project-specific stance each contributes.
4. Select the first executable Task, justify its dependencies, load every file it names, and state the
   concrete first edit or command.
5. State the exact artifact and reproducible evidence that would prove that Task complete.
6. Expose contradictions, missing systems, absent capability domains, generic expertise, inaccessible
   context, invented certainty, or any point where a new Agent would have to guess.

This is Keeper attempt ${attemptNumber || '<unknown>'}. The frozen prepared digest is
\`${preparedDigest || '<run loom project ready>'}\`. Generate a unique run_id for this fresh Agent and
include both run_id and prepared_digest in the result.

Use this result shape. Keep \`gaps\` empty on pass; otherwise prefer structured gaps so the next Agent
receives the reason and closure evidence without interpretation loss:

\`\`\`json
{
  "run_id": "<unique-id>",
  "prepared_digest": "<digest-above>",
  "verdict": "passed | needs_revision | blocked",
  "summary": "<concise handoff judgment>",
  "gaps": [
    {
      "gap": "<missing or contradictory truth>",
      "why_it_blocks_start": "<concrete consequence for a fresh Agent>",
      "evidence_to_close": "<observable condition that would close it>"
    }
  ],
  "evidence": ["<file, command, or observation supporting the verdict>"]
}
\`\`\`

Record the result with \`loom keeper record --json-file <result.json>\`. Use \`passed\` only when you
could responsibly begin the first Task. Otherwise use \`needs_revision\` with concrete gaps and the
observable evidence that would close each one, or \`blocked\` when progress requires unavailable
authority or external state. A failed attempt returns the project to shaping; revision requires a
changed digest and another fresh Keeper.`;
}

export const PROJECT_TEMPLATE = `# Project Whole and Document Map

> This is the concise entry point, not the container for every design decision. Describe the whole and
> link the documents that make it buildable. Add or remove documents according to project complexity.

## Intended result

What should exist or become possible when this project succeeds?

## People and operating reality

Who or what experiences the result, and in what real situation?

## Whole experience or behavior

Describe the coherent end-to-end result rather than a feature inventory.

## Boundaries and consequential assumptions

What must not be changed, lost, invented, or expanded without authority?

## Design document map

Link every product, experience, system, contract, verification, or operations document and state the
decision surface it owns. Complex subsystems should have their own files under \`.loom/design/\`.

## Professional capability map

Link each separate field dossier under \`.loom/capabilities/\` and state which design decisions it
changes. Do not merge distinct fields into one dossier.

## Completion and failure

What observable evidence means the project worked? What could look complete while actually failing?

## Work map

Explain the delivery shape and point to \`.loom/tasks.json\`; do not duplicate volatile Task state here.
`;

const DESIGN_SECTIONS = {
  product: ['Outcome and users', 'Problem and operating reality', 'Product principles', 'Scope and non-goals', 'End-to-end behavior', 'Success and failure signals', 'Decisions and open questions', 'Related documents and capabilities'],
  experience: ['Experience intent', 'Users and contexts', 'Journey and information architecture', 'Interaction states and transitions', 'Content, visual, and accessibility direction', 'Errors, empty states, and recovery', 'Usability verification', 'Related documents and capabilities'],
  system: ['Responsibility in the whole', 'Inputs, outputs, and boundaries', 'Components and control flow', 'Data and state', 'Interfaces and dependencies', 'Failure, safety, and recovery', 'Implementation constraints', 'Verification strategy', 'Related documents and capabilities'],
  contract: ['Consumers and purpose', 'Schema or command surface', 'Invariants and permissions', 'Errors and compatibility', 'Examples and fixtures', 'Contract tests', 'Related documents and capabilities'],
  verification: ['Claims under test', 'Environments and fixtures', 'Acceptance matrix', 'Commands and evidence', 'Negative and failure tests', 'Known blind spots', 'Related documents and capabilities'],
  operations: ['Operational outcome', 'Preconditions and authority', 'Procedure and commands', 'Safety boundaries', 'Failure detection and recovery', 'Evidence and audit trail', 'Related documents and capabilities'],
  research: ['Decision to inform', 'Current evidence and unknowns', 'Method and sources', 'Findings', 'Conflicts and limitations', 'Project consequences', 'Follow-up verification', 'Related documents and capabilities'],
};

export const DESIGN_KINDS = Object.freeze(Object.keys(DESIGN_SECTIONS));

export function designTemplate({ title, kind }) {
  const sections = DESIGN_SECTIONS[kind];
  if (!sections) throw new Error(`Unknown design kind: ${kind}`);
  return `# ${title}\n\n- Kind: ${kind}\n- Status: shaping\n\n${sections.map((section) => `## ${section}\n\nDescribe the project-specific decision, mechanism, boundary, or evidence owned by this section.`).join('\n\n')}\n`;
}

export const CAPABILITY_TEMPLATE = ({ title }) => `# ${title}

> One dossier covers one recognizable professional field. Keep UI/UX, visual art direction, game
> design, psychology, biology, security, and other fields separate when their evidence and judgments
> differ. Put cross-field synthesis in the affected design document, not in a hybrid capability title.

## Field identity and boundary

Name the established field, what expertise it contributes, and what belongs to another dossier.

## Project decisions this field changes

Identify the consequential questions, design choices, risks, or verification methods that would be
weaker without this field.

## Project-specific diagnosis

Interpret this project's users, constraints, existing evidence, and tensions through this field. Show
authored judgment rather than a generic overview.

## Principles, evidence, and sources

Record specialist principles and opened sources when research is used. State what each source changed,
where sources disagree, and what remains uncertain.

## Distinctive stance and rejected defaults

State what this project will do, why, the important tradeoffs, and which common or generic approaches it
will deliberately refuse.

## Consequences for design, implementation, and verification

Translate the field's stance into concrete requirements and link the design documents it affects.

## Questions that could change the stance

Keep only unresolved questions whose answers would materially alter this field's contribution.

## Failure modes and proof signals

Describe characteristic weak, generic, or harmful outcomes and the observable evidence that distinguishes
a strong result.

## Relationships without merger

Link adjacent capability dossiers and explain the tension or handoff. Do not absorb their expertise here.
`;

export function evalConditionPrompt({ brief, loom }) {
  return loom
    ? `# Evaluation condition\n\n${brief}\n\nWork with all ordinary Agent capabilities and tools. Use LOOM as invisible continuity infrastructure: run \`loom context\`, maintain its disk state, and never ask the human to operate it. This condition has no extra authority or information.`
    : `# Evaluation condition\n\n${brief}\n\nWork as a normal capable Agent with all ordinary capabilities and tools. LOOM and its files are unavailable in this condition. Use any normal planning or documentation you judge useful.`;
}

export function evalJudgePrompt() {
  return `# Blind Evil Eval judge

You receive two anonymized runs in randomized order. Do not infer framework identity. Judge observable
work, not framework-shaped filenames or document volume. Cite evidence for every score. Compare intent
fidelity, question value, whole-project coverage, professional capability depth, buildability, continuity
after forced resets, implementation evidence, user burden, and cost/time. Penalize unnecessary ceremony,
questions that do not change decisions, and documentation that a fresh Agent cannot use. Swap order and
judge again; mark order-sensitive conclusions unstable. Attribute missing files or path failures to a run
only after the anonymized packet passed its relative-layout and declared-test preflight. A system wins only if its benefit survives equal
model, tools, workspace, user facts, reset points, and budget.`;
}

export function promptCatalog() {
  const placeholderState = {
    project: { status: '<project-status>' },
    understanding: {
      confirmed: [],
      assumptions: [{ id: '<assumption-id>', text: '<assumption>', status: 'active' }],
      unresolved: [{ id: '<question-id>', question: '<material uncertainty>', impact: 'high', status: 'open' }],
    },
    keeper: { status: 'not_run', attempts: [] },
  };
  const revisionState = {
    ...placeholderState,
    keeper: {
      status: 'needs_revision',
      attempts: [{
        verdict: 'needs_revision',
        run_id: '<fresh-run-id>',
        summary: '<why the handoff cannot start>',
        gaps: ['<concrete gap>'],
        evidence: ['<observable evidence>'],
      }],
    },
  };
  return {
    purpose: 'Complete inventory of LOOM cognitive messages. Validation errors and JSON status payloads enforce state but are not Agent prompts.',
    layers: {
      stable_core: AGENT_CORE,
      runtime_protocol: RUNTIME_PROTOCOL,
      project_state: shapingContext({ state: placeholderState, taskSummary: { total: 0, done: 0, open: 0, blocked: 0, active: null }, capabilityNames: [], designNames: [] }),
      project_state_after_keeper_failure: shapingContext({ state: revisionState, taskSummary: { total: 1, done: 0, open: 1, blocked: 0, active: null }, capabilityNames: ['<field>.md'], designNames: ['<system>.md'] }),
      keeper_review_of_prior_failure: shapingContext({ state: revisionState, taskSummary: { total: 1, done: 0, open: 1, blocked: 0, active: null }, capabilityNames: ['<field>.md'], designNames: ['<system>.md'], forKeeper: true }),
      current_task: '## Active Task\n\n<exact Task JSON>\n\n---\n\n## Task context: <path from Task.reads>\n\n<exact file content>\n\n(repeated for every read path)',
      on_demand_map: '## On-demand project context\n\n- Decision history: .loom/DECISIONS.md (read when correction or lineage matters)\n- Design: .loom/design/<document>.md\n- Professional capability: .loom/capabilities/<field>.md',
      keeper_context: '## Decision history (...)\n\n<exact DECISIONS.md>\n\n---\n\n## Work map summary\n\n<summary and first executable Task>\n\n---\n\n## Design document: <name>\n\n<exact content>\n\n---\n\n## Capability dossier: <name>\n\n<exact content>',
    },
    workspace_anchor: AGENT_ANCHOR,
    templates: {
      project_index: PROJECT_TEMPLATE,
      design_documents: Object.fromEntries(DESIGN_KINDS.map((kind) => [kind, designTemplate({ title: `<${kind}-title>`, kind })])),
      professional_capability: CAPABILITY_TEMPLATE({ title: '<recognizable-professional-field>' }),
      decision_history: '# Decision History\n\nCurrent truth belongs in PROJECT.md and linked design documents. This file preserves consequential superseding decisions.',
    },
    keeper: keeperProtocol({ attemptNumber: '<attempt-number>', preparedDigest: '<prepared-digest>' }),
    evaluation: {
      baseline_condition: evalConditionPrompt({ brief: '<identical-raw-brief>', loom: false }),
      loom_condition: evalConditionPrompt({ brief: '<identical-raw-brief>', loom: true }),
      blind_judge: evalJudgePrompt(),
    },
    composition: {
      normal_resume: ['stable_core', 'runtime_protocol', 'project_state', 'PROJECT.md', 'on-demand document and capability map'],
      active_task: ['normal_resume', 'active Task JSON', 'exact files in Task.reads'],
      keeper_handoff: ['keeper', 'normal_resume', 'DECISIONS.md', 'Work Map summary and first executable Task', 'all design documents', 'all professional capability dossiers'],
    },
  };
}
