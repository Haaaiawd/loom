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
  return expected === 0 ? result.stdout.trim() : (result.stderr.trim() || result.stdout.trim());
}

function json(root, name, value) {
  const path = join(root, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return path;
}

function independentReview(reviewerId) {
  return { mode: 'independent', reviewer_id: reviewerId, evidence: 'Host opened a separate Agent without the shaping conversation.' };
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
  for (const file of ['.loom/PROJECT.md', '.loom/STRUCTURE.md', '.loom/DECISIONS.md', '.loom/state.json', '.loom/tasks.json', '.loom/deliverables.json']) {
    assert(existsSync(join(root, file)), `${file} missing`);
  }
  assert(existsSync(join(root, '.loom', 'design')), 'design directory missing');
  assert(existsSync(join(root, '.loom', 'capabilities')), 'capability directory missing');
  assert(!existsSync(join(root, '.loom', 'v1')), 'v2 must not recreate version ceremony');
  assert(readFileSync(join(root, 'AGENTS.md'), 'utf8').includes('loom context'), 'Agent anchor missing');
  assert(readFileSync(join(root, 'AGENTS.md'), 'utf8').includes('after a context reset'), 'Agent recovery trigger missing');
  assert(readFileSync(join(root, 'AGENTS.md'), 'utf8').includes('absolute path'), 'Agent anchor should explain source-checkout CLI recovery');
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
  assert(prompts.layers.environment_adaptation_unavailable.includes('Do not fabricate a user interaction'), 'unattended environment prompt missing');
  assert(prompts.layers.execution_protocol.includes('Recover before changing anything'), 'execution prompt layer missing');
  assert(prompts.composition.active_task.includes('execution_protocol'), 'execution prompt is not composed into active Tasks');
  assert(Object.keys(prompts.templates.design_documents).length === 7, 'design prompt inventory incomplete');
  assert(prompts.evaluation.blind_judge.includes('anonymized runs'), 'eval prompt inventory incomplete');
  assert(!context.includes('Capability Graph'), 'legacy ceremony leaked into v2 context');
});

test('unattended runs use an isolated sidecar without fabricating a human or polluting the workspace', () => {
  const root = workspace();
  const sidecar = workspace();
  run(root, ['init', '--state-dir', sidecar]);
  assert(!existsSync(join(root, '.loom')), 'sidecar mode wrote LOOM state into the scored workspace');
  assert(!existsSync(join(root, 'AGENTS.md')), 'sidecar mode edited the scored workspace anchor');
  assert(existsSync(join(sidecar, 'state.json')), 'sidecar state missing');
  assert(existsSync(join(sidecar, 'PROJECT.md')), 'sidecar project truth missing');
  json(root, 'tasks.json', {
    tasks: [{
      title: 'Read sidecar project truth',
      outcome: 'The Agent can load continuity state without editing the scored workspace.',
      done_when: ['Context loads the project truth from the isolated sidecar.'],
      boundaries: ['Do not write LOOM state into the scored workspace.'],
      reads: ['.loom/PROJECT.md'],
      touches: ['output.txt'],
    }],
  });
  run(root, ['task', 'plan', '--state-dir', sidecar, '--json-file', 'tasks.json']);
  const context = run(root, ['context', '--task', 'TASK-001', '--state-dir', sidecar, '--human-channel', 'unavailable']);
  assert(context.includes('Human response channel: unavailable'), 'unattended environment was not injected');
  assert(context.includes('Do not fabricate a user interaction'), 'unattended context may invent a user');
  assert(context.includes('never use web research as a substitute for user intent'), 'research boundary missing');
  assert(context.includes('## Project whole (.loom/PROJECT.md)'), 'sidecar project truth was not mapped back to its virtual LOOM reference');
  assert(JSON.parse(run(root, ['check', '--state-dir', sidecar])).healthy === true, 'sidecar task references are not checkable');
  assert(run(root, ['context', '--state-dir', sidecar, '--human-channel', 'unknown'], 1).includes('must be available or unavailable'), 'invalid human channel accepted');
  assert(run(root, ['init', '--state-dir', join(root, 'bad-sidecar')], 1).includes('outside the scored workspace'), 'workspace-local sidecar accepted');
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
  assert(dossier.includes('Decision tree'), 'decision tree section missing');
  assert(dossier.includes('### C1: <node name>'), 'named node structure missing');
  assert(dossier.includes('entry_when:'), 'node entry condition missing');
  assert(dossier.includes('source:'), 'node source citation field missing');
  assert(dossier.includes('counterexample:'), 'node counterexample field missing');
  assert(dossier.includes('Stance and rejected defaults'), 'stance section missing');
  assert(dossier.includes('Relationships without merger'), 'cross-field boundary missing');
  assert(JSON.parse(run(root, ['capability', 'list'])).length === 2, 'capability list mismatch');
  assert(existsSync(join(root, '.loom', 'capabilities', 'ui-ux-design', 'capability.md')), 'directory structure capability.md missing');
  assert(existsSync(join(root, '.loom', 'capabilities', 'ui-ux-design', 'research')), 'research directory missing');
  assert(existsSync(join(root, '.loom', 'capabilities', 'ui-ux-design', 'status.json')), 'status.json missing');
  const status = JSON.parse(readFileSync(join(root, '.loom', 'capabilities', 'ui-ux-design', 'status.json'), 'utf8'));
  assert(status.status === 'researching', 'initial capability status should be researching');
  const templateWarnings = JSON.parse(run(root, ['check'])).warnings.join('\n');
  assert(templateWarnings.includes('Design document still contains template instructions'), 'design template residue warning missing');
  assert(templateWarnings.includes('Capability dossier still contains template instructions'), 'capability template residue warning missing');
});

test('capability decision tree nodes require source citations', () => {
  const root = workspace();
  run(root, ['init']);
  run(root, ['capability', 'add', 'ui-ux-design', '--title', 'UI/UX design']);
  const capabilityPath = join(root, '.loom', 'capabilities', 'ui-ux-design', 'capability.md');
  writeFileSync(capabilityPath, `# UI/UX design\n\n## Field identity and boundary\nUI design for this project.\n\n## Project scenario\nToC web app.\n\n## Decision tree\n\n### C1: Choose visual direction\n- entry_when: starting a new UI surface\n- options:\n  - A: neo-brutalism\n  - B: minimal editorial\n- decide_by: brand voice and audience expectation\n- source: expert blog post on UI direction selection\n- counterexample: internal tool with no visual identity need\n- output: design decision D-visual-direction\n\n## Stance and rejected defaults\nWe refuse default component library styling.\n\n## Failure signals\nGeneric AI-generated UI patterns.\n\n## Relationships without merger\nAdjacent to behavioral-psychology capability.\n`, 'utf8');
  const healthyCheck = JSON.parse(run(root, ['check']));
  assert(!healthyCheck.warnings.join('\n').includes('without source citations'), 'check should not warn when sources exist');
  writeFileSync(capabilityPath, `# UI/UX design\n\n## Field identity and boundary\nUI design.\n\n## Project scenario\nToC.\n\n## Decision tree\n\n### C1: Choose direction\n- entry_when: starting\n- options:\n  - A: neo-brutalism\n- decide_by: brand\n- counterexample: internal tool\n- output: design decision\n\n## Stance\nRefuse defaults.\n\n## Failure signals\nGeneric patterns.\n\n## Relationships\nNone.\n`, 'utf8');
  const sourceWarningCheck = JSON.parse(run(root, ['check']));
  assert(sourceWarningCheck.warnings.join('\n').includes('without source citations'), 'check should warn when decision tree nodes lack source citations');
});

test('capability shaping lifecycle: research, synthesize, confirm gates execution', () => {
  const root = workspace();
  run(root, ['init']);
  run(root, ['capability', 'add', 'game-design', '--title', 'Game design']);
  assert(JSON.parse(run(root, ['capability', 'status', 'game-design'])).status === 'researching', 'initial status should be researching');
  assert(run(root, ['capability', 'synthesize', 'game-design'], 1).includes('No research materials'), 'synthesize should fail without research materials');
  const researchResult = JSON.parse(run(root, ['capability', 'research', 'game-design', '--field', 'Game design and player psychology']));
  const researchDir = join(root, '.loom', 'capabilities', 'game-design', 'research');
  assert(existsSync(join(researchDir, '_guide.md')), 'research should create _guide.md');
  assert(readFileSync(join(researchDir, '_guide.md'), 'utf8').includes('What to write'), '_guide.md should contain guidance');
  assert(researchResult.next && researchResult.next.includes('_guide.md'), 'research output should point to _guide.md');
  assert(run(root, ['capability', 'synthesize', 'game-design'], 1).includes('No research materials'), 'synthesize should fail when only _guide.md exists (no real research)');
  writeFileSync(join(researchDir, 'expert-narrative.md'), `# Expert narrative: designing calming games\n\nA game designer describes: I start by identifying the target emotional state, then choose mechanics that reinforce it. For calming games I avoid time pressure and loss conditions.\n`, 'utf8');
  const capabilityPath = join(root, '.loom', 'capabilities', 'game-design', 'capability.md');
  writeFileSync(capabilityPath, `# Game design\n\n## Field identity and boundary\nGame design for calming recovery tools.\n\n## Project scenario\nCalming recovery game.\n\n## Decision tree\n\n### C1: Choose core emotional direction\n- entry_when: starting a new game design\n- options:\n  - A: calming without challenge\n  - B: calming with gentle challenge\n- decide_by: target audience stress profile\n- source: expert narrative on designing calming games (see expert-narrative.md)\n- counterexample: a competitive game where calm is not the goal\n- output: design decision D-emotional-direction\n\n## Stance and rejected defaults\nWe refuse default game mechanics that create stress.\n\n## Failure signals\nPlayers report anxiety rather than calm.\n\n## Relationships without merger\nAdjacent to behavioral-psychology capability.\n`, 'utf8');
  const synthesizeResult = JSON.parse(run(root, ['capability', 'synthesize', 'game-design']));
  assert(synthesizeResult.status === 'synthesized', 'synthesize should set status to synthesized');
  assert(synthesizeResult.nodes === 1, 'synthesize should count decision tree nodes');
  assert(run(root, ['capability', 'confirm', 'game-design', '--scenario', 'short', '--source', 'human'], 1).includes('at least 20 characters'), 'confirm should reject short scenarios');
  assert(run(root, ['capability', 'confirm', 'game-design', '--scenario', 'A calming recovery game for stressed professionals needing gentle engagement without time pressure.'], 1).includes('--source human|agent'), 'confirm should require explicit authority provenance');
  const provisionalResult = JSON.parse(run(root, ['capability', 'confirm', 'game-design', '--scenario', 'A calming recovery game for stressed professionals needing gentle engagement without time pressure.', '--source', 'agent']));
  assert(provisionalResult.status === 'provisional', 'agent-selected scenario should remain provisional');
  assert(JSON.parse(run(root, ['capability', 'status', 'game-design'])).source === 'agent', 'status should preserve scenario provenance');
  assert(run(root, ['context', '--human-channel', 'unavailable']).includes('provisional'), 'context should surface provisional capability state');
  const confirmResult = JSON.parse(run(root, ['capability', 'confirm', 'game-design', '--scenario', 'A calming recovery game for stressed professionals needing gentle engagement without time pressure.', '--source', 'human']));
  assert(confirmResult.status === 'confirmed', 'human confirmation should upgrade provisional to confirmed');
  assert(JSON.parse(run(root, ['capability', 'status', 'game-design'])).status === 'confirmed', 'status command should report confirmed');
  const confirmedContent = run(root, ['capability', 'get', 'game-design']);
  assert(confirmedContent.includes('A calming recovery game for stressed professionals'), 'confirm should write scenario into capability.md');
});

test('synthesize rejects source citations that do not match a research file', () => {
  const root = workspace();
  run(root, ['init']);
  run(root, ['capability', 'add', 'ui-ux-design', '--title', 'UI/UX design']);
  const researchDir = join(root, '.loom', 'capabilities', 'ui-ux-design', 'research');
  writeFileSync(join(researchDir, 'real-source.md'), `# Real source

A designer describes how to choose a visual direction.
`, 'utf8');
  const capabilityPath = join(root, '.loom', 'capabilities', 'ui-ux-design', 'capability.md');
  writeFileSync(capabilityPath, `# UI/UX design

## Field identity and boundary
UI design.

## Project scenario
ToC web app.

## Decision tree

### C1: Choose visual direction
- entry_when: starting a new UI surface
- options:
  - A: neo-brutalism
  - B: minimal editorial
- decide_by: brand voice and audience expectation
- source: a fictional article not in research/
- counterexample: internal tool with no visual identity need
- output: design decision D-visual-direction

## Stance and rejected defaults
We refuse default component library styling.

## Failure signals
Generic AI-generated UI patterns.

## Relationships without merger
Adjacent to behavioral-psychology capability.
`, 'utf8');
  const errorMessage = run(root, ['capability', 'synthesize', 'ui-ux-design'], 1);
  assert(errorMessage.includes('cite sources not found in research'), 'synthesize should reject source citations that do not reference a research file');
  writeFileSync(capabilityPath, `# UI/UX design

## Field identity and boundary
UI design.

## Project scenario
ToC web app.

## Decision tree

### C1: Choose visual direction
- entry_when: starting a new UI surface
- options:
  - A: neo-brutalism
  - B: minimal editorial
- decide_by: brand voice and audience expectation
- source: real-source.md describes how to choose a visual direction
- counterexample: internal tool with no visual identity need
- output: design decision D-visual-direction

## Stance and rejected defaults
We refuse default component library styling.

## Failure signals
Generic AI-generated UI patterns.

## Relationships without merger
Adjacent to behavioral-psychology capability.
`, 'utf8');
  const goodResult = JSON.parse(run(root, ['capability', 'synthesize', 'ui-ux-design']));
  assert(goodResult.status === 'synthesized', 'synthesize should pass when source citation references a real research file');
});

test('capability hooks inject decision-tree nodes into active task context', () => {
  const root = workspace();
  run(root, ['init']);
  writeFileSync(join(root, '.loom', 'PROJECT.md'), `# Project Whole\n\n## Intended result\nA calming recovery tool with gentle game mechanics.\n\n## People and reality\nA human collaborates naturally while the Agent silently preserves state.\n\n## Whole behavior\nThe Agent clarifies, records, builds a work map, resumes one Task, and proves it done.\n\n## Boundaries\nThe human never has to operate LOOM. Irreversible work needs authority.\n\n## System shape\nHuman-readable project truth plus structured Task state compiled by a CLI.\n\n## Completion and failure\nA fresh Agent can start without chat memory; document volume alone is failure.\n`, 'utf8');
  run(root, ['design', 'add', 'game-mechanics', '--title', 'Game mechanics system', '--kind', 'system']);
  writeFileSync(join(root, '.loom', 'design', 'game-mechanics.md'), `# Game mechanics system\n\n- Kind: system\n- Status: ready\n\n## Responsibility\nDefine core game loops for calming engagement.\n\n## Boundary\nNo time pressure mechanics.\n\n## Interface\nGame loop entry point.\n\n## Verification\nPlaytest reports calm, not anxiety.\n`, 'utf8');
  run(root, ['capability', 'add', 'game-design', '--title', 'Game design']);
  run(root, ['capability', 'research', 'game-design', '--field', 'Game design']);
  writeFileSync(join(root, '.loom', 'capabilities', 'game-design', 'research', 'expert.md'), `# Expert narrative\n\nI start by identifying the target emotional state.\n`, 'utf8');
  const capPath = join(root, '.loom', 'capabilities', 'game-design', 'capability.md');
  writeFileSync(capPath, `# Game design\n\n## Field identity and boundary\nGame design for calming recovery tools.\n\n## Project scenario\nCalming recovery game.\n\n## Decision tree\n\n### C1: Choose core emotional direction\n- entry_when: starting a new game design\n- options:\n  - A: calming without challenge\n  - B: calming with gentle challenge\n- decide_by: target audience stress profile\n- source: expert narrative on designing calming games (see expert-narrative.md)\n- counterexample: a competitive game where calm is not the goal\n- output: design decision D-emotional-direction\n\n### C2: Choose loss condition design\n- entry_when: core direction is set and mechanics are being defined\n- options:\n  - A: no loss condition at all\n  - B: soft reset without penalty\n- decide_by: whether failure increases or decreases player calm\n- source: expert narrative on loss conditions in calming games (see expert.md)\n- counterexample: a skill-based game where loss drives learning\n- output: design decision D-loss-condition\n\n## Stance and rejected defaults\nWe refuse default game mechanics that create stress.\n\n## Failure signals\nPlayers report anxiety rather than calm.\n\n## Relationships without merger\nAdjacent to behavioral-psychology capability.\n`, 'utf8');
  run(root, ['capability', 'synthesize', 'game-design']);
  run(root, ['capability', 'confirm', 'game-design', '--scenario', 'A calming recovery game for stressed professionals needing gentle engagement.', '--source', 'human']);
  json(root, 'tasks.json', { tasks: [{ title: 'Implement game mechanics', outcome: 'Calming game loop with no-loss design', done_when: ['Game loop runs without time pressure'], boundaries: ['No stress mechanics'], reads: ['.loom/PROJECT.md', '.loom/design/game-mechanics.md'], touches: ['src/game.js'], implements: 'D-emotional-direction', capability_hooks: [{ node: 'game-design#C2', at: 'defining the loss condition', must_produce: 'design decision D-loss-condition' }] }] });
  run(root, ['task', 'plan', '--json-file', 'tasks.json']);
  const readyResult = JSON.parse(run(root, ['project', 'ready']));
  json(root, 'keeper-pass.json', { run_id: 'keeper-activation-001', prepared_digest: readyResult.digest, verdict: 'passed', summary: 'Build-ready.', evidence: ['PROJECT.md and game-design capability confirmed.'], review: independentReview('fresh-activation-agent') });
  run(root, ['keeper', 'record', '--json-file', 'keeper-pass.json']);
  run(root, ['task', 'start', 'TASK-001']);
  const context = run(root, ['context']);
  assert(context.includes('Capability decision points'), 'context should inject capability hooks section');
  assert(context.includes('game-design#C2'), 'context should reference the specific hook node');
  assert(context.includes('Choose loss condition design'), 'context should inject the node title');
  assert(context.includes('soft reset without penalty'), 'context should inject node options');
  assert(context.includes('design decision D-loss-condition'), 'context should show the node output');
  assert(!context.includes('### C1:'), 'context should NOT inject non-hooked nodes');
  assert(context.includes('must_produce'), 'context should show the must_produce directive');
  const checkResult = JSON.parse(run(root, ['check']));
  assert(!checkResult.warnings.join('\n').includes('missing capability node'), 'check should not warn when hooks reference valid nodes');
  json(root, 'bad-hooks.json', { capability_hooks: [{ node: 'game-design#C99' }] });
  run(root, ['task', 'update', 'TASK-001', '--json-file', 'bad-hooks.json']);
  const badCheck = JSON.parse(run(root, ['check']));
  assert(badCheck.warnings.join('\n').includes('missing capability node: game-design#C99'), 'check should warn when hooks reference non-existent nodes');
});

test('task integrity classification and declared outputs cannot stay false-green', () => {
  const root = workspace();
  run(root, ['init']);
  writeFileSync(join(root, '.loom', 'PROJECT.md'), `# Project Whole\n\n## Intended result\nA small integrity fixture with explicit design and capability links.\n\n## People and reality\nA fresh Agent must not mistake missing links or files for completion.\n\n## Whole behavior\nThe Task declares what it implements, which capability applies, and which output must exist.\n\n## Boundaries\nTest only.\n\n## System shape\nOne design, one capability, one Task.\n\n## Completion and failure\nMissing classification or output is unhealthy.\n`, 'utf8');
  run(root, ['design', 'add', 'integrity', '--title', 'Integrity fixture', '--kind', 'system']);
  writeFileSync(join(root, '.loom', 'design', 'integrity.md'), '# Integrity fixture\n\n## Responsibility\nRequire honest links.\n', 'utf8');
  run(root, ['capability', 'add', 'quality-assurance', '--title', 'Quality assurance']);
  json(root, 'tasks.json', { tasks: [{ title: 'Produce output', outcome: 'A concrete output file exists with explicit applicability decisions', done_when: ['Output exists'], boundaries: ['Test only'], reads: ['.loom/PROJECT.md'], touches: ['output.txt'] }] });
  run(root, ['task', 'plan', '--json-file', 'tasks.json']);
  const openCheck = JSON.parse(run(root, ['check']));
  assert(openCheck.warnings.join('\n').includes('missing implements or design_exemption'), 'open Task should surface missing design applicability');
  assert(openCheck.warnings.join('\n').includes('missing capability_hooks or capability_exemption'), 'open Task should surface missing capability applicability');
  json(root, 'classify.json', { implements: '.loom/design/integrity.md#Responsibility', capability_exemption: 'Capability research is not required for this file-existence fixture.' });
  run(root, ['task', 'update', 'TASK-001', '--json-file', 'classify.json']);
  const statePath = join(root, '.loom', 'state.json');
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  state.keeper.status = 'skipped';
  state.project.status = 'build_ready';
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  run(root, ['task', 'start', 'TASK-001']);
  json(root, 'done.json', { evidence: ['Claimed output exists'], checks: [{ criterion: 'Output exists', evidence: ['Claimed output exists'] }] });
  assert(run(root, ['task', 'done', 'TASK-001', '--json-file', 'done.json'], 1).includes('declared output does not exist'), 'completion should reject a missing touched file');
  writeFileSync(join(root, 'output.txt'), 'done\n', 'utf8');
  run(root, ['task', 'done', 'TASK-001', '--json-file', 'done.json']);
  rmSync(join(root, 'output.txt'));
  const brokenCheck = JSON.parse(run(root, ['check'], 1));
  assert(brokenCheck.healthy === false, 'missing output after completion should make check unhealthy');
  assert(brokenCheck.errors.join('\n').includes('declared output does not exist'), 'missing output should identify the broken Task promise');
});

test('deliverable coverage check finds uncovered delivery units', () => {
  const root = workspace();
  run(root, ['init']);
  run(root, ['deliverable', 'add', 'game-loop', '--title', 'Core game loop', '--kind', 'module']);
  run(root, ['deliverable', 'add', 'loss-condition', '--title', 'Loss condition design', '--kind', 'behavior']);
  run(root, ['deliverable', 'add', 'playtest-verification', '--title', 'Playtest verification', '--kind', 'verification']);
  const dlvList = JSON.parse(run(root, ['deliverable', 'list']));
  assert(dlvList.length === 3, 'should have 3 deliverables');
  assert(dlvList.every((item) => !item.covered), 'all deliverables should start uncovered');
  const coverage = JSON.parse(run(root, ['deliverable', 'coverage']));
  assert(coverage.uncovered === 3, 'all 3 deliverables should be uncovered');
  const gameLoopId = dlvList.find((item) => item.slug === 'game-loop').id;
  const lossConditionId = dlvList.find((item) => item.slug === 'loss-condition').id;
  json(root, 'tasks.json', { tasks: [
    { title: 'Implement game loop', outcome: 'Core game loop executes without time pressure', done_when: ['Loop executes'], boundaries: ['No scoring system'], reads: ['.loom/PROJECT.md'], touches: ['src/loop.js'], covers: [gameLoopId] },
    { title: 'Design loss condition', outcome: 'No-loss design documented for calming gameplay', done_when: ['Loss condition documented'], boundaries: ['No punishment mechanics'], reads: ['.loom/PROJECT.md'], touches: ['docs/loss.md'], covers: [lossConditionId] }
  ] });
  run(root, ['task', 'plan', '--json-file', 'tasks.json']);
  const afterCoverage = JSON.parse(run(root, ['deliverable', 'coverage']));
  assert(afterCoverage.covered === 2, '2 deliverables should be covered');
  assert(afterCoverage.uncovered === 1, '1 deliverable should remain uncovered');
  assert(afterCoverage.uncovered_items[0].slug === 'playtest-verification', 'playtest-verification should be the uncovered one');
  const checkResult = JSON.parse(run(root, ['check']));
  assert(checkResult.warnings.join('\n').includes('Uncovered deliverables: playtest-verification'), 'check should warn about uncovered deliverables');
  assert(checkResult.deliverable_coverage.total === 3, 'check should report deliverable coverage stats');
  assert(checkResult.deliverable_coverage.uncovered === 1, 'check should report uncovered count');
  const updatedDlvList = JSON.parse(run(root, ['deliverable', 'list']));
  assert(updatedDlvList.find((item) => item.slug === 'game-loop').covered === true, 'game-loop should be marked covered');
  assert(updatedDlvList.find((item) => item.slug === 'playtest-verification').covered === false, 'playtest-verification should remain uncovered');
});

test('acceptance structure pairs criterion with verify_by and evidence, and completion fills evidence', () => {
  const root = workspace();
  run(root, ['init']);
  writeFileSync(join(root, '.loom', 'PROJECT.md'), `# Project Whole\n\n## Intended result\nA test project verifying acceptance-based task completion works end to end, from planning through evidence-backed completion. The acceptance structure pairs each criterion with a verification method and an evidence field that gets filled in when the task is done.\n\n## People and reality\nSolo developer using LOOM for a small CLI project. The developer writes tasks in JSON and completes them through the CLI.\n\n## Whole behavior\nTasks use structured acceptance instead of plain done_when strings. Each acceptance condition has a criterion, a verify_by method, and an evidence field. Completion fills in evidence for every condition.\n\n## Boundaries\nNo external dependencies. Does not modify done_when-based tasks. Does not add CLI authoring.\n\n## System shape\nCLI-driven task management with JSON file input. State persists in .loom/ directory.\n\n## Completion and failure\nEvery acceptance condition has concrete evidence. A task with missing evidence is rejected. A task with incomplete acceptance results is rejected.\n`, 'utf8');
  run(root, ['design', 'add', 'test-system', '--title', 'Test system', '--kind', 'system']);
  writeFileSync(join(root, '.loom', 'design', 'test-system.md'), `# Test system\n\n- Kind: system\n- Status: ready\n\n## Responsibility\nVerify acceptance-based completion.\n\n## Boundary\nTest only.\n\n## Interface\nCLI.\n\n## Verification\nRun tests.\n`, 'utf8');
  json(root, 'tasks.json', { tasks: [{
    title: 'Implement acceptance-based completion',
    outcome: 'Task completion uses acceptance results with concrete evidence per criterion',
    acceptance: [
      { criterion: 'Task with acceptance[] can be imported and started', verify_by: 'Run loom task plan and loom task start, check no errors', evidence: '' },
      { criterion: 'Completion fills each acceptance evidence with actual result', verify_by: 'Run loom task done with acceptance_results, check task.acceptance[].evidence is populated', evidence: '' },
      { criterion: 'Missing acceptance result is rejected', verify_by: 'Run loom task done with incomplete acceptance_results, check error', evidence: '' },
    ],
    boundaries: ['Does not modify done_when-based tasks'],
    reads: ['.loom/PROJECT.md', '.loom/design/test-system.md'],
    touches: ['result.txt'],
    implements: '.loom/design/test-system.md#Responsibility',
  }] });
  run(root, ['task', 'plan', '--json-file', 'tasks.json']);
  const readyResult = JSON.parse(run(root, ['project', 'ready']));
  json(root, 'keeper-pass.json', { run_id: 'keeper-acceptance-001', prepared_digest: readyResult.digest, verdict: 'passed', summary: 'Ready.', evidence: ['PROJECT.md is complete.'], review: independentReview('fresh-acceptance-agent') });
  run(root, ['keeper', 'record', '--json-file', 'keeper-pass.json']);
  run(root, ['task', 'start', 'TASK-001']);
  const ctx = run(root, ['context']);
  assert(ctx.includes('acceptance'), 'context should show acceptance field');
  writeFileSync(join(root, 'result.txt'), 'verified\n', 'utf8');
  assert(ctx.includes('verify_by'), 'context should show verify_by in acceptance');
  json(root, 'done.json', {
    evidence: ['npm test passed', 'manual verification complete'],
    acceptance_results: [
      { criterion: 'Task with acceptance[] can be imported and started', evidence: 'loom task plan and loom task start both succeeded without errors' },
      { criterion: 'Completion fills each acceptance evidence with actual result', evidence: 'loom task done accepted acceptance_results and task.acceptance[].evidence was populated' },
    ],
  });
  const failResult = run(root, ['task', 'done', 'TASK-001', '--json-file', 'done.json'], 1);
  assert(failResult.includes('missing acceptance results'), 'should reject incomplete acceptance results');
  json(root, 'done.json', {
    evidence: ['npm test passed', 'manual verification complete'],
    acceptance_results: [
      { criterion: 'Task with acceptance[] can be imported and started', evidence: 'loom task plan and loom task start both succeeded without errors' },
      { criterion: 'Completion fills each acceptance evidence with actual result', evidence: 'loom task done accepted acceptance_results and task.acceptance[].evidence was populated' },
      { criterion: 'Missing acceptance result is rejected', evidence: 'loom task done with 2 of 3 acceptance_results returned error mentioning missing acceptance results' },
    ],
  });
  const result = JSON.parse(run(root, ['task', 'done', 'TASK-001', '--json-file', 'done.json']));
  assert(result.status === 'done', 'task should be done');
  assert(result.acceptance.every((acc) => acc.evidence && acc.evidence.length > 5), 'every acceptance condition should have evidence filled');
  assert(result.acceptance.length === 3, 'should have 3 acceptance conditions');
  const checkResult = JSON.parse(run(root, ['check']));
  assert(!checkResult.warnings.join('\n').includes('TASK-001 uses done_when'), 'acceptance task should not trigger done_when migration warning');
});

test('STRUCTURE.md is injected into context and check warns when it is missing or templated', () => {
  const root = workspace();
  run(root, ['init']);
  const ctx = run(root, ['context']);
  assert(ctx.includes('Project structure'), 'context should inject STRUCTURE.md');
  assert(ctx.includes('Source code'), 'context should include structure sections');
  const checkTemplated = JSON.parse(run(root, ['check']));
  assert(checkTemplated.warnings.join('\n').includes('STRUCTURE.md still contains template instructions'), 'check should warn when STRUCTURE.md is still templated');
  writeFileSync(join(root, '.loom', 'STRUCTURE.md'), `# Project structure\n\n## Source code\n- \`src/\` — all implementation\n\n## Tests\n- \`tests/\` — test files\n\n## Documents\n- \`README.md\` — entry point\n`, 'utf8');
  const ctxCustom = run(root, ['context']);
  assert(ctxCustom.includes('all implementation'), 'context should inject customized STRUCTURE.md');
  assert(!ctxCustom.includes('Where implementation files go. Example:'), 'context should not include template text after customization');
  const checkCustom = JSON.parse(run(root, ['check']));
  assert(!checkCustom.warnings.join('\n').includes('STRUCTURE.md'), 'check should not warn about STRUCTURE.md after customization');
  rmSync(join(root, '.loom', 'STRUCTURE.md'), { force: true });
  const checkMissing = JSON.parse(run(root, ['check']));
  assert(checkMissing.warnings.join('\n').includes('No STRUCTURE.md exists'), 'check should warn when STRUCTURE.md is missing');
});

test('Keeper auto-passes when all gaps are minor and 3 or fewer', () => {
  const root = workspace();
  run(root, ['init']);
  writeFileSync(join(root, '.loom', 'PROJECT.md'), `# Project Whole\n\n## Intended result\nA test project for Keeper auto-pass with minor gaps only. The system should auto-pass when all gaps are minor and 3 or fewer, without requiring a new Keeper round.\n\n## People and reality\nSolo developer testing the Keeper auto-pass mechanism in an isolated workspace.\n\n## Whole behavior\nKeeper returns minor gaps, developer fixes them, auto-pass without new Keeper round.\n\n## Boundaries\nNo external dependencies. No real implementation. Test only.\n\n## System shape\nCLI-based test harness with LOOM state files.\n\n## Completion and failure\nAuto-pass works when gaps are minor and few. Failure is when auto-pass triggers incorrectly.\n`, 'utf8');
  run(root, ['design', 'add', 'test-system', '--title', 'Test system', '--kind', 'system']);
  writeFileSync(join(root, '.loom', 'design', 'test-system.md'), `# Test system\n\n- Kind: system\n- Status: ready\n\n## Responsibility\nTest auto-pass.\n\n## Boundary\nTest only.\n\n## Interface\nCLI.\n\n## Verification\nRun tests.\n`, 'utf8');
  json(root, 'tasks.json', { tasks: [{ title: 'Test task', outcome: 'Verify auto-pass works correctly', done_when: ['Auto-pass triggers'], boundaries: ['No real implementation'], reads: ['.loom/PROJECT.md'], touches: ['output.txt'] }] });
  run(root, ['task', 'plan', '--json-file', 'tasks.json']);
  const ready1 = JSON.parse(run(root, ['project', 'ready']));
  json(root, 'keeper-minor.json', {
    run_id: 'keeper-autopass-001',
    prepared_digest: ready1.digest,
    verdict: 'needs_revision',
    summary: 'Two minor gaps found, no blocking issues.',
    gaps: [
      { gap: 'PROJECT.md could use more detail on completion criteria', severity: 'minor', why_it_blocks_start: 'Slightly less clear but does not block start', evidence_to_close: 'Add a sentence to completion section' },
      { gap: 'Design doc missing explicit verification section header', severity: 'minor', why_it_blocks_start: 'Verification is implied but not labeled', evidence_to_close: 'Add ## Verification header' },
    ],
    evidence: ['Reviewed PROJECT.md and design doc'],
  });
  run(root, ['keeper', 'record', '--json-file', 'keeper-minor.json']);
  writeFileSync(join(root, '.loom', 'PROJECT.md'), `# Project Whole\n\n## Intended result\nA test project for Keeper auto-pass with minor gaps only, now with detailed completion criteria. The system should auto-pass when all gaps are minor and 3 or fewer, without requiring a new Keeper round.\n\n## People and reality\nSolo developer testing the Keeper auto-pass mechanism in an isolated workspace.\n\n## Whole behavior\nKeeper returns minor gaps, developer fixes them, auto-pass without new Keeper round.\n\n## Boundaries\nNo external dependencies. No real implementation. Test only.\n\n## System shape\nCLI-based test harness with LOOM state files.\n\n## Completion and failure\nAuto-pass works when gaps are minor and few. Completion means the auto-pass triggered correctly. Failure is when auto-pass triggers incorrectly or blocking gaps slip through.\n`, 'utf8');
  writeFileSync(join(root, '.loom', 'design', 'test-system.md'), `# Test system\n\n- Kind: system\n- Status: ready\n\n## Responsibility\nTest auto-pass.\n\n## Boundary\nTest only.\n\n## Interface\nCLI.\n\n## Verification\nRun tests.\n`, 'utf8');
  const ready2 = JSON.parse(run(root, ['project', 'ready']));
  assert(ready2.auto_passed === true, 'should auto-pass when minor gaps are fixed and digest changed');
  assert(ready2.ready_for_keeper === false, 'should not require a new Keeper round');
  const checkResult = JSON.parse(run(root, ['check']));
  assert(checkResult.healthy === true, 'project should be healthy after auto-pass');
});

test('Keeper does NOT auto-pass when gaps include blocking severity', () => {
  const root = workspace();
  run(root, ['init']);
  writeFileSync(join(root, '.loom', 'PROJECT.md'), `# Project Whole\n\n## Intended result\nA test project for Keeper blocking gap. The system must handle blocking gaps correctly by requiring a new Keeper round when any blocking gap exists.\n\n## People and reality\nSolo developer testing the Keeper blocking gap mechanism in an isolated workspace.\n\n## Whole behavior\nKeeper returns a blocking gap, must require new Keeper round. Auto-pass must not trigger.\n\n## Boundaries\nNo external dependencies. No real implementation. Test only.\n\n## System shape\nCLI-based test harness with LOOM state files.\n\n## Completion and failure\nBlocking gaps prevent auto-pass. Failure is when auto-pass triggers despite a blocking gap.\n`, 'utf8');
  run(root, ['design', 'add', 'test-system', '--title', 'Test system', '--kind', 'system']);
  writeFileSync(join(root, '.loom', 'design', 'test-system.md'), `# Test system\n\n- Kind: system\n- Status: ready\n\n## Responsibility\nTest blocking gap.\n\n## Boundary\nTest only.\n\n## Interface\nCLI.\n\n## Verification\nRun tests.\n`, 'utf8');
  json(root, 'tasks.json', { tasks: [{ title: 'Test task', outcome: 'Verify blocking gap prevents auto-pass', done_when: ['Auto-pass does not trigger'], boundaries: ['No real implementation'], reads: ['.loom/PROJECT.md'], touches: ['output.txt'] }] });
  run(root, ['task', 'plan', '--json-file', 'tasks.json']);
  const ready1 = JSON.parse(run(root, ['project', 'ready']));
  json(root, 'keeper-blocking.json', {
    run_id: 'keeper-blocking-001',
    prepared_digest: ready1.digest,
    verdict: 'needs_revision',
    summary: 'One blocking gap found.',
    gaps: [
      { gap: 'Missing entire system design for the core module', severity: 'blocking', why_it_blocks_start: 'A fresh Agent cannot start without knowing the core module design', evidence_to_close: 'Add a design document for the core module' },
    ],
    evidence: ['No design document for core module found'],
  });
  run(root, ['keeper', 'record', '--json-file', 'keeper-blocking.json']);
  writeFileSync(join(root, '.loom', 'PROJECT.md'), `# Project Whole\n\n## Intended result\nA test project for Keeper blocking gap. Updated to try to pass. The system must handle blocking gaps correctly by requiring a new Keeper round when any blocking gap exists.\n\n## People and reality\nSolo developer testing the Keeper blocking gap mechanism in an isolated workspace.\n\n## Whole behavior\nKeeper returns a blocking gap, must require new Keeper round. Auto-pass must not trigger.\n\n## Boundaries\nNo external dependencies. No real implementation. Test only.\n\n## System shape\nCLI-based test harness with LOOM state files.\n\n## Completion and failure\nBlocking gaps prevent auto-pass. Failure is when auto-pass triggers despite a blocking gap.\n`, 'utf8');
  const ready2 = JSON.parse(run(root, ['project', 'ready']));
  assert(ready2.auto_passed !== true, 'should NOT auto-pass when there is a blocking gap');
  assert(ready2.ready_for_keeper === true, 'should require a new Keeper round for blocking gaps');
});

test('decision record traces changes and warns about affected done tasks', () => {
  const root = workspace();
  run(root, ['init']);
  writeFileSync(join(root, '.loom', 'PROJECT.md'), `# Project Whole\n\n## Intended result\nA project that evolves mid-flight. New ideas change existing decisions, and those changes are traced in DECISIONS.md while affected tasks are flagged for review.\n\n## People and reality\nSolo developer iterating on a project whose design changes after implementation has started.\n\n## Whole behavior\nDecisions are recorded with affected files and tasks. Done tasks affected by a decision are flagged by loom check.\n\n## Boundaries\nNo external dependencies. No real implementation. Test only.\n\n## System shape\nCLI-based test harness with LOOM state files and design documents.\n\n## Completion and failure\nDecisions traced, affected tasks reopened when needed. Failure is when a decision silently invalidates done work without warning.\n`, 'utf8');
  run(root, ['design', 'add', 'core-system', '--title', 'Core system', '--kind', 'system']);
  writeFileSync(join(root, '.loom', 'design', 'core-system.md'), `# Core system\n\n- Kind: system\n- Status: ready\n\n## Responsibility\nOriginal design.\n\n## Boundary\nTest only.\n\n## Interface\nCLI.\n\n## Verification\nRun tests.\n`, 'utf8');
  json(root, 'tasks.json', { tasks: [{ title: 'Original task', outcome: 'Implement original design correctly', done_when: ['Original design implemented'], boundaries: ['No scope creep'], reads: ['.loom/PROJECT.md', '.loom/design/core-system.md'], touches: ['core.txt'], implements: '.loom/design/core-system.md#Responsibility' }] });
  run(root, ['task', 'plan', '--json-file', 'tasks.json']);
  const readyResult = JSON.parse(run(root, ['project', 'ready']));
  json(root, 'keeper-pass.json', { run_id: 'keeper-decision-001', prepared_digest: readyResult.digest, verdict: 'passed', summary: 'Ready.', evidence: ['All good.'], review: independentReview('fresh-decision-agent') });
  run(root, ['keeper', 'record', '--json-file', 'keeper-pass.json']);
  run(root, ['task', 'start', 'TASK-001']);
  writeFileSync(join(root, 'core.txt'), 'implemented\n', 'utf8');
  json(root, 'done.json', { evidence: ['done'], checks: [{ criterion: 'Original design implemented', evidence: ['src/core.js exists'] }] });
  run(root, ['task', 'done', 'TASK-001', '--json-file', 'done.json']);
  json(root, 'decision.json', { summary: 'Changed core system from sync to async architecture', changes: ['.loom/design/core-system.md', 'src/core.js'], affected_tasks: ['TASK-001'] });
  const decisionResult = JSON.parse(run(root, ['decision', '--json-file', 'decision.json']));
  assert(decisionResult.id.startsWith('D-'), 'decision should have a D- prefixed id');
  assert(decisionResult.affected_tasks.includes('TASK-001'), 'decision should record affected task');
  const decisionsContent = readFileSync(join(root, '.loom', 'DECISIONS.md'), 'utf8');
  assert(decisionsContent.includes('Changed core system from sync to async'), 'DECISIONS.md should contain the decision summary');
  assert(decisionsContent.includes('TASK-001'), 'DECISIONS.md should record affected task');
  const checkResult = JSON.parse(run(root, ['check']));
  assert(checkResult.warnings.join('\n').includes('TASK-001 is done but was marked affected by a decision'), 'check should warn about done task affected by decision');
});

test('a long work map stays on disk while context remains focused', () => {
  const root = workspace();
  run(root, ['init']);
  const tasks = Array.from({ length: 250 }, (_, index) => ({
    title: `Work item ${index + 1}`,
    outcome: `Observable result ${index + 1} exists in the output artifact`,
    done_when: [`Evidence for result ${index + 1}`],
    boundaries: ['Does not touch unrelated modules'],
    depends_on: index === 0 ? [] : [`TASK-${String(index).padStart(3, '0')}`],
    reads: ['.loom/PROJECT.md'],
    touches: [`src/item-${index + 1}.js`],
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
  const capabilityPath = join(root, '.loom', 'capabilities', 'human-agent-interaction', 'capability.md');
  writeFileSync(capabilityPath, `# Human-Agent Interaction\n\n## Field identity and boundary\nThis field shapes continuity without taking user agency.\n\n## Project scenario\nAgent-driven project with natural human conversation.\n\n## Decision tree\n\n### C1: Determine what context a reset Agent needs\n- entry_when: a Task is about to start or resume after context loss\n- options:\n  - A: inject full project state\n  - B: inject only the active Task and its referenced files\n- decide_by: context economy vs coverage\n- source: observed LOOM v1 runtime behavior and user interaction requirements (v1-runtime-observations.md)\n- counterexample: a trivial single-step Task with no project context needed\n- output: design decision D-context-selection\n\n## Stance and rejected defaults\nThe Task is a restartable checkpoint, not an exhaustive plan. We refuse full-state reinjection.\n\n## Failure signals\nA fresh Agent cannot resume without asking the human to repeat prior decisions.\n\n## Relationships without merger\nAdjacent to agent-project-continuity capability.\n`, 'utf8');
  writeFileSync(join(root, '.loom', 'capabilities', 'human-agent-interaction', 'research', 'v1-runtime-observations.md'), `# LOOM v1 runtime observations\n\nIn the v1 runtime, injecting full project state after every reset caused context bloat that defeated\nthe purpose of external state. Users experienced question fatigue when the Agent asked without first\nchecking the workspace. The progressive-resolution approach—broad map on disk, detail only for the\nactive horizon—reduced context consumption while preserving coverage.\n`, 'utf8');
  run(root, ['capability', 'research', 'human-agent-interaction', '--field', 'Human-Agent collaboration and context engineering']);
  run(root, ['capability', 'synthesize', 'human-agent-interaction']);
  run(root, ['capability', 'confirm', 'human-agent-interaction', '--scenario', 'Agent-driven project with natural human conversation and forced context resets.', '--source', 'human']);
  writeFileSync(join(root, 'INPUT.md'), '# Runtime fixture\n\nA forced-reset handoff must preserve the selected Task.\n', 'utf8');
  json(root, 'tasks.json', { tasks: [{ title: 'Implement resume context', outcome: 'A fresh Agent receives only decision-relevant context', done_when: ['Integration transcript proves context survives a reset'], boundaries: ['Do not expose CLI operation to the human'], reads: ['.loom/PROJECT.md', '.loom/design/resume-context.md', '.loom/capabilities/human-agent-interaction/capability.md', 'INPUT.md'], touches: ['output.txt'], implements: '.loom/design/resume-context.md#Responsibility', capability_hooks: [{ node: 'human-agent-interaction#C1', at: 'selecting reset context', must_produce: 'restartable context selection' }] }] });
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
  json(root, 'keeper-duplicate.json', { run_id: 'keeper-run-001', prepared_digest: secondReady.digest, verdict: 'passed', summary: 'Duplicate run.', evidence: ['This must be rejected as non-independent.'], review: independentReview('fresh-duplicate-agent') });
  assert(run(root, ['keeper', 'record', '--json-file', 'keeper-duplicate.json'], 1).includes('already used'), 'Keeper run_id must be unique');
  writeFileSync(capabilityPath, `${readFileSync(capabilityPath, 'utf8')}\nFresh evidence discovered after ready.\n`, 'utf8');
  json(root, 'keeper-stale.json', { run_id: 'keeper-run-stale', prepared_digest: secondReady.digest, verdict: 'passed', summary: 'Stale run.', evidence: ['This result used a stale prepared project.'], review: independentReview('fresh-stale-agent') });
  assert(run(root, ['keeper', 'record', '--json-file', 'keeper-stale.json'], 1).includes('changed after'), 'stale prepared state must be rejected');
  const thirdReady = JSON.parse(run(root, ['project', 'ready']));
  json(root, 'keeper-self.json', { run_id: 'keeper-self-002', prepared_digest: thirdReady.digest, verdict: 'passed', summary: 'Self review cannot establish independence.', evidence: ['The shaping Agent reviewed its own work.'], review: { mode: 'self', reviewer_id: 'shaping-agent', evidence: 'Same Agent and inherited context.' } });
  assert(run(root, ['keeper', 'record', '--json-file', 'keeper-self.json'], 1).includes('independent review'), 'self-review should not produce Keeper pass');
  json(root, 'keeper-pass.json', { run_id: 'keeper-run-002', prepared_digest: thirdReady.digest, verdict: 'passed', summary: 'The project is build-ready.', evidence: ['PROJECT.md defines the whole and TASK-001 links the only required dossier.'], review: { mode: 'independent', reviewer_id: 'fresh-agent-002', evidence: 'Host opened a separate Agent with no shaping conversation.' } });
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
  writeFileSync(join(root, 'output.txt'), 'verified\n', 'utf8');
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
    human_channel: 'unavailable',
  });
  const result = JSON.parse(run(root, ['eval', 'scaffold', '--json-file', 'eval.json']));
  const manifest = JSON.parse(readFileSync(join(root, result.path, 'manifest.json'), 'utf8'));
  assert(manifest.controls.same_model_tools_workspace_and_budget === true, 'equal-condition control missing');
  assert(manifest.controls.human_channel === 'unavailable', 'human-channel control missing');
  assert(manifest.controls.minimum_repetitions_per_condition === 3, 'repeat control missing');
  assert(manifest.controls.context_reset_points.length === 2, 'forced reset control missing');
  assert(manifest.controls.anonymization_preserves_relative_layout === true, 'anonymized layout invariant missing');
  assert(manifest.controls.judge_packet_preflight_required === true, 'judge packet preflight missing');
  assert(manifest.controls.condition_output_digest_manifest === true, 'condition output manifest missing');
  const judge = readFileSync(join(root, result.path, 'judge-prompt.md'), 'utf8');
  assert(judge.includes('randomized order'), 'blind random order missing');
  assert(judge.includes('order-sensitive conclusions'), 'order-swap check missing');
  assert(judge.includes('Penalize unnecessary ceremony'), 'ceremony cost is not measured');
  assert(readFileSync(join(root, result.path, 'loom-prompt.md'), 'utf8').includes('Do not fabricate a user interaction'), 'unattended LOOM eval prompt may fabricate a user');
  assert(readFileSync(join(root, result.path, 'baseline-prompt.md'), 'utf8').includes('Do not fabricate a user interaction'), 'baseline did not receive the same unattended environment');
});

test('help and source surface stay minimal', () => {
  const root = workspace();
  const help = run(root, ['--help']);
  for (const command of ['loom context', 'loom prompts', 'loom record', 'loom decision', 'loom design add', 'loom capability add', 'loom capability research', 'loom capability synthesize', 'loom capability confirm', 'loom deliverable add', 'loom deliverable coverage', 'loom task plan', 'loom keeper prompt', 'loom eval scaffold']) assert(help.includes(command), `${command} missing`);
  for (const legacy of ['Intent Map', 'Capability Graph', 'Atelier', 'Atlas', 'Weaver', 'Forge']) assert(!help.includes(legacy), `${legacy} leaked into minimal help`);
  const helpCases = [
    [['record', '--help'], ['"confirmed"', '"assumptions"', '"unresolved"', '"decisions"']],
    [['decision', '--help'], ['"summary"', '"changes"', '"affected_tasks"']],
    [['task', 'plan', '--help'], ['"acceptance"', '"implements"', '"capability_hooks"']],
    [['task', 'update', '--help'], ['"progress"', '"current"', '"next"']],
    [['task', 'block', '--help'], ['"reason"', '"recovery_conditions"']],
    [['task', 'done', '--help'], ['"evidence"', '"acceptance_results"']],
    [['keeper', 'record', '--help'], ['"review"', '"mode"', '"reviewer_id"']],
    [['eval', 'scaffold', '--help'], ['"brief"', '"human_channel"', '"repetitions"']],
  ];
  for (const [args, fields] of helpCases) {
    const detail = run(root, args);
    for (const field of fields) assert(detail.includes(field), `loom ${args.join(' ')} missing ${field}`);
  }
  assert(run(root, ['help', 'task-done']).includes('acceptance_results'), 'loom help <topic> should expose the same canonical payload');
  run(root, ['init']);
  json(root, 'bad-record.json', { confirmed: [{ nope: true }] });
  const badRecord = run(root, ['record', '--json-file', 'bad-record.json'], 1);
  assert(badRecord.includes('Confirmed fact requires text'), 'structured write error lost the concrete validation failure');
  assert(badRecord.includes('loom record --help'), 'structured write error should point to command-local help');
  const chineseReadme = readFileSync(resolve('README.zh-CN.md'), 'utf8');
  assert(chineseReadme.includes('--source human'), 'Chinese README should teach capability authority provenance');
  assert(chineseReadme.includes('review.mode: "independent"'), 'Chinese README should teach independent Keeper provenance');
  assert(chineseReadme.includes('loom task done --help'), 'Chinese README should point structured writes to command-local help');
  assert(run(root, ['--version']) === 'loom 2.1.2', 'version mismatch');
});

for (const root of roots) rmSync(root, { recursive: true, force: true });

if (process.exitCode) {
  console.error(`\nResult: ${passed} passed, failures above`);
} else {
  console.log(`\nResult: ${passed} passed, 0 failed`);
}
