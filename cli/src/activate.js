// activate — compile a role- and intent-scoped Context Pack.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getLoomRoot } from './shared/paths.js';
import { getIntent, getNarrative } from './intent-map.js';
import { getIntentDraft } from './intent-draft.js';
import { getPhilosophy } from './philosophy.js';
import { getVerificationContract } from './verify.js';
import { extractMdSection } from './shared/md-utils.js';
import { compileCapabilityInputs } from './capability-graph.js';

const VALID_ROLES = ['weaver', 'visionary', 'architect', 'forge', 'keeper'];

const ROLE_FILES = {
  weaver: 'meta/PHILOSOPHY_WEAVER.md',
  visionary: 'roles/visionary.md',
  architect: 'roles/architect.md',
  forge: 'roles/forge.md',
  keeper: 'roles/keeper.md',
};

const ROLE_PHILOSOPHY_FILES = {
  visionary: ['PRODUCT_PHILOSOPHY.md', 'DECISION_RUBRIC.md'],
  architect: ['ENGINEERING_CREED.md', 'DECISION_RUBRIC.md'],
  forge: ['ENGINEERING_CREED.md'],
  keeper: ['PRODUCT_PHILOSOPHY.md', 'DECISION_RUBRIC.md'],
};

const BASELINE_SUMMARY = [
  '- B1：实质修改前理解真实结构，不创建平行体系。',
  '- B2：秘密、环境值和可变配置不写死。',
  '- B3：用户或系统可观察的行为具有显式契约。',
  '- B4：重要且会影响未来的判断可追溯。',
  '- B5：完成关联原始意图和当前 revision 证据；质量提升具有基线相对证据。',
].join('\n');

function section(title, body) {
  const content = String(body || '').trim();
  return `## ${title}\n\n${content || '无。'}`;
}

function readRole(role) {
  const filePath = join(getLoomRoot(), ROLE_FILES[role]);
  if (!existsSync(filePath)) throw new Error(`角色文件不存在: ${filePath}`);
  return readFileSync(filePath, 'utf-8');
}

function getVerificationMethod(intent) {
  return intent?.verification_method || intent?._optional?.verification_method || null;
}

function resolveContractReference(versionDir, value, label) {
  if (!value) return null;
  if (typeof value !== 'string') return JSON.stringify(value, null, 2);
  const match = value.trim().match(/^(?:see\s+)?([^#]+)#([\w-]+)$/i);
  if (!match) return value;
  const [, file, anchor] = match;
  if (file.includes('/') || file.includes('\\') || file !== '05_VERIFICATION.md') {
    throw new Error(`${label}引用必须位于 05_VERIFICATION.md: ${value}`);
  }
  const filePath = join(versionDir, file);
  if (!existsSync(filePath)) throw new Error(`${label}引用的文件不存在: ${filePath}`);
  return extractMdSection(readFileSync(filePath, 'utf-8'), anchor, label);
}

function compileEnvelope(role, intentId) {
  const scope = intentId ? `仅 ${intentId}` : '当前角色的项目阶段';
  const lines = [
    `- role: ${role}`,
    `- scope: ${scope}`,
    '- 本 Context Pack 不会清除现有会话记忆。',
    '- system、developer 与用户指令优先；项目事实冲突时报告，不静默混用。',
    '- 只在当前角色权限和明确作用域内行动。',
  ];
  if (role === 'keeper') {
    lines.push('- Keeper 必须在新的 Agent thread 中运行；同一会话切换角色不构成独立验证。');
    lines.push('- 无法获得独立上下文时降低声明，关键判断使用 pending_human。');
  }
  return lines.join('\n');
}

function compileObjective(role, versionDir, intentId) {
  if (!intentId) {
    return {
      body: role === 'weaver'
        ? '织造当前项目的 Project Doctrine。先读取真实项目与完整 BASELINE，不预写产品或架构。'
        : `履行 ${role} 的当前项目阶段职责；未指定 Intent，不得自行选择并处理实现任务。`,
      intent: null,
      draft: null,
      narrative: null,
    };
  }

  if (role === 'visionary' || role === 'architect') {
    const draft = getIntentDraft(versionDir, intentId);
    const match = draft.narrative_ref.match(/^([^#]+)#([\w-]+)$/);
    if (!match || match[1] !== '01_VISION.md') throw new Error(`draft narrative_ref 非法: ${draft.narrative_ref}`);
    const narrative = extractMdSection(
      readFileSync(join(versionDir, match[1]), 'utf-8'),
      match[2],
      'draft 意图叙事',
    );
    const visibleDraft = role === 'visionary'
      ? {
          id: draft.id,
          revision: draft.revision,
          title: draft.title,
          narrative_ref: draft.narrative_ref,
          depends_on: draft.depends_on,
        }
      : draft;
    return {
      body: [
        '只处理下面这个 draft。不要修改官方 Intent Map，不要处理其他 Intent，不要自行 finalize。',
        '',
        '### Draft',
        '',
        '```json',
        JSON.stringify(visibleDraft, null, 2),
        '```',
        '',
        '### Narrative',
        '',
        narrative,
      ].join('\n'),
      intent: null,
      draft,
      narrative,
    };
  }

  const intent = getIntent(versionDir, intentId);
  if (['forge', 'keeper'].includes(role)) {
    const unfinishedDependencies = intent.depends_on.filter((dependencyId) => getIntent(versionDir, dependencyId).status !== 'completed');
    if (unfinishedDependencies.length) {
      throw new Error(`Intent ${intentId} 的依赖尚未闭合: ${unfinishedDependencies.join(', ')}。不得通过 activate --intent 绕过执行顺序；先运行 loom intent next 或完成依赖 Intent。`);
    }
  }
  const narrative = getNarrative(versionDir, intentId);
  const objectiveView = {
    id: intent.id,
    revision: intent.revision,
    title: intent.title,
    status: intent.status,
    narrative_ref: intent.narrative_ref,
    depends_on: intent.depends_on,
  };
  return {
    body: [
      '只实现或验证下面这个官方 Intent。不得加载或顺便处理其他 Intent。',
      '',
      '### Intent',
      '',
      '```json',
      JSON.stringify(objectiveView, null, 2),
      '```',
      '',
      '### Narrative',
      '',
      narrative,
    ].join('\n'),
    intent,
    draft: null,
    narrative,
  };
}

function compileInvariants(role, versionDir) {
  const blocks = [];
  const baselinePath = join(getLoomRoot(), 'meta/BASELINE.md');
  blocks.push(role === 'weaver' ? readFileSync(baselinePath, 'utf-8') : BASELINE_SUMMARY);
  if (versionDir) {
    const projectBaseline = join(versionDir, '00_PHILOSOPHY', 'PROJECT_BASELINE.md');
    if (existsSync(projectBaseline)) {
      blocks.push(`### Project Baseline\n\n${readFileSync(projectBaseline, 'utf-8')}`);
    }
  }
  return blocks.join('\n\n');
}

function compileContracts(role, versionDir, objective) {
  const subject = objective.intent || objective.draft;
  if (!subject || role === 'visionary') {
    return role === 'visionary'
      ? 'Visionary 只定义目标、非目标和 narrative；不要编写 acceptance 或架构。'
      : '按当前角色 Output Contract 交付。';
  }

  const blocks = [];
  if (subject.acceptance) {
    const acceptance = objective.intent
      ? getVerificationContract(versionDir, subject.id)
      : resolveContractReference(versionDir, subject.acceptance, 'draft 完成契约');
    blocks.push(`### Acceptance / Reliability Floor\n\n${acceptance}`);
  }
  if (subject.quality_contract) {
    blocks.push(
      `### Quality Contract / Distinctive Ceiling\n\n` +
      resolveContractReference(versionDir, subject.quality_contract, '质量契约'),
    );
  }
  const verificationMethod = getVerificationMethod(subject);
  blocks.push(`### Verification Method\n\n${verificationMethod || '未声明：Keeper 使用适当的静态检查；需要运行时或人类判断却缺少入口时回流 Architect。'}`);
  const continuity = subject.continuity_required
    ? '此 Intent 已启用状态守恒门：通过前必须证明“旧状态 → 本轮操作 → 新状态”的完整序列中，未获明确授权删除或替换的既有价值、数据和可见结果仍被保留。'
    : '默认不启用状态守恒门；若本 Intent 会变更既有用户数据、持久状态、迁移结果或既有工作流，Architect 必须把 continuity_required 设为 true，并在 acceptance 写出保留项与时序验证。';
  blocks.push(
    '### Completion Gate / Codex Goal Alignment\n\n' +
    '将当前 Intent 视为本轮 Codex goal 的可闭合单元。goal 保持 active，直到结果达成、适用的状态守恒和可复现证据同时成立；goal/status 只是运行记录，不能替代验证证据。\n\n' +
    continuity,
  );
  return blocks.join('\n\n');
}

function compileProjectJudgment(role, versionDir, objective) {
  if (!versionDir || role === 'weaver') {
    return role === 'weaver'
      ? '从用户目标、仓库事实与决策相关证据建立 Project Doctrine。'
      : '当前版本目录不可用。';
  }

  const philosophyDir = join(versionDir, '00_PHILOSOPHY');
  const blocks = [];
  const missing = [];
  const anchors = (objective.intent || objective.draft)?.philosophy_anchors || [];

  if (anchors.length > 0) {
    for (const anchor of anchors) {
      blocks.push(`### ${anchor}\n\n${getPhilosophy(philosophyDir, anchor)}`);
    }
  } else {
    for (const file of ROLE_PHILOSOPHY_FILES[role] || []) {
      const filePath = join(philosophyDir, file);
      if (!existsSync(filePath)) {
        missing.push(file);
        continue;
      }
      blocks.push(`### ${file}\n\n${readFileSync(filePath, 'utf-8')}`);
    }
    if (missing.length) {
      blocks.push(
        `### Context Warning\n\n缺少: ${missing.join(', ')}。` +
        '不要用通用偏好伪造项目判断；回流 Weaver 或向用户索取必要决定。',
      );
    }
  }
  return blocks.join('\n\n');
}

function compileExpertiseInputs(role, versionDir, objective) {
  const subject = objective.intent || objective.draft;
  if (!subject || !['architect', 'forge', 'keeper'].includes(role)) {
    return '当前阶段不编译任务级 Expertise Pack。';
  }
  const needs = Array.isArray(subject.capability_needs) ? subject.capability_needs : [];
  const lines = [
    `- capability_needs: ${needs.length ? needs.join(', ') : '未声明；按当前任务发现必要能力'}`,
    `- creative_scope: ${subject.creative_scope || '未声明；遵循最小完整干预'}`,
    '- Skill、工具和资产名称只代表可发现入口；实际检查并加载后才进入 Expertise Pack。',
  ];
  if (versionDir && objective.intent) {
    const compiled = compileCapabilityInputs(versionDir, objective.intent.id);
    if (!compiled.available) {
      lines.push(`- Capability Graph: ${compiled.warnings.join(' ')}`);
    } else if (compiled.nodes.length === 0) {
      lines.push('- Capability Graph: 当前 Intent 没有回链节点；不得凭任务标题猜测能力，回流 Architect 补图谱或明确兼容原因。');
    } else {
      lines.push('- Capability Graph: 以下节点是本 Intent 的能力与风险输入：');
      for (const node of compiled.nodes) {
        lines.push(`  - ${node.id} [${node.kind}/${node.impact}] ${node.title}${node.question ? ` — ${node.question}` : ''}`);
      }
      for (const brief of compiled.briefs) {
        lines.push(`\n### Capability Brief: ${brief.node_id}\n\n${brief.content.trim()}`);
      }
      for (const warning of compiled.warnings) lines.push(`- Capability Graph warning: ${warning}`);
    }
  }
  if (role === 'keeper') {
    lines.push('- 不继承 Forge Expertise Pack；按契约独立准备验证能力。');
  }
  return lines.join('\n');
}

function compileWorkingFacts(versionDir, objective) {
  if (!versionDir) return '检查当前仓库、用户输入和可用工具。';
  const subject = objective.intent || objective.draft;
  const refs = [
    '- architecture: `.loom/.../02_ARCHITECTURE.md`（只读取与当前决定相关部分）',
    '- capability_graph: 从 `07_CAPABILITY_GRAPH.json` 查询与当前 Intent 回链的能力、风险与 Brief；不能用会话记忆补全未路由分支。',
    '- artifacts: 从真实工作区检查，不从会话记忆猜测。',
  ];
  const systemId = subject?._optional?.system_id || subject?.system_id;
  if (systemId) refs.push(`- system_id: ${systemId}`);
  if (subject?.quality_contract) refs.push('- baseline: 声明相对提升时，修改前证据必须在实现前保存。');
  return refs.join('\n');
}

/**
 * Compile a role-scoped Context Pack.
 * @param {string} role
 * @param {string | null} versionDir
 * @param {string | null} intentId
 */
export function activateRole(role, versionDir, intentId = null) {
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`未知角色: ${role}\n合法角色: ${VALID_ROLES.join(', ')}`);
  }
  if (intentId && !versionDir) throw new Error('--intent 需要当前 LOOM 版本');
  if (intentId && !['visionary', 'architect', 'forge', 'keeper'].includes(role)) {
    throw new Error(`角色 ${role} 不支持 --intent；draft 用 visionary/architect，官方 Intent 用 forge/keeper`);
  }

  const objective = compileObjective(role, versionDir, intentId);
  const parts = [
    '# LOOM Context Pack',
    section('1. Execution Envelope', compileEnvelope(role, intentId)),
    section('2. Active Objective', objective.body),
    section('3. Hard Invariants', compileInvariants(role, versionDir)),
    section('4. Success Contracts', compileContracts(role, versionDir, objective)),
    section('5. Project Judgment', compileProjectJudgment(role, versionDir, objective)),
    section('6. Expertise Inputs', compileExpertiseInputs(role, versionDir, objective)),
    section('7. Working Facts', compileWorkingFacts(versionDir, objective)),
    section('8. Role Contract / Output / Reflow / Stop', readRole(role)),
  ];
  return `${parts.join('\n\n---\n\n')}\n`;
}
