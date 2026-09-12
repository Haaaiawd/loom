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
  3. loom design add                    — write design documents for consequential systems
  4. loom capability add → research → synthesize → confirm
                                        — build professional decision trees for fields that matter
  5. loom deliverable add               — decompose the delivery surface
  6. loom task plan                     — write Tasks with acceptance criteria covering deliverables
  7. loom project ready                 — freeze a digest for Keeper review
  8. loom keeper prompt → record        — fresh Agent verifies build-readiness (one-time)
  9. loom task start → done             — execute one Task at a time, fill acceptance evidence
  10. loom check                        — verify health, coverage, and drift

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
  loom keeper prompt
  loom keeper record --json-file <result.json>
  loom keeper skip --reason <reason>

Evaluate LOOM itself
  loom eval scaffold --json-file <scenario.json>

Use \`--state-dir <outside-workspace-dir>\` on every command to keep LOOM state in an isolated sidecar
(for example, a benchmark runner's per-run state directory). Sidecar initialization never edits AGENTS.md.

Use \`loom <command> --help\` or \`loom help <topic>\` for canonical JSON payloads. Topics:
  record, decision, task-plan, task-update, task-block, task-done, keeper-record, eval-scaffold

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

function structuredHelp(topic) {
  const entry = STRUCTURED_HELP[topic];
  if (!entry) throw new Error(`Unknown help topic: ${topic}. Available topics: ${Object.keys(STRUCTURED_HELP).join(', ')}`);
  return `${entry.usage}\n\nCanonical JSON payload:\n${JSON.stringify(entry.example, null, 2)}`;
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
      if (subcommand === 'add') {
        const slug = rest[0];
        const title = option('--title');
        const kind = option('--kind');
        if (!slug) throw new Error('Usage: loom design add <slug> --title <text> --kind <kind>');
        output(createDesign(slug, { title, kind }));
      } else if (subcommand === 'list') output(listDesigns());
      else if (subcommand === 'get') {
        if (!rest[0]) throw new Error('Usage: loom design get <slug>');
        output(getDesign(rest[0]));
      } else throw new Error('Usage: loom design add|list|get');
      break;
    }
    case 'capability': {
      if (subcommand === 'add') {
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
      } else throw new Error('Usage: loom capability add|list|get|research|synthesize|confirm|status');
      break;
    }
    case 'deliverable': {
      if (subcommand === 'add') {
        const slug = rest[0];
        const title = option('--title');
        const kind = option('--kind');
        if (!slug) throw new Error('Usage: loom deliverable add <slug> --title <text> --kind <module|feature|behavior|interface|artifact|operational|verification|other>');
        output(addDeliverable(slug, { title, kind, notes: option('--notes') }));
      } else if (subcommand === 'list') output(listDeliverables());
      else if (subcommand === 'coverage') output(checkDeliverableCoverage());
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
      } else throw new Error('Usage: loom task plan|status|next|get|start|update|block|reopen|done');
      break;
    }
    case 'keeper': {
      if (argv.includes('--help') && subcommand === 'record') output(structuredHelp('keeper-record'));
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
