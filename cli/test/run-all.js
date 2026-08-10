import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const cli = resolve('cli/bin/loom.js');
const roots = [];
let passed = 0;

function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'loom-v2-'));
  roots.push(root);
  return root;
}

function run(root, args, expected = 0) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
  if (result.status !== expected) {
    throw new Error(`Command failed (${result.status}, expected ${expected}): loom ${args.join(' ')}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  return expected === 0 ? result.stdout.trim() : result.stderr.trim();
}

function json(root, name, value) {
  const path = join(root, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return path;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}\n    ${error.message.replaceAll('\n', '\n    ')}`);
    process.exitCode = 1;
  }
}

console.log('LOOM v2 minimal loop');

test('init creates one small, human-readable project skeleton', () => {
  const root = workspace();
  const result = JSON.parse(run(root, ['init']));
  assert(result.initialized === true, 'init should initialize');
  for (const file of ['.loom/PROJECT.md', '.loom/DECISIONS.md', '.loom/state.json', '.loom/tasks.json']) {
    assert(existsSync(join(root, file)), `${file} missing`);
  }
  assert(existsSync(join(root, '.loom', 'design')), 'design directory missing');
  assert(existsSync(join(root, '.loom', 'capabilities')), 'capability directory missing');
  assert(!existsSync(join(root, '.loom', 'v1')), 'v2 must not recreate version ceremony');
  assert(readFileSync(join(root, 'AGENTS.md'), 'utf8').includes('loom context'), 'Agent anchor missing');
  assert(readFileSync(join(root, 'AGENTS.md'), 'utf8').includes('after a context reset'), 'Agent recovery trigger missing');
  assert(JSON.parse(run(root, ['init'])).reason === 'already_initialized', 'repeat init should be safe');
});

test('context teaches adaptive question judgment without a fixed questionnaire', () => {
  const root = workspace();
  run(root, ['init']);
  const context = run(root, ['context']);
  assert(context.includes('uncertainty frontier'), 'uncertainty frontier missing');
  assert(context.includes('do not follow a fixed questionnaire'), 'adaptive questioning rule missing');
  assert(context.includes('The human talks naturally to you'), 'invisible CLI boundary missing');
  assert(context.includes('one recognizable field'), 'professional field boundary missing');
  assert(context.includes('Do not compress a complex product into PROJECT.md'), 'document graph rule missing');
  assert(!context.includes('# LOOM active Task execution protocol'), 'execution protocol inflated shaping context');
  const prompts = JSON.parse(run(root, ['prompts']));
  assert(prompts.layers.stable_core.includes('consequential'), 'stable prompt layer missing');
  assert(prompts.layers.execution_protocol.includes('Recover before changing anything'), 'execution prompt layer missing');
  assert(prompts.composition.active_task.includes('execution_protocol'), 'execution prompt is not composed into active Tasks');
  assert(Object.keys(prompts.templates.design_documents).length === 7, 'design prompt inventory incomplete');
  assert(prompts.evaluation.blind_judge.includes('anonymized runs'), 'eval prompt inventory incomplete');
  assert(!context.includes('Capability Graph'), 'legacy ceremony leaked into v2 context');
});

test('record preserves facts, assumptions, uncertainty, and superseding decisions', () => {
  const root = workspace();
  run(root, ['init']);
  json(root, 'record.json', {
    confirmed: ['The human speaks naturally to the Agent.'],
    assumptions: [{ text: 'The first release is local-only.', source: 'agent' }],
    unresolved: [{ question: 'May the first release change remote state?', impact: 'high' }],
    decisions: [{ title: 'Agent-only CLI', decision: 'The CLI remains invisible to humans.', rationale: 'LOOM supports the Agent rather than becoming user workflow.', supersedes: [] }],
  });
  const state = JSON.parse(run(root, ['record', '--json-file', 'record.json']));
  assert(state.confirmed[0].id === 'F-001', 'fact id missing');
  assert(state.assumptions[0].id === 'A-001', 'assumption id missing');
  assert(state.unresolved[0].id === 'Q-001', 'question id missing');
  const decisions = readFileSync(join(root, '.loom', 'DECISIONS.md'), 'utf8');
  assert(decisions.includes('D-001: Agent-only CLI'), 'decision history missing');
  assert(decisions.includes('Supersedes: none'), 'superseding record missing');
  assert(!run(root, ['context']).includes('D-001: Agent-only CLI'), 'full decision history should remain on demand');
});

test('design documents scale by system while capability dossiers keep professional fields separate', () => {
  const root = workspace();
  run(root, ['init']);
  run(root, ['design', 'add', 'first-use-flow', '--title', 'First-use flow', '--kind', 'experience']);
  run(root, ['design', 'add', 'local-state', '--title', 'Local state system', '--kind', 'system']);
  assert(JSON.parse(run(root, ['design', 'list'])).length === 2, 'design document list mismatch');
  assert(run(root, ['design', 'get', 'local-state']).includes('## Data and state'), 'system design template missing');
  run(root, ['capability', 'add', 'ui-ux-design', '--title', 'UI/UX design']);
  run(root, ['capability', 'add', 'behavioral-psychology', '--title', 'Behavioral psychology']);
  const dossier = run(root, ['capability', 'get', 'ui-ux-design']);
  assert(dossier.includes('One dossier covers one recognizable professional field'), 'field boundary missing');
  assert(dossier.includes('Distinctive stance and rejected defaults'), 'authored stance missing');
  assert(dossier.includes('Relationships without merger'), 'cross-field boundary missing');
  assert(JSON.parse(run(root, ['capability', 'list'])).length === 2, 'capability list mismatch');
  const templateWarnings = JSON.parse(run(root, ['check'])).warnings.join('\n');
  assert(templateWarnings.includes('Design document still contains template instructions'), 'design template residue warning missing');
  assert(templateWarnings.includes('Capability dossier still contains template instructions'), 'capability template residue warning missing');
});

test('a long work map stays on disk while context remains focused', () => {
  const root = workspace();
  run(root, ['init']);
  const tasks = Array.from({ length: 250 }, (_, index) => ({
    title: `Work item ${index + 1}`,
    outcome: `Observable result ${index + 1} exists`,
    done_when: [`Evidence for result ${index + 1}`],
    depends_on: index === 0 ? [] : [`TASK-${String(index).padStart(3, '0')}`],
    reads: ['.loom/PROJECT.md'],
  }));
  json(root, 'tasks.json', { tasks });
  const summary = JSON.parse(run(root, ['task', 'plan', '--json-file', 'tasks.json']));
  assert(summary.total === 250, 'long work map was not imported');
  const context = run(root, ['context']);
  assert(context.includes('work map: 250 tasks'), 'context should summarize work map');
  assert(!context.includes('Work item 250'), 'context must not inject the full work map');
  assert(JSON.parse(run(root, ['task', 'next'])).id === 'TASK-001', 'first executable task mismatch');
});

test('ready gate requires a real whole, initial work map, and closed high-impact uncertainty', () => {
  const root = workspace();
  run(root, ['init']);
  json(root, 'record.json', { unresolved: [{ question: 'Which irreversible action is authorized?', impact: 'high' }] });
  run(root, ['record', '--json-file', 'record.json']);
  const early = run(root, ['project', 'ready'], 1);
  assert(early.includes('PROJECT.md still looks like a template'), 'template gate missing');
  assert(early.includes('No design document exists'), 'design document gate missing');
  assert(early.includes('initial work map is empty'), 'work map gate missing');
  assert(early.includes('Q-001'), 'uncertainty gate missing');
});

test('one-time Keeper handoff gates execution, supports revision, then disappears from Tasks', () => {
  const root = workspace();
  run(root, ['init']);
  writeFileSync(join(root, '.loom', 'PROJECT.md'), `# Project Whole\n\n## Intended result\nA restartable Agent workflow that understands the whole project before building.\n\n## People and reality\nA human collaborates naturally while the Agent silently preserves state.\n\n## Whole behavior\nThe Agent clarifies, records, builds a work map, resumes one Task, and proves it done.\n\n## Boundaries\nThe human never has to operate LOOM. Irreversible work needs authority.\n\n## System shape\nHuman-readable project truth plus structured Task state compiled by a CLI.\n\n## Completion and failure\nA fresh Agent can start without chat memory; document volume alone is failure.\n`, 'utf8');
  run(root, ['design', 'add', 'resume-context', '--title', 'Resume context system', '--kind', 'system']);
  const designPath = join(root, '.loom', 'design', 'resume-context.md');
  writeFileSync(designPath, `# Resume context system\n\n- Kind: system\n- Status: ready\n\n## Responsibility\nCompile only the current whole and active Task after a reset.\n\n## Boundary\nThe human never operates LOOM.\n\n## Interface\nThe compiler entry point is cli/src/store.js.\n\n## Verification\nRun node cli/test/run-all.js and inspect the forced-reset transcript.\n`, 'utf8');
  run(root, ['capability', 'add', 'human-agent-interaction', '--title', 'Human-Agent Interaction']);
  const capabilityPath = join(root, '.loom', 'capabilities', 'human-agent-interaction.md');
  writeFileSync(capabilityPath, `# Human-Agent Interaction\n\n## Field boundary\nThis field shapes continuity without taking user agency.\n\n## Project stance\nThe Task is a restartable checkpoint, not an exhaustive plan.\n\n## Consequences\nContext exposes the current outcome, boundary, next action, and evidence.\n\n## Proof\nA fresh Agent resumes without asking the human to repeat prior decisions.\n`, 'utf8');
  writeFileSync(join(root, 'INPUT.md'), '# Runtime fixture\n\nA forced-reset handoff must preserve the selected Task.\n', 'utf8');
  json(root, 'tasks.json', { tasks: [{ title: 'Implement resume context', outcome: 'A fresh Agent receives only decision-relevant context', done_when: ['Integration transcript proves context survives a reset'], boundaries: ['Do not expose CLI operation to the human'], reads: ['.loom/PROJECT.md', '.loom/design/resume-context.md', '.loom/capabilities/human-agent-interaction.md', 'INPUT.md'], touches: ['cli/src/store.js', 'cli/test/run-all.js'] }] });
  run(root, ['task', 'plan', '--json-file', 'tasks.json']);
  json(root, 'keeper-pass.json', { verdict: 'passed', summary: 'The project is build-ready.', evidence: ['PROJECT.md defines the whole and TASK-001 links the only required dossier.'] });
  assert(run(root, ['keeper', 'record', '--json-file', 'keeper-pass.json'], 1).includes('before loom project ready'), 'Keeper must not bypass ready state');
  assert(run(root, ['keeper', 'skip', '--reason', 'The host cannot create another isolated Agent'], 1).includes('after loom project ready'), 'Keeper skip must not bypass ready state');
  const firstReady = JSON.parse(run(root, ['project', 'ready']));
  assert(run(root, ['task', 'start', 'TASK-001'], 1).includes('Keeper handoff has not passed'), 'Task should be gated before Keeper');
  const firstPrompt = run(root, ['keeper', 'prompt']);
  assert(firstPrompt.includes('fresh Agent'), 'Keeper prompt missing isolation');
  assert(firstPrompt.includes(firstReady.digest), 'Keeper prompt missing prepared digest');
  json(root, 'keeper-needs.json', { run_id: 'keeper-run-001', prepared_digest: firstReady.digest, verdict: 'needs_revision', summary: 'The first action is underspecified.', evidence: ['TASK-001 does not identify the context compiler entry point.'], gaps: [{ gap: 'Name the CLI entry point.', why_it_blocks_start: 'A fresh Agent cannot locate the first edit.', evidence_to_close: 'The design document names the file and test command.' }] });
  run(root, ['keeper', 'record', '--json-file', 'keeper-needs.json']);
  const revisionContext = run(root, ['context']);
  assert(revisionContext.includes('Keeper feedback that must enter the next iteration'), 'Keeper feedback did not return to context');
  assert(revisionContext.includes('Name the CLI entry point.'), 'Keeper gap did not return to context');
  assert(revisionContext.includes('A fresh Agent cannot locate the first edit.'), 'structured Keeper rationale was lost');
  assert(revisionContext.includes('The design document names the file and test command.'), 'structured Keeper closure evidence was lost');
  assert(!revisionContext.includes('[object Object]'), 'structured Keeper gap was corrupted');
  assert(run(root, ['keeper', 'prompt'], 1).includes('project ready'), 'revision must be prepared again');
  assert(run(root, ['project', 'ready'], 1).includes('have not changed'), 'unchanged revision must not be rechecked');
  writeFileSync(join(root, '.loom', 'PROJECT.md'), `${readFileSync(join(root, '.loom', 'PROJECT.md'), 'utf8')}\n## First implementation entry\n\nThe first action begins in cli/src/store.js and is verified through the CLI integration test.\n`, 'utf8');
  const secondReady = JSON.parse(run(root, ['project', 'ready']));
  assert(run(root, ['keeper', 'prompt']).includes('could responsibly begin'), 'prepared revision should be checkable');
  const keeperRevisionContext = run(root, ['context', '--keeper']);
  assert(keeperRevisionContext.includes('Prior Keeper feedback this prepared revision claims to close'), 'fresh Keeper did not receive prior gaps as an audit checklist');
  assert(keeperRevisionContext.includes('Do not repair it yourself'), 'Keeper feedback conflicted with independent review role');
  json(root, 'keeper-duplicate.json', { run_id: 'keeper-run-001', prepared_digest: secondReady.digest, verdict: 'passed', summary: 'Duplicate run.', evidence: ['This must be rejected as non-independent.'] });
  assert(run(root, ['keeper', 'record', '--json-file', 'keeper-duplicate.json'], 1).includes('already used'), 'Keeper run_id must be unique');
  writeFileSync(capabilityPath, `${readFileSync(capabilityPath, 'utf8')}\nFresh evidence discovered after ready.\n`, 'utf8');
  json(root, 'keeper-stale.json', { run_id: 'keeper-run-stale', prepared_digest: secondReady.digest, verdict: 'passed', summary: 'Stale run.', evidence: ['This result used a stale prepared project.'] });
  assert(run(root, ['keeper', 'record', '--json-file', 'keeper-stale.json'], 1).includes('changed after'), 'stale prepared state must be rejected');
  const thirdReady = JSON.parse(run(root, ['project', 'ready']));
  json(root, 'keeper-pass.json', { run_id: 'keeper-run-002', prepared_digest: thirdReady.digest, verdict: 'passed', summary: 'The project is build-ready.', evidence: ['PROJECT.md defines the whole and TASK-001 links the only required dossier.'] });
  run(root, ['keeper', 'record', '--json-file', 'keeper-pass.json']);
  const restartableTask = JSON.parse(run(root, ['task', 'get', 'TASK-001']));
  json(root, 'bad-task-reads.json', { reads: [...restartableTask.reads, '.loom/design'] });
  run(root, ['task', 'update', 'TASK-001', '--json-file', 'bad-task-reads.json']);
  assert(run(root, ['task', 'start', 'TASK-001'], 1).includes('must name a file, not a directory'), 'Task start accepted a directory context reference');
  json(root, 'good-task-reads.json', { reads: restartableTask.reads });
  run(root, ['task', 'update', 'TASK-001', '--json-file', 'good-task-reads.json']);
  run(root, ['task', 'start', 'TASK-001']);
  assert(JSON.parse(readFileSync(join(root, '.loom', 'state.json'), 'utf8')).project.status === 'building', 'Task start should enter building state');
  const context = run(root, ['context']);
  assert(context.includes('## Active Task'), 'active Task missing from context');
  assert(context.includes('# LOOM active Task execution protocol'), 'active Task execution protocol missing');
  assert(context.includes('Inspect the current workspace and version-control state'), 'workspace recovery rule missing');
  assert(context.includes('do not manufacture a ceremonial unit test'), 'risk-based test rule missing');
  assert(context.includes('A branch, commit, or pull request is a delivery mechanism'), 'PR boundary missing');
  assert(context.includes('Human-Agent Interaction'), 'relevant capability was not compiled');
  assert(context.includes('restartable checkpoint'), 'project-specific stance was not injected');
  assert(context.includes('forced-reset handoff'), 'workspace fixture was not compiled');
  json(root, 'bypass.json', { status: 'done' });
  assert(run(root, ['task', 'update', 'TASK-001', '--json-file', 'bypass.json'], 1).includes('cannot be updated'), 'generic update must not bypass done evidence');
  json(root, 'block.json', { reason: 'The declared context entry point does not exist yet.', recovery_conditions: ['Create and verify the entry point'], evidence: ['Read-only inspection found no entry point.'] });
  run(root, ['task', 'block', 'TASK-001', '--json-file', 'block.json']);
  assert(JSON.parse(run(root, ['task', 'get', 'TASK-001'])).status === 'blocked', 'Task did not block');
  run(root, ['task', 'reopen', 'TASK-001']);
  run(root, ['task', 'start', 'TASK-001']);
  json(root, 'progress.json', { progress: { completed: ['Context selector implemented'], current: 'Testing forced reset', next: 'Run integration transcript' } });
  run(root, ['task', 'update', 'TASK-001', '--json-file', 'progress.json']);
  json(root, 'evidence-only.json', { evidence: ['A vague evidence list is not enough.'] });
  assert(run(root, ['task', 'done', 'TASK-001', '--json-file', 'evidence-only.json'], 1).includes('checks for every done_when'), 'Task completion accepted evidence without criterion coverage');
  const completionChecks = JSON.parse(run(root, ['task', 'get', 'TASK-001'])).done_when.map((criterion) => ({ criterion, evidence: ['node cli/test/run-all.js: forced-reset integration passed'] }));
  json(root, 'evidence.json', { evidence: ['node cli/test/run-all.js: forced-reset integration passed'], checks: completionChecks });
  const done = JSON.parse(run(root, ['task', 'done', 'TASK-001', '--json-file', 'evidence.json']));
  assert(done.status === 'done', 'Task did not close');
  assert(JSON.parse(readFileSync(join(root, '.loom', 'state.json'), 'utf8')).project.status === 'complete', 'last Task should complete project state');
  assert(run(root, ['task', 'reopen', 'TASK-001'], 1).includes('concrete --reason'), 'done Task reopened without a reason');
  run(root, ['task', 'reopen', 'TASK-001', '--reason', 'The prior completion evidence was disproven by a reset failure.']);
  assert(JSON.parse(run(root, ['task', 'get', 'TASK-001'])).status === 'open', 'done Task did not reopen');
  assert(JSON.parse(readFileSync(join(root, '.loom', 'state.json'), 'utf8')).project.status === 'building', 'reopening completion did not restore building state');
  run(root, ['task', 'start', 'TASK-001']);
  run(root, ['task', 'done', 'TASK-001', '--json-file', 'evidence.json']);
  assert(JSON.parse(run(root, ['check'])).healthy === true, 'project should remain healthy');
});

test('Evil Eval scaffold controls information, budget, resets, repetition, and judge order', () => {
  const root = workspace();
  run(root, ['init']);
  json(root, 'eval.json', {
    id: 'EVAL-001',
    title: 'Ambiguous multidisciplinary build',
    brief: 'Build a calming recovery tool from this existing repository.',
    hidden_user_facts: ['The user must retain manual control.'],
    success_criteria: ['A new Agent can resume after a forced reset.'],
  });
  const result = JSON.parse(run(root, ['eval', 'scaffold', '--json-file', 'eval.json']));
  const manifest = JSON.parse(readFileSync(join(root, result.path, 'manifest.json'), 'utf8'));
  assert(manifest.controls.same_model_tools_workspace_and_budget === true, 'equal-condition control missing');
  assert(manifest.controls.minimum_repetitions_per_condition === 3, 'repeat control missing');
  assert(manifest.controls.context_reset_points.length === 2, 'forced reset control missing');
  assert(manifest.controls.anonymization_preserves_relative_layout === true, 'anonymized layout invariant missing');
  assert(manifest.controls.judge_packet_preflight_required === true, 'judge packet preflight missing');
  assert(manifest.controls.condition_output_digest_manifest === true, 'condition output manifest missing');
  const judge = readFileSync(join(root, result.path, 'judge-prompt.md'), 'utf8');
  assert(judge.includes('randomized order'), 'blind random order missing');
  assert(judge.includes('order-sensitive conclusions'), 'order-swap check missing');
  assert(judge.includes('Penalize unnecessary ceremony'), 'ceremony cost is not measured');
});

test('help and source surface stay minimal', () => {
  const root = workspace();
  const help = run(root, ['--help']);
  for (const command of ['loom context', 'loom prompts', 'loom record', 'loom design add', 'loom capability add', 'loom task plan', 'loom keeper prompt', 'loom eval scaffold']) assert(help.includes(command), `${command} missing`);
  for (const legacy of ['Intent Map', 'Capability Graph', 'Atelier', 'Atlas', 'Weaver', 'Forge']) assert(!help.includes(legacy), `${legacy} leaked into minimal help`);
  assert(run(root, ['--version']) === 'loom 2.0.1', 'version mismatch');
});

for (const root of roots) rmSync(root, { recursive: true, force: true });

if (process.exitCode) {
  console.error(`\nResult: ${passed} passed, failures above`);
} else {
  console.log(`\nResult: ${passed} passed, 0 failed`);
}
