// run-all.js — CLI 端到端测试
// 造一个临时 .loom/v1/ 项目结构，用模板数据，跑通所有命令。

import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const TEST_ROOT = join(process.cwd(), 'test', '.tmp-loom-test');
const LOOM_DIR = join(TEST_ROOT, '.loom', 'v1');
const PHILOSOPHY_DIR = join(LOOM_DIR, '00_PHILOSOPHY');
const VERIFICATIONS_DIR = join(LOOM_DIR, 'verifications');
const CLI = join(process.cwd(), 'bin', 'loom.js');

let passed = 0;
let failed = 0;

function setup() {
  rmSync(TEST_ROOT, { recursive: true, force: true });
  mkdirSync(PHILOSOPHY_DIR, { recursive: true });
  mkdirSync(VERIFICATIONS_DIR, { recursive: true });

  // Intent Map（基于模板，填入可测试的数据）
  writeFileSync(join(LOOM_DIR, '04_INTENT_MAP.json'), JSON.stringify({
    _meta: { _version: '1.0', _loom_version: 'v1', _generated_by: 'architect' },
    intents: {
      'INT-001': {
        id: 'INT-001',
        narrative_ref: '01_VISION.md#int-001',
        depends_on: [],
        acceptance: '用户能注册并登录',
        philosophy_anchors: ['PRODUCT_PHILOSOPHY.md#core-belief'],
        status: 'completed',
      },
      'INT-002': {
        id: 'INT-002',
        narrative_ref: '01_VISION.md#int-002',
        depends_on: ['INT-001'],
        acceptance: '用户能创建项目',
        philosophy_anchors: ['ENGINEERING_CREED.md#simplicity'],
        status: 'in_progress',
      },
      'INT-003': {
        id: 'INT-003',
        narrative_ref: '01_VISION.md#int-003',
        depends_on: ['INT-001', 'INT-002'],
        acceptance: '用户能邀请协作者',
        philosophy_anchors: ['PRODUCT_PHILOSOPHY.md#collaboration'],
        status: 'pending',
      },
    },
    topo_order: ['INT-001', 'INT-002', 'INT-003'],
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

function run(args) {
  return execSync(`node "${CLI}" ${args} --loom-dir "${LOOM_DIR}"`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

// 从项目根目录跑（不带 --loom-dir，测试 findLoomDir 指针逻辑）
function runFromRoot(args) {
  return execSync(`node "${CLI}" ${args}`, {
    encoding: 'utf-8',
    cwd: TEST_ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
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

test('intent update — 合法状态转换 pending→in_progress', () => {
  // INT-003 是 pending，转成 in_progress
  const out = run('intent update INT-003 --status in_progress');
  assertContains(out, 'INT-003 status 已更新为 in_progress');
  // 验证确实改了
  const data = JSON.parse(run('intent get INT-003'));
  assert(data.status === 'in_progress', 'status 未更新');
  // 改回去，不影响后续测试
  run('intent update INT-003 --status blocked');
  run('intent update INT-003 --status pending');
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
  // needs_review → pending（重新验证）
  const out2 = run('intent update INT-001 --status pending');
  assertContains(out2, 'pending');
  // 恢复为 completed，不影响后续测试
  run('intent update INT-001 --status in_progress');
  run('intent update INT-001 --status completed');
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

test('philosophy list — 列出哲学文档', () => {
  const out = run('philosophy list');
  const files = JSON.parse(out);
  assert(files.includes('PRODUCT_PHILOSOPHY.md'), '缺少 PRODUCT_PHILOSOPHY.md');
  assert(files.includes('ENGINEERING_CREED.md'), '缺少 ENGINEERING_CREED.md');
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

test('verify write — 写入验证记录（追加模式）', () => {
  const record = {
    intent_id: 'INT-002',
    verdict: 'passed',
    timestamp: '2026-06-26T12:00:00Z',
    summary: '实现忠实于意图',
    dimensions: {
      intent_fidelity: 'passed',
      philosophy_consistency: 'passed',
      baseline_compliance: 'passed',
      acceptance: 'passed',
    },
  };
  const tmpFile = join(LOOM_DIR, '_tmp_verify.json');
  writeFileSync(tmpFile, JSON.stringify(record));
  const out = run(`verify write --json-file "${tmpFile}"`);
  assertContains(out, '验证记录已写入');
  assertContains(out, '轮次: 1');
  assert(existsSync(join(VERIFICATIONS_DIR, 'INT-002.json')), '验证记录文件未创建');
  rmSync(tmpFile, { force: true });
});

test('verify write — deviated 轮次追踪和升级提示', () => {
  // 写 3 轮 deviated，第 3 轮应触发升级提示
  for (let i = 1; i <= 3; i++) {
    const record = {
      intent_id: 'INT-003',
      verdict: 'deviated',
      timestamp: `2026-06-26T12:0${i}:00Z`,
      summary: `第 ${i} 轮偏离`,
      dimensions: {
        intent_fidelity: 'deviated',
        philosophy_consistency: 'passed',
        baseline_compliance: 'passed',
        acceptance: 'deviated',
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
    }
    rmSync(tmpFile, { force: true });
  }
});

test('verify write — pending_human verdict（L3 人类反馈）', () => {
  const record = {
    intent_id: 'INT-002',
    verdict: 'pending_human',
    timestamp: '2026-06-26T14:00:00Z',
    summary: '静态维度通过，体验维度需人类验证',
    dimensions: {
      intent_fidelity: 'passed',
      philosophy_consistency: 'passed',
      baseline_compliance: 'passed',
      acceptance: 'pending_human',
    },
  };
  const tmpFile = join(LOOM_DIR, '_tmp_verify_ph.json');
  writeFileSync(tmpFile, JSON.stringify(record));
  const out = run(`verify write --json-file "${tmpFile}"`);
  assertContains(out, '验证记录已写入');
  assertContains(out, 'pending_human');
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

console.log('\n测试 init 命令');

test('init — 初始化项目目录', () => {
  const initRoot = join(process.cwd(), 'test', '.tmp-init-test');
  rmSync(initRoot, { recursive: true, force: true });
  mkdirSync(initRoot, { recursive: true });
  const out = execSync(`node "${CLI}" init`, { cwd: initRoot, encoding: 'utf-8' });
  assertContains(out, 'LOOM 项目已初始化');
  assert(existsSync(join(initRoot, '.loom', 'v1', '00_PHILOSOPHY')), '哲学目录未创建');
  assert(existsSync(join(initRoot, '.loom', 'v1', '04_INTENT_MAP.json')), 'Intent Map 模板未复制');
  assert(existsSync(join(initRoot, '.loom', 'v1', '01_VISION.md')), '愿景模板未复制');
  rmSync(initRoot, { recursive: true, force: true });
});

test('init — 重复初始化跳过已存在文件', () => {
  const initRoot = join(process.cwd(), 'test', '.tmp-init-test2');
  rmSync(initRoot, { recursive: true, force: true });
  mkdirSync(initRoot, { recursive: true });
  execSync(`node "${CLI}" init`, { cwd: initRoot, encoding: 'utf-8' });
  const out2 = execSync(`node "${CLI}" init`, { cwd: initRoot, encoding: 'utf-8' });
  assertContains(out2, '跳过');
  rmSync(initRoot, { recursive: true, force: true });
});

console.log('\n测试 activate 命令');

test('activate weaver — 输出激活提示词', () => {
  const out = run('activate weaver');
  assertContains(out, 'Philosophy Weaver');
  assertContains(out, 'BASELINE');
});

test('activate keeper — 输出激活提示词', () => {
  const out = run('activate keeper');
  assertContains(out, 'Keeper');
  assertContains(out, 'BASELINE');
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
          narrative_ref: '01_VISION.md#int-001',
          depends_on: [],
          acceptance: '用户能注册并登录',
          philosophy_anchors: ['PRODUCT_PHILOSOPHY.md#core-belief'],
          status: 'blocked',
        },
        'INT-002': {
          id: 'INT-002',
          narrative_ref: '01_VISION.md#int-002',
          depends_on: ['INT-001'],
          acceptance: '用户能创建项目',
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

console.log('\n测试 version 命令');

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
});

test('context — 上下文摘要', () => {
  const out = run('context');
  const data = JSON.parse(out);
  assert(data.progress !== undefined, '缺少 progress');
  assert(data.next_intent !== undefined, '缺少 next_intent');
  assert(data.pending_verifications !== undefined, '缺少 pending_verifications');
  assert(Array.isArray(data.risks), '缺少 risks 数组');
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

// ─── 清理 ──────────────────────────────────────────────

rmSync(TEST_ROOT, { recursive: true, force: true });

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
if (failed > 0) {
  process.exit(1);
}
