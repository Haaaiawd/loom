import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  agentProtocol,
  AGENT_ANCHOR,
  EXECUTION_PROTOCOL,
  CAPABILITY_TEMPLATE,
  DESIGN_KINDS,
  PROJECT_TEMPLATE,
  RESEARCH_GUIDE,
  STRUCTURE_TEMPLATE,
  designTemplate,
  evalConditionPrompt,
  evalJudgePrompt,
  keeperProtocol,
  shapingContext,
} from './protocol.js';

const SCHEMA_VERSION = 2;
const VALID_PROJECT_STATUS = new Set(['shaping', 'ready_for_keeper', 'build_ready', 'building', 'complete']);
const VALID_TASK_STATUS = new Set(['open', 'active', 'blocked', 'done']);
let runtimePaths = null;

function now() {
  return new Date().toISOString();
}

function readJson(path, label = basename(path)) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${label} cannot be read: ${error.message}`);
  }
}

function atomicJson(path, value) {
  const temp = `${path}.tmp-${process.pid}`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(temp, path);
}

function nextId(items, prefix) {
  const max = items.reduce((highest, item) => {
    const match = new RegExp(`^${prefix}-(\\d+)$`).exec(item.id || '');
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

function asObjects(values, key) {
  if (!values) return [];
  if (!Array.isArray(values)) throw new Error(`${key} must be an array`);
  return values.map((value) => typeof value === 'string' ? { [key]: value } : value);
}

export function findRoot(from = process.cwd()) {
  if (runtimePaths && existsSync(runtimePaths.state)) return runtimePaths.root;
  let cursor = resolve(from);
  while (true) {
    if (existsSync(join(cursor, '.loom', 'state.json'))) return cursor;
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  throw new Error('LOOM is not initialized. Run loom init in the project root.');
}

export function loomPaths(root = findRoot()) {
  const absolute = resolve(root);
  const loom = runtimePaths?.root === absolute ? runtimePaths.loom : join(absolute, '.loom');
  return loomPathsShape(absolute, loom);
}

export function configureRuntime({ stateDir } = {}) {
  if (!stateDir) {
    runtimePaths = null;
    return null;
  }
  const root = resolve(process.cwd());
  const loom = resolve(stateDir);
  const fromWorkspace = relative(root, loom);
  if (!fromWorkspace || (!fromWorkspace.startsWith('..') && !isAbsolute(fromWorkspace))) {
    throw new Error('--state-dir must be outside the scored workspace');
  }
  runtimePaths = loomPathsShape(root, loom);
  return { workspace: root, state_dir: loom };
}

export function initProject(root = process.cwd()) {
  const paths = loomPathsForInit(root);
  if (existsSync(paths.state)) return { initialized: false, root: paths.root, reason: 'already_initialized' };
  if (existsSync(join(paths.loom, 'current')) || existsSync(join(paths.loom, 'v1'))) {
    throw new Error('A legacy LOOM project was found. Back it up and migrate deliberately; v2 will not overwrite it.');
  }
  mkdirSync(paths.design, { recursive: true });
  mkdirSync(paths.capabilities, { recursive: true });
  mkdirSync(paths.eval, { recursive: true });
  const state = {
    schema_version: SCHEMA_VERSION,
    project: { name: basename(paths.root), status: 'shaping', created_at: now(), updated_at: now() },
    understanding: { confirmed: [], assumptions: [], unresolved: [] },
    keeper: { status: 'not_run', attempts: [] },
  };
  atomicJson(paths.state, state);
  atomicJson(paths.tasks, { schema_version: SCHEMA_VERSION, tasks: [] });
  atomicJson(paths.deliverables, { schema_version: SCHEMA_VERSION, deliverables: [] });
  writeFileSync(paths.project, PROJECT_TEMPLATE, 'utf8');
  writeFileSync(paths.structure, STRUCTURE_TEMPLATE, 'utf8');
  writeFileSync(paths.decisions, '# Decision History\n\nCurrent truth belongs in PROJECT.md and linked design documents. This file preserves consequential superseding decisions.\n', 'utf8');
  if (paths.loom === join(paths.root, '.loom')) installAgentAnchor(paths.root);
  return { initialized: true, root: paths.root, files: ['.loom/PROJECT.md', '.loom/STRUCTURE.md', '.loom/DECISIONS.md', '.loom/state.json', '.loom/tasks.json', '.loom/deliverables.json', '.loom/design/', '.loom/capabilities/'] };
}

function loomPathsForInit(root) {
  const absolute = resolve(root);
  const loom = runtimePaths?.root === absolute ? runtimePaths.loom : join(absolute, '.loom');
  return loomPathsShape(absolute, loom);
}

function loomPathsShape(root, loom) {
  return {
    root,
    loom,
    state: join(loom, 'state.json'),
    tasks: join(loom, 'tasks.json'),
    deliverables: join(loom, 'deliverables.json'),
    project: join(loom, 'PROJECT.md'),
    structure: join(loom, 'STRUCTURE.md'),
    decisions: join(loom, 'DECISIONS.md'),
    design: join(loom, 'design'),
    capabilities: join(loom, 'capabilities'),
    eval: join(loom, 'eval'),
  };
}

function installAgentAnchor(root) {
  const path = join(root, 'AGENTS.md');
  const marker = '<!-- loom:v2 -->';
  if (!existsSync(path)) writeFileSync(path, `${AGENT_ANCHOR}\n`, 'utf8');
  else if (!readFileSync(path, 'utf8').includes(marker)) appendFileSync(path, `\n${AGENT_ANCHOR}\n`, 'utf8');
}

export function loadProject(root = findRoot()) {
  const paths = loomPaths(root);
  mkdirSync(paths.design, { recursive: true });
  mkdirSync(paths.capabilities, { recursive: true });
  mkdirSync(paths.eval, { recursive: true });
  const state = readJson(paths.state, 'state.json');
  const taskStore = readJson(paths.tasks, 'tasks.json');
  const deliverableStore = existsSync(paths.deliverables) ? readJson(paths.deliverables, 'deliverables.json') : { schema_version: SCHEMA_VERSION, deliverables: [] };
  validateState(state);
  validateTasks(taskStore.tasks);
  return { paths, state, taskStore, deliverableStore };
}

function validateState(state) {
  if (state.schema_version !== SCHEMA_VERSION) throw new Error(`Unsupported schema_version ${state.schema_version}`);
  if (!VALID_PROJECT_STATUS.has(state.project?.status)) throw new Error('Invalid project status');
  for (const key of ['confirmed', 'assumptions', 'unresolved']) {
    if (!Array.isArray(state.understanding?.[key])) throw new Error(`understanding.${key} must be an array`);
  }
}

function validateTasks(tasks) {
  if (!Array.isArray(tasks)) throw new Error('tasks.json tasks must be an array');
  const ids = new Set();
  let active = 0;
  for (const task of tasks) {
    if (!task.id || ids.has(task.id)) throw new Error(`Task id is missing or duplicated: ${task.id || '<missing>'}`);
    ids.add(task.id);
    if (!task.title || !task.outcome) throw new Error(`${task.id} requires title and outcome`);
    if (task.outcome.length < 20) throw new Error(`${task.id} outcome must be at least 20 characters describing the observable difference`);
    if (!VALID_TASK_STATUS.has(task.status)) throw new Error(`${task.id} has invalid status ${task.status}`);
    if (!Array.isArray(task.depends_on) || !Array.isArray(task.reads)) throw new Error(`${task.id} dependencies and reads must be arrays`);
    if (!task.reads.length) throw new Error(`${task.id} reads must list at least one specific file or artifact`);
    if (!Array.isArray(task.touches) || !task.touches.length) throw new Error(`${task.id} touches must list at least one specific file or artifact`);
    if (!Array.isArray(task.boundaries) || !task.boundaries.length) throw new Error(`${task.id} boundaries must list at least one thing this Task does NOT do`);
    const hasAcceptance = Array.isArray(task.acceptance) && task.acceptance.length > 0;
    const hasDoneWhen = Array.isArray(task.done_when) && task.done_when.length > 0;
    if (!hasAcceptance && !hasDoneWhen) throw new Error(`${task.id} requires acceptance[] (preferred) or done_when[]`);
    if (hasAcceptance) {
      for (const acc of task.acceptance) {
        if (!acc || typeof acc !== 'object') throw new Error(`${task.id} acceptance entries must be objects`);
        if (!acc.criterion || typeof acc.criterion !== 'string') throw new Error(`${task.id} acceptance entry missing criterion (what must be true for this condition to pass)`);
        if (!acc.verify_by || typeof acc.verify_by !== 'string') throw new Error(`${task.id} acceptance entry missing verify_by (how to check)`);
        if (acc.evidence !== undefined && typeof acc.evidence !== 'string') throw new Error(`${task.id} acceptance evidence must be a string`);
      }
    }
    if (task.implements !== undefined && typeof task.implements !== 'string') throw new Error(`${task.id} implements must be a string referencing a design decision`);
    if (task.capability_hooks !== undefined) {
      if (!Array.isArray(task.capability_hooks)) throw new Error(`${task.id} capability_hooks must be an array`);
      for (const hook of task.capability_hooks) {
        if (!hook || typeof hook !== 'object' || typeof hook.node !== 'string' || !hook.node.includes('#')) throw new Error(`${task.id} capability_hooks entry must have a node field like "capability-slug#C1"`);
        if (hook.at !== undefined && typeof hook.at !== 'string') throw new Error(`${task.id} capability_hooks at must be a string`);
        if (hook.must_produce !== undefined && typeof hook.must_produce !== 'string') throw new Error(`${task.id} capability_hooks must_produce must be a string`);
      }
    }
    if (task.covers !== undefined) {
      if (!Array.isArray(task.covers)) throw new Error(`${task.id} covers must be an array of deliverable IDs`);
      for (const dlvId of task.covers) if (typeof dlvId !== 'string') throw new Error(`${task.id} covers entries must be deliverable ID strings`);
    }
    if (task.status === 'active') active += 1;
  }
  if (active > 1) throw new Error('Only one Task may be active');
  for (const task of tasks) {
    for (const dep of task.depends_on) if (!ids.has(dep)) throw new Error(`${task.id} depends on missing Task ${dep}`);
  }
  detectCycles(tasks);
}

function detectCycles(tasks) {
  const map = new Map(tasks.map((task) => [task.id, task.depends_on]));
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error(`Task dependency cycle includes ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of map.get(id) || []) visit(dep);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of map.keys()) visit(id);
}

export function recordUnderstanding(payload, root = findRoot()) {
  const { paths, state } = loadProject(root);
  for (const item of asObjects(payload.confirmed, 'text')) {
    if (!item.text) throw new Error('Confirmed fact requires text');
    state.understanding.confirmed.push({ id: nextId(state.understanding.confirmed, 'F'), text: item.text, source: item.source || 'conversation', at: now() });
  }
  for (const item of asObjects(payload.assumptions, 'text')) {
    if (!item.text) throw new Error('Assumption requires text');
    state.understanding.assumptions.push({ id: nextId(state.understanding.assumptions, 'A'), text: item.text, status: 'active', source: item.source || 'agent', at: now() });
  }
  for (const item of asObjects(payload.unresolved, 'question')) {
    if (!item.question) throw new Error('Unresolved item requires question');
    state.understanding.unresolved.push({ id: nextId(state.understanding.unresolved, 'Q'), question: item.question, impact: item.impact || 'medium', status: 'open', at: now() });
  }
  for (const item of payload.resolved || []) {
    const target = state.understanding.unresolved.find((candidate) => candidate.id === item.id);
    if (!target) throw new Error(`Unknown unresolved id ${item.id}`);
    target.status = item.status === 'skipped' ? 'skipped' : 'resolved';
    target.resolution = item.resolution || '';
    target.resolved_at = now();
  }
  for (const id of payload.retire_assumptions || []) {
    const target = state.understanding.assumptions.find((candidate) => candidate.id === id);
    if (!target) throw new Error(`Unknown assumption id ${id}`);
    target.status = 'retired';
  }
  if (payload.project_status) throw new Error('Project status is controlled by ready, Keeper, and Task commands');
  for (const decision of payload.decisions || []) appendDecision(paths.decisions, decision, state);
  state.project.updated_at = now();
  atomicJson(paths.state, state);
  return state.understanding;
}

function appendDecision(path, decision, state) {
  if (!decision.title || !decision.decision || !decision.rationale) throw new Error('Decision requires title, decision, and rationale');
  const prior = state.decision_ids || [];
  const id = nextId(prior.map((value) => ({ id: value })), 'D');
  state.decision_ids = [...prior, id];
  const supersedes = decision.supersedes?.length ? decision.supersedes.join(', ') : 'none';
  appendFileSync(path, `\n## ${id}: ${decision.title}\n\n- Current decision: ${decision.decision}\n- Rationale: ${decision.rationale}\n- Source: ${decision.source || 'conversation'}\n- Supersedes: ${supersedes}\n- Affects: ${(decision.affects || []).join(', ') || 'project-wide or not yet classified'}\n- Recorded: ${now()}\n`, 'utf8');
}

export function createDesign(slug, options = {}, root = findRoot()) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error('Design slug must use lowercase letters, numbers, and hyphens');
  if (!options.title) throw new Error('Design document requires --title');
  if (!DESIGN_KINDS.includes(options.kind)) throw new Error(`Design kind must be one of: ${DESIGN_KINDS.join(', ')}`);
  const { paths } = loadProject(root);
  const path = join(paths.design, `${slug}.md`);
  if (existsSync(path)) throw new Error(`Design document already exists: ${slug}`);
  writeFileSync(path, designTemplate({ title: options.title, kind: options.kind }), 'utf8');
  return { slug, kind: options.kind, path: relative(paths.root, path).replaceAll('\\', '/') };
}

export function listDesigns(root = findRoot()) {
  const { paths } = loadProject(root);
  return readdirSync(paths.design).filter((name) => name.endsWith('.md')).sort();
}

export function getDesign(slug, root = findRoot()) {
  const { paths } = loadProject(root);
  const name = slug.endsWith('.md') ? slug : `${slug}.md`;
  if (basename(name) !== name) throw new Error('Invalid design document name');
  const path = join(paths.design, name);
  if (!existsSync(path)) throw new Error(`Design document not found: ${slug}`);
  return readFileSync(path, 'utf8');
}

export function createCapability(slug, options = {}, root = findRoot()) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error('Capability slug must use lowercase letters, numbers, and hyphens');
  if (!options.title) throw new Error('Capability requires --title');
  const { paths } = loadProject(root);
  const dirPath = join(paths.capabilities, slug);
  const legacyPath = join(paths.capabilities, `${slug}.md`);
  if (existsSync(dirPath) || existsSync(legacyPath)) throw new Error(`Capability already exists: ${slug}`);
  mkdirSync(join(dirPath, 'research'), { recursive: true });
  const capabilityPath = join(dirPath, 'capability.md');
  writeFileSync(capabilityPath, CAPABILITY_TEMPLATE({ title: options.title }), 'utf8');
  atomicJson(join(dirPath, 'status.json'), { status: 'researching', title: options.title, field: options.field || '', scenario: '', confirmed_at: '', created_at: now() });
  return { slug, path: relative(paths.root, capabilityPath).replaceAll('\\', '/') };
}

export function listCapabilities(root = findRoot()) {
  const { paths } = loadProject(root);
  const entries = readdirSync(paths.capabilities, { withFileTypes: true });
  const names = entries
    .filter((entry) => (entry.isDirectory() && existsSync(join(paths.capabilities, entry.name, 'capability.md'))) || (entry.isFile() && entry.name.endsWith('.md')))
    .map((entry) => (entry.isDirectory() ? entry.name : entry.name))
    .sort();
  return names;
}

export function getCapability(slug, root = findRoot()) {
  const { paths } = loadProject(root);
  const cleanSlug = slug.endsWith('.md') ? slug.slice(0, -3) : slug;
  if (basename(cleanSlug) !== cleanSlug) throw new Error('Invalid capability name');
  const dirPath = join(paths.capabilities, cleanSlug);
  const dirCapability = join(dirPath, 'capability.md');
  if (existsSync(dirCapability)) return readFileSync(dirCapability, 'utf8');
  const legacyPath = join(paths.capabilities, `${cleanSlug}.md`);
  if (existsSync(legacyPath)) return readFileSync(legacyPath, 'utf8');
  throw new Error(`Capability not found: ${slug}`);
}

export function researchCapability(slug, options = {}, root = findRoot()) {
  if (!options.field) throw new Error('Research requires --field <professional-field>');
  const { paths } = loadProject(root);
  const dir = join(paths.capabilities, slug);
  if (!existsSync(dir)) throw new Error(`Capability not found: ${slug}. Run loom capability add ${slug} --title <text> first.`);
  const statusPath = join(dir, 'status.json');
  if (!existsSync(statusPath)) throw new Error(`Capability ${slug} is not a research-directory dossier`);
  const status = readJson(statusPath, 'status.json');
  if (status.status === 'confirmed') {
    status.reopened_at = now();
    status.reopen_reason = options.reopen_reason || 'new evidence requires updating the capability';
  }
  status.field = options.field;
  status.status = 'researching';
  status.updated_at = now();
  atomicJson(statusPath, status);
  const researchDir = join(dir, 'research');
  mkdirSync(researchDir, { recursive: true });
  const guidePath = join(researchDir, '_guide.md');
  if (!existsSync(guidePath)) writeFileSync(guidePath, RESEARCH_GUIDE, 'utf8');
  return {
    slug,
    field: options.field,
    research_dir: relative(paths.root, researchDir).replaceAll('\\', '/'),
    status: 'researching',
    next: `Add .md files to research/ — one per expert narrative, case study, or methodology source. See research/_guide.md for what to write. Then run loom capability synthesize ${slug}.`,
  };
}

export function synthesizeCapability(slug, root = findRoot()) {
  const { paths } = loadProject(root);
  const dir = join(paths.capabilities, slug);
  if (!existsSync(dir)) throw new Error(`Capability not found: ${slug}`);
  const statusPath = join(dir, 'status.json');
  if (!existsSync(statusPath)) throw new Error(`Capability ${slug} is not a research-directory dossier`);
  const status = readJson(statusPath, 'status.json');
  if (status.status === 'confirmed') throw new Error(`Capability ${slug} is confirmed; run loom capability research ${slug} --field <text> to reopen it with new evidence`);
  const researchDir = join(dir, 'research');
  const materials = readdirSync(researchDir).filter((f) => f.endsWith('.md') && f !== '_guide.md').sort();
  if (!materials.length) throw new Error(`No research materials found in ${slug}/research/. Add .md files (one per expert narrative, case study, or methodology source). See research/_guide.md for guidance. Then run loom capability synthesize ${slug}.`);
  const capabilityPath = join(dir, 'capability.md');
  const content = readFileSync(capabilityPath, 'utf8');
  const nodePattern = /### (C\d+):/g;
  const nodes = [...content.matchAll(nodePattern)].map((m) => m[1]);
  if (!nodes.length) throw new Error('Capability has no decision tree nodes (### C1, C2, ...). Add nodes before synthesizing.');
  const missingSources = [];
  const missingCounterexamples = [];
  const danglingSources = [];
  const materialNames = materials.flatMap((f) => [f, f.slice(0, -3)]);
  for (const node of nodes) {
    const nodeSection = content.split(`### ${node}:`)[1]?.split('### ')[0] || '';
    if (!nodeSection.includes('source:')) missingSources.push(node);
    else {
      const sourceMatch = nodeSection.match(/source:\s*(.+)(?:\n|$)/);
      const cited = sourceMatch ? sourceMatch[1].trim() : '';
      if (cited && !materialNames.some((name) => cited.includes(name))) danglingSources.push(node);
    }
    if (!nodeSection.includes('counterexample:')) missingCounterexamples.push(node);
  }
  if (missingSources.length) throw new Error(`Decision tree nodes missing source citations: ${missingSources.join(', ')}. Every node must reference a research material.`);
  if (danglingSources.length) throw new Error(`Decision tree nodes cite sources not found in research/: ${danglingSources.join(', ')}. The source field should reference one of the research files.`);
  if (missingCounterexamples.length) throw new Error(`Decision tree nodes missing counterexamples: ${missingCounterexamples.join(', ')}. Every node must have a counterexample (a situation where an expert would NOT walk this path).`);
  status.status = 'synthesized';
  status.updated_at = now();
  atomicJson(statusPath, status);
  return { slug, status: 'synthesized', nodes: nodes.length, materials: materials.length };
}

export function confirmCapability(slug, options = {}, root = findRoot()) {
  if (!options.scenario || options.scenario.length < 20) throw new Error('Confirm requires --scenario <text> (at least 20 characters describing which expert situation this project most resembles)');
  const { paths } = loadProject(root);
  const dir = join(paths.capabilities, slug);
  if (!existsSync(dir)) throw new Error(`Capability not found: ${slug}`);
  const statusPath = join(dir, 'status.json');
  if (!existsSync(statusPath)) throw new Error(`Capability ${slug} is not a research-directory dossier`);
  const status = readJson(statusPath, 'status.json');
  if (status.status !== 'synthesized') throw new Error(`Capability ${slug} must be synthesized before confirmation. Run loom capability synthesize ${slug} first.`);
  status.scenario = options.scenario;
  status.status = 'confirmed';
  status.confirmed_at = now();
  status.updated_at = now();
  atomicJson(statusPath, status);
  const capabilityPath = join(dir, 'capability.md');
  const content = readFileSync(capabilityPath, 'utf8');
  const scenarioMatch = content.match(/(## Project scenario\n)([\s\S]*?)(\n## )/);
  if (scenarioMatch) {
    const prefix = scenarioMatch[1];
    const suffix = scenarioMatch[3];
    const blockquote = scenarioMatch[2].match(/(> [^\n]+\n)+/);
    const blockquoteText = blockquote ? blockquote[0] : '';
    const updated = content.replace(/## Project scenario\n[\s\S]*?\n## /, `${prefix}${blockquoteText}\n${options.scenario}\n${suffix}`);
    writeFileSync(capabilityPath, updated, 'utf8');
  }
  return { slug, status: 'confirmed', scenario: options.scenario };
}

export function getCapabilityStatus(slug, root = findRoot()) {
  const { paths } = loadProject(root);
  const dir = join(paths.capabilities, slug);
  const statusPath = join(dir, 'status.json');
  if (!existsSync(statusPath)) return { slug, status: 'legacy' };
  return { ...readJson(statusPath, 'status.json'), slug };
}

export function addDeliverable(slug, options = {}, root = findRoot()) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error('Deliverable slug must use lowercase letters, numbers, and hyphens');
  if (!options.title) throw new Error('Deliverable requires --title');
  if (!options.kind) throw new Error('Deliverable requires --kind (module, feature, behavior, interface, artifact, operational, verification, or other)');
  const { paths, deliverableStore } = loadProject(root);
  if (deliverableStore.deliverables.some((item) => item.slug === slug)) throw new Error(`Deliverable already exists: ${slug}`);
  const id = nextId(deliverableStore.deliverables, 'DLV');
  deliverableStore.deliverables.push({ id, slug, title: options.title, kind: options.kind, notes: options.notes || '', covered_by: [], created_at: now() });
  atomicJson(paths.deliverables, deliverableStore);
  return { id, slug, title: options.title, kind: options.kind };
}

export function listDeliverables(root = findRoot()) {
  const { deliverableStore } = loadProject(root);
  return deliverableStore.deliverables.map((item) => ({ id: item.id, slug: item.slug, title: item.title, kind: item.kind, covered: item.covered_by.length > 0 }));
}

export function checkDeliverableCoverage(root = findRoot()) {
  const { paths, taskStore, deliverableStore } = loadProject(root);
  const taskCovers = new Map();
  for (const task of taskStore.tasks) {
    for (const dlvId of task.covers || []) {
      if (!taskCovers.has(dlvId)) taskCovers.set(dlvId, []);
      taskCovers.get(dlvId).push(task.id);
    }
  }
  const uncovered = [];
  const covered = [];
  for (const dlv of deliverableStore.deliverables) {
    const tasks = taskCovers.get(dlv.id) || [];
    if (tasks.length === 0) uncovered.push({ id: dlv.id, slug: dlv.slug, title: dlv.title });
    else covered.push({ id: dlv.id, slug: dlv.slug, tasks });
  }
  let changed = false;
  for (const dlv of deliverableStore.deliverables) {
    const tasks = taskCovers.get(dlv.id) || [];
    const sorted = [...tasks].sort();
    const current = JSON.stringify(dlv.covered_by);
    const newVal = JSON.stringify(sorted);
    if (current !== newVal) { dlv.covered_by = sorted; changed = true; }
  }
  if (changed) atomicJson(paths.deliverables, deliverableStore);
  return { total: deliverableStore.deliverables.length, covered: covered.length, uncovered: uncovered.length, uncovered_items: uncovered, covered_items: covered };
}

function capabilityPath(paths, name) {
  const dirCapability = join(paths.capabilities, name, 'capability.md');
  if (existsSync(dirCapability)) return dirCapability;
  return join(paths.capabilities, name);
}

function capabilityTemplateResidue(content) {
  return content.includes('Name the established field, what expertise it contributes')
    || content.includes('<node name>')
    || content.includes('<which research material or expert narrative supports this node>');
}

function extractCapabilityNode(paths, nodeRef) {
  const parts = nodeRef.split('#');
  if (parts.length !== 2) return null;
  const [slug, nodeId] = parts;
  const capPath = capabilityPath(paths, slug);
  if (!existsSync(capPath)) return null;
  const content = readFileSync(capPath, 'utf8');
  const header = `### ${nodeId}:`;
  const headerIndex = content.indexOf(header);
  if (headerIndex === -1) return null;
  const afterHeader = content.slice(headerIndex + header.length);
  const nextNode = afterHeader.search(/### C\d+:/);
  const nextSection = afterHeader.search(/\n## /);
  let endIdx = afterHeader.length;
  if (nextNode !== -1) endIdx = Math.min(endIdx, nextNode);
  if (nextSection !== -1) endIdx = Math.min(endIdx, nextSection);
  return `${header}${afterHeader.slice(0, endIdx)}`;
}

export function importTasks(payload, root = findRoot()) {
  const { paths, taskStore } = loadProject(root);
  const incoming = Array.isArray(payload) ? payload : payload.tasks;
  if (!Array.isArray(incoming) || !incoming.length) throw new Error('Task plan requires a non-empty tasks array');
  for (const raw of incoming) {
    if (raw.status && raw.status !== 'open') throw new Error('New Work Map Tasks must start open; completion requires Task evidence');
    const id = raw.id || nextId(taskStore.tasks, 'TASK');
    if (taskStore.tasks.some((task) => task.id === id)) throw new Error(`Task already exists: ${id}`);
    taskStore.tasks.push({
      id,
      title: raw.title,
      outcome: raw.outcome,
      acceptance: raw.acceptance || [],
      done_when: raw.done_when || [],
      boundaries: raw.boundaries || [],
      depends_on: raw.depends_on || [],
      reads: raw.reads || ['.loom/PROJECT.md'],
      touches: raw.touches || [],
      implements: raw.implements || '',
      capability_hooks: raw.capability_hooks || [],
      covers: raw.covers || [],
      status: 'open',
      progress: raw.progress || { completed: [], current: '', next: '' },
      evidence: raw.evidence || [],
      created_at: now(),
      updated_at: now(),
    });
  }
  validateTasks(taskStore.tasks);
  atomicJson(paths.tasks, taskStore);
  return taskSummary(taskStore.tasks);
}

export function taskSummary(tasks) {
  return {
    total: tasks.length,
    open: tasks.filter((task) => task.status === 'open').length,
    active: tasks.find((task) => task.status === 'active')?.id || null,
    blocked: tasks.filter((task) => task.status === 'blocked').length,
    done: tasks.filter((task) => task.status === 'done').length,
  };
}

export function getTask(id, root = findRoot()) {
  const { taskStore } = loadProject(root);
  const task = id ? taskStore.tasks.find((item) => item.id === id) : nextTask(taskStore.tasks);
  if (!task) throw new Error(id ? `Task not found: ${id}` : 'No executable Task is available');
  return task;
}

function nextTask(tasks) {
  const active = tasks.find((task) => task.status === 'active');
  if (active) return active;
  const done = new Set(tasks.filter((task) => task.status === 'done').map((task) => task.id));
  return tasks.find((task) => task.status === 'open' && task.depends_on.every((id) => done.has(id))) || null;
}

export function updateTask(id, patch, root = findRoot()) {
  const { paths, taskStore } = loadProject(root);
  const task = taskStore.tasks.find((item) => item.id === id);
  if (!task) throw new Error(`Task not found: ${id}`);
  const allowed = ['title', 'outcome', 'acceptance', 'done_when', 'boundaries', 'depends_on', 'reads', 'touches', 'implements', 'capability_hooks', 'covers', 'progress', 'evidence'];
  for (const key of Object.keys(patch)) if (!allowed.includes(key)) throw new Error(`Task field cannot be updated: ${key}`);
  Object.assign(task, patch, { updated_at: now() });
  validateTasks(taskStore.tasks);
  atomicJson(paths.tasks, taskStore);
  return task;
}

export function blockTask(id, payload, root = findRoot()) {
  const task = getTask(id, root);
  if (task.status !== 'active') throw new Error(`${id} is not active`);
  if (!payload.reason || payload.reason.length < 10) throw new Error('Blocking a Task requires a concrete reason');
  if (!Array.isArray(payload.recovery_conditions) || !payload.recovery_conditions.length) throw new Error('Blocking a Task requires recovery_conditions');
  const evidence = Array.isArray(payload.evidence) ? payload.evidence : [];
  const { paths, taskStore } = loadProject(root);
  const target = taskStore.tasks.find((item) => item.id === id);
  target.status = 'blocked';
  target.block = { reason: payload.reason, recovery_conditions: payload.recovery_conditions, at: now() };
  target.progress = { ...target.progress, current: `blocked: ${payload.reason}`, next: payload.recovery_conditions.join('; ') };
  target.evidence = [...target.evidence, ...evidence];
  target.updated_at = now();
  validateTasks(taskStore.tasks);
  atomicJson(paths.tasks, taskStore);
  return target;
}

export function reopenTask(id, options = {}, root = findRoot()) {
  const { paths, taskStore } = loadProject(root);
  if (taskStore.tasks.some((task) => task.status === 'active')) throw new Error('Another Task is already active');
  const task = taskStore.tasks.find((item) => item.id === id);
  if (!task || !['blocked', 'done'].includes(task.status)) throw new Error(`${id} is neither blocked nor done`);
  if (task.status === 'done' && (!options.reason || options.reason.length < 10)) throw new Error('Reopening a done Task requires a concrete --reason');
  const priorStatus = task.status;
  task.status = 'open';
  if (priorStatus === 'done') {
    task.evidence.push({ type: 'completion_reopened', reason: options.reason, at: now() });
    task.progress = { ...task.progress, current: `completion reopened: ${options.reason}`, next: 'Re-run the Task and close every done condition with evidence.' };
  }
  task.reopened_at = now();
  task.updated_at = now();
  validateTasks(taskStore.tasks);
  atomicJson(paths.tasks, taskStore);
  const { state } = loadProject(root);
  if (state.project.status === 'complete') {
    state.project.status = 'building';
    state.project.updated_at = now();
    atomicJson(paths.state, state);
  }
  return task;
}

export function startTask(id, root = findRoot()) {
  const { paths, state, taskStore } = loadProject(root);
  if (!['passed', 'skipped'].includes(state.keeper.status)) throw new Error('The one-time Keeper handoff has not passed. Run loom keeper prompt.');
  if (taskStore.tasks.some((task) => task.status === 'active')) throw new Error('Another Task is already active');
  const task = taskStore.tasks.find((item) => item.id === id);
  if (!task || task.status !== 'open') throw new Error(`${id} is not open`);
  const done = new Set(taskStore.tasks.filter((item) => item.status === 'done').map((item) => item.id));
  const missing = task.depends_on.filter((dep) => !done.has(dep));
  if (missing.length) throw new Error(`${id} has incomplete dependencies: ${missing.join(', ')}`);
  for (const ref of task.reads) readContextDocument(paths, ref);
  task.status = 'active';
  task.updated_at = now();
  validateTasks(taskStore.tasks);
  atomicJson(paths.tasks, taskStore);
  state.project.status = 'building';
  state.project.updated_at = now();
  atomicJson(paths.state, state);
  return task;
}

export function completeTask(id, payload, root = findRoot()) {
  const { paths, state, taskStore } = loadProject(root);
  const task = taskStore.tasks.find((item) => item.id === id);
  if (!task) throw new Error(`Task not found: ${id}`);
  if (task.status !== 'active') throw new Error(`${id} is not active`);
  if (!Array.isArray(payload.evidence) || !payload.evidence.length) throw new Error('Completing a Task requires concrete evidence');
  const hasAcceptance = Array.isArray(task.acceptance) && task.acceptance.length > 0;
  if (hasAcceptance) {
    if (!Array.isArray(payload.acceptance_results)) throw new Error('Completing a Task with acceptance[] requires acceptance_results[]');
    const criteria = new Set(task.acceptance.map((acc) => acc.criterion));
    const seen = new Set();
    for (const result of payload.acceptance_results) {
      if (!result || !criteria.has(result.criterion)) throw new Error('acceptance_results criterion must match an exact acceptance criterion');
      if (seen.has(result.criterion)) throw new Error(`Duplicate acceptance result: ${result.criterion}`);
      if (!result.evidence || typeof result.evidence !== 'string' || result.evidence.length < 5) throw new Error(`acceptance result requires concrete evidence: ${result.criterion}`);
      seen.add(result.criterion);
    }
    const missingResults = task.acceptance.filter((acc) => !seen.has(acc.criterion));
    if (missingResults.length) throw new Error(`Task completion is missing acceptance results:\n- ${missingResults.map((acc) => acc.criterion).join('\n- ')}`);
    for (const result of payload.acceptance_results) {
      const acc = task.acceptance.find((acc) => acc.criterion === result.criterion);
      acc.evidence = result.evidence;
    }
    task.status = 'done';
    task.evidence = [...task.evidence, ...payload.evidence, { type: 'acceptance_results', results: payload.acceptance_results, at: now() }];
  } else {
    if (!Array.isArray(payload.checks)) throw new Error('Completing a Task with done_when[] requires checks for every done_when criterion');
    const criteria = new Set(task.done_when);
    const seen = new Set();
    for (const check of payload.checks) {
      if (!check || !criteria.has(check.criterion)) throw new Error('Task completion check must quote an exact done_when criterion');
      if (seen.has(check.criterion)) throw new Error(`Duplicate Task completion check: ${check.criterion}`);
      if (!Array.isArray(check.evidence) || !check.evidence.length) throw new Error(`Task completion check requires evidence: ${check.criterion}`);
      seen.add(check.criterion);
    }
    const missingChecks = task.done_when.filter((criterion) => !seen.has(criterion));
    if (missingChecks.length) throw new Error(`Task completion is missing done_when checks:\n- ${missingChecks.join('\n- ')}`);
    task.status = 'done';
    task.evidence = [...task.evidence, ...payload.evidence, { type: 'done_when_checks', checks: payload.checks, at: now() }];
  }
  task.progress = { ...task.progress, current: 'complete', next: '' };
  task.updated_at = now();
  validateTasks(taskStore.tasks);
  atomicJson(paths.tasks, taskStore);
  if (taskStore.tasks.length && taskStore.tasks.every((item) => item.status === 'done')) {
    state.project.status = 'complete';
    state.project.updated_at = now();
    atomicJson(paths.state, state);
  }
  return task;
}

export function markReady(root = findRoot()) {
  const { paths, state, taskStore } = loadProject(root);
  const project = readFileSync(paths.project, 'utf8');
  const designs = listDesigns(root);
  const capabilities = listCapabilities(root);
  const highOpen = state.understanding.unresolved.filter((item) => item.status === 'open' && item.impact === 'high');
  const errors = [];
  if (project.includes('> This is the concise entry point') || project.length < 400) errors.push('PROJECT.md still looks like a template');
  if (!designs.length) errors.push('No design document exists; PROJECT.md is an index, not the entire project design');
  const unfinishedDesigns = designs.filter((name) => readFileSync(join(paths.design, name), 'utf8').includes('Describe the project-specific decision, mechanism, boundary, or evidence owned by this section.'));
  if (unfinishedDesigns.length) errors.push(`Design documents still contain template instructions: ${unfinishedDesigns.join(', ')}`);
  const unfinishedCapabilities = capabilities.filter((name) => capabilityTemplateResidue(readFileSync(capabilityPath(paths, name), 'utf8')));
  if (unfinishedCapabilities.length) errors.push(`Capability dossiers still contain template instructions: ${unfinishedCapabilities.join(', ')}`);
  if (!taskStore.tasks.length) errors.push('The initial work map is empty');
  if (highOpen.length) errors.push(`High-impact questions remain open: ${highOpen.map((item) => item.id).join(', ')}`);
  const digest = projectDigest(paths, taskStore.tasks);
  const latestKeeper = state.keeper.attempts.at(-1);
  if (['needs_revision', 'blocked'].includes(state.keeper.status) && latestKeeper?.prepared_digest === digest) {
    errors.push('Keeper requested revision, but project truth and Task definitions have not changed');
  }
  if (errors.length) throw new Error(`Project is not ready for Keeper:\n- ${errors.join('\n- ')}`);
  if (latestKeeper?.can_auto_pass && latestKeeper.prepared_digest !== digest) {
    state.keeper.status = 'passed';
    state.project.status = 'build_ready';
    state.project.updated_at = now();
    state.keeper.auto_passed = true;
    atomicJson(paths.state, state);
    return { ready_for_keeper: false, auto_passed: true, next: 'Keeper minor gaps fixed; auto-passed without a new Keeper round' };
  }
  state.project.status = 'ready_for_keeper';
  state.project.updated_at = now();
  state.keeper.prepared_digest = digest;
  state.keeper.prepared_attempt = state.keeper.attempts.length + 1;
  atomicJson(paths.state, state);
  return { ready_for_keeper: true, digest: state.keeper.prepared_digest, next: 'Open a fresh Agent and run loom keeper prompt' };
}

function projectDigest(paths, tasks) {
  const hash = createHash('sha256');
  hash.update(readFileSync(paths.project));
  hash.update(readFileSync(paths.decisions));
  for (const name of readdirSync(paths.design).filter((file) => file.endsWith('.md')).sort()) hash.update(readFileSync(join(paths.design, name)));
  for (const name of listCapabilities()) {
    hash.update(readFileSync(capabilityPath(paths, name), 'utf8'));
    const statusPath = join(paths.capabilities, name, 'status.json');
    if (existsSync(statusPath)) hash.update(readFileSync(statusPath, 'utf8'));
  }
  hash.update(JSON.stringify(tasks.map(({ progress, evidence, status, updated_at, ...definition }) => definition)));
  return hash.digest('hex');
}

export function getKeeperPrompt(root = findRoot()) {
  const { state } = loadProject(root);
  if (state.project.status !== 'ready_for_keeper') throw new Error('Run loom project ready before Keeper handoff');
  return keeperProtocol({ attemptNumber: state.keeper.prepared_attempt, preparedDigest: state.keeper.prepared_digest });
}

export function recordKeeper(payload, root = findRoot()) {
  const { paths, state, taskStore } = loadProject(root);
  if (state.project.status !== 'ready_for_keeper') throw new Error('Keeper result cannot be recorded before loom project ready');
  if (!['passed', 'needs_revision', 'blocked'].includes(payload.verdict)) throw new Error('Keeper verdict must be passed, needs_revision, or blocked');
  if (!payload.summary || !Array.isArray(payload.evidence) || !payload.evidence.length) throw new Error('Keeper result requires summary and evidence');
  if (payload.evidence.some((item) => typeof item !== 'string' || !item.trim())) throw new Error('Keeper evidence entries must be non-empty strings');
  if (payload.gaps !== undefined && !Array.isArray(payload.gaps)) throw new Error('Keeper gaps must be an array');
  for (const gap of payload.gaps || []) {
    if (typeof gap === 'string' && gap.trim()) continue;
    if (gap && typeof gap === 'object' && typeof gap.gap === 'string' && gap.gap.trim()) continue;
    throw new Error('Each Keeper gap must be a non-empty string or an object with a gap field');
  }
  const blockingGaps = (payload.gaps || []).filter((gap) => {
    if (typeof gap === 'string') return true;
    if (typeof gap === 'object' && gap.severity !== 'minor') return true;
    return false;
  });
  const minorGaps = (payload.gaps || []).filter((gap) => {
    if (typeof gap === 'object' && gap.severity === 'minor') return true;
    return false;
  });
  const canAutoPass = payload.verdict === 'needs_revision' && blockingGaps.length === 0 && minorGaps.length > 0 && minorGaps.length <= 3;
  if (!payload.run_id || payload.run_id.length < 6) throw new Error('Keeper result requires a unique fresh-thread run_id');
  if (state.keeper.attempts.some((attempt) => attempt.run_id === payload.run_id)) throw new Error(`Keeper run_id was already used: ${payload.run_id}`);
  if (!payload.prepared_digest || payload.prepared_digest !== state.keeper.prepared_digest) throw new Error('Keeper result prepared_digest does not match the current ready state');
  const currentDigest = projectDigest(paths, taskStore.tasks);
  if (currentDigest !== state.keeper.prepared_digest) throw new Error('Project truth changed after loom project ready; prepare a new Keeper attempt');
  const attempt = { run_id: payload.run_id, prepared_digest: payload.prepared_digest, verdict: payload.verdict, summary: payload.summary, evidence: payload.evidence, gaps: payload.gaps || [], can_auto_pass: canAutoPass, at: now() };
  state.keeper.attempts.push(attempt);
  state.keeper.status = payload.verdict;
  if (payload.verdict === 'passed') state.project.status = 'build_ready';
  else state.project.status = 'shaping';
  state.project.updated_at = now();
  atomicJson(paths.state, state);
  return state.keeper;
}

export function skipKeeper(reason, root = findRoot()) {
  if (!reason || reason.length < 10) throw new Error('Skipping Keeper requires a concrete reason');
  const { paths, state } = loadProject(root);
  if (state.project.status !== 'ready_for_keeper') throw new Error('Keeper can only be skipped after loom project ready');
  state.keeper.status = 'skipped';
  state.keeper.skip_reason = reason;
  state.project.status = 'build_ready';
  state.project.updated_at = now();
  atomicJson(paths.state, state);
  return state.keeper;
}

export function recordDecision(payload, root = findRoot()) {
  if (!payload || !payload.summary || payload.summary.length < 10) throw new Error('Decision requires --summary (what changed and why)');
  if (!payload.changes || !Array.isArray(payload.changes) || !payload.changes.length) throw new Error('Decision requires --changes (array of affected files or decisions)');
  const { paths } = loadProject(root);
  const id = `D-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36).slice(-4)}`;
  const entry = `## ${id}: ${payload.summary}\n\n- Changed: ${payload.changes.join(', ')}\n${payload.affected_tasks ? `- Affected tasks: ${payload.affected_tasks.join(', ')}\n` : ''}- At: ${now()}\n`;
  const existing = readFileSync(paths.decisions, 'utf8');
  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  writeFileSync(paths.decisions, existing + separator + entry, 'utf8');
  return { id, summary: payload.summary, changes: payload.changes, affected_tasks: payload.affected_tasks || [] };
}

export function compileContext(options = {}, root = findRoot()) {
  const { paths, state, taskStore } = loadProject(root);
  const designs = listDesigns(root);
  const capabilities = listCapabilities(root);
  const summary = taskSummary(taskStore.tasks);
  const task = options.taskId ? getTask(options.taskId, root) : taskStore.tasks.find((item) => item.status === 'active');
  const next = nextTask(taskStore.tasks);
  const recommendation = task
    ? `You have an active Task: ${task.id}. Read the Active Task, its reads, and the Capability decision points below. Then take the smallest action that advances the outcome inside the boundaries. Update progress or mark done only with concrete evidence.`
    : next
      ? `No active Task. The next executable Task is ${next.id}. Start it with \`loom task start ${next.id}\` if the project is build_ready, or run \`loom project ready\` if not. If the next Task is wrong, repair the Work Map first.`
      : state.project.status === 'complete'
        ? 'All Tasks are done. Run \`loom check\` to verify health. If new work arises, record the decision and update the Work Map.'
        : state.project.status === 'shaping'
          ? 'Project is still shaping. Confirm the intended result, identify open questions, and build the Work Map before starting material work.'
          : 'No executable Task. Create or update Tasks so the Work Map matches the project goal.';
  const statusBlock = `## Current LOOM state and recommended action\n\n- Project status: ${state.project.status}\n- Active task: ${summary.active || 'none'}\n- Work map: ${summary.total} total, ${summary.open} open, ${summary.done} done, ${summary.blocked} blocked\n- Design documents: ${designs.length}\n- Capability dossiers: ${capabilities.length}\n- Keeper status: ${state.keeper.status}\n\n**Recommended next action:** ${recommendation}\n\nThis is a recommendation, not a script. Use your judgment; if you choose differently, record the reason in \`.loom/DECISIONS.md\` or the active Task evidence.`;
  const blocks = [statusBlock, agentProtocol({ humanChannel: options.humanChannel || 'available' }), shapingContext({ state, taskSummary: summary, capabilityNames: capabilities, designNames: designs, forKeeper: Boolean(options.keeper) })];
  blocks.push(`## Project whole (${normalizeRef(paths, paths.project)})\n\n${readFileSync(paths.project, 'utf8')}`);
  if (existsSync(paths.structure)) blocks.push(`## Project structure (${normalizeRef(paths, paths.structure)})\n\n${readFileSync(paths.structure, 'utf8')}`);
  if (options.keeper) {
    blocks.unshift(keeperProtocol({ attemptNumber: state.keeper.prepared_attempt, preparedDigest: state.keeper.prepared_digest }));
    blocks.push(`## Decision history (${normalizeRef(paths, paths.decisions)})\n\n${readFileSync(paths.decisions, 'utf8')}`);
    blocks.push(`## Work map summary\n\n${JSON.stringify(summary, null, 2)}\n\nFirst executable Task:\n\n${JSON.stringify(nextTask(taskStore.tasks), null, 2)}`);
    for (const name of designs) blocks.push(`## Design document: ${name}\n\n${getDesign(name, root)}`);
    for (const name of capabilities) blocks.push(`## Capability dossier: ${name}\n\n${getCapability(name, root)}`);
  } else if (task) {
    blocks.push(EXECUTION_PROTOCOL);
    blocks.push(`## Active Task\n\n${JSON.stringify(task, null, 2)}`);
    for (const ref of task.reads) {
      const content = readContextDocument(paths, ref);
      if (content && ref.replaceAll('\\', '/') !== normalizeRef(paths, paths.project)) blocks.push(`## Task context: ${ref}\n\n${content}`);
    }
    if (task.capability_hooks && task.capability_hooks.length) {
      const hookBlocks = [];
      for (const hook of task.capability_hooks) {
        const nodeContent = extractCapabilityNode(paths, hook.node);
        if (nodeContent) {
          const atLine = hook.at ? `\n\n**Activate at:** ${hook.at}` : '';
          const produceLine = hook.must_produce ? `\n\n**Must produce:** ${hook.must_produce}` : '';
          hookBlocks.push(`### Capability hook: ${hook.node}${atLine}${produceLine}\n\n${nodeContent}`);
        }
      }
      if (hookBlocks.length) blocks.push(`## Capability decision points\n\nYou are at specific decision-tree nodes from professional capability dossiers. Use them to inform your judgment — each node carries options, criteria, a source, and a counterexample. If the evidence points somewhere the tree does not cover, trust the evidence and update the capability.\n\n${hookBlocks.join('\n\n')}`);
    }
  } else {
    blocks.push(`## On-demand project context\n\n- Decision history: .loom/DECISIONS.md (read when correction or lineage matters)\n${designs.length ? designs.map((name) => `- Design: .loom/design/${name}`).join('\n') : '- No design documents yet; split the whole according to consequential systems and decisions.'}\n${capabilities.length ? capabilities.map((name) => `- Professional capability: .loom/capabilities/${name}`).join('\n') : '- No professional capability dossiers yet; create separate field dossiers only where expertise changes the work.'}`);
  }
  return blocks.filter(Boolean).join('\n\n---\n\n');
}

function normalizeRef(paths, absolute) {
  const loomPrefix = `${paths.loom}${process.platform === 'win32' ? '\\' : '/'}`;
  if (absolute === paths.loom || absolute.startsWith(loomPrefix)) return `.loom/${relative(paths.loom, absolute).replaceAll('\\', '/')}`.replace(/\/$/, '');
  return relative(paths.root, absolute).replaceAll('\\', '/');
}

function readContextDocument(paths, ref) {
  const normalized = ref.replaceAll('\\', '/');
  if (isAbsolute(normalized) || normalized.startsWith('/') || normalized.includes('..')) throw new Error(`Unsafe context reference: ${ref}`);
  const fromLoom = normalized === '.loom' || normalized.startsWith('.loom/');
  const base = fromLoom ? paths.loom : paths.root;
  const relativeRef = fromLoom ? normalized.slice('.loom'.length).replace(/^\//, '') : normalized;
  const absolute = resolve(base, relativeRef);
  const prefix = `${base}${process.platform === 'win32' ? '\\' : '/'}`;
  if (!absolute.startsWith(prefix) && absolute !== base) throw new Error(`Unsafe context reference: ${ref}`);
  if (!existsSync(absolute)) throw new Error(`Task context file does not exist: ${ref}`);
  if (!statSync(absolute).isFile()) throw new Error(`Task context must name a file, not a directory: ${ref}`);
  return readFileSync(absolute, 'utf8');
}

export function checkProject(root = findRoot()) {
  const { paths, state, taskStore } = loadProject(root);
  const errors = [];
  const warnings = [];
  for (const task of taskStore.tasks) {
    for (const ref of task.reads) {
      try { readContextDocument(paths, ref); } catch (error) { errors.push(`${task.id}: ${error.message}`); }
    }
    if (task.capability_hooks) {
      for (const hook of task.capability_hooks) {
        const nodeContent = extractCapabilityNode(paths, hook.node);
        if (nodeContent === null) warnings.push(`${task.id} references missing capability node: ${hook.node}`);
      }
    }
    const hasAcceptance = Array.isArray(task.acceptance) && task.acceptance.length > 0;
    const hasDoneWhen = Array.isArray(task.done_when) && task.done_when.length > 0;
    if (!hasAcceptance && hasDoneWhen) warnings.push(`${task.id} uses done_when[] without acceptance[] — consider migrating to structured acceptance for clearer verification`);
  }
  if (state.project.status === 'build_ready' && !['passed', 'skipped'].includes(state.keeper.status)) errors.push('Project is build_ready without Keeper pass or explicit skip');
  if (state.understanding.unresolved.some((item) => item.status === 'open' && item.impact === 'high')) warnings.push('High-impact uncertainty remains open');
  const decisionsContent = readFileSync(paths.decisions, 'utf8');
  const affectedMatches = [...decisionsContent.matchAll(/Affected tasks: (.+)/g)];
  const allAffected = new Set();
  for (const match of affectedMatches) {
    for (const taskId of match[1].split(',').map((s) => s.trim()).filter(Boolean)) allAffected.add(taskId);
  }
  for (const taskId of allAffected) {
    const task = taskStore.tasks.find((item) => item.id === taskId);
    if (task && task.status === 'done') warnings.push(`${taskId} is done but was marked affected by a decision; consider reopening if the change invalidates prior work`);
  }
  if (!listCapabilities(root).length) warnings.push('No capability dossier exists; acceptable only when specialist judgment would not change the work');
  if (!listDesigns(root).length) warnings.push('No design document exists; PROJECT.md should remain a concise map of the whole');
  if (!existsSync(paths.structure)) warnings.push('No STRUCTURE.md exists; declare where files go so the Agent does not guess');
  else if (readFileSync(paths.structure, 'utf8').includes('Where implementation files go. Example:')) warnings.push('STRUCTURE.md still contains template instructions; customize it for this project');
  for (const name of listDesigns(root)) {
    if (readFileSync(join(paths.design, name), 'utf8').includes('Describe the project-specific decision, mechanism, boundary, or evidence owned by this section.')) warnings.push(`Design document still contains template instructions: ${name}`);
  }
  for (const name of listCapabilities(root)) {
    const content = readFileSync(capabilityPath(paths, name), 'utf8');
    if (capabilityTemplateResidue(content)) warnings.push(`Capability dossier still contains template instructions: ${name}`);
    if (content.includes('### C') && !content.includes('source:')) warnings.push(`Capability dossier has decision tree nodes without source citations: ${name}`);
    const statusPath = join(paths.capabilities, name, 'status.json');
    if (existsSync(statusPath)) {
      const capStatus = readJson(statusPath, 'status.json');
      if (capStatus.status && capStatus.status !== 'confirmed') warnings.push(`Capability ${name} is ${capStatus.status}, not confirmed; tasks referencing it proceed provisionally`);
    }
  }
  const coverage = checkDeliverableCoverage(root);
  if (coverage.uncovered > 0) warnings.push(`Uncovered deliverables: ${coverage.uncovered_items.map((item) => item.slug).join(', ')}`);
  return { healthy: errors.length === 0, errors, warnings, summary: taskSummary(taskStore.tasks), deliverable_coverage: { total: coverage.total, covered: coverage.covered, uncovered: coverage.uncovered } };
}

export function scaffoldEval(payload, root = findRoot()) {
  if (!payload.id || !payload.title || !payload.brief) throw new Error('Eval scenario requires id, title, and brief');
  const { paths } = loadProject(root);
  const slug = payload.id.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const dir = join(paths.eval, slug);
  if (existsSync(dir)) throw new Error(`Eval scenario already exists: ${payload.id}`);
  mkdirSync(dir, { recursive: true });
  const humanChannel = payload.human_channel || 'available';
  if (!['available', 'unavailable'].includes(humanChannel)) throw new Error('human_channel must be available or unavailable');
  const manifest = {
    schema_version: 1,
    id: payload.id,
    title: payload.title,
    brief: payload.brief,
    primary_comparison: 'same capable Agent without LOOM vs with LOOM',
    hidden_user_facts: payload.hidden_user_facts || [],
    success_criteria: payload.success_criteria || [],
    conditions: [
      { id: 'baseline', framework: 'none', instruction: 'Work normally with all ordinary Agent capabilities and tools.' },
      { id: 'loom', framework: 'loom-v2', instruction: 'Use LOOM as invisible Agent continuity infrastructure.' },
    ],
    controls: {
      same_model_tools_workspace_and_budget: true,
      human_channel: humanChannel,
      minimum_repetitions_per_condition: payload.repetitions || 3,
      scripted_user_answers: true,
      context_reset_points: payload.context_reset_points || ['after-shaping', 'mid-task'],
      blind_pairwise_order_swap: true,
      anonymization_preserves_relative_layout: true,
      judge_packet_preflight_required: true,
      condition_output_digest_manifest: true,
    },
    measures: ['intent_fidelity', 'question_value', 'whole_project_coverage', 'capability_depth', 'buildability', 'continuity_after_reset', 'user_burden', 'cost_and_time'],
  };
  atomicJson(join(dir, 'manifest.json'), manifest);
  writeFileSync(join(dir, 'baseline-prompt.md'), `${evalConditionPrompt({ brief: payload.brief, loom: false, humanChannel })}\n`, 'utf8');
  writeFileSync(join(dir, 'loom-prompt.md'), `${evalConditionPrompt({ brief: payload.brief, loom: true, humanChannel })}\n`, 'utf8');
  writeFileSync(join(dir, 'judge-prompt.md'), `${evalJudgePrompt()}\n`, 'utf8');
  return { scenario: payload.id, path: normalizeRef(paths, dir), controls: manifest.controls };
}
