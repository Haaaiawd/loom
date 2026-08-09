#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  blockTask,
  checkProject,
  compileContext,
  completeTask,
  createCapability,
  createDesign,
  getCapability,
  getDesign,
  getKeeperPrompt,
  getTask,
  importTasks,
  initProject,
  listCapabilities,
  listDesigns,
  loadProject,
  markReady,
  recordKeeper,
  recordUnderstanding,
  reopenTask,
  scaffoldEval,
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

Start and resume
  loom init
  loom context [--task TASK-001] [--keeper]
  loom check
  loom prompts

Preserve understanding
  loom record --json-file <update.json>
  loom project ready
  loom design add <slug> --title <text> --kind <product|experience|system|contract|verification|operations|research>
  loom design list|get <slug>
  loom capability add <slug> --title <professional-field>
  loom capability list|get <slug>

Maintain the work map
  loom task plan --json-file <tasks.json>
  loom task status|next|get <id>
  loom task start <id>
  loom task update <id> --json-file <patch.json>
  loom task block <id> --json-file <block.json>
  loom task reopen <id> [--reason <reason>]
  loom task done <id> --json-file <evidence.json>

One-time independent handoff
  loom keeper prompt
  loom keeper record --json-file <result.json>
  loom keeper skip --reason <reason>

Evaluate LOOM itself
  loom eval scaffold --json-file <scenario.json>

Use JSON files for structured writes so long content and shell quoting remain auditable.
Task completion JSON includes evidence plus one check for every exact done_when criterion.`;
}

try {
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
    case 'init':
      output(initProject());
      break;
    case 'context':
    case 'resume':
      output(compileContext({ taskId: option('--task'), keeper: argv.includes('--keeper') }));
      break;
    case 'prompts':
      output(promptCatalog());
      break;
    case 'record':
      output(recordUnderstanding(jsonFile()));
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
      } else throw new Error('Usage: loom capability add|list|get');
      break;
    }
    case 'task': {
      if (subcommand === 'plan') output(importTasks(jsonFile()));
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
      if (subcommand === 'prompt') output(getKeeperPrompt());
      else if (subcommand === 'record') output(recordKeeper(jsonFile()));
      else if (subcommand === 'skip') output(skipKeeper(option('--reason')));
      else throw new Error('Usage: loom keeper prompt|record|skip');
      break;
    }
    case 'eval':
      if (subcommand !== 'scaffold') throw new Error('Usage: loom eval scaffold --json-file <scenario.json>');
      output(scaffoldEval(jsonFile()));
      break;
    default:
      throw new Error(`Unknown command: ${command}\n\n${help()}`);
  }
} catch (error) {
  fail(error.message);
}
