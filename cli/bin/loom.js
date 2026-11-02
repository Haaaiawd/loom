#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addDeliverable,
  blockTask,
  checkProject,
  checkDeliverableCoverage,
  compileContext,
  completeTask,
  confirmCapability,
  configureRuntime,
  createCapability,
  createDesign,
  recordDecision,
  getCapability,
  getCapabilityStatus,
  getDesign,
  getKeeperPrompt,
  getTask,
  importTasks,
  initProject,
  listCapabilities,
  listDeliverables,
  listDesigns,
  loadProject,
  markReady,
  recordKeeper,
  recordUnderstanding,
  reopenTask,
  researchCapability,
  scaffoldEval,
  synthesizeCapability,
  skipKeeper,
  startTask,
  taskSummary,
  updateTask,
} from '../src/store.js';
import { promptCatalog } from '../src/protocol.js';

const argv = process.argv.slice(2);
const [command, subcommand, ...rest] = argv;

function output(value) {
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exitCode = 1;
}

function option(name) {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

function jsonFile() {
  const path = option('--json-file');
  if (!path) throw new Error('This command requires --json-file <path>');
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read JSON file ${path}: ${error.message}`);
  }
}

function help() {
  return `loom — continuity infrastructure for Agents

The human talks naturally to the Agent. The Agent uses these commands silently.

Typical flow (first pass):
  1. loom init                          — create .loom/ skeleton
  2. loom record                        — confirm facts, assumptions, open questions
  3. loom design add                    — one document per consequential decision surface;
                                        skipping this makes PROJECT.md an unresumable monolith
  4. loom capability add → research → synthesize → confirm
                                        — compile researched expert decision trees for the
                                        fields whose judgment changes this work; skipping this
                                        produces generic output
  5. loom deliverable add               — decompose the delivery surface
  6. loom task plan                     — write Tasks with acceptance criteria covering deliverables
  7. loom project ready                 — freeze a digest for Keeper review
  8. loom keeper prompt → record        — fresh Agent verifies build-readiness (one-time)
  9. loom task start → done             — execute one Task at a time, fill acceptance evidence
  10. loom check                        — verify health, coverage, and drift

Steps 3-6 are the shaping layers where project quality is decided. Run
\`loom help <concept>\` for purpose and quality bar: shaping, design, capability, task, deliverable.

When a new idea changes an existing decision:
  loom decision --json-file <decision.json>   — record what changed and affected tasks
  then update the design document directly; loom check warns which done tasks need reopening.

Start and resume
  loom init
  loom context [--task TASK-001] [--keeper] [--human-channel available|unavailable]
  loom check
  loom prompts

Preserve understanding
  loom record --json-file <update.json>
  loom decision --json-file <decision.json>
  loom project ready
  loom design add <slug> --title <text> --kind <product|experience|system|contract|verification|operations|research>
  loom design list|get <slug>
  loom capability add <slug> --title <professional-field>
  loom capability list|get <slug>
  loom capability research <slug> --field <text>      (creates research/_guide.md — add .md files there)
  loom capability synthesize <slug>                   (builds decision tree from research, validates sources)
  loom capability confirm <slug> --scenario <text> --source human|agent
                                        — human confirms, or Agent records a provisional selection
  loom capability status <slug>

Map the delivery surface
  loom deliverable add <slug> --title <text> --kind <module|feature|behavior|interface|artifact|operational|verification|other>
  loom deliverable list
  loom deliverable coverage

Maintain the work map
  loom task plan --json-file <tasks.json>
  loom task status|next|get <id>
  loom task start <id>
  loom task update <id> --json-file <patch.json>
  loom task block <id> --json-file <block.json>
  loom task reopen <id> [--reason <reason>]
  loom task done <id> --json-file <evidence.json>

Each Task should produce one verifiable unit of real work. Use acceptance[] with criterion,
verify_by, and evidence fields. Task completion fills in each acceptance condition's evidence
with the actual result (for acceptance tasks) or quotes each done_when criterion (for legacy tasks).

One-time independent handoff
  loom review [--help]                 — Keeper handoff and stage-review guide
  loom keeper --help                  — read-only guide in any project state
  loom keeper prompt
  loom keeper record --json-file <result.json>
  loom keeper skip --reason <reason>

Evaluate LOOM itself
  loom eval scaffold --json-file <scenario.json>

Use \`--state-dir <outside-workspace-dir>\` on every command to keep LOOM state in an isolated sidecar
(for example, a benchmark runner's per-run state directory). Sidecar initialization never edits AGENTS.md.

Use \`loom <command> --help\` or \`loom help <topic>\` for canonical JSON payloads. Topics:
  record, decision, task-plan, task-update, task-block, task-done, keeper-record, eval-scaffold
Conceptual guidance topics: shaping, design, capability, task, deliverable

Use JSON files for structured writes so long content and shell quoting remain auditable.
Task completion JSON includes evidence plus either acceptance_results[] (one per acceptance criterion,
each with concrete evidence) or checks[] (one per done_when criterion, for legacy tasks).`;
}

const STRUCTURED_HELP = {
  record: {
    usage: 'loom record --json-file <update.json>',
    example: {
      confirmed: ['A fact confirmed by the human or workspace.'],
      assumptions: [{ text: 'A bounded, reversible Agent assumption.', source: 'agent' }],
      unresolved: [{ question: 'A consequential question still open?', impact: 'high' }],
      resolved: [{ id: 'Q-001', status: 'resolved' }],
      retire_assumptions: ['A-001'],
      decisions: [{ title: 'Decision title', decision: 'Current decision.', rationale: 'Why it follows.', supersedes: [], affects: ['.loom/PROJECT.md'] }],
    },
  },
  decision: {
    usage: 'loom decision --json-file <decision.json>',
    example: { summary: 'What changed and why.', changes: ['.loom/design/system.md', 'src/system.js'], affected_tasks: ['TASK-001'] },
  },
  'task-plan': {
    usage: 'loom task plan --json-file <tasks.json>',
    example: { tasks: [{ title: 'Create one verifiable result', outcome: 'A concrete artifact behaves as specified.', acceptance: [{ criterion: 'Observable condition', verify_by: 'Exact command or review method', evidence: '' }], boundaries: ['Does not change unrelated behavior'], depends_on: [], reads: ['.loom/PROJECT.md', '.loom/design/system.md'], touches: ['src/result.js'], implements: '.loom/design/system.md#Decision', capability_hooks: [{ node: 'field#C1', at: 'decision point', must_produce: 'project-specific choice' }], covers: ['DLV-001'] }] },
  },
  'task-update': {
    usage: 'loom task update <id> --json-file <patch.json>',
    example: { progress: { completed: ['Finished checkpoint'], current: 'Verifying behavior', next: 'Run the named acceptance check' } },
  },
  'task-block': {
    usage: 'loom task block <id> --json-file <block.json>',
    example: { reason: 'A concrete dependency or authority is unavailable.', recovery_conditions: ['Observable condition that permits resuming'], evidence: ['Inspection or command output showing the block'] },
  },
  'task-done': {
    usage: 'loom task done <id> --json-file <evidence.json>',
    example: { evidence: ['Overall reproducible verification result'], acceptance_results: [{ criterion: 'Exact acceptance criterion from the Task', evidence: 'Concrete command, artifact, or observation' }] },
  },
  'keeper-record': {
    usage: 'loom keeper record --json-file <result.json>',
    example: { run_id: 'fresh-agent-run-001', prepared_digest: '<digest from loom project ready>', verdict: 'passed', review: { mode: 'independent', reviewer_id: 'fresh-agent-001', evidence: 'Host opened a separate Agent without the shaping conversation.' }, summary: 'Build-readiness judgment.', gaps: [], evidence: ['Files and observations supporting the verdict'] },
  },
  'eval-scaffold': {
    usage: 'loom eval scaffold --json-file <scenario.json>',
    example: { id: 'EVAL-001', title: 'Ambiguous real project', brief: 'Identical brief for both conditions.', hidden_user_facts: ['Fact revealed by the same answer script'], human_channel: 'unavailable', success_criteria: ['Observable result'], context_reset_points: ['after-shaping', 'mid-task'], repetitions: 3 },
  },
};

const CONCEPT_HELP = {
  shaping: `loom shaping — the order that makes a project resumable

Shaping is everything before material execution. Each layer exists because a specific
failure happens without it; skipping a layer is a decision, not a shortcut.

  loom record           — preserves answers, assumptions, and open questions across resets
  loom design add       — each document owns one consequential decision surface; without it
                          PROJECT.md becomes an unresumable monolith (loom help design)
  loom capability add   — injects researched professional judgment; without it output is
                          generic (loom help capability)
  loom deliverable add  — decomposes what "done" delivers so coverage is checkable
  loom task plan        — restartable work at evidence granularity (loom help task)
  loom project ready    — refuses while template residue, unclassified Tasks, or high-impact
                          open questions remain, then a fresh Keeper verifies from disk

Run loom context during shaping: the recommended action names the layer that is actually
unfinished rather than reciting this list.`,

  design: `loom design — documents that own consequential decisions

A design document owns one decision surface a fresh Agent must understand and verify
independently: a subsystem, an experience, a contract, a verification strategy, an
operational procedure, or a research answer. PROJECT.md is only the map — putting the
whole design inside it makes the project unresumable.

Add one when a wrong decision there would be expensive to reverse, when two reasonable
experts could decide differently, or when the surface must be verifiable on its own. A
trivial project may need one document; a complex product may need many.

Lifecycle:
  loom design add <slug> --title <text> --kind <product|experience|system|contract|verification|operations|research>
  → fill every section with project-specific decisions (template text fails loom project ready)
  → link it from PROJECT.md's design document map
  → Tasks reference it via implements, or carry a concrete design_exemption

Quality bar: each section records a real decision with rationale and rejected
alternatives — not a restatement of the section heading.`,

  capability: `loom capability — researched professional judgment, not a summary

A capability dossier compiles how an expert in ONE recognizable field thinks through
THIS project's problems, as a decision tree with sources and counterexamples. It is the
layer that turns a generic Agent answer into a professional one. Include a field only
when its knowledge changes questions, design, implementation, risk, or verification —
Tasks may declare capability_exemption, but skip deliberately, not by default.

Lifecycle:
  1. loom capability add <slug> --title <field>     — one dossier per field
  2. loom capability research <slug> --field <text> — creates research/_guide.md
     → add one .md per source: expert narratives, case studies, methodology,
       failure accounts — not API docs or textbook summaries. One file is the
       legal minimum; several distinct sources are what make the tree non-generic.
  3. loom capability synthesize <slug>              — rejects nodes whose source does not
       cite a research file, or that lack a counterexample
  4. loom capability confirm <slug> --scenario <which expert situation applies> --source human
     --source agent records a visibly provisional selection when the human is unavailable

Tasks activate nodes via capability_hooks: [{ "node": "<slug>#C1", "at": "<decision point>",
"must_produce": "<artifact>" }]. loom context injects that node's options, criteria,
source, and counterexample at Task execution.

Quality bar: each node is a decision a real expert reaches — entry condition, options,
judgment criteria, a source naming actual research, and a counterexample naming when an
expert would NOT walk this path.`,

  task: `loom task — the restartable Work Map

A Task is one verifiable unit of real work: completing it produces a piece of evidence
you can point to. "Implement the feature" is too large; "add one field" is too small.

Required shape (loom task plan --json-file <tasks.json>):
  outcome          — the observable difference, not a summary of activity
  acceptance       — [{ criterion (what must be true), verify_by (how to check), evidence }]
  boundaries       — at least one thing this Task does NOT do
  reads / touches  — exact paths, not categories
  implements       — the design decision it realizes, or a concrete design_exemption
  capability_hooks — decision-tree nodes it activates, or a capability_exemption
  covers           — deliverable IDs it advances
  depends_on       — prior Task IDs; empty only when there are no prerequisites

Lifecycle: task plan → project ready → keeper → task next/start → update (progress) →
done (one acceptance_results entry per criterion) or block (reason + recovery
conditions) → reopen. Start and done refuse Tasks with unresolved classification and
missing declared outputs.`,

  deliverable: `loom deliverable — the delivery surface, decomposed

A deliverable is one observable thing the project must produce: a module, feature,
behavior, interface, artifact, operational outcome, or verification result. Tasks claim
coverage via covers: [deliverable IDs]; loom deliverable coverage and loom check
distinguish planned coverage from actually delivered (a covering Task is done).

Lifecycle:
  loom deliverable add <slug> --title <text> --kind <module|feature|behavior|interface|artifact|operational|verification|other>
  → loom deliverable list      — inspect the surface
  → loom deliverable coverage  — planned vs delivered, with uncovered items named`,
};

function conceptHelp(topic) {
  const entry = CONCEPT_HELP[topic];
  if (!entry) return null;
  return entry;
}

function structuredHelp(topic) {
  if (['keeper', 'review', 'keeper-prompt'].includes(topic)) return reviewHelp();
  if (topic === 'keeper-record') return `${STRUCTURED_HELP[topic].usage}\n\nCanonical JSON payload:\n${JSON.stringify(STRUCTURED_HELP[topic].example, null, 2)}\n\nFor a revised pass, add closure_results: [{"gap":"<exact prior gap text>","evidence":"<observed closure proof>"}] for every prior gap. Minor gaps require fresh verification too.`;
  const entry = STRUCTURED_HELP[topic];
  if (!entry) {
    const concept = conceptHelp(topic);
    if (concept) return concept;
    throw new Error(`Unknown help topic: ${topic}. Payload topics: ${Object.keys(STRUCTURED_HELP).join(', ')}. Concept topics: ${Object.keys(CONCEPT_HELP).join(', ')}`);
  }
  return `${entry.usage}\n\nCanonical JSON payload:\n${JSON.stringify(entry.example, null, 2)}`;
}

function reviewHelp() {
  return `LOOM review guide

Keeper is the first build-readiness handoff. Stage reviews use ordinary Tasks.
This guide is read-only and available before initialization or project readiness.

Keeper handoff:
1. The shaping Agent runs loom project ready after preparing project truth.
2. The host opens a fresh Agent without inherited conversation. Give it the workspace
   path, the CLI location (absolute path in source checkouts), and this instruction:
   Run loom keeper prompt, then loom context --keeper, and inspect the referenced files.
3. The fresh Agent records its verdict with loom keeper record --json-file <result.json>.
   See loom keeper record --help for the payload and independent review provenance.
4. The parent waits for the result, then runs loom context. On needs_revision or blocked,
   repair the named sources, prepare again, and obtain a fresh review, including minor gaps.
5. On passed, resume with loom task next and loom task start <id>.
If isolation is unavailable, explicitly record loom keeper skip --reason <limitation>.
The CLI prints instructions and records state; it does not launch Agents itself.

Stage review:
Use loom task plan --help to create a review Task naming the implementation, design,
and verification artifacts in reads. Record each finding as a repair Task with concrete
acceptance criteria and evidence. Block the review Task with loom task block until repairs
are ready; reopen it and re-run verification before loom task done. A completed repair
alone is not a completed review. No findings: close the review Task with inspection evidence.
Do not rerun first-time Keeper just to review every implementation Task.`;
}

function activeStructuredHelpTopic() {
  if (command === 'record' || command === 'decision') return command;
  if (command === 'task' && ['plan', 'update', 'block', 'done'].includes(subcommand)) return `task-${subcommand}`;
  if (command === 'keeper' && subcommand === 'record') return 'keeper-record';
  if (command === 'eval' && subcommand === 'scaffold') return 'eval-scaffold';
  return '';
}

try {
  configureRuntime({ stateDir: option('--state-dir') });
  const humanChannel = option('--human-channel');
  if (humanChannel && !['available', 'unavailable'].includes(humanChannel)) throw new Error('--human-channel must be available or unavailable');
  switch (command) {
    case '--version':
    case '-v': {
      const here = dirname(fileURLToPath(import.meta.url));
      const pkg = JSON.parse(readFileSync(resolve(here, '..', '..', 'package.json'), 'utf8'));
      output(`loom ${pkg.version}`);
      break;
    }
    case '--help':
    case '-h':
    case undefined:
      output(help());
      break;
    case 'help':
      output(subcommand ? structuredHelp(subcommand) : help());
      break;
    case 'init':
      output(initProject());
      break;
    case 'context':
    case 'resume':
      output(compileContext({ taskId: option('--task'), keeper: argv.includes('--keeper'), humanChannel: humanChannel || 'available' }));
      break;
    case 'prompts':
      output(promptCatalog());
      break;
    case 'record':
      output(subcommand === '--help' ? structuredHelp('record') : recordUnderstanding(jsonFile()));
      break;
    case 'decision':
      output(subcommand === '--help' ? structuredHelp('decision') : recordDecision(jsonFile()));
      break;
    case 'check': {
      const result = checkProject();
      output(result);
      if (!result.healthy) process.exitCode = 1;
      break;
    }
    case 'project':
      if (subcommand !== 'ready') throw new Error('Usage: loom project ready');
      output(markReady());
      break;
    case 'design': {
      if (argv.includes('--help')) output(conceptHelp('design'));
      else if (subcommand === 'add') {
        const slug = rest[0];
        const title = option('--title');
        const kind = option('--kind');
        if (!slug) throw new Error('Usage: loom design add <slug> --title <text> --kind <kind>');
        output(createDesign(slug, { title, kind }));
      } else if (subcommand === 'list') output(listDesigns());
      else if (subcommand === 'get') {
        if (!rest[0]) throw new Error('Usage: loom design get <slug>');
        output(getDesign(rest[0]));
      } else if (!subcommand) output(conceptHelp('design'));
      else throw new Error('Usage: loom design add|list|get');
      break;
    }
    case 'capability': {
      if (argv.includes('--help')) output(conceptHelp('capability'));
      else if (subcommand === 'add') {
        const slug = rest[0];
        const title = option('--title');
        if (!slug) throw new Error('Usage: loom capability add <slug> --title <text>');
        output(createCapability(slug, { title }));
      } else if (subcommand === 'list') output(listCapabilities());
      else if (subcommand === 'get') {
        if (!rest[0]) throw new Error('Usage: loom capability get <slug>');
        output(getCapability(rest[0]));
      } else if (subcommand === 'research') {
        if (!rest[0]) throw new Error('Usage: loom capability research <slug> --field <text>');
        output(researchCapability(rest[0], { field: option('--field') }));
      } else if (subcommand === 'synthesize') {
        if (!rest[0]) throw new Error('Usage: loom capability synthesize <slug>');
        output(synthesizeCapability(rest[0]));
      } else if (subcommand === 'confirm') {
        if (!rest[0]) throw new Error('Usage: loom capability confirm <slug> --scenario <text>');
        output(confirmCapability(rest[0], { scenario: option('--scenario'), source: option('--source') }));
      } else if (subcommand === 'status') {
        if (!rest[0]) throw new Error('Usage: loom capability status <slug>');
        output(getCapabilityStatus(rest[0]));
      } else if (!subcommand) output(conceptHelp('capability'));
      else throw new Error('Usage: loom capability add|list|get|research|synthesize|confirm|status');
      break;
    }
    case 'deliverable': {
      if (argv.includes('--help')) output(conceptHelp('deliverable'));
      else if (subcommand === 'add') {
        const slug = rest[0];
        const title = option('--title');
        const kind = option('--kind');
        if (!slug) throw new Error('Usage: loom deliverable add <slug> --title <text> --kind <module|feature|behavior|interface|artifact|operational|verification|other>');
        output(addDeliverable(slug, { title, kind, notes: option('--notes') }));
      } else if (subcommand === 'list') output(listDeliverables());
      else if (subcommand === 'coverage') output(checkDeliverableCoverage());
      else if (!subcommand) output(conceptHelp('deliverable'));
      else throw new Error('Usage: loom deliverable add|list|coverage');
      break;
    }
    case 'task': {
      if (argv.includes('--help') && ['plan', 'update', 'block', 'done'].includes(subcommand)) output(structuredHelp(`task-${subcommand}`));
      else if (subcommand === 'plan') output(importTasks(jsonFile()));
      else if (subcommand === 'status') output(taskSummary(loadProject().taskStore.tasks));
      else if (subcommand === 'next') output(getTask());
      else if (subcommand === 'get') {
        if (!rest[0]) throw new Error('Usage: loom task get <id>');
        output(getTask(rest[0]));
      } else if (subcommand === 'start') {
        if (!rest[0]) throw new Error('Usage: loom task start <id>');
        output(startTask(rest[0]));
      } else if (subcommand === 'update') {
        if (!rest[0]) throw new Error('Usage: loom task update <id> --json-file <patch.json>');
        output(updateTask(rest[0], jsonFile()));
      } else if (subcommand === 'block') {
        if (!rest[0]) throw new Error('Usage: loom task block <id> --json-file <block.json>');
        output(blockTask(rest[0], jsonFile()));
      } else if (subcommand === 'reopen') {
        if (!rest[0]) throw new Error('Usage: loom task reopen <id>');
        output(reopenTask(rest[0], { reason: option('--reason') }));
      } else if (subcommand === 'done') {
        if (!rest[0]) throw new Error('Usage: loom task done <id> --json-file <evidence.json>');
        output(completeTask(rest[0], jsonFile()));
      } else if (!subcommand || argv.includes('--help')) output(conceptHelp('task'));
      else throw new Error('Usage: loom task plan|status|next|get|start|update|block|reopen|done');
      break;
    }
    case 'review':
      if (subcommand && subcommand !== '--help') throw new Error('Usage: loom review [--help]');
      output(reviewHelp());
      break;
    case 'keeper': {
      if (argv.includes('--help') && subcommand === 'record') output(structuredHelp('keeper-record'));
      else if (!subcommand || argv.includes('--help')) output(reviewHelp());
      else if (subcommand === 'prompt') output(getKeeperPrompt());
      else if (subcommand === 'record') output(recordKeeper(jsonFile()));
      else if (subcommand === 'skip') output(skipKeeper(option('--reason')));
      else throw new Error('Usage: loom keeper prompt|record|skip');
      break;
    }
    case 'eval':
      if (argv.includes('--help') && subcommand === 'scaffold') output(structuredHelp('eval-scaffold'));
      else {
        if (subcommand !== 'scaffold') throw new Error('Usage: loom eval scaffold --json-file <scenario.json>');
        output(scaffoldEval(jsonFile()));
      }
      break;
    default:
      throw new Error(`Unknown command: ${command}\n\n${help()}`);
  }
} catch (error) {
  const topic = activeStructuredHelpTopic();
  const pointer = topic && !argv.includes('--help') ? `\nRun ${STRUCTURED_HELP[topic].usage.replace(/ --json-file .+$/, ' --help').replace(/ <id>/, '')} for a canonical payload.` : '';
  fail(`${error.message}${pointer}`);
}
