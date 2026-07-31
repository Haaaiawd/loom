// run-all.js — CLI 端到端测试
// 造一个临时 .loom/v1/ 项目结构，用模板数据，跑通所有命令。

import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const TEST_ROOT = join(process.cwd(), 'test', '.tmp-loom-test');
const LOOM_DIR = join(TEST_ROOT, '.loom', 'v1');
const PHILOSOPHY_DIR = join(LOOM_DIR, '00_PHILOSOPHY');
const VERIFICATIONS_DIR = join(LOOM_DIR, 'verifications');
const CAPABILITY_BRIEFS_DIR = join(LOOM_DIR, '07_CAPABILITY_BRIEFS');
const ASSET_LIBRARY_DIR = join(LOOM_DIR, '08_ASSET_LIBRARY');
const EXPERTISE_PACKS_DIR = join(LOOM_DIR, '10_EXPERTISE_PACKS');
const CLI = join(process.cwd(), 'cli', 'bin', 'loom.js');

let passed = 0;
let failed = 0;

function setup() {
  rmSync(TEST_ROOT, { recursive: true, force: true });
  mkdirSync(PHILOSOPHY_DIR, { recursive: true });
  mkdirSync(VERIFICATIONS_DIR, { recursive: true });
  mkdirSync(CAPABILITY_BRIEFS_DIR, { recursive: true });
  mkdirSync(join(ASSET_LIBRARY_DIR, 'files'), { recursive: true });
  mkdirSync(EXPERTISE_PACKS_DIR, { recursive: true });
  mkdirSync(join(TEST_ROOT, 'artifacts'), { recursive: true });
  writeFileSync(join(TEST_ROOT, 'artifacts', 'quality-proof.md'), '# INT-002 {#INT-002}\n\n基线、候选、稳定性与取舍证据。\n');
  writeFileSync(join(VERIFICATIONS_DIR, 'INT-001-host-render.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  // Intent Map（基于模板，填入可测试的数据）
  writeFileSync(join(LOOM_DIR, '04_INTENT_MAP.json'), JSON.stringify({
    _meta: { _version: '1.0', _loom_version: 'v1', _generated_by: 'architect' },
    intents: {
      'INT-001': {
        id: 'INT-001',
        revision: 1,
        title: '用户注册与登录',
        narrative_ref: '01_VISION.md#int-001',
        depends_on: [],
        acceptance: '功能承诺：用户能用邮箱注册并登录，返回 session token。防御承诺：密码不明文存储，登录失败不泄露用户是否存在。',
        philosophy_anchors: ['PRODUCT_PHILOSOPHY.md#core-belief'],
        status: 'completed',
      },
      'INT-002': {
        id: 'INT-002',
        revision: 1,
        title: '项目创建',
        narrative_ref: '01_VISION.md#int-002',
        depends_on: ['INT-001'],
        acceptance: '功能承诺：用户能创建项目并设置名称。防御承诺：项目名不硬编码，空名称被拒绝。',
        philosophy_anchors: ['ENGINEERING_CREED.md#simplicity'],
        status: 'in_progress',
      },
      'INT-003': {
        id: 'INT-003',
        revision: 1,
        title: '协作者邀请',
        narrative_ref: '01_VISION.md#int-003',
        depends_on: ['INT-001', 'INT-002'],
        acceptance: '功能承诺：项目所有者能邀请其他用户协作。防御承诺：不能邀请自己，不能重复邀请已协作成员。',
        philosophy_anchors: ['PRODUCT_PHILOSOPHY.md#collaboration'],
        status: 'pending',
      },
    },
    topo_order: ['INT-001', 'INT-002', 'INT-003'],
  }, null, 2));

  writeFileSync(join(CAPABILITY_BRIEFS_DIR, 'CAP-PROJECT-CREATION.md'), [
    '# CAP-PROJECT-CREATION — 项目创建的可理解流程',
    '',
    '## 项目问题',
    '',
    '用户首次创建项目时必须理解名称、错误反馈和后续进入路径。',
    '',
    '## 成功判断',
    '',
    '窄屏与错误路径均可复现，且不会破坏既有认证状态。',
  ].join('\n'));
  writeFileSync(join(LOOM_DIR, '07_CAPABILITY_GRAPH.json'), JSON.stringify({
    _meta: { _version: '1.0', _loom_version: 'v1', _generated_by: 'architect' },
    nodes: {
      'OUTCOME-IDENTITY': {
        id: 'OUTCOME-IDENTITY', kind: 'outcome', title: '用户自主控制身份与项目空间',
        status: 'covered', impact: 'high', route: 'intent', intent_refs: ['INT-001'],
        relationships: [
          { type: 'refines', target: 'CONCERN-PROJECT-CREATION' },
          { type: 'validated_by', target: 'EVIDENCE-IDENTITY-HOST' },
        ],
      },
      'EVIDENCE-IDENTITY-HOST': {
        id: 'EVIDENCE-IDENTITY-HOST', kind: 'evidence', title: '用户在目标宿主中完成身份管理',
        status: 'covered', impact: 'high', route: 'intent', intent_refs: ['INT-001'],
        verification: {
          method: 'manual_visual',
          target: '目标客户端的身份管理界面',
          procedure: '在干净会话中注册并登录，观察身份状态和项目入口是否呈现',
          pass_criteria: '用户无需依赖外部链接即可看到已登录状态并进入自己的项目空间',
          artifact: 'verifications/INT-001-host-render.png',
        },
        relationships: [],
      },
      'CONCERN-PROJECT-CREATION': {
        id: 'CONCERN-PROJECT-CREATION', kind: 'concern', title: '首次创建项目的体验与业务边界',
        status: 'covered', impact: 'high', route: 'intent', intent_refs: ['INT-002'],
        relationships: [{ type: 'requires', target: 'CAP-PROJECT-CREATION' }],
      },
      'CAP-PROJECT-CREATION': {
        id: 'CAP-PROJECT-CREATION', kind: 'capability', title: '设计项目创建的可理解流程',
        status: 'researched', impact: 'high', route: 'brief', intent_refs: ['INT-002'],
        acquisition_mode: 'adaptive',
        acquisition_rationale: '测试基线：当前项目已有可复现的内部实现与验证夹具，不需要额外来源。',
        brief_ref: '07_CAPABILITY_BRIEFS/CAP-PROJECT-CREATION.md',
        question: '用户能否理解输入、错误反馈和创建后的下一步？', relationships: [],
      },
      'CONCERN-COLLABORATION': {
        id: 'CONCERN-COLLABORATION', kind: 'concern', title: '协作邀请的成员边界',
        status: 'covered', impact: 'medium', route: 'intent', intent_refs: ['INT-003'], relationships: [],
      },
    },
  }, null, 2));
  writeFileSync(join(ASSET_LIBRARY_DIR, 'manifest.json'), JSON.stringify({
    _meta: { _version: '1.0', _loom_version: 'v1', _generated_by: 'architect' }, assets: {},
  }, null, 2));

  // 哲学文档
  writeFileSync(join(PHILOSOPHY_DIR, 'PRODUCT_PHILOSOPHY.md'), [
    '# 产品哲学',
    '',
    '## Core Belief',
    '',
    '我们相信用户应该掌控自己的数据。',
    '',
    '## Collaboration',
    '',
    '协作是产品的核心——不是附加功能。',
  ].join('\n'));

  writeFileSync(join(PHILOSOPHY_DIR, 'ENGINEERING_CREED.md'), [
    '# 工程信条',
    '',
    '## Simplicity',
    '',
    '简单是系统自己的品质。单一职责、低耦合、可理解。',
  ].join('\n'));

  // 愿景文档（用显式锚点，测试 narrative 解析）
  writeFileSync(join(LOOM_DIR, '01_VISION.md'), [
    '# 产品愿景',
    '',
    '## INT-001：用户认证 {#int-001}',
    '',
    '用户需要自主管理自己的身份——这是产品信任的基础。',
    '如果用户不能控制自己的身份，产品就只是一个旁观者。',
    '登录不是安全措施，是身份自治的入口。',
    '',
    '## INT-002：创建项目 {#int-002}',
    '',
    '用户需要一个属于自己的空间来组织工作。',
    '项目是工作的容器——没有它，所有待办都是散落的碎片。',
    '',
    '## INT-003：邀请协作者 {#int-003}',
    '',
    '一个人能做的事有限。协作让产品从个人工具变成团队工具。',
    '邀请是协作的起点——必须简单、可靠、可追踪。',
  ].join('\n'));

  // 写入 current 指针
  writeFileSync(join(TEST_ROOT, '.loom', 'current'), 'v1', 'utf-8');
}

function writeReadyExpertisePack(intentId = 'INT-002') {
  const map = JSON.parse(readFileSync(join(LOOM_DIR, '04_INTENT_MAP.json'), 'utf-8'));
  const pack = {
    _meta: {
      _description: 'test expertise pack',
      _version: '1.0',
      _loom_version: 'v1',
      _generated_by: 'forge',
    },
    intent_id: intentId,
    intent_revision: map.intents[intentId].revision ?? 1,
    required_capability_refs: ['CAP-PROJECT-CREATION'],
    status: 'ready',
    search_plan: {
      decision_question: '怎样让首次项目创建既容易理解，又有可观察的反馈与后续路径？',
      project_signals: ['当前 Capability Brief 要求覆盖输入、错误反馈和创建后的下一步'],
      derived_queries: [
        {
          channel: 'skill_registry',
          query: 'interaction design first run project creation feedback skill',
          rationale: '寻找可复用的交互设计决策框架与失败模式',
        },
        {
          channel: 'web',
          query: 'project creation onboarding inline validation interaction patterns',
          rationale: '交叉核对真实产品模式与可观察验证信号',
        },
      ],
      constraints: ['不改变项目创建业务规则', '不得损害已有认证状态'],
      stop_condition: '至少一个外部来源直接支持每个 Capsule，并能写出可观察的决策门与失败模式。',
    },
    sources: [{
      id: 'SRC-001',
      kind: 'skill',
      authority: 'expert',
      title: 'Interaction design workflow reference',
      locator: 'https://example.com/interaction-design-skill',
      retrieved_at: '2026-07-31T09:00:00Z',
      why_selected: '包含触发、反馈、决策门与可观察检查，直接对应当前 Capability question。',
      retrieval_evidence: '已打开来源正文并核对触发、反馈、失败路径和验证章节。',
    }],
    capsules: [{
      capability_ref: 'CAP-PROJECT-CREATION',
      professional_problem: '把项目创建的输入、错误和下一步编排成无需猜测的连续反馈。',
      when_to_use: '首次创建、空输入、服务端失败和创建成功后的进入路径。',
      rules: ['每次操作都给出与当前状态对应的反馈', '错误反馈靠近发生位置且保留用户输入'],
      workflow: ['冻结当前流程基线', '按正常、空输入、服务失败、成功四条路径设计反馈'],
      decision_gates: ['用户是否能在一次观察内说明当前状态和下一步'],
      failure_modes: ['只做漂亮表单但错误和成功后的状态含糊'],
      verification_signals: ['窄屏和错误路径可复现，认证状态不丢失'],
      source_refs: ['SRC-001'],
    }],
    blocker: null,
  };
  writeFileSync(join(EXPERTISE_PACKS_DIR, `${intentId}.json`), JSON.stringify(pack, null, 2));
  return pack;
}

function expertisePackDigest(pack) {
  return createHash('sha256').update(JSON.stringify(pack)).digest('hex');
}

function useDefaultHighImpactAcquisition() {
  const graphPath = join(LOOM_DIR, '07_CAPABILITY_GRAPH.json');
  const graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
  delete graph.nodes['CAP-PROJECT-CREATION'].acquisition_mode;
  writeFileSync(graphPath, JSON.stringify(graph, null, 2));
}

function completeAllIntents() {
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  for (const intent of Object.values(map.intents)) intent.status = 'completed';
  writeFileSync(mapPath, JSON.stringify(map, null, 2), 'utf-8');
}

function run(args, allowFailure = false) {
  try {
    const verifiedArgs = args.startsWith('verify pass ') && !args.includes('--verified-by')
      ? `${args} --verified-by "keeper-test-thread" --verification-context independent_thread`
      : args;
    return execSync(`node "${CLI}" ${verifiedArgs} --loom-dir "${LOOM_DIR}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' },
    });
  } catch (e) {
    if (allowFailure) {
      return (e.stdout || '') + (e.stderr || '');
    }
    throw e;
  }
}

// 从项目根目录跑（不带 --loom-dir，测试 findLoomDir 指针逻辑）
function runFromRoot(args, allowFailure = false) {
  try {
    return execSync(`node "${CLI}" ${args}`, {
      encoding: 'utf-8',
      cwd: TEST_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' },
    });
  } catch (e) {
    if (allowFailure) return (e.stdout || '') + (e.stderr || '');
    throw e;
  }
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || '断言失败');
}

function assertContains(output, substring, msg) {
  if (!output.includes(substring)) {
    throw new Error(msg || `输出中未找到: "${substring}"\n实际输出:\n${output}`);
  }
}

// ─── 测试用例 ──────────────────────────────────────────

setup();

console.log('\n测试 intent 命令');

test('intent next — 返回 INT-003（INT-001 completed, INT-002 in_progress, INT-003 依赖两者但 INT-002 未完成 → 应返回 null）', () => {
  // INT-003 依赖 INT-001 和 INT-002，INT-002 是 in_progress 不是 completed
  // 所以没有可执行的 Intent
  const out = run('intent next');
  assertContains(out, '没有可执行的 Intent');
});

test('intent status — 显示进度概览', () => {
  const out = run('intent status');
  assertContains(out, '1/3 完成');
  assertContains(out, 'INT-001');
  assertContains(out, 'INT-002');
  assertContains(out, 'INT-003');
});

test('intent graph — 输出 Mermaid 依赖图', () => {
  const out = run('intent graph');
  assertContains(out, '```mermaid');
  assertContains(out, 'graph TD');
  assertContains(out, 'INT-001 --> INT-002');
  assertContains(out, 'INT-002 --> INT-003');
});

test('intent get INT-001 — 返回完整信息', () => {
  const out = run('intent get INT-001');
  const data = JSON.parse(out);
  assert(data.id === 'INT-001', 'id 不匹配');
  assert(data.status === 'completed', 'status 不匹配');
  assertContains(data.acceptance, '注册并登录');
});

test('intent narrative — 解析 narrative_ref 返回意图叙事', () => {
  const out = run('intent narrative INT-001');
  assertContains(out, '身份自治的入口');
  assertContains(out, 'INT-001');
});

test('intent narrative — 不存在的 Intent 报错', () => {
  try {
    run('intent narrative INT-999');
    throw new Error('应该报错但没有');
  } catch (e) {
    assertContains(e.stderr || e.message, '不存在');
  }
});

test('intent validate — 校验通过', () => {
  const out = run('intent validate');
  assertContains(out, '校验通过');
});

test('intent validate — 质量契约与专业能力字段按最小结构校验', () => {
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const original = readFileSync(mapPath, 'utf-8');
  try {
    const map = JSON.parse(original);
    map.intents['INT-002'].quality_contract = '相对当前创建流程，首次成功时间至少降低 20%，且错误率不回退。';
    map.intents['INT-002'].continuity_required = true;
    map.intents['INT-002'].capability_needs = ['交互设计', '可用性测量'];
    map.intents['INT-002'].creative_scope = '允许调整信息层级和反馈机制，不改变项目创建业务规则。';
    map.intents['INT-002'].quality_strategy = 'atelier';
    writeFileSync(mapPath, JSON.stringify(map, null, 2));
    assertContains(run('intent validate'), '校验通过');

    map.intents['INT-002'].capability_needs = ['交互设计', '交互设计'];
    map.intents['INT-002'].quality_contract = '更好';
    map.intents['INT-002'].continuity_required = 'yes';
    writeFileSync(mapPath, JSON.stringify(map, null, 2));
    const out = run('intent validate', true);
    assertContains(out, 'quality_contract');
    assertContains(out, 'quality_strategy=atelier');
    assertContains(out, 'continuity_required');
    assertContains(out, '重复专业领域');

    map.intents['INT-002'].quality_strategy = 'persona';
    writeFileSync(mapPath, JSON.stringify(map, null, 2));
    assertContains(run('intent validate', true), '合法: adaptive|atelier');
  } finally {
    writeFileSync(mapPath, original);
  }
});

test('intent validate — 缺失 revision 兼容为 1，非法显式 revision 被拒绝', () => {
  setup();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const original = readFileSync(mapPath, 'utf-8');
  try {
    const legacy = JSON.parse(original);
    delete legacy.intents['INT-001'].revision;
    writeFileSync(mapPath, JSON.stringify(legacy, null, 2));
    assertContains(run('intent validate'), '校验通过');
    const readLegacy = JSON.parse(run('intent get INT-001'));
    assert(readLegacy.revision === 1, '旧 Intent 读取时应投影有效 revision 1');
    const persistedLegacy = JSON.parse(readFileSync(mapPath, 'utf-8'));
    assert(!('revision' in persistedLegacy.intents['INT-001']), '读取旧 Intent 不应强制迁移磁盘文件');

    for (const invalid of [0, -1, 1.5, '2', null]) {
      const map = JSON.parse(original);
      map.intents['INT-001'].revision = invalid;
      writeFileSync(mapPath, JSON.stringify(map, null, 2));
      assertContains(run('intent validate', true), 'revision 非法');
    }
  } finally {
    writeFileSync(mapPath, original);
  }
});

test('intent validate — lineage 结构、重复引用和同版本自引用被拒绝', () => {
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const original = readFileSync(mapPath, 'utf-8');
  try {
    const map = JSON.parse(original);
    map.intents['INT-001'].lineage = {
      predecessors: [
        { version: 'v1', intent_id: 'INT-001' },
        { version: 'v1', intent_id: 'INT-001' },
      ],
      change_summary: '',
    };
    writeFileSync(mapPath, JSON.stringify(map, null, 2));
    const out = run('intent validate', true);
    assertContains(out, '不能自引用');
    assertContains(out, '重复引用');
    assertContains(out, 'change_summary');
  } finally {
    writeFileSync(mapPath, original);
  }
});

test('intent update — 合法状态转换 pending→in_progress', () => {
  // INT-003 的依赖先完成，再转成 in_progress
  run('verify pass INT-002 --summary "INT-002 当前 revision 的验收契约已验证通过，具备闭合条件"');
  run('intent update INT-002 --status completed');
  const out = run('intent update INT-003 --status in_progress');
  assertContains(out, 'INT-003 status 已更新为 in_progress');
  // 验证确实改了
  const data = JSON.parse(run('intent get INT-003'));
  assert(data.status === 'in_progress', 'status 未更新');
  // 改回去，不影响后续测试
  run('intent update INT-003 --status blocked');
  run('intent update INT-003 --status pending');
  run('intent update INT-002 --status needs_review');
  run('intent update INT-002 --status in_progress');
});

test('intent update — 纯 status 更新保持 revision 不变', () => {
  setup();
  const before = JSON.parse(run('intent get INT-002'));
  run('verify pass INT-002 --summary "INT-002 当前 revision 的验收契约已验证通过，具备闭合条件"');
  run('intent update INT-002 --status completed');
  const after = JSON.parse(run('intent get INT-002'));
  assert(after.revision === before.revision, 'status 更新不应改变 revision');
});

test('intent update — 非法状态转换被拒绝（completed→pending）', () => {
  // INT-001 是 completed，不能转回 pending
  try {
    run('intent update INT-001 --status pending');
    throw new Error('应该拒绝非法转换但没有');
  } catch (e) {
    assertContains(e.stderr || e.message, '非法状态转换');
  }
});

test('intent update — needs_review 状态转换（变更回流）', () => {
  // completed → needs_review（变更回流触发）
  const out = run('intent update INT-001 --status needs_review');
  assertContains(out, 'needs_review');
  // needs_review → in_progress（进入重新实现/验证）
  const out2 = run('intent update INT-001 --status in_progress');
  assertContains(out2, 'in_progress');
  // 恢复为 completed，不影响后续测试
  run('verify pass INT-001 --summary "INT-001 当前 revision 的验收契约已重新验证通过，具备闭合条件"');
  run('intent update INT-001 --status completed');
});

test('intent update — 没有当前 passed 验证时拒绝直接 completed', () => {
  setup();
  const out = run('intent update INT-002 --status completed', true);
  assertContains(out, '不能标记 completed');
  assertContains(out, 'loom intent done');
});

test('intent status — needs_review 纳入状态统计', () => {
  setup();
  run('intent update INT-001 --status needs_review');
  const out = run('intent status');
  assertContains(out, 'needs_review');
  assertContains(out, 'INT-001');
});

test('intent update — 依赖未完成时拒绝 pending→in_progress', () => {
  setup();
  const out = run('intent update INT-003 --status in_progress', true);
  assertContains(out, '依赖尚未完成');
  assertContains(out, 'INT-002');
});

console.log('\n测试 Intent deprecation');

test('intent deprecate — assessment 返回完整影响且逐字不修改 map', () => {
  setup();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const before = readFileSync(mapPath, 'utf-8');
  const result = JSON.parse(run('intent deprecate INT-001 --reason "认证能力由统一身份层替代"'));
  assert(result.mode === 'assessment' && result.mutated === false, '应明确报告只读 assessment');
  assert(result.target.id === 'INT-001' && result.target.status === 'completed', '目标信息不完整');
  assert(result.dependents.direct.some((item) => item.id === 'INT-002' && item.status === 'in_progress'), '缺少直接依赖方及状态');
  assert(result.dependents.transitive.some((item) => item.id === 'INT-003' && item.status === 'pending'), '缺少传递依赖方及状态');
  assert(result.required_partition.join(',') === 'INT-002,INT-003', 'required_partition 不完整');
  assertContains(result.follow_up.command, '--confirm');
  assertContains(result.follow_up.command, '--review');
  assertContains(result.follow_up.command, '--unaffected');
  assert(readFileSync(mapPath, 'utf-8') === before, 'assessment 不得修改 map');
});

test('intent deprecate — 分区缺失、重叠、重复和无关 ID 全部拒绝且不写入', () => {
  const cases = [
    ['--review INT-002', '缺少: INT-003'],
    ['--review INT-002,INT-003 --unaffected INT-003', '重叠'],
    ['--review INT-002,INT-002 --unaffected INT-003', '重复 ID'],
    ['--review INT-002 --unaffected INT-003,INT-999', '无关 Intent'],
  ];
  for (const [flags, expected] of cases) {
    setup();
    const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
    const before = readFileSync(mapPath, 'utf-8');
    const out = run(`intent deprecate INT-001 --reason "退出旧认证" --confirm ${flags}`, true);
    assertContains(out, expected);
    assert(readFileSync(mapPath, 'utf-8') === before, `失败分区不得写 map: ${flags}`);
  }
});

test('intent deprecate — reviewed completed 进入 needs_review，其他 reviewed 状态与 unaffected 不变', () => {
  setup();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  map.intents['INT-002'].status = 'completed';
  writeFileSync(mapPath, JSON.stringify(map, null, 2));
  const result = JSON.parse(run('intent deprecate INT-001 --reason "迁移到项目身份" --confirm --replacement INT-002 --review INT-002,INT-003'));
  const persisted = JSON.parse(readFileSync(mapPath, 'utf-8'));
  assert(result.mode === 'confirmed' && result.mutated === true, '应报告确认写入');
  assert(persisted.intents['INT-001'].status === 'completed', '弃用目标必须保持 completed');
  assert(persisted.intents['INT-001'].lifecycle.deprecation.reason === '迁移到项目身份', '弃用原因未持久化');
  assert(persisted.intents['INT-001'].lifecycle.deprecation.replacement === 'INT-002', 'replacement 未持久化');
  assert(persisted.intents['INT-002'].status === 'needs_review', 'reviewed completed 必须进入 needs_review');
  assert(persisted.intents['INT-003'].status === 'pending', 'reviewed 非 completed 状态必须不变');
  assert(result.reviewed.some((item) => item.id === 'INT-003' && item.status_before === 'pending' && item.status_after === 'pending'), '结果必须包含未转换的 reviewed 依赖方');
  assertContains(run('intent deprecate INT-001 --reason "重复" --confirm', true), '已弃用');
});

test('intent deprecate — unaffected 保持不变，leaf 无需分区', () => {
  setup();
  let mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  let map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  map.intents['INT-002'].status = 'completed';
  writeFileSync(mapPath, JSON.stringify(map, null, 2));
  const result = JSON.parse(run('intent deprecate INT-001 --reason "退出认证" --confirm --review INT-002 --unaffected INT-003'));
  map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  assert(map.intents['INT-003'].status === 'pending', 'unaffected 状态不得改变');
  assert(result.unaffected.some((item) => item.id === 'INT-003' && item.status_after === 'pending'), '结果应列出 unaffected 状态');

  setup();
  mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  map.intents['INT-003'].status = 'completed';
  writeFileSync(mapPath, JSON.stringify(map, null, 2));
  const assessment = JSON.parse(run('intent deprecate INT-003 --reason "协作邀请退出"'));
  assert(assessment.required_partition.length === 0, 'leaf 不应要求分区');
  assert(!assessment.follow_up.command.includes('--review'), 'leaf 指引不应包含分区参数');
  run('intent deprecate INT-003 --reason "协作邀请退出" --confirm');
  map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  assert(map.intents['INT-003'].status === 'completed' && map.intents['INT-003'].lifecycle.deprecation, 'leaf 应直接完成弃用');
});

test('intent deprecate — replacement 必须是另一个当前 Intent', () => {
  for (const [replacement, expected] of [['INT-001', '另一个当前 Intent'], ['INT-999', '不是当前 Intent']]) {
    setup();
    const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
    const before = readFileSync(mapPath, 'utf-8');
    const out = run(`intent deprecate INT-001 --reason "退出认证" --confirm --replacement ${replacement} --unaffected INT-002,INT-003`, true);
    assertContains(out, expected);
    assert(readFileSync(mapPath, 'utf-8') === before, 'replacement 校验失败不得写入');
  }
});

test('收敛计数 — 批量影响只计一趟，全部闭合后重置', () => {
  setup();
  completeAllIntents();
  run('intent deprecate INT-001 --reason "退出认证" --confirm --review INT-002,INT-003');
  let map = JSON.parse(readFileSync(join(LOOM_DIR, '04_INTENT_MAP.json'), 'utf-8'));
  assert(map._meta.pass_count === 1, `批量 review 应只计一趟，实际 ${map._meta.pass_count}`);
  assert(map._meta.reviewing_ids.length === 2, '应跟踪两个回流 Intent');
  run('intent update INT-002 --status in_progress');
  run('verify pass INT-002 --summary "INT-002 回流后的当前 revision 已重新验证通过，具备闭合条件"');
  run('intent update INT-002 --status completed');
  map = JSON.parse(readFileSync(join(LOOM_DIR, '04_INTENT_MAP.json'), 'utf-8'));
  assert(map._meta.pass_count === 1, '仍有回流 Intent 时不应重置趟数');
  run('intent update INT-003 --status in_progress');
  run('verify pass INT-003 --summary "INT-003 回流后的当前 revision 已重新验证通过，具备闭合条件"');
  run('intent update INT-003 --status completed');
  map = JSON.parse(readFileSync(join(LOOM_DIR, '04_INTENT_MAP.json'), 'utf-8'));
  assert(map._meta.pass_count === 0, '全部回流 Intent 闭合后应重置趟数');
  assert(!map._meta.reviewing_ids, '全部闭合后应清理 reviewing_ids');
});

test('intent lifecycle — validator 检查结构，status/context 暴露弃用且 next 跳过异常非 completed 弃用项', () => {
  setup();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const original = readFileSync(mapPath, 'utf-8');
  try {
    const invalid = JSON.parse(original);
    invalid.intents['INT-001'].lifecycle = { deprecation: { deprecated_at: 'not-a-date', reason: '', replacement: 'INT-999' } };
    writeFileSync(mapPath, JSON.stringify(invalid, null, 2));
    const invalidOut = run('intent validate', true);
    assertContains(invalidOut, 'deprecated_at');
    assertContains(invalidOut, 'reason');
    assertContains(invalidOut, 'replacement');

    writeFileSync(mapPath, original);
    run('intent deprecate INT-001 --reason "退出认证" --confirm --unaffected INT-002,INT-003');
    const status = run('intent status');
    assertContains(status, 'deprecated:   1');
    assertContains(status, 'INT-001');
    const context = JSON.parse(run('context'));
    assert(context.deprecated_intents.includes('INT-001'), 'context 应暴露弃用 Intent');

    const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
    map.intents['INT-001'].status = 'pending';
    map.intents['INT-002'].status = 'completed';
    writeFileSync(mapPath, JSON.stringify(map, null, 2));
    const next = run('intent next');
    assertContains(next, '没有可执行的 Intent');
    assert(!next.includes('INT-001'), 'next 必须跳过异常处于 pending 的弃用 Intent');
  } finally {
    writeFileSync(mapPath, original);
  }
});

console.log('\n测试 Minor Intent draft 命令');

function makeDraftFinalizable(id) {
  const draftPath = join(LOOM_DIR, 'drafts', `${id}.json`);
  const draft = JSON.parse(readFileSync(draftPath, 'utf-8'));
  draft.philosophy_anchors = ['PRODUCT_PHILOSOPHY.md#core-belief'];
  writeFileSync(draftPath, JSON.stringify(draft, null, 2));
  const visionPath = join(LOOM_DIR, '01_VISION.md');
  const verificationPath = join(LOOM_DIR, '05_VERIFICATION.md');
  writeFileSync(visionPath, readFileSync(visionPath, 'utf-8').replace(
    /\[TODO: replace this with the intent narrative:[^\]]+\]/,
    '团队需要可靠地导出项目资料，以便在迁移、审计和离线协作时仍然掌控自己的工作成果。'
  ));
  writeFileSync(verificationPath, readFileSync(verificationPath, 'utf-8').replace(
    /\[TODO: replace this with concrete, observable acceptance criteria[^\]]+\]/,
    '用户执行导出后会得到包含项目名称和成员清单的文件；无权限用户被拒绝，空项目仍生成结构合法的文件。'
  ));
  return draft;
}

test('intent add — 分配 ID 并保持官方 map/topo_order 不变', () => {
  setup();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const before = readFileSync(mapPath, 'utf-8');
  const draft = JSON.parse(run('intent add --title "项目资料导出" --depends-on INT-003'));
  assert(draft.id === 'INT-004', '应分配 INT-004');
  assert(draft.revision === 1 && draft.status === 'pending', '新增 draft 初始语义错误');
  assert(draft.acceptance === 'see 05_VERIFICATION.md#int-004', 'acceptance 应引用验证章节');
  assert(readFileSync(mapPath, 'utf-8') === before, 'finalize 前官方 map 必须逐字不变');
  assertContains(readFileSync(join(LOOM_DIR, '01_VISION.md'), 'utf-8'), '[DRAFT] INT-004');
  assertContains(readFileSync(join(LOOM_DIR, '05_VERIFICATION.md'), 'utf-8'), '[DRAFT] INT-004');
  assert(JSON.parse(run('intent draft INT-004')).id === 'INT-004', 'draft 命令未返回 draft');
});

test('intent finalize — 拒绝占位章节且不修改官方 map', () => {
  setup();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  run('intent add --title "项目资料导出"');
  const draftPath = join(LOOM_DIR, 'drafts', 'INT-004.json');
  const draft = JSON.parse(readFileSync(draftPath, 'utf-8'));
  draft.philosophy_anchors = ['PRODUCT_PHILOSOPHY.md#core-belief'];
  writeFileSync(draftPath, JSON.stringify(draft, null, 2));
  const before = readFileSync(mapPath, 'utf-8');
  assertContains(run('intent finalize INT-004', true), '非占位内容');
  assert(readFileSync(mapPath, 'utf-8') === before, '失败 finalize 不得修改官方 map');
  assert(existsSync(draftPath), '失败 finalize 不得删除 draft');
});

test('intent finalize — 成功新增并按 DAG 重算 topo_order', () => {
  setup();
  run('intent add --title "项目资料导出" --depends-on INT-003');
  makeDraftFinalizable('INT-004');
  const result = JSON.parse(run('intent finalize INT-004'));
  const map = JSON.parse(readFileSync(join(LOOM_DIR, '04_INTENT_MAP.json'), 'utf-8'));
  assert(result.operation === 'add', '应报告 add');
  assert(map.intents['INT-004'].status === 'pending', '新增 Intent 必须 pending');
  assert(map.topo_order.indexOf('INT-003') < map.topo_order.indexOf('INT-004'), '依赖必须位于新增 Intent 前');
  assert(!existsSync(join(LOOM_DIR, 'drafts', 'INT-004.json')), '成功后应删除 draft');
  assert(!readFileSync(join(LOOM_DIR, '01_VISION.md'), 'utf-8').includes('[DRAFT] INT-004'), '成功后应提升愿景章节');
  assert(!readFileSync(join(LOOM_DIR, '05_VERIFICATION.md'), 'utf-8').includes('[DRAFT] INT-004'), '成功后应提升验证章节');
  assertContains(run('intent validate'), '校验通过');
});

test('intent revise — 强制声明全部下游影响，completed finalize 为 needs_review', () => {
  setup();
  completeAllIntents();
  const result = JSON.parse(run('intent revise INT-001 --reason "认证承诺增加会话撤销边界"'));
  assert(result.draft.revision === 2, '修订 revision 应递增');
  assert(result.reverse_dependencies.direct.includes('INT-002'), '应报告直接反向依赖');
  assert(result.reverse_dependencies.transitive.includes('INT-003'), '应报告传递反向依赖');
  assertContains(run('intent revise INT-001 --reason "再次修改"', true), '已存在 draft');
  assertContains(run('intent finalize INT-001', true), '依赖分区不完整');
  const out = JSON.parse(run('intent finalize INT-001 --review INT-002,INT-003'));
  assert(out.intent.revision === 2, 'finalize 后 revision 应为 2');
  assert(out.intent.status === 'needs_review', 'completed 修订后必须 needs_review');
  const map = JSON.parse(readFileSync(join(LOOM_DIR, '04_INTENT_MAP.json'), 'utf-8'));
  assert(map._meta.pass_count === 1, 'completed→needs_review 应增加收敛趟计数');
  assert(map.intents['INT-002'].status === 'needs_review', '直接下游 completed 必须回流复验');
  assert(map.intents['INT-003'].status === 'needs_review', '传递下游 completed 必须回流复验');
});

test('intent finalize — 循环依赖被拒绝且官方 map 不变', () => {
  setup();
  run('intent revise INT-001 --reason "调整认证依赖边界以覆盖协作流程"');
  const draftPath = join(LOOM_DIR, 'drafts', 'INT-001.json');
  const draft = JSON.parse(readFileSync(draftPath, 'utf-8'));
  draft.depends_on = ['INT-003'];
  writeFileSync(draftPath, JSON.stringify(draft, null, 2));
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const before = readFileSync(mapPath, 'utf-8');
  assertContains(run('intent finalize INT-001 --review INT-002,INT-003', true), '循环');
  assert(readFileSync(mapPath, 'utf-8') === before, '循环依赖失败不得修改官方 map');
  assert(existsSync(draftPath), '循环依赖失败不得删除 draft');
});

test('activate --intent — draft 与官方角色都只加载对应作用域', () => {
  setup();
  run('intent add --title "项目资料导出"');
  const draftPrompt = run('activate visionary --intent INT-004');
  assertContains(draftPrompt, '# LOOM Context Pack');
  assertContains(draftPrompt, '只处理下面这个 draft');
  assertContains(draftPrompt, '不要修改官方 Intent Map');
  assertContains(draftPrompt, '项目资料导出');
  assert(!draftPrompt.includes('用户注册与登录'), 'draft 激活不应加载其他官方 Intent');

  const officialPrompt = run('activate forge --intent INT-001');
  assertContains(officialPrompt, '## 2. Active Objective');
  assertContains(officialPrompt, '## 7. Expertise Inputs');
  assertContains(officialPrompt, '用户注册与登录');
  assertContains(officialPrompt, '身份自治的入口');
  assertContains(officialPrompt, '注册并登录');
  assertContains(officialPrompt, '掌控自己的数据');
  assertContains(officialPrompt, 'quality_strategy: adaptive');
  assert(!officialPrompt.includes('Authorship Method'), 'adaptive Intent 不应注入 Atelier 方法');
  assert(!officialPrompt.includes('协作是产品的核心'), '官方 Intent 只应加载精确 Doctrine anchor');
  assertContains(run('activate forge --intent INT-004', true), 'Intent 不存在');
});

test('activate forge/keeper — 显式 Intent 也不得绕过未完成依赖', () => {
  setup();
  assertContains(run('activate forge --intent INT-003', true), '依赖尚未闭合: INT-002');
  assertContains(run('activate keeper --intent INT-003', true), '不得通过 activate --intent 绕过执行顺序');
});

test('activate forge — Context Pack 顺序稳定并注入质量与专业能力输入', () => {
  setup();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  Object.assign(map.intents['INT-001'], {
    quality_contract: '相对当前基线，首次登录理解时间至少降低 20%，安全行为与错误率不回退。',
    quality_strategy: 'atelier',
    capability_needs: ['身份安全', '交互反馈设计'],
    creative_scope: '允许探索信息层级和反馈机制，不改变认证业务语义与安全边界。',
  });
  writeFileSync(mapPath, JSON.stringify(map, null, 2));

  const out = run('activate forge --intent INT-001');
  const headings = [
    '## 1. Execution Envelope',
    '## 2. Active Objective',
    '## 3. Hard Invariants',
    '## 4. Success Contracts',
    '## 5. Project Judgment',
    '## 6. Stage Inputs (command-assembled)',
    '## 7. Expertise Inputs',
    '## 8. Working Facts',
    '## 9. Role Contract / Output / Reflow / Stop',
  ];
  for (let i = 1; i < headings.length; i++) {
    assert(out.indexOf(headings[i - 1]) < out.indexOf(headings[i]), `Context Pack 顺序错误: ${headings[i]}`);
  }
  assertContains(out, '身份安全');
  assertContains(out, '交互反馈设计');
  assertContains(out, '首次登录理解时间');
  assertContains(out, 'quality_strategy: atelier');
  assertContains(out, 'Authorship Method');
  assertContains(out, 'Authorial Stance');
  assertContains(out, '09_ATELIER/INT-001.json');
  assertContains(out, 'provenance-backed Capability Graph proposal');
  assertContains(out, '只代表可发现入口');
  assert(!out.includes('协作者邀请'), '当前 Intent 不应注入无关 Intent');
  setup();
});

test('atelier — 只为显式 atelier Intent 创建并校验版本化创作记录', () => {
  setup();
  assertContains(run('atelier init INT-001', true), '未启用 quality_strategy=atelier');

  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  Object.assign(map.intents['INT-001'], {
    quality_contract: '相对当前基线，用户对核心命题的复述准确率提高，且登录任务成功率不回退。',
    quality_strategy: 'atelier',
    creative_scope: '允许改变登录入口的构图、节奏和反馈；不得改变认证语义与安全边界。',
    status: 'in_progress',
  });
  writeFileSync(mapPath, JSON.stringify(map, null, 2));
  assertContains(runFromRoot('guide --dry-run'), 'loom atelier init INT-001');
  assertContains(run('doctor'), 'atelier_record_invalid');

  const created = JSON.parse(run('atelier init INT-001'));
  assert(created.status === 'draft' && created.stance_revision === 1, 'atelier init 必须创建 revision=1 的 draft');
  assertContains(run('atelier validate INT-001'), '"valid": true');
  assertContains(run('atelier init INT-001', true), '不会覆盖');

  const atelierDir = join(LOOM_DIR, '09_ATELIER');
  const filesDir = join(atelierDir, 'files', 'INT-001');
  const recordPath = join(atelierDir, 'INT-001.json');
  const blocked = JSON.parse(readFileSync(recordPath, 'utf-8'));
  blocked.status = 'blocked';
  writeFileSync(recordPath, JSON.stringify(blocked, null, 2));
  assertContains(run('atelier validate INT-001', true), 'blocker 对象');
  blocked.blocker = {
    reason: '缺少目标宿主的可访问测试环境。',
    recovery_condition: '获得测试环境权限并能保存真实基线。',
  };
  writeFileSync(recordPath, JSON.stringify(blocked, null, 2));
  assertContains(run('atelier validate INT-001'), '"status": "blocked"');

  for (const file of ['baseline.png', 'candidate-a.png', 'candidate-b.png', 'comparison.md']) {
    writeFileSync(join(filesDir, file), file.endsWith('.png')
      ? Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      : '# comparison\n\n匿名顺序交换比较记录。\n');
  }
  const record = JSON.parse(readFileSync(recordPath, 'utf-8'));
  Object.assign(record, {
    status: 'selected',
    blocker: null,
    stance: {
      creative_thesis: '让身份确认像一次清晰的交接，而不是填写表单。',
      gaze: ['先确认控制权，再输入凭证'],
      tension: '明确的安全感与轻盈的完成节奏同时成立',
      signature_bet: {
        claim: '用连续确认过程替代等权字段堆叠',
        mechanism: '分阶段显露信息并持续反馈当前控制状态',
        cost: '首次流程增加一个明确确认动作',
      },
      refusals: ['默认居中卡片表单'],
      reference_mechanisms: [],
      medium_grammar: { composition: '连续单路径', motion: '只反馈状态变化' },
      surprise_budget: {
        level: 'medium',
        allowed: '改变布局与反馈节奏',
        protected: '认证语义、安全边界和键盘可用性',
      },
      anti_fixation: ['至少一个候选禁止使用卡片容器'],
      verification_lens: ['用户能否复述当前控制权状态'],
    },
    baseline: {
      artifact_refs: ['09_ATELIER/files/INT-001/baseline.png'],
      observed_limit: '字段可靠但全部等权，用户无法先确认控制权。',
    },
    diversity_axes: [
      { id: 'structure', low: '离散字段', high: '连续确认', why: '改变理解顺序' },
      { id: 'guidance', low: '一次展示', high: '渐进显露', why: '改变首次理解成本' },
    ],
    candidates: [
      {
        id: 'CAND-A',
        stance_revision: 1,
        mechanism: '连续确认路径',
        artifact_refs: ['09_ATELIER/files/INT-001/candidate-a.png'],
        floor_check: 'passed',
        floor_evidence: '认证回归与键盘路径通过。',
      },
      {
        id: 'CAND-B',
        stance_revision: 1,
        mechanism: '分区控制面板',
        artifact_refs: ['09_ATELIER/files/INT-001/candidate-b.png'],
        floor_check: 'passed',
        floor_evidence: '认证回归与键盘路径通过。',
      },
    ],
    selection: {
      status: 'selected',
      selected_candidate: 'CAND-A',
      method: '匿名顺序交换比较',
      evidence_refs: ['09_ATELIER/files/INT-001/comparison.md'],
      why: '核心命题复述更准确，任务成功率未回退。',
      remaining_tradeoff: '首次流程多一个确认动作。',
    },
  });
  writeFileSync(recordPath, JSON.stringify(record, null, 2));
  assertContains(run('atelier validate INT-001'), '"status": "selected"');
  assertContains(run('atelier get INT-001'), '"selected_candidate": "CAND-A"');
  const keeper = run('activate keeper --intent INT-001');
  assertContains(keeper, 'Atelier Record');
  assertContains(keeper, '"selected_candidate": "CAND-A"');
  writeFileSync(join(TEST_ROOT, 'artifacts', 'quality-proof-int001.md'), '# INT-001 {#INT-001}\n\n基线、候选、作者命题、稳定性与取舍证据。\n');
  run('verify pass INT-001 --summary "匿名比较证明作者命题可被复述，认证回归与键盘路径均未退化" --quality-proof "artifacts/quality-proof-int001.md#INT-001"');
  const verification = JSON.parse(readFileSync(join(VERIFICATIONS_DIR, 'INT-001.json'), 'utf-8'));
  const latest = verification.records[verification.records.length - 1];
  assert(latest.atelier?.stance_revision === 1, 'Atelier passed 验证必须绑定 stance_revision');
  assert(latest.atelier?.record_ref === '09_ATELIER/INT-001.json', 'Atelier passed 验证必须绑定 Record');

  record.intent_revision = 99;
  record.candidates[0].floor_check = 'failed';
  writeFileSync(recordPath, JSON.stringify(record, null, 2));
  const invalid = run('atelier validate INT-001', true);
  assertContains(invalid, '已过期');
  assertContains(invalid, 'selected candidate 必须通过 Reliability Floor');
  assertContains(
    run('verify pass INT-001 --summary "再次验证作者命题与认证回归，准备写入新一轮结果" --quality-proof "artifacts/quality-proof-int001.md#INT-001"', true),
    '必须有当前且合法的 Atelier Record',
  );
  assertContains(run('intent done INT-001', true), 'Atelier Record 校验失败');
  record.intent_revision = 1;
  record.candidates[0].floor_check = 'passed';
  writeFileSync(recordPath, JSON.stringify(record, null, 2));
  assertContains(run('intent done INT-001'), '已完成');
  setup();
});

console.log('\n测试 Capability Graph 命令');

test('asset library — imports local approved bytes, supports Chinese search, and rejects incomplete or duplicate provenance', () => {
  const source = join(TEST_ROOT, 'emoji-测试.png');
  writeFileSync(source, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const incomplete = run(`asset import "${source}" --tags "庆祝,表情" --source "用户导入" --author "测试作者" --approval approved`, true);
  assertContains(incomplete, '--license is required');
  const imported = JSON.parse(run(`asset import "${source}" --tags "庆祝,表情" --source "用户导入" --author "测试作者" --license "CC0-1.0" --approval approved`));
  assert(imported.id.startsWith('ASSET-'), '资产必须获得内容派生 stable id');
  assert(existsSync(join(LOOM_DIR, '08_ASSET_LIBRARY', imported.path)), '资产字节必须被复制进版本化库内');
  const found = JSON.parse(run('asset search 表情'));
  assert(found.length === 1 && found[0].id === imported.id, '中文标签必须可检索');
  assert(JSON.parse(run(`asset get ${imported.id}`)).content_hash === imported.content_hash, 'asset get 必须返回可追溯哈希');
  assert(JSON.parse(run('asset validate')).valid === true, '无 evidence 回链的已批准资产应可校验');
  const evidenceSource = join(TEST_ROOT, 'emoji-evidence.png');
  writeFileSync(evidenceSource, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]));
  const evidenceAsset = JSON.parse(run(`asset import "${evidenceSource}" --tags "宿主呈现" --source "用户导入" --author "测试作者" --license "CC0-1.0" --approval approved --evidence EVIDENCE-IDENTITY-HOST`));
  const graphWithAsset = JSON.parse(readFileSync(join(LOOM_DIR, '07_CAPABILITY_GRAPH.json'), 'utf-8'));
  assert(graphWithAsset.nodes['EVIDENCE-IDENTITY-HOST'].asset_refs.includes(evidenceAsset.id), '带 evidence 导入必须原子写入 evidence → asset 回链');
  assert(JSON.parse(run('asset validate')).valid === true, '自动双向回链后的资产库必须可校验');
  const duplicate = run(`asset import "${source}" --tags "庆祝" --source "用户导入" --author "测试作者" --license "CC0-1.0" --approval approved`, true);
  assertContains(duplicate, 'duplicate asset bytes');
});

test('asset import transaction — second metadata write failure rolls back, and validate recovers an interrupted journal', () => {
  setup();
  const source = join(TEST_ROOT, 'transaction-emoji.png');
  writeFileSync(source, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x77]));
  const manifestPath = join(ASSET_LIBRARY_DIR, 'manifest.json');
  const graphPath = join(LOOM_DIR, '07_CAPABILITY_GRAPH.json');
  const beforeManifest = readFileSync(manifestPath, 'utf-8');
  const beforeGraph = readFileSync(graphPath, 'utf-8');
  const command = `asset import "${source}" --tags "transaction" --source "test" --author "test" --license "CC0-1.0" --approval approved --evidence EVIDENCE-IDENTITY-HOST`;

  const failed = run(`${command} --test-fail-after manifest`, true);
  assertContains(failed, 'injected asset import failure after manifest write');
  assert(readFileSync(manifestPath, 'utf-8') === beforeManifest, 'second write failure must restore manifest bytes exactly');
  assert(readFileSync(graphPath, 'utf-8') === beforeGraph, 'second write failure must restore graph bytes exactly');
  assert(readdirSync(join(ASSET_LIBRARY_DIR, 'files')).length === 0, 'second write failure must not orphan copied asset bytes');
  assert(!existsSync(join(ASSET_LIBRARY_DIR, '.asset-import-journal.json')), 'successful rollback must remove its journal');

  const interrupted = run(`${command} --test-fail-after crash-manifest`, true);
  assertContains(interrupted, 'injected crash after manifest write');
  assert(existsSync(join(ASSET_LIBRARY_DIR, '.asset-import-journal.json')), 'interrupted transaction must leave a recovery journal');
  const validation = JSON.parse(run('asset validate'));
  assert(validation.recovered_transaction?.recovered === true, 'asset validate must explicitly report recovered transaction');
  assert(readFileSync(manifestPath, 'utf-8') === beforeManifest, 'recovery must restore manifest bytes exactly');
  assert(readFileSync(graphPath, 'utf-8') === beforeGraph, 'recovery must restore graph bytes exactly');
  assert(readdirSync(join(ASSET_LIBRARY_DIR, 'files')).length === 0, 'recovery must remove staged/copied bytes');
  assert(!existsSync(join(ASSET_LIBRARY_DIR, '.asset-import-journal.json')), 'recovery must clear the completed journal');
});

test('capability proposal — incoming requirement is audited, blocks guide, and closes only after Architect decision', () => {
  const proposalPath = join(TEST_ROOT, 'CGP-ASSET-RENDER.json');
  writeFileSync(proposalPath, JSON.stringify({
    id: 'CGP-ASSET-RENDER', origin: 'user_request', candidate_kind: 'constraint', title: '素材必须在目标宿主可见',
    why_now: '外链成功不等于用户可见，需要强制宿主呈现验收。',
    provenance: { source: '用户反馈', observed_at: '2026-07-30', evidence: '上一轮外链在目标宿主未呈现。' }, status: 'submitted',
  }, null, 2));
  const submitted = JSON.parse(run(`capability proposal submit --json-file "${proposalPath}"`));
  assert(submitted.status === 'submitted', 'proposal 必须从 submitted 开始');
  assertContains(runFromRoot('guide'), 'capability_graph_proposals_pending');
  const decided = JSON.parse(run('capability proposal decide CGP-ASSET-RENDER graph_update --rationale "将呈现约束写入 evidence 节点并建立资产双向回链"'));
  assert(decided.status === 'decided' && decided.decision === 'graph_update', 'Architect 决策必须显式落盘');
  assertContains(runFromRoot('guide'), 'capability_graph_proposals_pending');
  const prematureResolution = join(TEST_ROOT, 'CGP-ASSET-RENDER-premature.json');
  writeFileSync(prematureResolution, JSON.stringify({ graph: { node_ids: ['EVIDENCE-IDENTITY-HOST'] } }));
  assertContains(run(`capability proposal close CGP-ASSET-RENDER --resolution-file "${prematureResolution}"`, true), 'real change to 07_CAPABILITY_GRAPH.json');
  const graphPath = join(LOOM_DIR, '07_CAPABILITY_GRAPH.json');
  const graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
  graph.nodes['EVIDENCE-IDENTITY-HOST'].proposal_refs = ['CGP-ASSET-RENDER'];
  writeFileSync(graphPath, JSON.stringify(graph, null, 2));
  const resolution = join(TEST_ROOT, 'CGP-ASSET-RENDER-resolution.json');
  writeFileSync(resolution, JSON.stringify({ graph: { node_ids: ['EVIDENCE-IDENTITY-HOST'] } }));
  assertContains(run(`capability proposal close CGP-ASSET-RENDER --resolution-file "${resolution}"`, true), 'requires a formal Graph constraints carrier');
  graph.constraints = [{ proposal_id: 'CGP-ASSET-RENDER', title: '素材必须在目标宿主可见', node_refs: ['EVIDENCE-IDENTITY-HOST'] }];
  writeFileSync(graphPath, JSON.stringify(graph, null, 2));
  const closed = JSON.parse(run(`capability proposal close CGP-ASSET-RENDER --resolution-file "${resolution}"`));
  assert(closed.status === 'closed' && closed.resolution.graph.node_ids[0] === 'EVIDENCE-IDENTITY-HOST', 'proposal 必须以结构化 resolution 和真实 Graph 变更关闭');
  assert(!runFromRoot('guide').includes('capability_graph_proposals_pending'), 'closed proposal 不得持续阻断 loop');
});

test('capability graph/frontier/get/coverage/compile — 图谱、Brief 与 Intent 回链可查询', () => {
  setup();
  const graph = JSON.parse(run('capability graph'));
  assert(graph.summary.total === 5, '图谱节点数不正确');
  assertContains(graph.mermaid, 'CAP-PROJECT-CREATION');
  assert(JSON.parse(run('capability frontier')).length === 0, '已路由高影响节点不应进入 frontier');

  const node = JSON.parse(run('capability get CAP-PROJECT-CREATION'));
  assert(node.node.brief_ref.includes('CAP-PROJECT-CREATION'), '能力节点应返回 Brief 引用');
  const coverage = JSON.parse(run('capability coverage'));
  assert(coverage.summary.ready === true, '完整图谱应通过 coverage');
  assert(coverage.summary.unmapped_intents === 0, '所有 Intent 应回链图谱');
  assert(coverage.summary.routing_gaps === 0, '完整图谱不应存在无依据的路由');

  const compiled = JSON.parse(run('capability compile INT-002'));
  assert(compiled.available === true, 'Capability Graph 应可用');
  assert(compiled.nodes.some((item) => item.id === 'CAP-PROJECT-CREATION'), '编译输入缺少能力节点');
  assertContains(compiled.briefs[0].content, '项目创建的可理解流程');
  assertContains(run('activate forge --intent INT-002'), 'Capability Brief: CAP-PROJECT-CREATION');
});

test('capability coverage — 高影响未路由节点必须被发现', () => {
  setup();
  const graphPath = join(LOOM_DIR, '07_CAPABILITY_GRAPH.json');
  const graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
  graph.nodes['CAP-PROJECT-CREATION'].status = 'open';
  graph.nodes['CAP-PROJECT-CREATION'].route = 'expand';
  graph.nodes['CAP-PROJECT-CREATION'].brief_ref = undefined;
  writeFileSync(graphPath, JSON.stringify(graph, null, 2));
  const frontier = JSON.parse(run('capability frontier'));
  assert(frontier.some((item) => item.id === 'CAP-PROJECT-CREATION'), '高影响 open 节点必须出现在 frontier');
  const coverage = JSON.parse(run('capability coverage'));
  assert(coverage.summary.high_unrouted === 1, 'coverage 必须统计未路由高影响节点');
  assertContains(run('doctor'), 'capability_frontier_open');
});

test('capability coverage — Intent 漏回链或路由缺证据不得显示 ready', () => {
  setup();
  const graphPath = join(LOOM_DIR, '07_CAPABILITY_GRAPH.json');
  const graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
  graph.nodes['CONCERN-COLLABORATION'].intent_refs = [];
  writeFileSync(graphPath, JSON.stringify(graph, null, 2));
  const coverage = JSON.parse(run('capability coverage'));
  assert(coverage.summary.ready === false, '任一 Intent 漏回链时 coverage 不得 ready');
  assert(coverage.summary.routing_gaps === 1, 'intent 路由缺少回链必须被统计');
  assert(coverage.summary.unmapped_intents === 1, '漏回链 Intent 必须被统计');
  assertContains(run('doctor'), 'capability_route_evidence');
  assertContains(run('doctor'), 'intent_graph_unmapped');
});

test('capability coverage — outcome 必须展开为 concern', () => {
  setup();
  const graphPath = join(LOOM_DIR, '07_CAPABILITY_GRAPH.json');
  const graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
  graph.nodes['OUTCOME-IDENTITY'].relationships = [];
  writeFileSync(graphPath, JSON.stringify(graph, null, 2));
  const coverage = JSON.parse(run('capability coverage'));
  assert(coverage.summary.ready === false, '未展开的 outcome 不得通过 coverage');
  assert(coverage.summary.outcomes_without_concern === 1, '缺少 concern 的 outcome 必须被统计');
  assertContains(run('doctor'), 'capability_outcome_unexpanded');
});

test('capability coverage/doctor/guide — 高影响 outcome 必须拥有目标宿主中的可观察验证链', () => {
  setup();
  const graphPath = join(LOOM_DIR, '07_CAPABILITY_GRAPH.json');
  const graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
  graph.nodes['OUTCOME-IDENTITY'].relationships = graph.nodes['OUTCOME-IDENTITY'].relationships
    .filter((relation) => relation.type !== 'validated_by');
  writeFileSync(graphPath, JSON.stringify(graph, null, 2));

  const coverage = JSON.parse(run('capability coverage'));
  assert(coverage.summary.ready === false, '缺少宿主可观察验证链时 coverage 不得 ready');
  assert(coverage.summary.high_outcomes_without_observable_evidence === 1, '高影响 outcome 的可观察验证缺口必须被统计');
  assertContains(run('doctor'), 'capability_outcome_unobservable');
  const guide = runFromRoot('guide');
  assertContains(guide, 'capability_graph_incomplete');
  assertContains(guide, '不可观察 outcome 1');
});

test('capability graph — evidence artifact and covered_by must be real, direct and local', () => {
  setup();
  const graphPath = join(LOOM_DIR, '07_CAPABILITY_GRAPH.json');
  const graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
  graph.nodes['EVIDENCE-IDENTITY-HOST'].verification.artifact = 'verifications/not-written.png';
  writeFileSync(graphPath, JSON.stringify(graph, null, 2));
  const missingArtifact = JSON.parse(run('capability coverage'));
  assert(missingArtifact.summary.ready === false && missingArtifact.summary.high_outcomes_without_observable_evidence === 1, 'evidence artifact 只是路径文本而未真实落盘时不得通过');

  setup();
  const invalidCoveredBy = JSON.parse(readFileSync(graphPath, 'utf-8'));
  invalidCoveredBy.nodes['CAP-PROJECT-CREATION'].status = 'covered';
  invalidCoveredBy.nodes['CAP-PROJECT-CREATION'].route = 'covered_by';
  invalidCoveredBy.nodes['CAP-PROJECT-CREATION'].covered_by = 'CAP-PROJECT-CREATION';
  invalidCoveredBy.nodes['CAP-PROJECT-CREATION'].relationships = [{ type: 'covered_by', target: 'CAP-PROJECT-CREATION' }];
  writeFileSync(graphPath, JSON.stringify(invalidCoveredBy, null, 2));
  assertContains(run('capability coverage', true), 'covered_by 不得指向自身');
});

test('external acquisition — 高影响能力默认进入强门，并由 guide/activate/doctor 暴露', () => {
  setup();
  useDefaultHighImpactAcquisition();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  map.intents['INT-002'].quality_contract = '相对当前基线，项目创建首次成功时间至少降低 20%，错误率不回退。';
  writeFileSync(mapPath, JSON.stringify(map, null, 2));

  const compiled = JSON.parse(run('capability compile INT-002'));
  assert(compiled.acquisition.required === true, '未显式豁免的高影响 capability 应启用外部获取强门');
  assert(compiled.acquisition.required_node_ids.includes('CAP-PROJECT-CREATION'), '必须报告强门能力节点');
  assertContains(runFromRoot('guide'), 'loom expertise init INT-002');
  const activation = run('activate forge --intent INT-002');
  assertContains(activation, 'External Acquisition Gate — OPEN');
  assertContains(activation, 'find skill');
  assertContains(run('doctor'), 'expertise_pack_invalid');
});

test('expertise pack — draft 不能冒充 ready，来源化 Capsule 闭合后才注入 Forge', () => {
  setup();
  useDefaultHighImpactAcquisition();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  map.intents['INT-002'].quality_contract = '相对当前基线，项目创建首次成功时间至少降低 20%，错误率不回退。';
  writeFileSync(mapPath, JSON.stringify(map, null, 2));

  const draft = JSON.parse(run('expertise init INT-002'));
  assert(draft.status === 'draft', 'init 应只创建 draft');
  assertContains(run('expertise validate INT-002', true), '必须为 ready');

  const pack = writeReadyExpertisePack();
  const validation = JSON.parse(run('expertise validate INT-002'));
  assert(validation.external_source_count === 1, 'ready Pack 必须统计外部来源');
  const activation = run('activate forge --intent INT-002');
  assertContains(activation, 'External Acquisition Gate — READY');
  assertContains(activation, pack.capsules[0].professional_problem);

  pack.capsules[0].source_refs = [];
  writeFileSync(join(EXPERTISE_PACKS_DIR, 'INT-002.json'), JSON.stringify(pack, null, 2));
  assertContains(run('expertise validate INT-002', true), '至少需要一个来源');
});

test('capability acquisition_mode — 显式 required 生效，project_only 必须说明理由', () => {
  setup();
  const graphPath = join(LOOM_DIR, '07_CAPABILITY_GRAPH.json');
  const graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
  graph.nodes['CAP-PROJECT-CREATION'].acquisition_mode = 'external_required';
  writeFileSync(graphPath, JSON.stringify(graph, null, 2));
  assert(JSON.parse(run('capability compile INT-002')).acquisition.required === true, '显式 external_required 应生效');

  graph.nodes['CAP-PROJECT-CREATION'].acquisition_mode = 'project_only';
  delete graph.nodes['CAP-PROJECT-CREATION'].acquisition_rationale;
  writeFileSync(graphPath, JSON.stringify(graph, null, 2));
  assertContains(run('capability coverage', true), 'acquisition_rationale');
  graph.nodes['CAP-PROJECT-CREATION'].acquisition_rationale = '这是对未公开内部协议的机械迁移，不存在可适用的外部专业知识。';
  writeFileSync(graphPath, JSON.stringify(graph, null, 2));
  assert(JSON.parse(run('capability compile INT-002')).acquisition.required === false, '有理由的 project_only 不应强制外部获取');
});

test('1.2.1 — 高影响 adaptive 必须留下不获取的理由，完成后丢失 evidence artifact 必须被 doctor 发现', () => {
  setup();
  const graphPath = join(LOOM_DIR, '07_CAPABILITY_GRAPH.json');
  const graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
  delete graph.nodes['CAP-PROJECT-CREATION'].acquisition_rationale;
  writeFileSync(graphPath, JSON.stringify(graph, null, 2));
  assertContains(run('capability coverage', true), 'adaptive');
  graph.nodes['CAP-PROJECT-CREATION'].acquisition_rationale = '当前任务已有经验证的项目内方法，外部获取不会改变本轮判断。';
  graph.nodes['EVIDENCE-IDENTITY-HOST'].verification.artifact = 'verifications/missing-proof.png';
  writeFileSync(graphPath, JSON.stringify(graph, null, 2));
  assertContains(run('doctor'), 'capability_evidence_artifact_missing');
  setup();
});

test('1.2.1 — 快捷 passed 必须声明可审计的独立验证来源', () => {
  setup();
  const out = run('verify pass INT-002 --summary "独立复现项目创建的完整行为与失败边界" --verified-by "keeper-test-thread"', true);
  assertContains(out, '--verification-context');
});

console.log('\n测试 philosophy 命令');

test('philosophy get — 按锚点加载特定章节', () => {
  const out = run('philosophy get PRODUCT_PHILOSOPHY.md#core-belief');
  assertContains(out, 'Core Belief');
  assertContains(out, '掌控自己的数据');
  // 不应包含其他章节
  assert(!out.includes('协作是产品的核心'), '不应包含 Collaboration 章节');
});

test('philosophy get — 中文标题用显式锚点匹配', () => {
  // 写一个中文标题的哲学文档，用显式锚点
  writeFileSync(join(PHILOSOPHY_DIR, 'CN_TEST.md'), [
    '# 测试文档',
    '',
    '## 核心信念 {#core-belief}',
    '',
    '这是中文标题的章节内容。',
    '',
    '## 反模式清单 {#anti-patterns}',
    '',
    '不做过度设计。',
  ].join('\n'));

  const out = run('philosophy get CN_TEST.md#core-belief');
  assertContains(out, '中文标题的章节内容');

  const out2 = run('philosophy get CN_TEST.md#anti-patterns');
  assertContains(out2, '过度设计');
});

test('philosophy get — 无锚点时返回整个文件', () => {
  const out = run('philosophy get ENGINEERING_CREED.md');
  assertContains(out, '工程信条');
  assertContains(out, 'Simplicity');
});

test('philosophy get — 拒绝越出哲学目录的文件路径', () => {
  const out = run('philosophy get ../01_VISION.md', true);
  assertContains(out, '哲学锚点文件名非法');
});

test('philosophy list — 列出哲学文档', () => {
  const out = run('philosophy list');
  const files = JSON.parse(out);
  assert(files.includes('PRODUCT_PHILOSOPHY.md'), '缺少 PRODUCT_PHILOSOPHY.md');
  assert(files.includes('ENGINEERING_CREED.md'), '缺少 ENGINEERING_CREED.md');
});

test('philosophy check — 无灵感来源章节报 high', () => {
  // 当前测试数据的哲学文档没有可追溯的证据条目。
  const out = run('philosophy check', true);
  assertContains(out, '哲学文档校验未通过');
  assertContains(out, '灵感来源');
  assertContains(out, 'loom activate weaver');
  assert(!out.includes('参见 meta/PHILOSOPHY_WEAVER.md'), '哲学恢复不应让 Agent 手动寻找框架文件');
});

test('philosophy check — 单个决策相关的 Wikipedia 来源可以通过', () => {
  writeFileSync(join(PHILOSOPHY_DIR, 'TEST_INSPIRATION.md'), [
    '# 测试灵感来源',
    '',
    '## 灵感来源',
    '',
    '- **Unix Philosophy** — 为什么相关：用于判断 CLI 是否应保持单一职责；转译为组合优先。来源：https://en.wikipedia.org/wiki/Unix_philosophy',
  ].join('\n'));
  const out = run('philosophy check');
  assertContains(out, '通过');
  rmSync(join(PHILOSOPHY_DIR, 'TEST_INSPIRATION.md'), { force: true });
});

test('philosophy check — 来源缺少选择理由时拒绝', () => {
  writeFileSync(join(PHILOSOPHY_DIR, 'TEST_NO_REASON.md'), [
    '# 测试无理由来源',
    '',
    '## 灵感来源',
    '',
    '- **Unix Philosophy** — 来源：https://en.wikipedia.org/wiki/Unix_philosophy',
  ].join('\n'));
  const out = run('philosophy check', true);
  assertContains(out, '缺乏选取理由');
  rmSync(join(PHILOSOPHY_DIR, 'TEST_NO_REASON.md'), { force: true });
});

test('philosophy check — 一个可追溯且有转译理由的来源即可通过', () => {
  writeFileSync(join(PHILOSOPHY_DIR, 'TEST_GOOD.md'), [
    '# 测试合格',
    '',
    '## 灵感来源',
    '',
    '- **真实用户反馈** — 为什么相关：直接暴露首次使用失败；转译为默认路径必须可发现。来源：local:./research/user-feedback.md',
  ].join('\n'));
  const out = run('philosophy check');
  assertContains(out, '通过');
  rmSync(join(PHILOSOPHY_DIR, 'TEST_GOOD.md'), { force: true });
});

test('philosophy impact — 返回直接引用和传递闭包且不修改文件', () => {
  setup();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const before = readFileSync(mapPath, 'utf-8');
  const result = JSON.parse(run('philosophy impact PRODUCT_PHILOSOPHY.md#core-belief'));
  assert(result.direct.length === 1 && result.direct[0].id === 'INT-001', '直接引用不正确');
  assert(result.transitive.map((item) => item.id).join(',') === 'INT-002,INT-003', '传递闭包不正确');
  assert(result.impacted.every((item) => item.title && item.status && item.revision === 1 && item.acceptance), '影响详情不完整');
  assert(readFileSync(mapPath, 'utf-8') === before, 'impact 不得修改 map');
  assert(!existsSync(join(LOOM_DIR, '03_DECISIONS')), 'impact 不得创建 ADR 目录');
  assertContains(run('philosophy impact PRODUCT_PHILOSOPHY.md#missing', true), '章节未找到');
});

test('philosophy revise assessment — clarification/minor 严格只读并给出确认指引', () => {
  for (const classification of ['clarification', 'minor']) {
    setup();
    const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
    const before = readFileSync(mapPath, 'utf-8');
    const result = JSON.parse(run(`philosophy revise PRODUCT_PHILOSOPHY.md#core-belief --classification ${classification} --reason "补充边界说明"`));
    assert(result.mode === 'assessment' && result.mutated === false, '未确认必须只读');
    assert(result.required_partition.join(',') === 'INT-001,INT-002,INT-003', '必须分区全部影响');
    assertContains(result.follow_up.command, '--confirm');
    if (classification === 'clarification') {
      assertContains(result.follow_up.command, '--unaffected INT-001,INT-002,INT-003');
      assert(!result.follow_up.command.includes('--review'), 'clarification 不得要求 review');
    } else assertContains(result.follow_up.command, '--review');
    assert(readFileSync(mapPath, 'utf-8') === before, 'assessment 不得修改 map');
    assert(!existsSync(join(LOOM_DIR, '03_DECISIONS')), 'assessment 不得写 ADR');
  }
});

test('philosophy revise clarification — review 为空，状态和 acceptance 不变并写 ADR', () => {
  setup();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const before = JSON.parse(readFileSync(mapPath, 'utf-8'));
  assertContains(run('philosophy revise PRODUCT_PHILOSOPHY.md#core-belief --classification clarification --reason "补充边界" --confirm --review INT-001 --unaffected INT-002,INT-003', true), 'review 必须为空');
  const result = JSON.parse(run('philosophy revise PRODUCT_PHILOSOPHY.md#core-belief --classification clarification --reason "补充边界" --confirm --unaffected INT-001,INT-002,INT-003'));
  const after = JSON.parse(readFileSync(mapPath, 'utf-8'));
  assert(result.audit_adr === '03_DECISIONS/PHIL-REV-001.md', 'ADR 命名不正确');
  for (const id of ['INT-001', 'INT-002', 'INT-003']) {
    assert(after.intents[id].status === before.intents[id].status, `${id} 状态不应改变`);
    assert(after.intents[id].acceptance === before.intents[id].acceptance, `${id} acceptance 不应改变`);
  }
  const adr = readFileSync(join(LOOM_DIR, result.audit_adr), 'utf-8');
  assertContains(adr, 'Classification: clarification');
  assertContains(adr, 'Philosophy prose is edited by Weaver/user separately');
});

test('philosophy revise minor — 校验完整分区，completed 回流且 pass_count 只加一', () => {
  const invalidCases = [
    ['--review INT-001', '缺少: INT-002, INT-003'],
    ['--review INT-001,INT-002 --unaffected INT-002,INT-003', '重叠'],
    ['--review INT-001,INT-001 --unaffected INT-002,INT-003', '重复 ID'],
    ['--review INT-001 --unaffected INT-002,INT-003,INT-999', '无关 Intent'],
  ];
  for (const [partition, expected] of invalidCases) {
    setup();
    const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
    const before = readFileSync(mapPath, 'utf-8');
    assertContains(run(`philosophy revise PRODUCT_PHILOSOPHY.md#core-belief --classification minor --reason "调整原则" --confirm ${partition}`, true), expected);
    assert(readFileSync(mapPath, 'utf-8') === before, '分区失败不得修改 map');
    assert(!existsSync(join(LOOM_DIR, '03_DECISIONS')), '分区失败不得写 ADR');
  }
  setup();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  map.intents['INT-002'].status = 'completed';
  writeFileSync(mapPath, JSON.stringify(map, null, 2));
  const acceptanceBefore = Object.fromEntries(Object.entries(map.intents).map(([id, intent]) => [id, intent.acceptance]));
  const result = JSON.parse(run('philosophy revise PRODUCT_PHILOSOPHY.md#core-belief --classification minor --reason "调整原则" --confirm --review INT-001,INT-002 --unaffected INT-003'));
  const after = JSON.parse(readFileSync(mapPath, 'utf-8'));
  assert(after.intents['INT-001'].status === 'needs_review' && after.intents['INT-002'].status === 'needs_review', 'reviewed completed 必须回流');
  assert(after.intents['INT-003'].status === 'pending', 'unaffected 必须不变');
  assert(after._meta.pass_count === 1, '一次 minor 操作只能增加一次 pass_count');
  assert(result.reviewed.every((item) => item.status_after === 'needs_review'), '结果必须报告 reviewed 状态');
  for (const id of Object.keys(after.intents)) assert(after.intents[id].acceptance === acceptanceBefore[id], '不得修改 acceptance');
  assertContains(readFileSync(join(LOOM_DIR, '03_DECISIONS', 'PHIL-REV-001.md'), 'utf-8'), 'Classification: minor');
});

test('philosophy revise major — confirm 也不修改当前版本', () => {
  setup();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const before = readFileSync(mapPath, 'utf-8');
  const result = JSON.parse(run('philosophy revise PRODUCT_PHILOSOPHY.md#core-belief --classification major --reason "核心前提改变" --confirm --review INT-001'));
  assert(result.mutated === false && result.follow_up.command === 'loom version new', 'major 必须只给新版本指引');
  assert(readFileSync(mapPath, 'utf-8') === before, 'major 不得修改 map');
  assert(!existsSync(join(LOOM_DIR, '03_DECISIONS')), 'major 不得写当前 ADR');
  assertContains(run('philosophy revise PRODUCT_PHILOSOPHY.md#core-belief --classification typo --reason "x"', true), 'classification 非法');
});

console.log('\n测试 verify 命令');

test('verify pending — 返回待验证的 Intent（INT-002 是 in_progress 且无验证记录）', () => {
  const out = run('verify pending');
  const pending = JSON.parse(out);
  assert(pending.includes('INT-002'), '应包含 INT-002');
  assert(!pending.includes('INT-001'), '不应包含 INT-001（已 completed）');
});

test('verify contract — 内联 acceptance 直接返回', () => {
  // INT-001 的 acceptance 是内联的 "用户能注册并登录"
  const out = run('verify contract INT-001');
  assertContains(out, '注册并登录');
});

test('verify contract — 引用 acceptance 解析 05_VERIFICATION.md', () => {
  // 给 INT-003 设置引用格式的 acceptance，并创建 05_VERIFICATION.md
  const intentMap = JSON.parse(readFileSync(join(LOOM_DIR, '04_INTENT_MAP.json'), 'utf-8'));
  intentMap.intents['INT-003'].acceptance = 'see 05_VERIFICATION.md#int-003';
  writeFileSync(join(LOOM_DIR, '04_INTENT_MAP.json'), JSON.stringify(intentMap, null, 2));

  writeFileSync(join(LOOM_DIR, '05_VERIFICATION.md'), [
    '# 验证契约',
    '',
    '## INT-003',
    '',
    '用户能邀请协作者，邀请通过邮件发送。',
    '被邀请者接受后成为项目成员。',
  ].join('\n'));

  const out = run('verify contract INT-003');
  assertContains(out, '邀请协作者');
  assertContains(out, '项目成员');
});

test('verify pass — 质量契约强制第五维，相对提升可附 Quality Proof', () => {
  setup();
  useDefaultHighImpactAcquisition();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  map.intents['INT-002'].quality_contract = '相对当前基线，项目创建首次成功时间至少降低 20%，错误率不回退。';
  writeFileSync(mapPath, JSON.stringify(map, null, 2));
  writeReadyExpertisePack();

  writeFileSync(join(VERIFICATIONS_DIR, 'INT-002.json'), JSON.stringify({
    intent_id: 'INT-002',
    records: [{
      round: 1,
      intent_revision: 1,
      verdict: 'passed',
      expertise: {
        record_ref: '10_EXPERTISE_PACKS/INT-002.json',
        intent_revision: 1,
        required_node_ids: ['CAP-PROJECT-CREATION'],
        source_count: 1,
        capsule_count: 1,
        pack_digest: expertisePackDigest(JSON.parse(readFileSync(join(EXPERTISE_PACKS_DIR, 'INT-002.json'), 'utf-8'))),
      },
    }],
  }));
  assertContains(run('intent done INT-002', true), 'quality_achievement');
  rmSync(join(VERIFICATIONS_DIR, 'INT-002.json'), { force: true });

  const inconsistent = {
    intent_id: 'INT-002',
    verdict: 'passed',
    timestamp: '2026-07-28T12:00:00Z',
    summary: '完成契约通过但质量比较未达到约定差异',
    dimensions: {
      intent_fidelity: { verdict: 'passed', evidence: '对照叙事，用户目标与非目标均保持一致' },
      philosophy_consistency: { verdict: 'passed', evidence: '对照项目原则，关键取舍没有发生冲突' },
      baseline_compliance: { verdict: 'passed', evidence: 'B1-B5 与项目底线逐项检查均未失守' },
      acceptance_achievement: { verdict: 'passed', evidence: '完成契约的可观察行为均已复现通过' },
      quality_achievement: {
        verdict: 'deviated',
        evidence: '相对基线只提升 5%，未达到契约要求的 20%',
        quality_proof_ref: 'artifacts/quality-proof.md#INT-002',
      },
    },
  };
  const inconsistentPath = join(LOOM_DIR, '_tmp_quality_inconsistent.json');
  writeFileSync(inconsistentPath, JSON.stringify(inconsistent));
  assertContains(run(`verify write --json-file "${inconsistentPath}"`, true), '整体 verdict 为 passed');
  rmSync(inconsistentPath, { force: true });

  assertContains(run('verify pass INT-002 --summary "完成质量契约的基线比较并验证回归稳定"', true), '--quality-proof');
  assertContains(run('verify pass INT-002 --summary "完成质量契约的基线比较并验证回归稳定" --quality-proof "artifacts/missing.md#INT-002"', true), '不存在');
  run('verify pass INT-002 --summary "完成契约通过，基线比较达到约定差异且回归稳定" --quality-proof "artifacts/quality-proof.md#INT-002"');
  const history = JSON.parse(run('verify history INT-002'));
  const latest = history.records.at(-1);
  assert(latest.dimensions.quality_achievement.verdict === 'passed', '应自动写入第五维');
  assert(latest.dimensions.quality_achievement.quality_proof_ref === 'artifacts/quality-proof.md#INT-002', '应在质量维度保留 Quality Proof 引用');
  assert(latest.expertise.record_ref === '10_EXPERTISE_PACKS/INT-002.json', 'passed 必须绑定当前 Expertise Pack');
  assert(latest.expertise.source_count === 1 && latest.expertise.capsule_count === 1, 'passed 必须绑定来源与 Capsule 计数');
  assert(/^[a-f0-9]{64}$/.test(latest.expertise.pack_digest), 'passed 必须绑定 Pack 内容摘要，内容变化后旧验证失效');
  const changedPack = JSON.parse(readFileSync(join(EXPERTISE_PACKS_DIR, 'INT-002.json'), 'utf-8'));
  changedPack.capsules[0].rules.push('验证后新增但尚未由 Keeper 重验的规则');
  writeFileSync(join(EXPERTISE_PACKS_DIR, 'INT-002.json'), JSON.stringify(changedPack, null, 2));
  assertContains(run('intent done INT-002', true), '未绑定当前 Expertise Pack');
  setup();
});

test('状态守恒门 — stateful Intent 必须提供独立守恒证据才能闭合', () => {
  setup();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  map.intents['INT-002'].continuity_required = true;
  writeFileSync(mapPath, JSON.stringify(map, null, 2));

  const missing = run('verify pass INT-002 --summary "项目创建结果与基础验收均已复现"', true);
  assertContains(missing, 'continuity_required');
  assertContains(missing, '--preservation-evidence');

  run('verify pass INT-002 --summary "项目创建结果与基础验收均已复现" --preservation-evidence "复现已有项目 Alpha → 新建项目 Beta → 刷新后 Alpha 与 Beta 均存在，Alpha 的原属性不变"');
  const latest = JSON.parse(run('verify history INT-002')).records.at(-1);
  assert(latest.dimensions.preservation_achievement.verdict === 'passed', '状态型 Intent 必须写入守恒维度');
  assertContains(latest.dimensions.preservation_achievement.evidence, 'Alpha');
  assertContains(run('intent done INT-002'), '已完成');

  const activation = run('activate forge --intent INT-002');
  assertContains(activation, 'Codex Goal Alignment');
  assertContains(activation, '状态守恒门');
  setup();
});

test('doctor — 状态守恒门的旧 passed 记录缺少守恒维度时报告 high', () => {
  setup();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  map.intents['INT-001'].continuity_required = true;
  writeFileSync(mapPath, JSON.stringify(map, null, 2));
  writeFileSync(join(VERIFICATIONS_DIR, 'INT-001.json'), JSON.stringify({
    intent_id: 'INT-001',
    records: [{
      round: 1,
      intent_revision: 1,
      verdict: 'passed',
      dimensions: {
        intent_fidelity: { verdict: 'passed', evidence: '旧记录只证明当前结果存在，未复现状态变化序列' },
        philosophy_consistency: { verdict: 'passed', evidence: '项目原则与当前实现没有明显冲突' },
        baseline_compliance: { verdict: 'passed', evidence: '基础底线检查通过，未发现外部依赖或秘密泄露' },
        acceptance_achievement: { verdict: 'passed', evidence: '基础功能路径已经复现，但没有守恒序列证据' },
      },
    }],
  }));
  const out = run('doctor');
  assertContains(out, 'preservation_dimension_missing');
  assertContains(out, 'preservation_achievement');
  setup();
});

test('verify write — 写入验证记录（追加模式）', () => {
  const record = {
    intent_id: 'INT-002',
    intent_revision: 999,
    verdict: 'passed',
    timestamp: '2026-06-26T12:00:00Z',
    summary: '实现忠实于意图',
    reproduction_command: 'npm test',
    verification_provenance: {
      verified_by: 'keeper-write-test',
      context: 'independent_thread',
    },
    dimensions: {
      intent_fidelity: { verdict: 'passed', evidence: '对照意图叙事第 2 段，实现忠实于原始意图' },
      philosophy_consistency: { verdict: 'passed', evidence: '反模式逐条对照：AP1/AP2/AP3 均未违反' },
      baseline_compliance: { verdict: 'passed', evidence: 'B1-B5 逐条合规，无硬编码无隐式契约' },
      acceptance_achievement: { verdict: 'passed', evidence: '6 条契约全部达成，npm test 6/6 pass' },
    },
  };
  const tmpFile = join(LOOM_DIR, '_tmp_verify.json');
  writeFileSync(tmpFile, JSON.stringify(record));
  const out = run(`verify write --json-file "${tmpFile}"`);
  assertContains(out, '验证记录已写入');
  assertContains(out, '轮次: 1');
  assert(existsSync(join(VERIFICATIONS_DIR, 'INT-002.json')), '验证记录文件未创建');
  const written = JSON.parse(readFileSync(join(VERIFICATIONS_DIR, 'INT-002.json'), 'utf-8'));
  assert(written.records[0].intent_revision === 1, 'CLI 必须覆盖调用者伪造的 intent_revision');
  rmSync(tmpFile, { force: true });
});

test('verify write — deviated 轮次追踪和升级提示', () => {
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  map.intents['INT-003'].status = 'in_progress';
  writeFileSync(mapPath, JSON.stringify(map, null, 2));
  // 写 3 轮 deviated，第 3 轮应触发升级提示
  for (let i = 1; i <= 3; i++) {
    const record = {
      intent_id: 'INT-003',
      verdict: 'deviated',
      timestamp: `2026-06-26T12:0${i}:00Z`,
      summary: `第 ${i} 轮偏离`,
      dimensions: {
        intent_fidelity: { verdict: 'deviated', evidence: '偏离意图叙事第 2 段，实现多了个副作用' },
        philosophy_consistency: { verdict: 'passed', evidence: '反模式逐条对照：AP1/AP2 均未违反' },
        baseline_compliance: { verdict: 'passed', evidence: 'B1-B5 逐条合规，无硬编码无隐式契约' },
        acceptance_achievement: { verdict: 'deviated', evidence: '契约#3 未达成，缺少错误边界处理' },
      },
      deviation_detail: '偏离了原始意图',
    };
    const tmpFile = join(LOOM_DIR, `_tmp_verify_${i}.json`);
    writeFileSync(tmpFile, JSON.stringify(record));
    const out = run(`verify write --json-file "${tmpFile}"`);
    assertContains(out, `轮次: ${i}`);
    if (i < 3) {
      assert(!out.includes('升级为 blocked'), `第 ${i} 轮不应触发升级提示`);
    } else {
      assertContains(out, '达到 3 轮上限');
      assertContains(out, '升级为 blocked');
      assert(JSON.parse(run('intent get INT-003')).status === 'blocked', '第 3 轮偏离必须自动阻断 Intent');
    }
    rmSync(tmpFile, { force: true });
  }
});

test('verify write — deviated 连续计数遇到 passed 会重置', () => {
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  map.intents['INT-003'].status = 'in_progress';
  writeFileSync(mapPath, JSON.stringify(map, null, 2));
  const recordPath = join(VERIFICATIONS_DIR, 'INT-003.json');
  rmSync(recordPath, { force: true });
  const verdicts = ['deviated', 'passed', 'deviated', 'deviated'];
  for (let i = 0; i < verdicts.length; i++) {
    const verdict = verdicts[i];
    const record = {
      intent_id: 'INT-003',
      verdict,
      timestamp: `2026-06-26T13:0${i}:00Z`,
      summary: `第 ${i + 1} 轮 ${verdict}`,
      verification_provenance: {
        verified_by: 'keeper-reset-test',
        context: 'independent_thread',
      },
      dimensions: {
        intent_fidelity: { verdict, evidence: '对照意图叙事第 2 段，记录连续偏离计数行为' },
        philosophy_consistency: { verdict: 'passed', evidence: '反模式逐条对照：AP1/AP2 均未违反' },
        baseline_compliance: { verdict: 'passed', evidence: 'B1-B5 逐条合规，无硬编码无隐式契约' },
        acceptance_achievement: { verdict, evidence: '契约#3 用于验证连续 deviated 计数是否重置' },
      },
      deviation_detail: verdict === 'deviated' ? '偏离了原始意图' : undefined,
    };
    const tmpFile = join(LOOM_DIR, `_tmp_verify_reset_${i}.json`);
    writeFileSync(tmpFile, JSON.stringify(record));
    const out = run(`verify write --json-file "${tmpFile}"`);
    assert(!out.includes('升级为 blocked'), '非连续 3 轮 deviated 不应触发升级');
    rmSync(tmpFile, { force: true });
  }
  rmSync(recordPath, { force: true });
});

test('verify write — pending_human verdict（L3 人类反馈）', () => {
  const record = {
    intent_id: 'INT-002',
    verdict: 'pending_human',
    timestamp: '2026-06-26T14:00:00Z',
    summary: '静态维度通过，体验维度需人类验证',
    dimensions: {
      intent_fidelity: { verdict: 'passed', evidence: '对照意图叙事第 2 段，实现忠实于原始意图' },
      philosophy_consistency: { verdict: 'passed', evidence: '反模式逐条对照：AP1/AP2/AP3 均未违反' },
      baseline_compliance: { verdict: 'passed', evidence: 'B1-B5 逐条合规，无硬编码无隐式契约' },
      acceptance_achievement: { verdict: 'pending_human', evidence: '体验维度需人类验证，自动化测试无法覆盖' },
    },
  };
  const tmpFile = join(LOOM_DIR, '_tmp_verify_ph.json');
  writeFileSync(tmpFile, JSON.stringify(record));
  const out = run(`verify write --json-file "${tmpFile}"`);
  assertContains(out, '验证记录已写入');
  assertContains(out, 'pending_human');
  rmSync(tmpFile, { force: true });
});

test('verify write — pending Intent 不得抢先写入验证记录', () => {
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  map.intents['INT-003'].status = 'pending';
  writeFileSync(mapPath, JSON.stringify(map, null, 2));
  const record = {
    intent_id: 'INT-003',
    verdict: 'pending_human',
    timestamp: '2026-06-26T14:30:00Z',
    summary: '尚未开始的 Intent 不应进入验证阶段',
    dimensions: {
      intent_fidelity: { verdict: 'pending_human', evidence: '该 Intent 仍是 pending，验证记录不应抢先写入' },
      philosophy_consistency: { verdict: 'pending_human', evidence: '该 Intent 仍是 pending，尚未具备可判定产物' },
      baseline_compliance: { verdict: 'pending_human', evidence: '该 Intent 仍是 pending，不能声明底线检查完成' },
      acceptance_achievement: { verdict: 'pending_human', evidence: '该 Intent 仍是 pending，完成契约尚未进入验证' },
    },
  };
  const tmpFile = join(LOOM_DIR, '_tmp_verify_pending.json');
  writeFileSync(tmpFile, JSON.stringify(record));
  const out = run(`verify write --json-file "${tmpFile}"`, true);
  assertContains(out, '当前状态为 pending');
  rmSync(tmpFile, { force: true });
});

test('verify write — 旧格式 dimensions（枚举值）被拒绝', () => {
  const record = {
    intent_id: 'INT-002',
    verdict: 'passed',
    timestamp: '2026-06-26T12:00:00Z',
    summary: '旧格式测试',
    dimensions: {
      intent_fidelity: 'passed',
      philosophy_consistency: 'passed',
      baseline_compliance: 'passed',
      acceptance_achievement: 'passed',
    },
  };
  const tmpFile = join(LOOM_DIR, '_tmp_verify_old.json');
  writeFileSync(tmpFile, JSON.stringify(record));
  const out = run(`verify write --json-file "${tmpFile}"`, true);
  assertContains(out, '旧格式');
  rmSync(tmpFile, { force: true });
});

test('verify write — evidence 缺失被拒绝', () => {
  const record = {
    intent_id: 'INT-002',
    verdict: 'passed',
    timestamp: '2026-06-26T12:00:00Z',
    summary: 'evidence 缺失测试',
    dimensions: {
      intent_fidelity: { verdict: 'passed', evidence: '' },
      philosophy_consistency: { verdict: 'passed', evidence: '有证据' },
      baseline_compliance: { verdict: 'passed', evidence: '有证据' },
      acceptance_achievement: { verdict: 'passed', evidence: '有证据' },
    },
  };
  const tmpFile = join(LOOM_DIR, '_tmp_verify_no_evidence.json');
  writeFileSync(tmpFile, JSON.stringify(record));
  const out = run(`verify write --json-file "${tmpFile}"`, true);
  assertContains(out, 'evidence 缺失');
  rmSync(tmpFile, { force: true });
});

test('verify history — 读取验证记录（数组格式）', () => {
  const out = run('verify history INT-002');
  const data = JSON.parse(out);
  assert(data.intent_id === 'INT-002', 'intent_id 不匹配');
  assert(Array.isArray(data.records), 'records 应是数组');
  assert(data.records.length > 0, 'records 不应为空');
  assert(data.records[0].verdict === 'passed', '第一条记录 verdict 不匹配');
});

test('verify list — 列出所有验证记录', () => {
  const out = run('verify list');
  const list = JSON.parse(out);
  assert(list.includes('INT-002'), '应包含 INT-002');
});

test('verify pending — 旧 revision、needs_review 和当前非 passed 最新记录均待验证', () => {
  setup();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  map.intents['INT-002'].revision = 2;
  map.intents['INT-003'].status = 'needs_review';
  writeFileSync(mapPath, JSON.stringify(map, null, 2));
  writeFileSync(join(VERIFICATIONS_DIR, 'INT-002.json'), JSON.stringify({
    intent_id: 'INT-002',
    records: [{ round: 1, intent_revision: 1, verdict: 'passed' }],
  }));
  writeFileSync(join(VERIFICATIONS_DIR, 'INT-003.json'), JSON.stringify({
    intent_id: 'INT-003',
    records: [
      { round: 1, intent_revision: 1, verdict: 'passed' },
      { round: 2, intent_revision: 1, verdict: 'deviated' },
    ],
  }));

  const pending = JSON.parse(run('verify pending'));
  assert(pending.includes('INT-002'), '旧 revision passed 的 in_progress Intent 应待验证');
  assert(pending.includes('INT-003'), '最新记录非 passed 的 needs_review Intent 应待验证');
});

test('intent done — 拒绝旧 revision，通过重新验证后才能完成', () => {
  setup();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  map.intents['INT-002'].revision = 2;
  writeFileSync(mapPath, JSON.stringify(map, null, 2));
  writeFileSync(join(VERIFICATIONS_DIR, 'INT-002.json'), JSON.stringify({
    intent_id: 'INT-002',
    records: [{ round: 1, intent_revision: 1, verdict: 'passed' }],
  }));

  assertContains(run('intent done INT-002', true), '不属于当前 Intent revision 2');
  run('verify pass INT-002 --summary "当前 revision 验收契约已完整通过"');
  const history = JSON.parse(run('verify history INT-002'));
  assert(history.records[1].intent_revision === 2, '新验证应自动绑定当前 revision 2');
  assertContains(run('intent done INT-002'), '已完成');
});

test('legacy Intent revision 1 — 无标签旧验证记录仍可完成', () => {
  setup();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  delete map.intents['INT-002'].revision;
  writeFileSync(mapPath, JSON.stringify(map, null, 2));
  writeFileSync(join(VERIFICATIONS_DIR, 'INT-002.json'), JSON.stringify({
    intent_id: 'INT-002',
    records: [{ round: 1, verdict: 'passed' }],
  }));

  assertContains(run('intent done INT-002'), '已完成');
});

test('验证 epoch — completed 回流后旧 passed 记录不能再次闭合', () => {
  setup();
  writeFileSync(join(VERIFICATIONS_DIR, 'INT-001.json'), JSON.stringify({
    intent_id: 'INT-001',
    records: [{ intent_revision: 1, verification_epoch: 1, verdict: 'passed' }],
  }, null, 2));

  run('intent update INT-001 --status needs_review');
  const map = JSON.parse(readFileSync(join(LOOM_DIR, '04_INTENT_MAP.json'), 'utf-8'));
  assert(map.intents['INT-001'].verification_epoch === 2, '回流必须推进验证 epoch');
  assert(JSON.parse(run('verify pending')).includes('INT-001'), '旧 epoch 的 passed 必须重新进入待验证');
  assertContains(run('intent done INT-001', true), '不属于当前 Intent');
  run('intent update INT-001 --status in_progress');
  run('verify pass INT-001 --summary "按当前回流后的验收边界重新执行并记录可复现结果"');
  assertContains(run('intent done INT-001'), '已完成');
});

test('完成门 — verification_method 必须由 reproduction_command 覆盖', () => {
  setup();
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  map.intents['INT-002']._optional = { verification_method: 'npm test' };
  writeFileSync(mapPath, JSON.stringify(map, null, 2));
  run('verify pass INT-002 --summary "已执行全部自动化测试并逐项复核项目创建的验收边界"');
  assertContains(run('intent done INT-002', true), 'reproduction_command');
  run('verify pass INT-002 --summary "已执行全部自动化测试并逐项复核项目创建的验收边界" --reproduction-command "npm test"');
  assertContains(run('intent done INT-002'), '已完成');
});

console.log('\n测试 init 命令');

test('init — 初始化项目目录', () => {
  const initRoot = join(process.cwd(), 'test', '.tmp-init-test');
  rmSync(initRoot, { recursive: true, force: true });
  mkdirSync(initRoot, { recursive: true });
  const out = execSync(`node "${CLI}" init`, { cwd: initRoot, encoding: 'utf-8' });
  assertContains(out, 'LOOM 项目已初始化');
  assert(existsSync(join(initRoot, '.loom', 'v1', '00_PHILOSOPHY')), '哲学目录未创建');
  assert(existsSync(join(initRoot, '.loom', 'v1', '04_INTENT_MAP.json')), 'Intent Map 模板未复制');
  assert(existsSync(join(initRoot, '.loom', 'v1', '07_CAPABILITY_GRAPH.json')), 'Capability Graph 模板未复制');
  assert(existsSync(join(initRoot, '.loom', 'v1', '07_CAPABILITY_BRIEFS')), 'Capability Brief 目录未创建');
  const initMap = JSON.parse(readFileSync(join(initRoot, '.loom', 'v1', '04_INTENT_MAP.json'), 'utf-8'));
  assert(initMap._meta._loom_version === 'v1', 'v1 模板应写入实际版本');
  assert(initMap._meta._parent_version === null, 'v1 parent 应为 null');
  const initGraph = JSON.parse(readFileSync(join(initRoot, '.loom', 'v1', '07_CAPABILITY_GRAPH.json'), 'utf-8'));
  assert(initGraph._meta._loom_version === 'v1', 'Capability Graph 应写入实际版本');
  assert(existsSync(join(initRoot, '.loom', 'v1', '01_VISION.md')), '愿景模板未复制');
  assert(existsSync(join(initRoot, '.loom', 'v1', '02_ARCHITECTURE.md')), '02_ARCHITECTURE.md 未 scaffold');
  assert(existsSync(join(initRoot, '.loom', 'v1', '05_VERIFICATION.md')), '05_VERIFICATION.md 未 scaffold');
  assert(existsSync(join(initRoot, '.loom', 'v1', '06_CHANGELOG.json')), '06_CHANGELOG.json 未 scaffold');
  assert(existsSync(join(initRoot, '.loom', 'v1', '06_CHANGELOG.md')), '06_CHANGELOG.md 未 scaffold');
  assertContains(readFileSync(join(initRoot, '.loom', 'v1', '06_CHANGELOG.md'), 'utf-8'), 'GENERATED FILE');
  assert(existsSync(join(initRoot, '.loom', 'current')), 'current 指针未创建');
  assert(existsSync(join(initRoot, 'AGENTS.md')), 'AGENTS.md 未创建');
  assertContains(readFileSync(join(initRoot, 'AGENTS.md'), 'utf-8'), 'LOOM');
  rmSync(initRoot, { recursive: true, force: true });
});

test('init — 重复初始化跳过已存在文件', () => {
  const initRoot = join(process.cwd(), 'test', '.tmp-init-test2');
  rmSync(initRoot, { recursive: true, force: true });
  mkdirSync(initRoot, { recursive: true });
  execSync(`node "${CLI}" init`, { cwd: initRoot, encoding: 'utf-8' });
  const out2 = execSync(`node "${CLI}" init`, { cwd: initRoot, encoding: 'utf-8' });
  assertContains(out2, 'skipped');
  rmSync(initRoot, { recursive: true, force: true });
});

test('init --help — 只显示帮助，不初始化当前目录', () => {
  const initRoot = join(process.cwd(), 'test', '.tmp-init-help');
  rmSync(initRoot, { recursive: true, force: true });
  mkdirSync(initRoot, { recursive: true });
  const out = execSync(`node "${CLI}" init --help`, { cwd: initRoot, encoding: 'utf-8' });
  assertContains(out, '用法: loom init');
  assert(!existsSync(join(initRoot, '.loom')), 'init --help 不得创建 .loom');
  rmSync(initRoot, { recursive: true, force: true });
});

console.log('\n测试 activate 命令');

test('activate weaver — 输出激活提示词', () => {
  const out = run('activate weaver');
  assertContains(out, 'Project Doctrine');
  assertContains(out, 'BASELINE');
  assertContains(out, 'Search Methodology');
  assertContains(out, 'Available Dimension Catalog');
  assertContains(out, '不要为了取得这些输入而搜索 CLI 安装目录');
});

test('activate architect — 设计阶段直接装配愿景、图谱与 Intent Map', () => {
  const out = run('activate architect');
  assertContains(out, 'Stage Inputs (command-assembled)');
  assertContains(out, 'Vision Input (01_VISION.md)');
  assertContains(out, 'Capability Graph Input (07_CAPABILITY_GRAPH.json)');
  assertContains(out, 'Intent Map Input (04_INTENT_MAP.json)');
});

test('activate keeper — 输出激活提示词', () => {
  const out = run('activate keeper');
  assertContains(out, 'Keeper');
  assertContains(out, 'BASELINE');
  assertContains(out, '我们相信用户应该掌控自己的数据');
  assertContains(out, '新的 Agent thread 中运行');
  assert(!out.includes('## 角色激活协议'), '不应把完整跨角色协议注入当前角色');
});

test('activate visionary — 注入项目哲学而非完整跨角色协议', () => {
  const out = run('activate visionary');
  assertContains(out, '我们相信用户应该掌控自己的数据');
  assertContains(out, 'Execution Envelope');
  assertContains(out, 'Active Objective');
  assert(!out.includes('## 角色激活协议'), '不应把完整跨角色协议注入当前角色');
});

test('activate 不存在的角色 — 报错', () => {
  try {
    run('activate nonexistent');
    throw new Error('应该报错但没有');
  } catch (e) {
    assertContains(e.stderr || e.message, '未知角色');
  }
});

console.log('\n测试依赖状态一致性校验');

test('intent validate — 检测 completed 依赖 blocked 的不一致', () => {
  // 备份原 Intent Map
  const intentMapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const original = readFileSync(intentMapPath, 'utf-8');
  try {
    // 构造不一致状态：INT-001 completed 依赖 INT-002 blocked
    // 但 INT-001 depends_on 是 []，所以需要构造一个有依赖的 completed Intent
    // 用 INT-002（depends_on INT-001），把 INT-002 标记 completed，INT-001 标记 blocked
    writeFileSync(intentMapPath, JSON.stringify({
      _meta: { _version: '1.0', _loom_version: 'v1', _generated_by: 'architect' },
      intents: {
        'INT-001': {
          id: 'INT-001',
          title: '用户注册与登录',
          narrative_ref: '01_VISION.md#int-001',
          depends_on: [],
          acceptance: '功能承诺：用户能注册并登录。防御承诺：密码不明文存储。',
          philosophy_anchors: ['PRODUCT_PHILOSOPHY.md#core-belief'],
          status: 'blocked',
        },
        'INT-002': {
          id: 'INT-002',
          title: '项目创建',
          narrative_ref: '01_VISION.md#int-002',
          depends_on: ['INT-001'],
          acceptance: '功能承诺：用户能创建项目。防御承诺：项目名不硬编码。',
          philosophy_anchors: ['ENGINEERING_CREED.md#simplicity'],
          status: 'completed',
        },
      },
      topo_order: ['INT-001', 'INT-002'],
    }, null, 2));
    run('intent validate');
    throw new Error('应该检测到不一致但没有');
  } catch (e) {
    assertContains(e.stderr || e.message, 'completed');
    assertContains(e.stderr || e.message, 'blocked');
  } finally {
    // 恢复
    writeFileSync(intentMapPath, original);
  }
});

console.log('\n测试错误处理');

test('intent get 不存在的 ID — 报错', () => {
  try {
    run('intent get INT-999');
    throw new Error('应该报错但没有');
  } catch (e) {
    assertContains(e.stderr || e.message, '不存在');
  }
});

test('philosophy get 不存在的文件 — 报错', () => {
  try {
    run('philosophy get NONEXISTENT.md');
    throw new Error('应该报错但没有');
  } catch (e) {
    assertContains(e.stderr || e.message, '不存在');
  }
});

test('intent map JSON 损坏 — 报错含文件路径和解析失败', () => {
  const intentMapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const original = readFileSync(intentMapPath, 'utf-8');
  try {
    writeFileSync(intentMapPath, '{ "intents": broken json }', 'utf-8');
    run('intent next');
    throw new Error('应该报错但没有');
  } catch (e) {
    const msg = e.stderr || e.message;
    assertContains(msg, 'JSON 解析失败');
  } finally {
    writeFileSync(intentMapPath, original, 'utf-8');
  }
});

test('verify write evidence 废话被拒绝（"合规"）', () => {
  const record = {
    intent_id: 'INT-002',
    verdict: 'passed',
    timestamp: '2026-06-26T12:00:00Z',
    summary: '废话测试',
    dimensions: {
      intent_fidelity: { verdict: 'passed', evidence: '对照意图叙事第 2 段，实现忠实于原始意图' },
      philosophy_consistency: { verdict: 'passed', evidence: '合规' },
      baseline_compliance: { verdict: 'passed', evidence: 'B1-B5 逐条合规，无硬编码无隐式契约' },
      acceptance_achievement: { verdict: 'passed', evidence: '6 条契约全部达成，npm test 6/6 pass' },
    },
  };
  const tmpFile = join(LOOM_DIR, '_tmp_verify_nonsense.json');
  writeFileSync(tmpFile, JSON.stringify(record));
  try {
    const out = run(`verify write --json-file "${tmpFile}"`, true);
    assertContains(out, '通用评价');
  } finally {
    rmSync(tmpFile, { force: true });
  }
});

test('verify write evidence 太短被拒绝（<10字符）', () => {
  const record = {
    intent_id: 'INT-002',
    verdict: 'passed',
    timestamp: '2026-06-26T12:00:00Z',
    summary: '太短测试',
    dimensions: {
      intent_fidelity: { verdict: 'passed', evidence: 'OK' },
      philosophy_consistency: { verdict: 'passed', evidence: '反模式逐条对照：AP1/AP2/AP3 均未违反' },
      baseline_compliance: { verdict: 'passed', evidence: 'B1-B5 逐条合规，无硬编码无隐式契约' },
      acceptance_achievement: { verdict: 'passed', evidence: '6 条契约全部达成，npm test 6/6 pass' },
    },
  };
  const tmpFile = join(LOOM_DIR, '_tmp_verify_short.json');
  writeFileSync(tmpFile, JSON.stringify(record));
  try {
    const out = run(`verify write --json-file "${tmpFile}"`, true);
    assertContains(out, '太短');
  } finally {
    rmSync(tmpFile, { force: true });
  }
});

test('philosophy get 中文标题无显式锚点 — 报错含提示', () => {
  // 构造一个中文标题无显式锚点的临时哲学文件
  const tmpFile = join(PHILOSOPHY_DIR, '_TMP_NO_ANCHOR.md');
  writeFileSync(tmpFile, [
    '# 临时哲学',
    '',
    '## 核心信念',
    '',
    '这是中文标题但没有显式锚点。',
    '',
  ].join('\n'), 'utf-8');
  try {
    run('philosophy get _TMP_NO_ANCHOR.md#core-belief');
    throw new Error('应该报错但没有');
  } catch (e) {
    const msg = e.stderr || e.message;
    // slugify 中文标题返回空，匹配不上 #core-belief，应该报"章节未找到"
    assertContains(msg, '章节未找到');
  } finally {
    rmSync(tmpFile, { force: true });
  }
});

console.log('\n测试 version 命令');

test('--version / -v — 输出版本号', () => {
  const out2 = execSync(`node "${CLI}" --version`, { encoding: 'utf-8' });
  assertContains(out2, '1.2.2');
  assertContains(out2, 'loom');
  const out3 = execSync(`node "${CLI}" -v`, { encoding: 'utf-8' });
  assertContains(out3, 'loom');
});

test('version list — 列出版本并标记当前', () => {
  const out = runFromRoot('version list');
  assertContains(out, 'v1');
  assertContains(out, '*');
  assertContains(out, '当前版本: v1');
});

test('version current — 显示当前版本', () => {
  const out = runFromRoot('version current');
  assertContains(out, 'v1');
});

test('version new — 创建 v2 并切换', () => {
  const out = runFromRoot('version new');
  assertContains(out, 'v2');
  assertContains(out, '当前版本已切换为 v2');
  // 验证目录创建
  assert(existsSync(join(TEST_ROOT, '.loom', 'v2', '04_INTENT_MAP.json')), 'v2 模板未创建');
  assert(existsSync(join(TEST_ROOT, '.loom', 'v2', '06_CHANGELOG.json')), 'v2 Patch JSON 未创建');
  assert(existsSync(join(TEST_ROOT, '.loom', 'v2', '06_CHANGELOG.md')), 'v2 Patch Markdown 未创建');
  const v2Template = JSON.parse(readFileSync(join(TEST_ROOT, '.loom', 'v2', '04_INTENT_MAP.json'), 'utf-8'));
  assert(v2Template._meta._loom_version === 'v2', 'v2 模板应写入实际版本');
  assert(v2Template._meta._parent_version === 'v1', 'v2 parent 应为创建前的当前版本');
  // 验证指针切换
  const pointer = readFileSync(join(TEST_ROOT, '.loom', 'current'), 'utf-8').trim();
  assert(pointer === 'v2', `指针应为 v2，实际: ${pointer}`);
  // 切回 v1，不影响后续测试
  runFromRoot('version use v1');
});

test('version use — 切换当前版本', () => {
  runFromRoot('version use v2');
  let pointer = readFileSync(join(TEST_ROOT, '.loom', 'current'), 'utf-8').trim();
  assert(pointer === 'v2', `指针应为 v2，实际: ${pointer}`);
  runFromRoot('version use v1');
  pointer = readFileSync(join(TEST_ROOT, '.loom', 'current'), 'utf-8').trim();
  assert(pointer === 'v1', `指针应为 v1，实际: ${pointer}`);
});

test('version use — 不存在的版本报错', () => {
  try {
    runFromRoot('version use v99');
    throw new Error('应该报错但没有');
  } catch (e) {
    assertContains(e.stderr || e.message, '不存在');
  }
});

test('version diff — 对比 v1 和 v2', () => {
  const out = runFromRoot('version diff v1 v2');
  const data = JSON.parse(out);
  // v1 有哲学/愿景/Intent Map，v2 只有模板，应该有差异
  assert(data.only_in_a !== undefined, 'diff 输出缺少 only_in_a');
  assert(data.only_in_b !== undefined, 'diff 输出缺少 only_in_b');
});

console.log('\n测试 doctor / context / trace / reverse 命令');

test('doctor — 健康检查（INT-001 completed 无验证记录 → 应报告问题）', () => {
  const out = run('doctor');
  // INT-001 是 completed 但无验证记录，应该被检测到
  assertContains(out, 'completed_no_record');
  assertContains(out, '问题');
  assertContains(out, 'loom guide');
  assert(!out.includes('参见 meta/PHILOSOPHY_WEAVER.md'), 'doctor 应回到可执行引导，不应暴露框架路径');
});

test('doctor — completed 的最后一条非 passed 验证必须报 high', () => {
  const recordPath = join(VERIFICATIONS_DIR, 'INT-001.json');
  const original = existsSync(recordPath) ? readFileSync(recordPath, 'utf-8') : null;
  try {
    writeFileSync(recordPath, JSON.stringify({
      intent_id: 'INT-001',
      records: [{ round: 1, intent_revision: 1, verdict: 'deviated' }],
    }));
    const out = run('doctor');
    assertContains(out, 'completed_verification_not_passed');
    assertContains(out, 'INT-001');
  } finally {
    if (original === null) rmSync(recordPath, { force: true });
    else writeFileSync(recordPath, original);
  }
});

test('doctor — 质量契约的旧 passed 记录缺少第五维时报告 high', () => {
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const recordPath = join(VERIFICATIONS_DIR, 'INT-001.json');
  const originalMap = readFileSync(mapPath, 'utf-8');
  const originalRecord = existsSync(recordPath) ? readFileSync(recordPath, 'utf-8') : null;
  try {
    const map = JSON.parse(originalMap);
    map.intents['INT-001'].quality_contract = '相对当前基线，首次登录理解时间至少降低 20%，且安全行为不回退。';
    writeFileSync(mapPath, JSON.stringify(map, null, 2));
    writeFileSync(recordPath, JSON.stringify({
      intent_id: 'INT-001',
      records: [{
        round: 1,
        intent_revision: 1,
        verdict: 'passed',
        dimensions: {
          intent_fidelity: { verdict: 'passed', evidence: '旧记录未包含质量维度与比较证据' },
        },
      }],
    }));
    const out = run('doctor');
    assertContains(out, 'quality_dimension_missing');
    assertContains(out, 'quality_achievement');
  } finally {
    writeFileSync(mapPath, originalMap);
    if (originalRecord === null) rmSync(recordPath, { force: true });
    else writeFileSync(recordPath, originalRecord);
  }
});

test('context — 上下文摘要', () => {
  const out = run('context');
  const data = JSON.parse(out);
  assert(data.progress !== undefined, '缺少 progress');
  assert(data.intent_map_valid === true, '健康 Intent Map 应标记为有效');
  assert(data.next_intent !== undefined, '缺少 next_intent');
  assert(data.pending_verifications !== undefined, '缺少 pending_verifications');
  assert(Array.isArray(data.risks), '缺少 risks 数组');
});

test('doctor/context — Intent Map 无效时返回诊断而不是崩溃', () => {
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const original = readFileSync(mapPath, 'utf-8');
  try {
    const broken = JSON.parse(original);
    delete broken.intents['INT-001'].title;
    broken.intents['INT-002'].acceptance = '...';
    broken._meta = { ...(broken._meta || {}), _template: true };
    writeFileSync(mapPath, JSON.stringify(broken, null, 2));

    const doctorOut = run('doctor');
    assertContains(doctorOut, 'intent_map_invalid');
    assertContains(doctorOut, 'intent_map_template');

    const contextOut = run('context');
    const context = JSON.parse(contextOut);
    assert(context.intent_map_valid === false, '坏 Intent Map 应标记为无效');
    assert(context.progress.total === 3, '坏 Intent Map 仍应尽量汇总原始进度');
    assert(context.risks.length > 0, '坏 Intent Map 应输出风险');
  } finally {
    writeFileSync(mapPath, original);
  }
});

test('doctor — completed Intent 的 verification_method 与 reproduction_command 漂移时报 high', () => {
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const recordPath = join(VERIFICATIONS_DIR, 'INT-001.json');
  const originalMap = readFileSync(mapPath, 'utf-8');
  const hadRecord = existsSync(recordPath);
  const originalRecord = hadRecord ? readFileSync(recordPath, 'utf-8') : null;
  try {
    const map = JSON.parse(originalMap);
    map.intents['INT-001']._optional = { verification_method: 'run node bin/md2html.js --help' };
    writeFileSync(mapPath, JSON.stringify(map, null, 2));
    writeFileSync(recordPath, JSON.stringify({
      intent_id: 'INT-001',
      records: [{
        round: 1,
        verdict: 'passed',
        timestamp: '2026-06-26T14:00:00Z',
        summary: '只跑了 npm test',
        dimensions: {
          intent_fidelity: { verdict: 'passed', evidence: '对照意图叙事第 2 段，测试命令通过' },
          philosophy_consistency: { verdict: 'passed', evidence: '反模式逐条对照：AP1/AP2 均未违反' },
          baseline_compliance: { verdict: 'passed', evidence: 'B1-B5 逐条合规，无硬编码无隐式契约' },
          acceptance_achievement: { verdict: 'passed', evidence: 'npm test 通过，但未覆盖 help 命令' },
        },
        reproduction_command: 'npm test',
      }],
    }, null, 2));

    const out = run('doctor');
    assertContains(out, 'verification_method_drift');
    assertContains(out, 'node bin/md2html.js --help');
  } finally {
    writeFileSync(mapPath, originalMap);
    if (hadRecord) {
      writeFileSync(recordPath, originalRecord);
    } else {
      rmSync(recordPath, { force: true });
    }
  }
});

test('intent trace — 完整追溯链', () => {
  const out = run('intent trace INT-002');
  const data = JSON.parse(out);
  assert(data.intent.id === 'INT-002', '缺少 intent');
  assert(data.narrative !== undefined, '缺少 narrative');
  assert(data.acceptance !== undefined, '缺少 acceptance');
  assert(data.dependency_chain !== undefined, '缺少 dependency_chain');
  // INT-002 依赖 INT-001
  assertContains(JSON.stringify(data.dependency_chain), 'INT-001');
});

test('intent reverse-dep — 反向依赖', () => {
  // INT-002 和 INT-003 都依赖 INT-001
  const out = run('intent reverse-dep INT-001');
  const data = JSON.parse(out);
  assert(data.includes('INT-002'), `应包含 INT-002，实际: ${JSON.stringify(data)}`);
  assert(data.includes('INT-003'), `应包含 INT-003，实际: ${JSON.stringify(data)}`);
});

test('intent reverse-ref — 反向哲学引用', () => {
  // INT-001 引用 PRODUCT_PHILOSOPHY.md#core-belief
  const out = run('intent reverse-ref PRODUCT_PHILOSOPHY.md#core-belief');
  const data = JSON.parse(out);
  assert(data.includes('INT-001'), `应包含 INT-001，实际: ${JSON.stringify(data)}`);
});

test('intent reverse-dep — 不存在的 Intent 返回空数组', () => {
  const out = run('intent reverse-dep INT-999');
  const data = JSON.parse(out);
  assert(Array.isArray(data) && data.length === 0, `应返回空数组，实际: ${out}`);
});

console.log('\n测试 help 命令');

test('help — 无参数列出所有 topic', () => {
  const out = run('help');
  assertContains(out, 'workflow');
  assertContains(out, 'concepts');
  assertContains(out, 'loop');
  assertContains(out, 'version');
  assertContains(out, 'doctor');
});

test('help workflow — 输出工作流指南', () => {
  const out = run('help workflow');
  assertContains(out, 'Weaver');
  assertContains(out, 'Visionary');
  assertContains(out, 'Architect');
  assertContains(out, 'Quality Engine');
});

test('help concepts — 输出核心概念', () => {
  const out = run('help concepts');
  assertContains(out, 'Doctrine');
  assertContains(out, 'Intent');
  assertContains(out, 'Keeper');
  assertContains(out, 'Quality Proof');
});

test('help expertise — 解释外部检索强门与来源化 Capsule', () => {
  const out = run('help expertise');
  assertContains(out, 'External Acquisition');
  assertContains(out, 'Capability Capsule');
  assertContains(out, '模型自行生成');
});

test('help loop — 输出 Loop 详细流程', () => {
  const out = run('help loop');
  assertContains(out, 'Expertise Compiler');
  assertContains(out, 'Quality Arena');
  assertContains(out, 'Keeper');
  assertContains(out, 'Forge');
  assertContains(out, 'passed');
  assertContains(out, 'deviated');
});

test('help version — 输出版本演进指南', () => {
  const out = run('help version');
  assertContains(out, 'Patch');
  assertContains(out, 'Major');
  assertContains(out, 'Minor');
  assertContains(out, 'version new');
  assertContains(out, 'version diff');
});

test('Intent lineage — composite reads、semantic diff、split/merge 与跨版本历史', () => {
  const v2Dir = join(TEST_ROOT, '.loom', 'v2');
  const acceptance = '功能承诺：跨版本能力保持可验证。防御承诺：不复制或继承任何旧版本通过状态。';
  writeFileSync(join(v2Dir, '04_INTENT_MAP.json'), JSON.stringify({
    _meta: { _version: '1.0', _loom_version: 'v2', _parent_version: 'v1' },
    intents: {
      'INT-001': { id: 'INT-001', revision: 1, title: '同 ID 新能力', narrative_ref: '01_VISION.md#int-001', depends_on: [], acceptance, philosophy_anchors: [], status: 'pending' },
      'INT-007': { id: 'INT-007', revision: 2, title: '认证能力修订', narrative_ref: '01_VISION.md#int-007', depends_on: [], acceptance, philosophy_anchors: [], status: 'pending', lineage: { predecessors: [{ version: 'v1', intent_id: 'INT-001' }], change_summary: '收紧认证边界' } },
      'INT-008': { id: 'INT-008', revision: 1, title: '项目创建 A', narrative_ref: '01_VISION.md#int-008', depends_on: [], acceptance, philosophy_anchors: [], status: 'pending', lineage: { predecessors: [{ version: 'v1', intent_id: 'INT-002' }], change_summary: '拆分 A' } },
      'INT-009': { id: 'INT-009', revision: 1, title: '项目创建 B', narrative_ref: '01_VISION.md#int-009', depends_on: [], acceptance, philosophy_anchors: [], status: 'pending', lineage: { predecessors: [{ version: 'v1', intent_id: 'INT-002' }], change_summary: '拆分 B' } },
      'INT-010': { id: 'INT-010', revision: 1, title: '协作项目', narrative_ref: '01_VISION.md#int-010', depends_on: [], acceptance, philosophy_anchors: [], status: 'pending', lineage: { predecessors: [{ version: 'v1', intent_id: 'INT-002' }, { version: 'v1', intent_id: 'INT-003' }], change_summary: '合并项目与协作' } },
    },
    topo_order: ['INT-001', 'INT-007', 'INT-008', 'INT-009', 'INT-010'],
  }, null, 2));
  writeFileSync(join(v2Dir, '01_VISION.md'), '# v2\n\n## Intent 007 {#int-007}\n\n跨版本修订叙事。\n');
  mkdirSync(join(v2Dir, 'verifications'), { recursive: true });
  writeFileSync(join(v2Dir, 'verifications', 'INT-007.json'), JSON.stringify({ intent_id: 'INT-007', records: [{ round: 1, verdict: 'deviated' }] }));
  writeFileSync(join(VERIFICATIONS_DIR, 'INT-001.json'), JSON.stringify({ intent_id: 'INT-001', records: [{ round: 1, verdict: 'passed' }] }));

  runFromRoot('version use v2');
  const historical = JSON.parse(runFromRoot('intent get v1:INT-001'));
  assert(historical.title === '用户注册与登录', 'composite get 应读取 owning version');
  assertContains(runFromRoot('intent narrative v1:INT-001'), '身份自治');
  const trace = JSON.parse(runFromRoot('intent trace v2:INT-007'));
  assert(trace.ref === 'v2:INT-007' && trace.version === 'v2' && trace.revision === 2, 'trace 缺少版本化身份');
  assert(trace.lineage.predecessors.some((item) => item.ref === 'v1:INT-001'), 'trace 缺少 predecessor');

  const diff = JSON.parse(runFromRoot('intent diff v1 v2'));
  assert(diff.new.includes('v2:INT-001'), '同 ID 且无 lineage 应判定为 new');
  assert(diff.revised.some((item) => item.to === 'v2:INT-007'), '缺少 one-to-one revised');
  assert(diff.split.some((item) => item.from === 'v1:INT-002'), '缺少 split');
  assert(diff.merged.some((item) => item.to === 'v2:INT-010'), '缺少 merge');
  assert(diff.warnings.some((warning) => warning.includes('ID 相同')), '同 ID 不映射应给 warning');

  const across = JSON.parse(runFromRoot('verify history v2:INT-007 --across-versions'));
  assert(across.histories.length === 2, '应递归读取当前与 predecessor 两份历史');
  assert(across.histories[0].records[0].source_version === 'v2', '当前记录缺少来源标注');
  assert(across.histories[1].records[0].source_intent === 'INT-001', '前序记录缺少来源标注');
  assert(across.histories[0].records[0].verdict === 'deviated' && across.histories[1].records[0].verdict === 'passed', '不得继承 passed 状态');
  runFromRoot('version use v1');
});

test('Intent lineage — across-version history detects cycles', () => {
  const v1Path = join(LOOM_DIR, '04_INTENT_MAP.json');
  const v2Path = join(TEST_ROOT, '.loom', 'v2', '04_INTENT_MAP.json');
  const originalV1 = readFileSync(v1Path, 'utf-8');
  try {
    const v1 = JSON.parse(originalV1);
    v1.intents['INT-001'].lineage = { predecessors: [{ version: 'v2', intent_id: 'INT-007' }], change_summary: '构造循环测试' };
    writeFileSync(v1Path, JSON.stringify(v1, null, 2));
    const out = runFromRoot('verify history v2:INT-007 --across-versions', true);
    assertContains(out, 'lineage 存在循环');
  } finally {
    writeFileSync(v1Path, originalV1);
  }
});

test('doctor — completed/needs_review 的旧 revision passed 记录报告 stale_verification', () => {
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const originalMap = readFileSync(mapPath, 'utf-8');
  const recordPaths = ['INT-001', 'INT-002'].map((id) => join(VERIFICATIONS_DIR, `${id}.json`));
  const originals = recordPaths.map((path) => existsSync(path) ? readFileSync(path, 'utf-8') : null);
  try {
    const map = JSON.parse(originalMap);
    map.intents['INT-001'].status = 'completed';
    map.intents['INT-001'].revision = 2;
    map.intents['INT-002'].status = 'needs_review';
    map.intents['INT-002'].revision = 3;
    writeFileSync(mapPath, JSON.stringify(map, null, 2));
    writeFileSync(recordPaths[0], JSON.stringify({ intent_id: 'INT-001', records: [{ round: 1, intent_revision: 1, verdict: 'passed' }] }));
    writeFileSync(recordPaths[1], JSON.stringify({ intent_id: 'INT-002', records: [{ round: 1, intent_revision: 2, verdict: 'passed' }] }));

    const out = run('doctor');
    assertContains(out, 'stale_verification');
    assertContains(out, 'INT-001');
    assertContains(out, 'INT-002');
  } finally {
    writeFileSync(mapPath, originalMap);
    recordPaths.forEach((path, index) => {
      if (originals[index] === null) rmSync(path, { force: true });
      else writeFileSync(path, originals[index]);
    });
  }
});

test('help patch — 输出 Patch 审计指南', () => {
  const out = run('help patch');
  assertContains(out, '06_CHANGELOG.json');
  assertContains(out, 'loom patch record');
  assertContains(out, '绝不执行命令');
});

console.log('\n测试 patch 命令');

test('patch record/list/get/validate — 分配 ID 和时间并生成确定性投影', () => {
  setup();
  completeAllIntents();
  const jsonPath = join(LOOM_DIR, '06_CHANGELOG.json');
  const mdPath = join(LOOM_DIR, '06_CHANGELOG.md');
  writeFileSync(jsonPath, JSON.stringify({ _meta: { schema_version: '1.0', source: '06_CHANGELOG.json' }, patches: [] }, null, 2) + '\n');
  writeFileSync(mdPath, '<stale>');
  const inputPath = join(TEST_ROOT, 'patch-input.json');
  writeFileSync(inputPath, JSON.stringify({
    summary: '修复空输入崩溃',
    reason: '解析器遗漏空字符串边界',
    affects: ['INT-001'],
    files: ['cli/src/patch.js', 'cli/test/run-all.js'],
    verification: [
      { command: 'npm test', result: 'passed' },
      { method: 'agent-browser screenshot', result: 'passed', evidence: '浅色和深色背景下均清晰可读' },
    ],
  }));
  const recorded = JSON.parse(runFromRoot(`patch record --json-file "${inputPath}"`));
  assert(recorded.id === 'PATCH-001', `Patch ID 不匹配: ${recorded.id}`);
  assert(!Number.isNaN(Date.parse(recorded.timestamp)), 'timestamp 应由 CLI 分配');
  const list = JSON.parse(runFromRoot('patch list'));
  assert(list.length === 1 && list[0].id === 'PATCH-001', 'patch list 不匹配');
  const item = JSON.parse(runFromRoot('patch get PATCH-001'));
  assert(item.summary === '修复空输入崩溃', 'patch get 不匹配');
  const validation = JSON.parse(runFromRoot('patch validate'));
  assert(validation.valid === true && validation.patches === 1, 'patch validate 应通过');
  assertContains(readFileSync(mdPath, 'utf-8'), 'GENERATED FILE');
  assertContains(readFileSync(mdPath, 'utf-8'), 'PATCH-001');
  rmSync(inputPath, { force: true });
});

test('patch record — 拒绝不存在 Intent、不安全路径和无 passed 验证', () => {
  setup();
  completeAllIntents();
  const jsonPath = join(LOOM_DIR, '06_CHANGELOG.json');
  const mdPath = join(LOOM_DIR, '06_CHANGELOG.md');
  writeFileSync(jsonPath, JSON.stringify({ _meta: { schema_version: '1.0', source: '06_CHANGELOG.json' }, patches: [] }, null, 2) + '\n');
  writeFileSync(mdPath, '<stale>');
  const cases = [
    [{ summary: 'x', reason: 'y', affects: ['INT-999'], files: ['src/a.js'], verification: [{ command: 'npm test', result: 'passed' }] }, '不存在的 Intent'],
    [{ summary: 'x', reason: 'y', files: ['../secret'], verification: [{ command: 'npm test', result: 'passed' }] }, '项目相对路径'],
    [{ summary: 'x', reason: 'y', files: ['src/a.js'], verification: [{ command: 'npm test', result: 'failed' }] }, '至少需要一个 passed'],
  ];
  cases.forEach(([input, expected], index) => {
    const inputPath = join(TEST_ROOT, `bad-patch-${index}.json`);
    writeFileSync(inputPath, JSON.stringify(input));
    const out = runFromRoot(`patch record --json-file "${inputPath}"`, true);
    assertContains(out, expected);
    rmSync(inputPath, { force: true });
  });
});

test('patch validate — 检测手工修改的 Markdown 投影', () => {
  const mdPath = join(LOOM_DIR, '06_CHANGELOG.md');
  writeFileSync(mdPath, 'hand edited');
  const out = runFromRoot('patch validate', true);
  assertContains(out, '不是 06_CHANGELOG.json');
});

test('doctor — 检测 Patch Markdown 投影漂移', () => {
  const out = runFromRoot('doctor');
  assertContains(out, 'patch_projection_drift');
});

test('help doctor — 输出诊断指南', () => {
  const out = run('help doctor');
  assertContains(out, 'doctor');
  assertContains(out, 'context');
  assertContains(out, 'Quality Proof');
  assertContains(out, 'trace');
});

test('help — 未知 topic 报错', () => {
  try {
    run('help nonexistent');
    throw new Error('应该报错但没有');
  } catch (e) {
    assertContains(e.stderr || e.message, '未知 topic');
  }
});

console.log('\n测试 guide 命令');

test('guide — 未初始化项目引导 loom init', () => {
  const guideRoot = join(process.cwd(), 'test', '.tmp-guide-test');
  rmSync(guideRoot, { recursive: true, force: true });
  mkdirSync(guideRoot, { recursive: true });
  const out = execSync(`node "${CLI}" guide`, { cwd: guideRoot, encoding: 'utf-8' });
  assertContains(out, 'not_initialized');
  assertContains(out, 'loom init');
  rmSync(guideRoot, { recursive: true, force: true });
});

test('guide — 刚 init 完引导 activate weaver', () => {
  const guideRoot = join(process.cwd(), 'test', '.tmp-guide-test2');
  rmSync(guideRoot, { recursive: true, force: true });
  mkdirSync(guideRoot, { recursive: true });
  execSync(`node "${CLI}" init`, { cwd: guideRoot, encoding: 'utf-8' });
  const out = execSync(`node "${CLI}" guide`, { cwd: guideRoot, encoding: 'utf-8' });
  assertContains(out, 'need_philosophy');
  assertContains(out, 'loom activate weaver');
  assertContains(out, '它会输出当前阶段所需的 Context Pack');
  assert(!out.includes('需要读取:'), 'guide 不应把路径清单暴露成 Agent 待办');
  assert(!out.includes('PHILOSOPHY_WEAVER.md'), '阶段源文件应由 activate 装配，不应由 guide 要求寻找');
  rmSync(guideRoot, { recursive: true, force: true });
});

test('guide — 哲学已织造引导 activate visionary', () => {
  const guideRoot = join(process.cwd(), 'test', '.tmp-guide-test3');
  rmSync(guideRoot, { recursive: true, force: true });
  mkdirSync(guideRoot, { recursive: true });
  execSync(`node "${CLI}" init`, { cwd: guideRoot, encoding: 'utf-8' });
  // 写入真实哲学（去掉模板标记）
  writeFileSync(join(guideRoot, '.loom', 'v1', '00_PHILOSOPHY', 'PRODUCT_PHILOSOPHY.md'),
    '# 真实哲学\n\n## Core Belief\n\n我们信简单。', 'utf-8');
  const out = execSync(`node "${CLI}" guide`, { cwd: guideRoot, encoding: 'utf-8' });
  assertContains(out, 'need_vision');
  assertContains(out, 'loom activate visionary');
  rmSync(guideRoot, { recursive: true, force: true });
});

test('guide — 愿景完成后先要求 Capability Graph，再允许设计 Intent Map', () => {
  const guideRoot = join(process.cwd(), 'test', '.tmp-guide-capability-graph');
  rmSync(guideRoot, { recursive: true, force: true });
  mkdirSync(guideRoot, { recursive: true });
  execSync(`node "${CLI}" init`, { cwd: guideRoot, encoding: 'utf-8' });
  writeFileSync(join(guideRoot, '.loom', 'v1', '00_PHILOSOPHY', 'PRODUCT_PHILOSOPHY.md'),
    '# 真实哲学\n\n## Core Belief\n\n我们相信清晰优先。', 'utf-8');
  writeFileSync(join(guideRoot, '.loom', 'v1', '01_VISION.md'),
    '# 真实愿景\n\n用户需要一个可理解的项目空间。', 'utf-8');
  const out = execSync(`node "${CLI}" guide`, { cwd: guideRoot, encoding: 'utf-8' });
  assertContains(out, 'need_capability_graph');
  assertContains(out, 'loom activate architect');
  assert(!out.includes('07_CAPABILITY_GRAPH.json'), 'guide 不应泄露阶段文件清单');
  writeFileSync(join(guideRoot, '.loom', 'v1', '07_CAPABILITY_GRAPH.json'), JSON.stringify({
    _meta: { _version: '1.0', _loom_version: 'v1', _generated_by: 'architect' },
    nodes: {
      'CONCERN-ONBOARDING': {
        id: 'CONCERN-ONBOARDING', kind: 'concern', title: '首次使用体验',
        status: 'open', impact: 'high', route: 'expand', relationships: [],
      },
    },
  }, null, 2));
  const incomplete = execSync(`node "${CLI}" guide`, { cwd: guideRoot, encoding: 'utf-8' });
  assertContains(incomplete, 'capability_graph_incomplete');
  assertContains(incomplete, 'loom activate architect');
  rmSync(guideRoot, { recursive: true, force: true });
});

test('guide — 缺少图谱的旧项目保留兼容路径', () => {
  const guideRoot = join(process.cwd(), 'test', '.tmp-guide-legacy-no-graph');
  rmSync(guideRoot, { recursive: true, force: true });
  mkdirSync(guideRoot, { recursive: true });
  execSync(`node "${CLI}" init`, { cwd: guideRoot, encoding: 'utf-8' });
  writeFileSync(join(guideRoot, '.loom', 'v1', '00_PHILOSOPHY', 'PRODUCT_PHILOSOPHY.md'),
    '# 真实哲学\n\n## Core Belief\n\n我们相信清晰优先。', 'utf-8');
  writeFileSync(join(guideRoot, '.loom', 'v1', '01_VISION.md'),
    '# 真实愿景\n\n用户需要一个可理解的项目空间。', 'utf-8');
  rmSync(join(guideRoot, '.loom', 'v1', '07_CAPABILITY_GRAPH.json'), { force: true });
  const out = execSync(`node "${CLI}" guide`, { cwd: guideRoot, encoding: 'utf-8' });
  assertContains(out, 'need_architecture');
  rmSync(guideRoot, { recursive: true, force: true });
});

test('guide --dry-run — 不写 heartbeat', () => {
  const guideRoot = join(process.cwd(), 'test', '.tmp-guide-dry-run');
  rmSync(guideRoot, { recursive: true, force: true });
  mkdirSync(guideRoot, { recursive: true });
  execSync(`node "${CLI}" init`, { cwd: guideRoot, encoding: 'utf-8' });
  const heartbeatPath = join(guideRoot, '.loom', 'heartbeat.json');
  rmSync(heartbeatPath, { force: true });
  const out = execSync(`node "${CLI}" guide --dry-run`, { cwd: guideRoot, encoding: 'utf-8' });
  assertContains(out, 'dry-run');
  assert(!existsSync(heartbeatPath), 'guide --dry-run 不应写 heartbeat');
  rmSync(guideRoot, { recursive: true, force: true });
});

test('guide — --help 包含 To Agent 和 To Human 区块', () => {
  const out = run('--help');
  assertContains(out, 'To Agent');
  assertContains(out, 'To Human');
  assertContains(out, 'loom guide');
});

test('guide — init 输出包含 To Agent 和 To Human 引导', () => {
  const initRoot = join(process.cwd(), 'test', '.tmp-guide-test4');
  rmSync(initRoot, { recursive: true, force: true });
  mkdirSync(initRoot, { recursive: true });
  const out = execSync(`node "${CLI}" init`, { cwd: initRoot, encoding: 'utf-8' });
  assertContains(out, 'To Agent');
  assertContains(out, 'To Human');
  assertContains(out, 'loom guide');
  rmSync(initRoot, { recursive: true, force: true });
});

test('init — 不覆盖只有手工 Markdown 的旧版 changelog', () => {
  const initRoot = join(process.cwd(), 'test', '.tmp-init-legacy-changelog');
  rmSync(initRoot, { recursive: true, force: true });
  mkdirSync(initRoot, { recursive: true });
  execSync(`node "${CLI}" init`, { cwd: initRoot, encoding: 'utf-8' });
  const jsonPath = join(initRoot, '.loom', 'v1', '06_CHANGELOG.json');
  const markdownPath = join(initRoot, '.loom', 'v1', '06_CHANGELOG.md');
  rmSync(jsonPath, { force: true });
  writeFileSync(markdownPath, '# Legacy changelog\n\n- Important history\n', 'utf-8');
  let output = '';
  try {
    execSync(`node "${CLI}" init`, { cwd: initRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) {
    output = (error.stdout || '') + (error.stderr || '');
  }
  assertContains(output, '拒绝用空 Patch ledger 覆盖');
  assertContains(readFileSync(markdownPath, 'utf-8'), 'Important history');
  assert(!existsSync(jsonPath), '拒绝迁移时不应创建空 JSON');
  rmSync(initRoot, { recursive: true, force: true });
});

test('guide — 健康的全部完成后提示 Patch / Minor / Major 三档演进', () => {
  setup();
  const evidencePath = join(PHILOSOPHY_DIR, 'RELEASE_EVIDENCE.md');
  writeFileSync(evidencePath, [
    '# 发布证据',
    '',
    '## 灵感来源',
    '',
    '- **真实项目复盘** — 为什么相关：用于判断完成是否必须有可复现证据；转译为完成门必须阻断过期验证。来源：local:./research/release-retrospective.md',
  ].join('\n'));
  const mapPath = join(LOOM_DIR, '04_INTENT_MAP.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
  for (const intent of Object.values(map.intents)) intent.status = 'completed';
  writeFileSync(mapPath, JSON.stringify(map, null, 2), 'utf-8');
  for (const intent of Object.values(map.intents)) {
    writeFileSync(join(VERIFICATIONS_DIR, `${intent.id}.json`), JSON.stringify({
      intent_id: intent.id,
      records: [{
        intent_id: intent.id,
        intent_revision: intent.revision,
        verdict: 'passed',
        dimensions: {
          intent_fidelity: { verdict: 'passed', evidence: '测试通过并符合验收标准。' },
          philosophy_consistency: { verdict: 'passed', evidence: '测试通过并符合验收标准。' },
          baseline_compliance: { verdict: 'passed', evidence: '测试通过并符合验收标准。' },
          acceptance_achievement: { verdict: 'passed', evidence: '测试通过并符合验收标准。' },
        },
        evidence: '测试通过并符合验收标准。',
        created_at: new Date().toISOString(),
      }],
    }, null, 2), 'utf-8');
  }
  const out = execSync(`node "${CLI}" guide --dry-run`, { cwd: TEST_ROOT, encoding: 'utf-8' });
  assertContains(out, 'done');
  assertContains(out, 'Patch');
  assertContains(out, 'Minor');
  assertContains(out, 'Major');
  assertContains(out, 'loom help version');
  rmSync(evidencePath, { force: true });
});

console.log('\n测试 auto 命令');

test('auto on/off/status — 三模式切换', () => {
  const autoRoot = join(process.cwd(), 'test', '.tmp-auto-test');
  rmSync(autoRoot, { recursive: true, force: true });
  mkdirSync(autoRoot, { recursive: true });
  execSync(`node "${CLI}" init`, { cwd: autoRoot, encoding: 'utf-8' });
  // 默认 manual
  const off = execSync(`node "${CLI}" auto status`, { cwd: autoRoot, encoding: 'utf-8' });
  assertContains(off, 'manual');
  // 开启 auto-loop（默认）
  const on = execSync(`node "${CLI}" auto on`, { cwd: autoRoot, encoding: 'utf-8' });
  assertContains(on, 'auto-loop');
  assert(existsSync(join(autoRoot, '.loom', 'auto')), 'auto 文件未创建');
  // 状态
  const status = execSync(`node "${CLI}" auto status`, { cwd: autoRoot, encoding: 'utf-8' });
  assertContains(status, 'auto-loop');
  // 切换 auto-design
  const onDesign = execSync(`node "${CLI}" auto on --design`, { cwd: autoRoot, encoding: 'utf-8' });
  assertContains(onDesign, 'auto-design');
  const statusDesign = execSync(`node "${CLI}" auto status`, { cwd: autoRoot, encoding: 'utf-8' });
  assertContains(statusDesign, 'auto-design');
  // guide 检测 AUTO
  const guide = execSync(`node "${CLI}" guide`, { cwd: autoRoot, encoding: 'utf-8' });
  assertContains(guide, 'AUTO');
  // 关闭 → manual
  execSync(`node "${CLI}" auto off`, { cwd: autoRoot, encoding: 'utf-8' });
  assert(!existsSync(join(autoRoot, '.loom', 'auto')), 'auto 文件未删除');
  const statusOff = execSync(`node "${CLI}" auto status`, { cwd: autoRoot, encoding: 'utf-8' });
  assertContains(statusOff, 'manual');
  rmSync(autoRoot, { recursive: true, force: true });
});

console.log('\n测试 preview 命令');

test('preview — 输出提示词', () => {
  const out = run('preview');
  assertContains(out, 'To Agent');
  assertContains(out, 'PPT');
  assertContains(out, 'SVG');
  assertContains(out, '.loom/');
  assertContains(out, 'loom-preview.html');
});

test('preview --help — 输出 preview 用法', () => {
  const out = run('preview --help');
  assertContains(out, 'loom preview --regen');
  assertContains(out, 'loom preview status');
  assertContains(out, 'loom preview --stale');
});

test('preview status — 报告 preview 新鲜度', () => {
  const previewRoot = join(process.cwd(), 'test', '.tmp-preview-status');
  rmSync(previewRoot, { recursive: true, force: true });
  mkdirSync(previewRoot, { recursive: true });
  execSync(`node "${CLI}" init`, { cwd: previewRoot, encoding: 'utf-8' });
  const previewPath = join(previewRoot, 'loom-preview.html');
  writeFileSync(previewPath, '<html></html>', 'utf-8');
  const oldTime = new Date('2026-01-01T00:00:00Z');
  const newTime = new Date('2026-01-02T00:00:00Z');
  const newestTime = new Date('2026-01-03T00:00:00Z');
  utimesSync(previewPath, oldTime, oldTime);
  utimesSync(join(previewRoot, '.loom', 'v1', '00_PHILOSOPHY', 'PRODUCT_PHILOSOPHY.md'), oldTime, oldTime);
  utimesSync(join(previewRoot, '.loom', 'v1', '02_ARCHITECTURE.md'), oldTime, oldTime);
  utimesSync(join(previewRoot, '.loom', 'v1', '04_INTENT_MAP.json'), oldTime, oldTime);
  utimesSync(join(previewRoot, '.loom', 'v1', '05_VERIFICATION.md'), oldTime, oldTime);
  utimesSync(join(previewRoot, '.loom', 'v1', '06_CHANGELOG.json'), newTime, newTime);
  utimesSync(join(previewRoot, '.loom', 'v1', '06_CHANGELOG.md'), oldTime, oldTime);
  const sourcePath = join(previewRoot, '.loom', 'v1', '01_VISION.md');
  utimesSync(sourcePath, oldTime, oldTime);

  let out = execSync(`node "${CLI}" preview status`, { cwd: previewRoot, encoding: 'utf-8' });
  let data = JSON.parse(out);
  assert(data.exists === true, 'preview 应存在');
  assert(data.fresh === false, 'preview 应过期');
  assert(data.latest_source_file === '.loom/v1/06_CHANGELOG.json', `latest_source_file 不匹配: ${data.latest_source_file}`);

  utimesSync(join(previewRoot, '.loom', 'v1', '06_CHANGELOG.md'), newestTime, newestTime);
  out = execSync(`node "${CLI}" preview status`, { cwd: previewRoot, encoding: 'utf-8' });
  data = JSON.parse(out);
  assert(data.latest_source_file === '.loom/v1/06_CHANGELOG.md', `Markdown 投影未纳入 freshness: ${data.latest_source_file}`);
  rmSync(previewRoot, { recursive: true, force: true });
});

test('preview — 过期时提示 regen，不打开旧投影', () => {
  const previewRoot = join(process.cwd(), 'test', '.tmp-preview-stale');
  rmSync(previewRoot, { recursive: true, force: true });
  mkdirSync(previewRoot, { recursive: true });
  execSync(`node "${CLI}" init`, { cwd: previewRoot, encoding: 'utf-8' });
  const previewPath = join(previewRoot, 'loom-preview.html');
  writeFileSync(previewPath, '<html></html>', 'utf-8');
  const oldTime = new Date('2026-01-01T00:00:00Z');
  const newTime = new Date('2026-01-02T00:00:00Z');
  utimesSync(previewPath, oldTime, oldTime);
  utimesSync(join(previewRoot, '.loom', 'v1', '04_INTENT_MAP.json'), newTime, newTime);

  const out = execSync(`node "${CLI}" preview`, { cwd: previewRoot, encoding: 'utf-8' });
  assertContains(out, 'preview 已过期');
  assertContains(out, 'loom preview --regen');
  assertContains(out, 'loom preview --stale');
  rmSync(previewRoot, { recursive: true, force: true });
});

// ─── 清理 ──────────────────────────────────────────────

rmSync(TEST_ROOT, { recursive: true, force: true });

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
if (failed > 0) {
  process.exit(1);
}
