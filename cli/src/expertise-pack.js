// expertise-pack.js — provenance-backed external capability acquisition for one Intent.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import { getIntent } from './intent-map.js';
import { compileCapabilityInputs } from './capability-graph.js';
import { getLoomRoot } from './shared/paths.js';
import { readJsonFile } from './shared/md-utils.js';

const PACKS_DIR = '10_EXPERTISE_PACKS';
const VALID_STATUS = ['draft', 'ready', 'blocked'];
const QUERY_CHANNELS = ['skill_registry', 'web', 'official_docs', 'research', 'tool', 'asset'];
const SOURCE_KINDS = ['skill', 'web', 'official_docs', 'research', 'tool', 'human'];
const SOURCE_AUTHORITIES = ['official', 'primary', 'expert', 'community', 'secondary'];
const EXTERNAL_KNOWLEDGE_KINDS = new Set(['skill', 'web', 'official_docs', 'research']);

export function getExpertisePacksDir(versionDir) {
  return join(versionDir, PACKS_DIR);
}

export function getExpertisePackPath(versionDir, intentId) {
  return join(getExpertisePacksDir(versionDir), `${intentId}.json`);
}

function pushText(value, label, errors) {
  if (typeof value !== 'string' || value.trim() === '') errors.push(`${label} 必须是非空字符串`);
}

function pushTextArray(value, label, errors, { min = 1 } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${label} 必须是字符串数组`);
    return;
  }
  if (value.length < min) errors.push(`${label} 至少需要 ${min} 项`);
  value.forEach((item, index) => pushText(item, `${label}[${index}]`, errors));
}

function isHttpsLocator(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function getExpertiseRequirement(versionDir, intentId) {
  const intent = getIntent(versionDir, intentId);
  const compiled = compileCapabilityInputs(versionDir, intentId);
  const acquisition = compiled.acquisition || {
    required: false,
    required_node_ids: [],
    nodes: [],
  };
  return {
    intent,
    compiled,
    required: acquisition.required === true,
    required_node_ids: acquisition.required_node_ids || [],
    acquisition_nodes: acquisition.nodes || [],
  };
}

function validateSearchPlan(plan, strict, errors) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    errors.push('search_plan 必须是对象');
    return;
  }
  if (!strict) return;
  pushText(plan.decision_question, 'search_plan.decision_question', errors);
  pushTextArray(plan.project_signals, 'search_plan.project_signals', errors);
  pushTextArray(plan.constraints, 'search_plan.constraints', errors);
  pushText(plan.stop_condition, 'search_plan.stop_condition', errors);
  if (!Array.isArray(plan.derived_queries) || plan.derived_queries.length === 0) {
    errors.push('search_plan.derived_queries 至少需要一条运行时派生查询');
  } else {
    plan.derived_queries.forEach((query, index) => {
      const prefix = `search_plan.derived_queries[${index}]`;
      if (!query || typeof query !== 'object' || Array.isArray(query)) {
        errors.push(`${prefix} 必须是对象`);
        return;
      }
      if (!QUERY_CHANNELS.includes(query.channel)) {
        errors.push(`${prefix}.channel 必须是 ${QUERY_CHANNELS.join('|')}`);
      }
      pushText(query.query, `${prefix}.query`, errors);
      pushText(query.rationale, `${prefix}.rationale`, errors);
    });
  }
}

function validateSources(sources, strict, errors) {
  const ids = new Set();
  const valid = new Map();
  if (!Array.isArray(sources)) {
    errors.push('sources 必须是数组');
    return { ids, valid, externalCount: 0 };
  }
  if (strict && sources.length === 0) errors.push('ready Expertise Pack 必须包含外部来源');
  let externalCount = 0;
  sources.forEach((source, index) => {
    const prefix = `sources[${index}]`;
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      errors.push(`${prefix} 必须是对象`);
      return;
    }
    pushText(source.id, `${prefix}.id`, errors);
    if (typeof source.id === 'string') {
      if (ids.has(source.id)) errors.push(`${prefix}.id 重复: ${source.id}`);
      ids.add(source.id);
    }
    if (!SOURCE_KINDS.includes(source.kind)) {
      errors.push(`${prefix}.kind 必须是 ${SOURCE_KINDS.join('|')}`);
    }
    if (!SOURCE_AUTHORITIES.includes(source.authority)) {
      errors.push(`${prefix}.authority 必须是 ${SOURCE_AUTHORITIES.join('|')}`);
    }
    pushText(source.title, `${prefix}.title`, errors);
    pushText(source.locator, `${prefix}.locator`, errors);
    if (source.kind !== 'human' && typeof source.locator === 'string' && !isHttpsLocator(source.locator)) {
      errors.push(`${prefix}.locator 必须是可追溯的 https URL`);
    }
    pushText(source.retrieved_at, `${prefix}.retrieved_at`, errors);
    if (typeof source.retrieved_at === 'string' && Number.isNaN(Date.parse(source.retrieved_at))) {
      errors.push(`${prefix}.retrieved_at 必须是合法日期时间`);
    }
    pushText(source.why_selected, `${prefix}.why_selected`, errors);
    pushText(source.retrieval_evidence, `${prefix}.retrieval_evidence`, errors);
    if (EXTERNAL_KNOWLEDGE_KINDS.has(source.kind)) externalCount += 1;
    if (typeof source.id === 'string' && source.id.trim()) valid.set(source.id, source);
  });
  if (strict && externalCount === 0) {
    errors.push('ready Expertise Pack 至少需要一个 skill|web|official_docs|research 外部知识来源');
  }
  return { ids, valid, externalCount };
}

function validateCapsules(capsules, requiredNodeIds, sourceMap, strict, errors) {
  const covered = new Set();
  if (!Array.isArray(capsules)) {
    errors.push('capsules 必须是数组');
    return covered;
  }
  if (strict && capsules.length === 0) errors.push('ready Expertise Pack 必须包含 Capability Capsule');
  capsules.forEach((capsule, index) => {
    const prefix = `capsules[${index}]`;
    if (!capsule || typeof capsule !== 'object' || Array.isArray(capsule)) {
      errors.push(`${prefix} 必须是对象`);
      return;
    }
    pushText(capsule.capability_ref, `${prefix}.capability_ref`, errors);
    if (typeof capsule.capability_ref === 'string') covered.add(capsule.capability_ref);
    if (strict && requiredNodeIds.length > 0 && !requiredNodeIds.includes(capsule.capability_ref)) {
      errors.push(`${prefix}.capability_ref 未引用当前 Intent 的外部获取能力节点: ${capsule.capability_ref}`);
    }
    if (!strict) return;
    pushText(capsule.professional_problem, `${prefix}.professional_problem`, errors);
    pushText(capsule.when_to_use, `${prefix}.when_to_use`, errors);
    pushTextArray(capsule.rules, `${prefix}.rules`, errors);
    pushTextArray(capsule.workflow, `${prefix}.workflow`, errors);
    pushTextArray(capsule.decision_gates, `${prefix}.decision_gates`, errors);
    pushTextArray(capsule.failure_modes, `${prefix}.failure_modes`, errors);
    pushTextArray(capsule.verification_signals, `${prefix}.verification_signals`, errors);
    if (!Array.isArray(capsule.source_refs) || capsule.source_refs.length === 0) {
      errors.push(`${prefix}.source_refs 至少需要一个来源`);
    } else {
      let externalRefCount = 0;
      capsule.source_refs.forEach((ref, refIndex) => {
        pushText(ref, `${prefix}.source_refs[${refIndex}]`, errors);
        if (typeof ref === 'string' && !sourceMap.has(ref)) {
          errors.push(`${prefix}.source_refs[${refIndex}] 引用不存在的来源: ${ref}`);
        } else if (EXTERNAL_KNOWLEDGE_KINDS.has(sourceMap.get(ref)?.kind)) {
          externalRefCount += 1;
        }
      });
      if (externalRefCount === 0) {
        errors.push(`${prefix} 必须直接引用至少一个 skill|web|official_docs|research 外部知识来源`);
      }
    }
  });
  if (strict) {
    for (const nodeId of requiredNodeIds) {
      if (!covered.has(nodeId)) errors.push(`缺少外部必需能力 ${nodeId} 的 Capability Capsule`);
    }
  }
  return covered;
}

export function validateExpertisePack(versionDir, intentId, pack = null, { requireReady = true } = {}) {
  const requirement = getExpertiseRequirement(versionDir, intentId);
  const path = getExpertisePackPath(versionDir, intentId);
  const data = pack ?? readJsonFile(path, 'Expertise Pack');
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Expertise Pack 校验失败:\n  - 根节点必须是对象');
  }
  const errors = [];
  if (!data._meta || typeof data._meta !== 'object' || Array.isArray(data._meta)) {
    errors.push('_meta 必须是对象');
  } else {
    if (data._meta._version !== '1.0') errors.push('_meta._version 必须是 1.0');
    if (data._meta._loom_version !== basename(versionDir)) {
      errors.push(`_meta._loom_version 必须是 ${basename(versionDir)}`);
    }
  }
  if (data.intent_id !== intentId) errors.push(`intent_id 必须是 ${intentId}`);
  if (data.intent_revision !== (requirement.intent.revision ?? 1)) {
    errors.push(`intent_revision=${data.intent_revision} 已过期；当前为 ${requirement.intent.revision ?? 1}`);
  }
  if (!Array.isArray(data.required_capability_refs)) {
    errors.push('required_capability_refs 必须是数组');
  } else {
    data.required_capability_refs.forEach((ref, index) => {
      pushText(ref, `required_capability_refs[${index}]`, errors);
    });
    const declared = [...new Set(data.required_capability_refs)].sort();
    const expected = [...new Set(requirement.required_node_ids)].sort();
    if (JSON.stringify(declared) !== JSON.stringify(expected)) {
      errors.push(`required_capability_refs 必须精确匹配当前强门节点: ${expected.join(', ') || '无'}`);
    }
  }
  if (!VALID_STATUS.includes(data.status)) errors.push(`status 必须是 ${VALID_STATUS.join('|')}`);
  const strict = data.status === 'ready';
  validateSearchPlan(data.search_plan, data.status === 'ready' || data.status === 'blocked', errors);
  const sourceResult = validateSources(data.sources, strict, errors);
  validateCapsules(data.capsules, requirement.required_node_ids, sourceResult.valid, strict, errors);
  if (data.status === 'blocked') {
    if (!data.blocker || typeof data.blocker !== 'object' || Array.isArray(data.blocker)) {
      errors.push('blocked 状态必须提供 blocker 对象');
    } else {
      pushText(data.blocker.reason, 'blocker.reason', errors);
      pushText(data.blocker.recovery_condition, 'blocker.recovery_condition', errors);
    }
  } else if (data.blocker !== null && data.blocker !== undefined) {
    errors.push('非 blocked 状态的 blocker 必须为 null 或省略');
  }
  if (requireReady && requirement.required && data.status !== 'ready') {
    errors.push(`当前 Intent 需要外部能力获取，Expertise Pack 必须为 ready（当前: ${data.status}）`);
  }
  if (errors.length) throw new Error(`Expertise Pack 校验失败:\n  - ${errors.join('\n  - ')}`);
  return {
    valid: true,
    required: requirement.required,
    intent_id: intentId,
    intent_revision: data.intent_revision,
    status: data.status,
    required_node_ids: requirement.required_node_ids,
    source_count: data.sources.length,
    external_source_count: sourceResult.externalCount,
    capsule_count: data.capsules.length,
    pack_digest: createHash('sha256').update(JSON.stringify(data)).digest('hex'),
    path,
  };
}

export function getExpertisePack(versionDir, intentId) {
  const path = getExpertisePackPath(versionDir, intentId);
  if (!existsSync(path)) throw new Error(`Expertise Pack 不存在: ${path}`);
  const pack = readJsonFile(path, 'Expertise Pack');
  validateExpertisePack(versionDir, intentId, pack, { requireReady: false });
  return pack;
}

export function initExpertisePack(versionDir, intentId) {
  const requirement = getExpertiseRequirement(versionDir, intentId);
  if (!requirement.required) {
    throw new Error(`${intentId} 当前没有外部能力获取强门；只有显式 external_required 或未显式豁免的高影响 capability 才需要持久化 Expertise Pack`);
  }
  const path = getExpertisePackPath(versionDir, intentId);
  if (existsSync(path)) throw new Error(`Expertise Pack 已存在，不会覆盖: ${path}`);
  const templatePath = join(getLoomRoot(), 'templates', 'EXPERTISE_PACK_TEMPLATE.json');
  const pack = JSON.parse(readFileSync(templatePath, 'utf-8'));
  pack._meta._loom_version = basename(versionDir);
  pack.intent_id = intentId;
  pack.intent_revision = requirement.intent.revision ?? 1;
  pack.required_capability_refs = requirement.required_node_ids;
  mkdirSync(getExpertisePacksDir(versionDir), { recursive: true });
  writeFileSync(path, `${JSON.stringify(pack, null, 2)}\n`, { encoding: 'utf-8', flag: 'wx' });
  return pack;
}

export function getExpertisePackState(versionDir, intentId) {
  const requirement = getExpertiseRequirement(versionDir, intentId);
  const path = getExpertisePackPath(versionDir, intentId);
  if (!requirement.required) {
    return { required: false, ready: true, path, required_node_ids: [] };
  }
  if (!existsSync(path)) {
    return { required: true, ready: false, path, required_node_ids: requirement.required_node_ids, reason: 'missing' };
  }
  try {
    const validation = validateExpertisePack(versionDir, intentId, null, { requireReady: false });
    const ready = validation.status === 'ready';
    const pack = ready ? null : readJsonFile(path, 'Expertise Pack');
    const reason = ready
      ? undefined
      : validation.status === 'blocked'
        ? `blocked: ${pack.blocker.reason}`
        : `status=${validation.status}`;
    return { required: true, ready, path, required_node_ids: requirement.required_node_ids, validation, reason };
  } catch (error) {
    return { required: true, ready: false, path, required_node_ids: requirement.required_node_ids, reason: error.message };
  }
}

export function assertExpertiseReady(versionDir, intentId) {
  const state = getExpertisePackState(versionDir, intentId);
  if (!state.required) return null;
  if (!state.ready) {
    const action = state.reason === 'missing'
      ? `先运行 loom expertise init ${intentId}，通过 find skill 与网络搜索获取外部信息，完成后运行 loom expertise validate ${intentId}`
      : `修正 10_EXPERTISE_PACKS/${intentId}.json 后运行 loom expertise validate ${intentId}`;
    throw new Error(`${intentId} 的外部能力获取强门尚未闭合: ${state.reason || 'Expertise Pack not ready'}\n${action}`);
  }
  return state.validation;
}

export function formatExpertisePackForPrompt(pack) {
  const lines = [
    `- decision_question: ${pack.search_plan.decision_question}`,
    `- sources: ${pack.sources.map((source) => `${source.id} ${source.title} (${source.locator})`).join('; ')}`,
  ];
  for (const capsule of pack.capsules) {
    lines.push(
      `\n### Capability Capsule: ${capsule.capability_ref}`,
      `- professional_problem: ${capsule.professional_problem}`,
      `- when_to_use: ${capsule.when_to_use}`,
      `- rules:\n${capsule.rules.map((item) => `  - ${item}`).join('\n')}`,
      `- workflow:\n${capsule.workflow.map((item) => `  - ${item}`).join('\n')}`,
      `- decision_gates:\n${capsule.decision_gates.map((item) => `  - ${item}`).join('\n')}`,
      `- failure_modes:\n${capsule.failure_modes.map((item) => `  - ${item}`).join('\n')}`,
      `- verification_signals:\n${capsule.verification_signals.map((item) => `  - ${item}`).join('\n')}`,
      `- source_refs: ${capsule.source_refs.join(', ')}`,
    );
  }
  return lines.join('\n');
}
