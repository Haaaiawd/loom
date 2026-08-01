// capability-graph.js — 项目初衷到能力获取的可审计展开图。

import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { loadIntentMap } from './intent-map.js';
import { readJsonFile } from './shared/md-utils.js';

const GRAPH_FILE = '07_CAPABILITY_GRAPH.json';
const BRIEFS_DIR = '07_CAPABILITY_BRIEFS';
const NODE_KINDS = ['outcome', 'concern', 'capability', 'risk', 'evidence'];
const NODE_STATUSES = ['open', 'researched', 'covered', 'deferred', 'out_of_scope'];
const ROUTES = ['expand', 'brief', 'intent', 'defer', 'exclude', 'covered_by'];
const RELATIONSHIPS = ['refines', 'requires', 'realizes', 'constrains', 'risks', 'validated_by', 'covered_by'];
const ACQUISITION_MODES = ['adaptive', 'external_required', 'project_only'];
const FAILURE_COSTS = ['low', 'material', 'hard_to_reverse'];
const IMPACT_REVIEWER_MODES = ['independent_agent_thread'];
const VERIFICATION_FIELDS = ['method', 'target', 'procedure', 'pass_criteria', 'artifact'];
const EVIDENCE_ARTIFACT_DIRS = ['verifications', '08_ASSET_LIBRARY/files'];
const LENS_STATUSES = ['applicable', 'not_applicable'];
// A lens is a mandatory inspection direction, not a capability category.  The
// graph may decide that a lens does not apply, but it must make that decision
// visible instead of silently omitting, for example, interaction quality.
const STANDARD_LENSES = [
  { id: 'journey', title: '用户旅程', question: '用户从开始到离开，是否能完成有意义的完整路径？' },
  { id: 'interaction_accessibility', title: '交互与可访问性', question: '状态、反馈、失败恢复和不同使用条件是否真实可用？' },
  { id: 'visual_editorial', title: '视觉与信息表达', question: '视觉语言、层级、版式与资产是否帮助用户理解并形成该产品的气质？' },
  { id: 'content_communication', title: '内容与沟通', question: '文案、信息呈现或对话是否准确、可理解且符合产品立场？' },
  { id: 'system_data', title: '系统与数据', question: '数据、模型、集成、权限与运行边界是否支撑而非伤害用户结果？' },
  { id: 'quality_risk', title: '横切质量与风险', question: '可靠性、隐私、安全、性能、素材来源与独立验证是否被处理？' },
];

export function getCapabilityGraphPath(versionDir) {
  return join(versionDir, GRAPH_FILE);
}

export function getCapabilityBriefsDir(versionDir) {
  return join(versionDir, BRIEFS_DIR);
}

function assertString(value, label, errors) {
  if (typeof value !== 'string' || value.trim() === '') errors.push(`${label} 必须是非空字符串`);
}

function schemaRequiresLensContract(data) {
  const version = Number.parseFloat(String(data?._meta?._version || '1.0'));
  return Number.isFinite(version) && version >= 1.1;
}

function schemaRequiresCapabilityDomains(data) {
  const version = Number.parseFloat(String(data?._meta?._version || '1.0'));
  return Number.isFinite(version) && version >= 1.2;
}

function schemaRequiresImpactAssessment(data) {
  const version = Number.parseFloat(String(data?._meta?._version || '1.0'));
  return Number.isFinite(version) && version >= 1.3;
}

function minimumHighCapabilityCount(totalCapabilities) {
  return Math.max(1, Math.ceil(totalCapabilities * 0.3));
}

function validateImpactReview(data, capabilities, errors) {
  if (data?._meta?._template === true) return;
  const review = data.impact_review;
  if (!review || typeof review !== 'object' || Array.isArray(review)) {
    errors.push('Graph schema 1.3 要求 impact_review；Architect 提出判断后，必须由新的 Agent thread 独立审查每个 capability 的影响等级与外部获取必要性');
    return;
  }
  if (!IMPACT_REVIEWER_MODES.includes(review.reviewer_mode)) {
    errors.push(`impact_review.reviewer_mode 必须为 independent_agent_thread；不能由 Architect 在同一上下文替自己确认影响等级`);
  }
  if (!Array.isArray(review.assessments)) {
    errors.push('impact_review.assessments 必须是数组');
    return;
  }
  const assessmentByCapability = new Map();
  for (const [index, assessment] of review.assessments.entries()) {
    const prefix = `impact_review.assessments[${index}]`;
    if (!assessment || typeof assessment !== 'object' || Array.isArray(assessment)) {
      errors.push(`${prefix} 必须是对象`);
      continue;
    }
    assertString(assessment.capability_id, `${prefix}.capability_id`, errors);
    if (!['low', 'medium', 'high'].includes(assessment.recommended_impact)) {
      errors.push(`${prefix}.recommended_impact 非法: ${assessment.recommended_impact}`);
    }
    if (typeof assessment.external_acquisition_required !== 'boolean') {
      errors.push(`${prefix}.external_acquisition_required 必须是 boolean`);
    }
    assertString(assessment.rationale, `${prefix}.rationale`, errors);
    if (assessmentByCapability.has(assessment.capability_id)) errors.push(`${prefix}.capability_id 重复: ${assessment.capability_id}`);
    assessmentByCapability.set(assessment.capability_id, assessment);
  }

  const capabilityIds = new Set(capabilities.map((node) => node.id));
  for (const capability of capabilities) {
    const assessment = assessmentByCapability.get(capability.id);
    if (!assessment) {
      errors.push(`impact_review 缺少 ${capability.id} 的独立审查；不要让 Architect 自己裁决它是否重要`);
      continue;
    }
    if (assessment.recommended_impact !== capability.impact) {
      errors.push(`impact_review 对 ${capability.id} 建议 ${assessment.recommended_impact}，但 Graph 写为 ${capability.impact}；先按独立审查结论更新图谱或重新审查`);
    }
    const effectiveAcquisition = getEffectiveAcquisitionMode(capability);
    if (assessment.external_acquisition_required && effectiveAcquisition !== 'external_required') {
      errors.push(`impact_review 要求 ${capability.id} 外部获取，但 Graph 的 acquisition_mode 为 ${effectiveAcquisition}`);
    }
  }
  for (const capabilityId of assessmentByCapability.keys()) {
    if (!capabilityIds.has(capabilityId)) errors.push(`impact_review 引用不存在的 capability: ${capabilityId}`);
  }
  const highCount = capabilities.filter((node) => node.impact === 'high').length;
  const requiredHighCount = minimumHighCapabilityCount(capabilities.length);
  if (highCount < requiredHighCount) {
    errors.push(`Impact Gate 要求至少 ${requiredHighCount}/${capabilities.length}（30%，向上取整，至少 1 个）capability 为 high；当前只有 ${highCount} 个。不要通过整体降级来跳过检索`);
  }
}

function validateImpactAssessment(id, node, required, errors) {
  const prefix = `nodes["${id}"].impact_assessment`;
  const assessment = node.impact_assessment;
  if (assessment === undefined) {
    if (required) errors.push(`nodes["${id}"] 是 capability；Graph schema 1.3 要求 impact_assessment，先说明它影响的用户结果、错判代价、外部知识是否会改变决定与理由，再决定 impact`);
    return;
  }
  if (!assessment || typeof assessment !== 'object' || Array.isArray(assessment)) {
    errors.push(`${prefix} 必须是对象`);
    return;
  }
  assertString(assessment.affected_user_result, `${prefix}.affected_user_result`, errors);
  if (!FAILURE_COSTS.includes(assessment.failure_cost)) {
    errors.push(`${prefix}.failure_cost 非法: ${assessment.failure_cost}（可选 low|material|hard_to_reverse）`);
  }
  if (typeof assessment.external_knowledge_changes_decision !== 'boolean') {
    errors.push(`${prefix}.external_knowledge_changes_decision 必须是 boolean`);
  }
  assertString(assessment.rationale, `${prefix}.rationale`, errors);

  const mustBeHigh = assessment.failure_cost === 'hard_to_reverse'
    || assessment.external_knowledge_changes_decision === true;
  if (mustBeHigh && node.impact !== 'high') {
    errors.push(`nodes["${id}"] 的 impact_assessment 表明错判不可逆或外部知识会改变决定，impact 必须为 high；不能以 medium/low 绕过能力获取门禁`);
  }
  if (node.impact === 'high' && assessment.external_knowledge_changes_decision !== true) {
    errors.push(`nodes["${id}"] 为 high capability，impact_assessment.external_knowledge_changes_decision 必须为 true；高影响能力必须进入外部获取判断`);
  }
}

function validateCapabilityDomains(data, allIds, errors) {
  if (data?._meta?._template === true) return new Set();
  const domains = data.capability_domains;
  if (domains === undefined) return new Set();
  if (!Array.isArray(domains)) {
    errors.push('capability_domains 必须是数组');
    return new Set();
  }
  const seen = new Set();
  for (const [index, domain] of domains.entries()) {
    const prefix = `capability_domains[${index}]`;
    if (!domain || typeof domain !== 'object' || Array.isArray(domain)) {
      errors.push(`${prefix} 必须是对象`);
      continue;
    }
    assertString(domain.id, `${prefix}.id`, errors);
    assertString(domain.title, `${prefix}.title`, errors);
    assertString(domain.question, `${prefix}.question`, errors);
    assertString(domain.why_now, `${prefix}.why_now`, errors);
    if (seen.has(domain.id)) errors.push(`${prefix}.id 重复: ${domain.id}`);
    seen.add(domain.id);
    if (!Array.isArray(domain.node_refs) || domain.node_refs.length === 0) {
      errors.push(`${prefix}.node_refs 必须连接至少一个具体 capability 节点`);
    } else {
      for (const nodeId of domain.node_refs) {
        if (!allIds.has(nodeId)) errors.push(`${prefix}.node_refs 指向不存在节点: ${nodeId}`);
        else if (data.nodes[nodeId]?.kind !== 'capability') errors.push(`${prefix}.node_refs 只能引用 capability 节点: ${nodeId}`);
      }
    }
  }
  return seen;
}

function validateLensContract(data, allIds, errors) {
  if (data?._meta?._template === true) return;
  const contract = data.lens_contract;
  if (contract === undefined) return;
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    errors.push('lens_contract 必须是对象');
    return;
  }
  assertString(contract.selection_basis, 'lens_contract.selection_basis', errors);
  if (!Array.isArray(contract.lenses)) {
    errors.push('lens_contract.lenses 必须是数组');
    return;
  }
  const seen = new Set();
  for (const [index, lens] of contract.lenses.entries()) {
    const prefix = `lens_contract.lenses[${index}]`;
    if (!lens || typeof lens !== 'object' || Array.isArray(lens)) {
      errors.push(`${prefix} 必须是对象`);
      continue;
    }
    assertString(lens.id, `${prefix}.id`, errors);
    assertString(lens.title, `${prefix}.title`, errors);
    assertString(lens.question, `${prefix}.question`, errors);
    if (!LENS_STATUSES.includes(lens.status)) errors.push(`${prefix}.status 非法: ${lens.status}`);
    if (seen.has(lens.id)) errors.push(`${prefix}.id 重复: ${lens.id}`);
    seen.add(lens.id);
    if (lens.status === 'applicable') {
      if (!Array.isArray(lens.node_refs) || lens.node_refs.length === 0) {
        errors.push(`${prefix}.status=applicable 必须用 node_refs 连接至少一个具体 Graph 节点`);
      } else {
        for (const nodeId of lens.node_refs) {
          if (!allIds.has(nodeId)) errors.push(`${prefix}.node_refs 指向不存在节点: ${nodeId}`);
        }
      }
    }
    if (lens.status === 'not_applicable') {
      assertString(lens.rationale, `${prefix}.rationale`, errors);
    }
  }
  if (schemaRequiresLensContract(data)) {
    for (const lens of STANDARD_LENSES) {
      if (!seen.has(lens.id)) errors.push(`lens_contract 缺少必审透镜: ${lens.id}（${lens.title}）`);
    }
  }
}

function validateNode(id, node, allIds, domainIds, requireCapabilityDomains, requireImpactAssessment, errors) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    errors.push(`nodes["${id}"] 必须是对象`);
    return;
  }
  if (node.id !== id) errors.push(`nodes["${id}"].id 必须与 key 一致`);
  assertString(node.title, `nodes["${id}"].title`, errors);
  if (!NODE_KINDS.includes(node.kind)) errors.push(`nodes["${id}"].kind 非法: ${node.kind}`);
  if (!NODE_STATUSES.includes(node.status)) errors.push(`nodes["${id}"].status 非法: ${node.status}`);
  if (!['low', 'medium', 'high'].includes(node.impact)) errors.push(`nodes["${id}"].impact 非法: ${node.impact}`);
  if (!ROUTES.includes(node.route)) errors.push(`nodes["${id}"].route 非法: ${node.route}`);
  if (node.intent_refs !== undefined && (!Array.isArray(node.intent_refs) || node.intent_refs.some((ref) => typeof ref !== 'string'))) {
    errors.push(`nodes["${id}"].intent_refs 必须是字符串数组`);
  }
  if (node.proposal_refs !== undefined && (!Array.isArray(node.proposal_refs) || node.proposal_refs.some((ref) => typeof ref !== 'string' || !ref.trim()))) {
    errors.push(`nodes["${id}"].proposal_refs 必须是非空字符串数组`);
  }
  if (node.covered_by !== undefined && (typeof node.covered_by !== 'string' || !node.covered_by.trim())) {
    errors.push(`nodes["${id}"].covered_by 必须是非空节点 ID`);
  }
  if (node.relationships !== undefined && !Array.isArray(node.relationships)) {
    errors.push(`nodes["${id}"].relationships 必须是数组`);
  }
  for (const relation of node.relationships || []) {
    if (!relation || typeof relation !== 'object') {
      errors.push(`nodes["${id}"].relationships 含非法关系`);
      continue;
    }
    if (!RELATIONSHIPS.includes(relation.type)) errors.push(`nodes["${id}"].relationships.type 非法: ${relation.type}`);
    if (!allIds.has(relation.target)) errors.push(`nodes["${id}"].relationships 指向不存在节点: ${relation.target}`);
  }
  if (node.brief_ref !== undefined && (typeof node.brief_ref !== 'string' || node.brief_ref.trim() === '')) {
    errors.push(`nodes["${id}"].brief_ref 必须是非空字符串`);
  }
  if (node.asset_refs !== undefined && (!Array.isArray(node.asset_refs) || node.asset_refs.some((ref) => typeof ref !== 'string' || !ref.trim()))) {
    errors.push(`nodes["${id}"].asset_refs 必须是字符串数组`);
  }
  if (node.asset_refs !== undefined && node.kind !== 'evidence') {
    errors.push(`nodes["${id}"].asset_refs 只允许写在 evidence 节点`);
  }
  if (node.domain_refs !== undefined && (!Array.isArray(node.domain_refs) || node.domain_refs.some((ref) => typeof ref !== 'string' || !ref.trim()))) {
    errors.push(`nodes["${id}"].domain_refs 必须是非空字符串数组`);
  } else if (node.domain_refs !== undefined) {
    for (const domainId of node.domain_refs) {
      if (!domainIds.has(domainId)) errors.push(`nodes["${id}"].domain_refs 指向不存在能力领域: ${domainId}`);
    }
  }
  if (requireCapabilityDomains && node.kind === 'capability'
    && (!Array.isArray(node.domain_refs) || node.domain_refs.length === 0)) {
    errors.push(`nodes["${id}"] 是 capability，必须用 domain_refs 回链至少一个 capability domain`);
  }
  if (node.kind === 'capability') {
    validateImpactAssessment(id, node, requireImpactAssessment, errors);
  } else if (node.impact_assessment !== undefined) {
    errors.push(`nodes["${id}"].impact_assessment 只允许写在 capability 节点`);
  }
  if (node.acquisition_mode !== undefined) {
    if (node.kind !== 'capability') {
      errors.push(`nodes["${id}"].acquisition_mode 只允许写在 capability 节点`);
    } else if (!ACQUISITION_MODES.includes(node.acquisition_mode)) {
      errors.push(`nodes["${id}"].acquisition_mode 非法: ${node.acquisition_mode}`);
    }
  }
  if (node.acquisition_mode === 'project_only'
    && (typeof node.acquisition_rationale !== 'string' || !node.acquisition_rationale.trim())) {
    errors.push(`nodes["${id}"].acquisition_mode=project_only 必须声明 acquisition_rationale`);
  }
  if (node.impact === 'high' && requireImpactAssessment
    && node.acquisition_mode !== undefined && node.acquisition_mode !== 'external_required') {
    errors.push(`nodes["${id}"] 为 high capability；Graph schema 1.3 只允许 acquisition_mode=external_required（或省略并使用默认值），不得以 ${node.acquisition_mode} 绕过外部获取门禁`);
  } else if (node.impact === 'high' && node.acquisition_mode === 'adaptive'
    && (typeof node.acquisition_rationale !== 'string' || !node.acquisition_rationale.trim())) {
    errors.push(`nodes["${id}"] 为高影响 capability 且选择 adaptive 时必须声明 acquisition_rationale；说明为何此处不启用 external_required`);
  }
  if (node.verification !== undefined) {
    if (node.kind !== 'evidence') {
      errors.push(`nodes["${id}"].verification 只允许写在 evidence 节点`);
    } else if (!node.verification || typeof node.verification !== 'object' || Array.isArray(node.verification)) {
      errors.push(`nodes["${id}"].verification 必须是对象`);
    } else {
      for (const field of VERIFICATION_FIELDS) {
        assertString(node.verification[field], `nodes["${id}"].verification.${field}`, errors);
      }
    }
  }
}

export function validateCapabilityGraph(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Capability Graph 必须是 JSON 对象');
  }
  if (!data.nodes || typeof data.nodes !== 'object' || Array.isArray(data.nodes)) {
    errors.push('缺少 nodes 对象');
  } else {
    const ids = new Set(Object.keys(data.nodes));
    const domainIds = validateCapabilityDomains(data, ids, errors);
    const requireCapabilityDomains = schemaRequiresCapabilityDomains(data) && data.capability_domains !== undefined;
    const requireImpactAssessment = schemaRequiresImpactAssessment(data);
    validateLensContract(data, ids, errors);
    for (const [id, node] of Object.entries(data.nodes)) {
      validateNode(id, node, ids, domainIds, requireCapabilityDomains, requireImpactAssessment, errors);
    }
    if (requireImpactAssessment) {
      validateImpactReview(data, Object.values(data.nodes).filter((node) => node?.kind === 'capability'), errors);
    }
    for (const [id, node] of Object.entries(data.nodes)) {
      if (node?.route !== 'covered_by') continue;
      const targetId = node.covered_by;
      const target = data.nodes[targetId];
      if (!targetId) errors.push(`nodes["${id}"].route=covered_by 必须声明 covered_by`);
      else if (targetId === id) errors.push(`nodes["${id}"].covered_by 不得指向自身`);
      else if (!target) errors.push(`nodes["${id}"].covered_by 指向不存在节点: ${targetId}`);
      else if (target.status !== 'covered' || target.route === 'covered_by') errors.push(`nodes["${id}"].covered_by 必须指向已覆盖且非 covered_by 的真实节点: ${targetId}`);
      else if (!(node.relationships || []).some((relation) => relation.type === 'covered_by' && relation.target === targetId)) {
        errors.push(`nodes["${id}"].route=covered_by 必须有 covered_by 关系指向 ${targetId}`);
      }
    }
    if (data.constraints !== undefined) {
      if (!Array.isArray(data.constraints)) errors.push('constraints 必须是数组');
      else {
        const seen = new Set();
        for (const [index, constraint] of data.constraints.entries()) {
          const prefix = `constraints[${index}]`;
          if (!constraint || typeof constraint !== 'object' || Array.isArray(constraint)) { errors.push(`${prefix} 必须是对象`); continue; }
          assertString(constraint.proposal_id, `${prefix}.proposal_id`, errors);
          assertString(constraint.title, `${prefix}.title`, errors);
          if (!Array.isArray(constraint.node_refs) || constraint.node_refs.length === 0) errors.push(`${prefix}.node_refs 必须包含至少一个 Graph 节点`);
          else for (const nodeId of constraint.node_refs) if (!ids.has(nodeId)) errors.push(`${prefix}.node_refs 指向不存在节点: ${nodeId}`);
          if (seen.has(constraint.proposal_id)) errors.push(`${prefix}.proposal_id 重复: ${constraint.proposal_id}`);
          seen.add(constraint.proposal_id);
        }
      }
    }
  }
  if (errors.length) throw new Error(`Capability Graph 校验失败:\n  - ${errors.join('\n  - ')}`);
  return data;
}

export function loadCapabilityGraph(versionDir, { required = true } = {}) {
  const filePath = getCapabilityGraphPath(versionDir);
  if (!existsSync(filePath)) {
    if (required) throw new Error(`缺少 ${GRAPH_FILE}`);
    return null;
  }
  return validateCapabilityGraph(readJsonFile(filePath, 'Capability Graph'));
}

function getEffectiveAcquisitionMode(node) {
  if (node.kind !== 'capability') return null;
  if (node.acquisition_mode) return node.acquisition_mode;
  if (node.impact === 'high') return 'external_required';
  return 'adaptive';
}

function isRouted(node) {
  return ['brief', 'intent', 'defer', 'exclude', 'covered_by'].includes(node.route);
}

function incoming(nodes, nodeId) {
  const result = [];
  for (const [id, node] of Object.entries(nodes)) {
    for (const relation of node.relationships || []) {
      if (relation.target === nodeId) result.push({ source: id, type: relation.type });
    }
  }
  return result;
}

export function getCapabilityNode(versionDir, nodeId) {
  const graph = loadCapabilityGraph(versionDir);
  const node = graph.nodes[nodeId];
  if (!node) throw new Error(`Capability 节点不存在: ${nodeId}`);
  return { node, incoming: incoming(graph.nodes, nodeId), outgoing: node.relationships || [] };
}

export function getCapabilityFrontier(versionDir) {
  const graph = loadCapabilityGraph(versionDir);
  return Object.values(graph.nodes)
    .filter((node) => node.impact === 'high' && (!isRouted(node) || node.status === 'open'))
    .map((node) => ({ id: node.id, title: node.title, kind: node.kind, status: node.status, route: node.route, question: node.question || null }));
}

export function getCapabilityGraphProjection(versionDir) {
  const graph = loadCapabilityGraph(versionDir);
  const lines = ['```mermaid', 'flowchart LR'];
  for (const node of Object.values(graph.nodes)) {
    const label = `${node.id}<br/>${String(node.title).replace(/"/g, '&quot;')}`;
    const shape = node.kind === 'outcome' ? `(["${label}"])`
      : node.kind === 'risk' ? `{{"${label}"}}`
        : node.kind === 'capability' ? `[["${label}"]]`
          : `("${label}")`;
    lines.push(`  ${node.id.replace(/[^A-Za-z0-9_]/g, '_')}${shape}`);
  }
  for (const node of Object.values(graph.nodes)) {
    for (const relation of node.relationships || []) {
      lines.push(`  ${node.id.replace(/[^A-Za-z0-9_]/g, '_')} -->|${relation.type}| ${relation.target.replace(/[^A-Za-z0-9_]/g, '_')}`);
    }
  }
  lines.push('```');
  return {
    summary: {
      total: Object.keys(graph.nodes).length,
      by_kind: Object.fromEntries(NODE_KINDS.map((kind) => [kind, Object.values(graph.nodes).filter((node) => node.kind === kind).length])),
      frontier: getCapabilityFrontier(versionDir).length,
      lenses: getLensSummary(graph),
      capability_domains: getDomainSummary(graph),
    },
    mermaid: lines.join('\n'),
  };
}

function getLensSummary(graph) {
  const lenses = graph.lens_contract?.lenses || [];
  return {
    required: schemaRequiresLensContract(graph),
    declared: lenses.length,
    applicable: lenses.filter((lens) => lens.status === 'applicable').length,
    not_applicable: lenses.filter((lens) => lens.status === 'not_applicable').length,
  };
}

function getDomainSummary(graph) {
  const domains = graph.capability_domains || [];
  return {
    required: schemaRequiresCapabilityDomains(graph),
    declared: domains.length,
  };
}

function resolveBrief(versionDir, briefRef) {
  if (!briefRef) return null;
  if (isAbsolute(briefRef)) throw new Error(`Capability Brief 不得使用绝对路径: ${briefRef}`);
  const versionRoot = resolve(versionDir);
  const filePath = resolve(versionDir, briefRef);
  const relation = relative(versionRoot, filePath);
  if (relation.startsWith('..') || isAbsolute(relation)) throw new Error(`Capability Brief 不得越出当前版本目录: ${briefRef}`);
  const briefsRoot = resolve(getCapabilityBriefsDir(versionDir));
  const briefRelation = relative(briefsRoot, filePath);
  if (briefRelation.startsWith('..') || isAbsolute(briefRelation)) throw new Error(`Capability Brief 必须位于 ${BRIEFS_DIR}/: ${briefRef}`);
  if (!existsSync(filePath)) throw new Error(`Capability Brief 不存在: ${briefRef}`);
  return { ref: briefRef, content: readFileSync(filePath, 'utf-8') };
}

function resolveEvidenceArtifact(versionDir, artifactRef) {
  if (typeof artifactRef !== 'string' || !artifactRef.trim() || isAbsolute(artifactRef)) return null;
  const versionRoot = resolve(versionDir);
  const artifactPath = resolve(versionDir, artifactRef);
  const withinVersion = relative(versionRoot, artifactPath);
  if (withinVersion.startsWith('..') || isAbsolute(withinVersion)) return null;
  const allowed = EVIDENCE_ARTIFACT_DIRS.some((directory) => {
    const allowedRoot = resolve(versionDir, directory);
    const relation = relative(allowedRoot, artifactPath);
    return !relation.startsWith('..') && !isAbsolute(relation) && relation !== '';
  });
  if (!allowed || !existsSync(artifactPath) || !lstatSync(artifactPath).isFile()) return null;
  return artifactPath;
}

function getHighOutcomesWithoutObservableEvidence(graph, intentMap, intentMappingRequired) {
  const gaps = [];
  for (const outcome of Object.values(graph.nodes)) {
    if (outcome.kind !== 'outcome' || outcome.impact !== 'high') continue;
    const evidenceRelations = (outcome.relationships || []).filter((relation) => relation.type === 'validated_by');
    const validEvidence = evidenceRelations.find((relation) => {
      const evidence = graph.nodes[relation.target];
      if (!evidence || evidence.kind !== 'evidence' || !evidence.verification) return false;
      const hasOwner = (evidence.intent_refs || []).some((intentId) => !intentMappingRequired || intentId in intentMap.intents);
      return hasOwner;
    });
    if (!validEvidence) {
      gaps.push({
        node_id: outcome.id,
        reason: '高影响 outcome 必须以 validated_by 连接到带 method、target、procedure、pass_criteria、artifact 和 Intent 回链的 evidence 节点',
      });
    }
  }
  return gaps;
}

export function getCapabilityCoverage(versionDir) {
  const graph = loadCapabilityGraph(versionDir);
  const intentMap = loadIntentMap(versionDir);
  const intentMappingRequired = intentMap._meta?._template !== true;
  const nodes = Object.values(graph.nodes);
  const capabilityNodes = nodes.filter((node) => node.kind === 'capability');
  const highCapabilityCount = capabilityNodes.filter((node) => node.impact === 'high').length;
  const highUnrouted = getCapabilityFrontier(versionDir);
  const orphanIntentRefs = [];
  const mappedIntentIds = new Set();
  const capabilitiesWithoutPlan = [];
  const routingGaps = [];
  const outcomesWithoutConcern = [];
  const evidenceArtifactGaps = [];
  const lensContractGaps = [];
  const capabilityDomainGaps = [];

  if (schemaRequiresLensContract(graph) && !graph.lens_contract) {
    lensContractGaps.push({
      reason: '当前 Graph schema 要求 lens_contract；Architect 必须先审视用户旅程、交互与可访问性、视觉与信息表达、内容与沟通、系统与数据、横切质量与风险，并把每项连接到具体节点或说明为何不适用。',
    });
  }
  if (schemaRequiresCapabilityDomains(graph) && !graph.capability_domains) {
    capabilityDomainGaps.push({
      reason: '当前 Graph schema 要求 capability_domains；Architect 必须从项目事实派生会改变方案或验证方法的专业领域（如 UI/UX、3D 与光影、网络安全、心理学或生物学），再把具体 capability 回链到这些领域。',
    });
  }

  for (const node of nodes) {
    for (const intentId of node.intent_refs || []) {
      if (!intentMappingRequired) continue;
      if (!(intentId in intentMap.intents)) orphanIntentRefs.push({ node_id: node.id, intent_id: intentId });
      else mappedIntentIds.add(intentId);
    }
    if (node.route === 'intent' && (!node.intent_refs || node.intent_refs.length === 0)) {
      routingGaps.push({ node_id: node.id, reason: 'route=intent 但缺少 intent_refs' });
    }
    if (node.route === 'brief' && !node.brief_ref) {
      capabilitiesWithoutPlan.push({ node_id: node.id, reason: 'route=brief 但缺少 brief_ref' });
    }
    if (node.kind === 'capability') {
      const linkedIntents = (node.intent_refs || [])
        .map((intentId) => intentMap.intents[intentId])
        .filter(Boolean);
      const needsExternalAcquisition = linkedIntents.length > 0
        && getEffectiveAcquisitionMode(node) === 'external_required';
      if (needsExternalAcquisition && !node.brief_ref && node.route !== 'brief') {
        capabilitiesWithoutPlan.push({
          node_id: node.id,
          reason: '外部能力获取为 required，但缺少 brief_ref 来定义专业问题与验收边界',
        });
      }
    }
    if (['defer', 'exclude'].includes(node.route) && (!node.rationale || typeof node.rationale !== 'string' || node.rationale.trim() === '')) {
      routingGaps.push({ node_id: node.id, reason: `route=${node.route} 但缺少 rationale` });
    }
    if (node.route === 'defer' && (!node.revisit_when || typeof node.revisit_when !== 'string' || node.revisit_when.trim() === '')) {
      routingGaps.push({ node_id: node.id, reason: 'route=defer 但缺少 revisit_when' });
    }
    if (node.route === 'covered_by' && (node.relationships || []).length === 0) {
      routingGaps.push({ node_id: node.id, reason: 'route=covered_by 但没有指向覆盖节点的关系' });
    }
    if (node.kind === 'outcome' && !(node.relationships || []).some((relation) => graph.nodes[relation.target]?.kind === 'concern')) {
      outcomesWithoutConcern.push({ node_id: node.id, reason: 'outcome 没有连接到 concern，项目初衷尚未展开为问题面' });
    }
    if (node.kind === 'evidence' && node.verification?.artifact) {
      const ownedCompletedIntent = (node.intent_refs || []).some((intentId) => intentMap.intents[intentId]?.status === 'completed');
      if (ownedCompletedIntent && !resolveEvidenceArtifact(versionDir, node.verification.artifact)) {
        evidenceArtifactGaps.push({ node_id: node.id, reason: `已完成 Intent 的 evidence artifact 不存在或不可读: ${node.verification.artifact}` });
      }
    }
    if (node.brief_ref) {
      try { resolveBrief(versionDir, node.brief_ref); } catch (error) {
        capabilitiesWithoutPlan.push({ node_id: node.id, reason: error.message });
      }
    }
  }

  const unmappedIntents = intentMappingRequired
    ? Object.keys(intentMap.intents).filter((id) => !mappedIntentIds.has(id))
    : [];
  const highOutcomesWithoutObservableEvidence = getHighOutcomesWithoutObservableEvidence(graph, intentMap, intentMappingRequired);
  return {
    summary: {
      nodes: nodes.length,
      outcomes: nodes.filter((node) => node.kind === 'outcome').length,
      capabilities: capabilityNodes.length,
      high_capabilities: highCapabilityCount,
      required_high_capabilities: capabilityNodes.length ? minimumHighCapabilityCount(capabilityNodes.length) : 0,
      high_capability_ratio: capabilityNodes.length ? highCapabilityCount / capabilityNodes.length : 0,
      high_unrouted: highUnrouted.length,
      orphan_intent_refs: orphanIntentRefs.length,
      capabilities_without_plan: capabilitiesWithoutPlan.length,
      routing_gaps: routingGaps.length,
      outcomes_without_concern: outcomesWithoutConcern.length,
      high_outcomes_without_observable_evidence: highOutcomesWithoutObservableEvidence.length,
      evidence_artifact_gaps: evidenceArtifactGaps.length,
      lens_contract_gaps: lensContractGaps.length,
      capability_domain_gaps: capabilityDomainGaps.length,
      lenses: getLensSummary(graph),
      capability_domains: getDomainSummary(graph),
      intent_mapping_required: intentMappingRequired,
      unmapped_intents: unmappedIntents.length,
      ready: highUnrouted.length === 0
        && orphanIntentRefs.length === 0
        && capabilitiesWithoutPlan.length === 0
        && routingGaps.length === 0
        && outcomesWithoutConcern.length === 0
        && highOutcomesWithoutObservableEvidence.length === 0
        && evidenceArtifactGaps.length === 0
        && lensContractGaps.length === 0
        && capabilityDomainGaps.length === 0
        && unmappedIntents.length === 0,
    },
    high_unrouted: highUnrouted,
    orphan_intent_refs: orphanIntentRefs,
    capabilities_without_plan: capabilitiesWithoutPlan,
    routing_gaps: routingGaps,
    outcomes_without_concern: outcomesWithoutConcern,
    high_outcomes_without_observable_evidence: highOutcomesWithoutObservableEvidence,
    evidence_artifact_gaps: evidenceArtifactGaps,
    lens_contract_gaps: lensContractGaps,
    capability_domain_gaps: capabilityDomainGaps,
    unmapped_intents: unmappedIntents,
  };
}

function collectCompilationNodes(graph, intentId) {
  const selected = new Set(Object.values(graph.nodes)
    .filter((node) => (node.intent_refs || []).includes(intentId))
    .map((node) => node.id));
  const queue = [...selected];
  while (queue.length) {
    const current = queue.shift();
    for (const { source, type } of incoming(graph.nodes, current)) {
      if (type === 'refines' && !selected.has(source)) {
        selected.add(source);
        queue.push(source);
      }
    }
    for (const relation of graph.nodes[current].relationships || []) {
      if (['requires', 'constrains', 'risks'].includes(relation.type) && !selected.has(relation.target)) {
        selected.add(relation.target);
        queue.push(relation.target);
      }
    }
  }
  return [...selected].map((id) => graph.nodes[id]);
}

export function compileCapabilityInputs(versionDir, intentId) {
  const graph = loadCapabilityGraph(versionDir, { required: false });
  if (!graph) {
    return {
      available: false,
      nodes: [],
      briefs: [],
      warnings: ['项目尚未建立 Capability Graph；使用 Intent 的 capability_needs 兼容路径。'],
      acquisition: { required: false, required_node_ids: [], nodes: [] },
    };
  }
  const nodes = collectCompilationNodes(graph, intentId);
  const relevantLenses = (graph.lens_contract?.lenses || [])
    .filter((lens) => lens.status === 'applicable'
      && (lens.node_refs || []).some((nodeId) => nodes.some((node) => node.id === nodeId)))
    .map((lens) => ({
      id: lens.id,
      title: lens.title,
      question: lens.question,
      node_refs: lens.node_refs,
    }));
  const relevantDomains = (graph.capability_domains || [])
    .filter((domain) => (domain.node_refs || []).some((nodeId) => nodes.some((node) => node.id === nodeId)))
    .map((domain) => ({
      id: domain.id,
      title: domain.title,
      question: domain.question,
      why_now: domain.why_now,
      node_refs: domain.node_refs,
    }));
  const briefs = [];
  const warnings = [];
  for (const node of nodes) {
    if (!node.brief_ref) continue;
    try { briefs.push({ node_id: node.id, ...resolveBrief(versionDir, node.brief_ref) }); } catch (error) { warnings.push(`${node.id}: ${error.message}`); }
  }
  const acquisitionNodes = nodes
    .filter((node) => node.kind === 'capability')
    .map((node) => ({
      node_id: node.id,
      title: node.title,
      mode: getEffectiveAcquisitionMode(node),
      reason: node.acquisition_mode
        ? 'Capability Graph 显式声明'
        : node.impact === 'high'
          ? '高影响能力默认需要外部来源化'
          : '按任务证据自适应判断',
    }));
  const requiredNodeIds = acquisitionNodes
    .filter((node) => node.mode === 'external_required')
    .map((node) => node.node_id);
  return {
    available: true,
    nodes,
    lenses: relevantLenses,
    capability_domains: relevantDomains,
    briefs,
    warnings,
    acquisition: {
      required: requiredNodeIds.length > 0,
      required_node_ids: requiredNodeIds,
      nodes: acquisitionNodes,
    },
  };
}
