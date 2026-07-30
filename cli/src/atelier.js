// atelier.js — Atelier Record 的创建、读取与结构校验。
// 只管理可审计创作记录；不替 Author 生成方案，也不替 Keeper 判断质量。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { getIntent } from './intent-map.js';
import { getLoomRoot } from './shared/paths.js';
import { readJsonFile } from './shared/md-utils.js';

const VALID_STATUS = ['draft', 'exploring', 'compared', 'selected', 'baseline_retained', 'blocked'];
const CORRECTION_CLASSIFICATIONS = ['local_stance', 'graph_candidate', 'reflow', 'learning_candidate'];

function recordPath(versionDir, intentId) {
  return join(versionDir, '09_ATELIER', `${intentId}.json`);
}

function pushText(value, field, errors) {
  if (typeof value !== 'string' || value.trim() === '') errors.push(`${field} 必须是非空字符串`);
}

function pushStringArray(value, field, errors, { nonEmpty = false } = {}) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    errors.push(`${field} 必须是非空字符串数组`);
  } else if (nonEmpty && value.length === 0) {
    errors.push(`${field} 不能为空`);
  }
}

function artifactRef(versionDir, intentId, value, field, errors) {
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${field} 必须是非空 artifact 引用`);
    return;
  }
  const normalized = value.replaceAll('\\', '/');
  const expectedPrefix = `09_ATELIER/files/${intentId}/`;
  const absolute = resolve(versionDir, normalized);
  const rel = relative(versionDir, absolute);
  if (!normalized.startsWith(expectedPrefix) || rel.startsWith('..') || isAbsolute(rel)) {
    errors.push(`${field} 必须位于当前 Intent 的 ${expectedPrefix}`);
    return;
  }
  if (!existsSync(absolute)) errors.push(`${field} 引用不存在: ${normalized}`);
}

function validateStance(record, errors) {
  if (!record.stance || typeof record.stance !== 'object' || Array.isArray(record.stance)) {
    errors.push('stance 必须是对象');
    return;
  }
  if (record.status === 'draft' || record.status === 'blocked') return;
  const stance = record.stance;
  pushText(stance.creative_thesis, 'stance.creative_thesis', errors);
  pushStringArray(stance.gaze, 'stance.gaze', errors, { nonEmpty: true });
  pushText(stance.tension, 'stance.tension', errors);
  if (!stance.signature_bet || typeof stance.signature_bet !== 'object' || Array.isArray(stance.signature_bet)) {
    errors.push('stance.signature_bet 必须是对象');
  } else {
    pushText(stance.signature_bet.claim, 'stance.signature_bet.claim', errors);
    pushText(stance.signature_bet.mechanism, 'stance.signature_bet.mechanism', errors);
    pushText(stance.signature_bet.cost, 'stance.signature_bet.cost', errors);
  }
  pushStringArray(stance.refusals, 'stance.refusals', errors, { nonEmpty: true });
  if (!stance.medium_grammar || typeof stance.medium_grammar !== 'object' || Array.isArray(stance.medium_grammar) || Object.keys(stance.medium_grammar).length === 0) {
    errors.push('stance.medium_grammar 必须是非空对象');
  }
  if (!stance.surprise_budget || typeof stance.surprise_budget !== 'object' || Array.isArray(stance.surprise_budget)) {
    errors.push('stance.surprise_budget 必须是对象');
  } else {
    if (!['low', 'medium', 'high'].includes(stance.surprise_budget.level)) {
      errors.push('stance.surprise_budget.level 必须是 low|medium|high');
    }
    pushText(stance.surprise_budget.allowed, 'stance.surprise_budget.allowed', errors);
    pushText(stance.surprise_budget.protected, 'stance.surprise_budget.protected', errors);
  }
  pushStringArray(stance.anti_fixation, 'stance.anti_fixation', errors, { nonEmpty: true });
  pushStringArray(stance.verification_lens, 'stance.verification_lens', errors, { nonEmpty: true });
}

function validateCorrections(versionDir, intentId, record, errors) {
  if (!Array.isArray(record.corrections)) {
    errors.push('corrections 必须是数组');
    return;
  }
  const local = [];
  for (const [index, correction] of record.corrections.entries()) {
    const prefix = `corrections[${index}]`;
    if (!correction || typeof correction !== 'object' || Array.isArray(correction)) {
      errors.push(`${prefix} 必须是对象`);
      continue;
    }
    if (!Number.isInteger(correction.round) || correction.round < 1) errors.push(`${prefix}.round 必须是正整数`);
    pushText(correction.trigger, `${prefix}.trigger`, errors);
    artifactRef(versionDir, intentId, correction.evidence_ref, `${prefix}.evidence_ref`, errors);
    if (!CORRECTION_CLASSIFICATIONS.includes(correction.classification)) {
      errors.push(`${prefix}.classification 必须是 ${CORRECTION_CLASSIFICATIONS.join('|')}`);
    }
    pushText(correction.change, `${prefix}.change`, errors);
    if (correction.classification === 'local_stance') {
      if (!Number.isInteger(correction.from_stance_revision) || correction.from_stance_revision < 1) {
        errors.push(`${prefix}.from_stance_revision 必须是正整数`);
      }
      if (correction.to_stance_revision !== correction.from_stance_revision + 1) {
        errors.push(`${prefix}.to_stance_revision 必须恰好递增 1`);
      }
      local.push(correction);
    }
    if (correction.classification === 'graph_candidate') {
      if (typeof correction.proposal_ref !== 'string' || !/^CGP-[A-Z0-9-]+$/.test(correction.proposal_ref)) {
        errors.push(`${prefix}.proposal_ref 必须是 CGP-* ID`);
      } else if (!existsSync(join(versionDir, '07_GRAPH_PROPOSALS', `${correction.proposal_ref}.json`))) {
        errors.push(`${prefix}.proposal_ref 引用不存在: ${correction.proposal_ref}`);
      }
    }
  }
  const ordered = [...local].sort((a, b) => a.to_stance_revision - b.to_stance_revision);
  for (let index = 0; index < ordered.length; index += 1) {
    const expectedFrom = index + 1;
    if (ordered[index].from_stance_revision !== expectedFrom) {
      errors.push(`local_stance corrections 必须形成从 1 开始的连续 revision 链`);
      break;
    }
  }
  if (record.stance_revision !== ordered.length + 1) {
    errors.push(`stance_revision=${record.stance_revision} 与 local_stance corrections 数量不一致（应为 ${ordered.length + 1}）`);
  }
}

function validateCandidates(versionDir, intentId, record, errors) {
  if (!Array.isArray(record.candidates)) {
    errors.push('candidates 必须是数组');
    return new Map();
  }
  const candidates = new Map();
  for (const [index, candidate] of record.candidates.entries()) {
    const prefix = `candidates[${index}]`;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      errors.push(`${prefix} 必须是对象`);
      continue;
    }
    pushText(candidate.id, `${prefix}.id`, errors);
    if (typeof candidate.id === 'string' && candidate.id.trim()) {
      if (candidates.has(candidate.id)) errors.push(`candidate id 重复: ${candidate.id}`);
      candidates.set(candidate.id, candidate);
    }
    if (!Number.isInteger(candidate.stance_revision) || candidate.stance_revision < 1 || candidate.stance_revision > record.stance_revision) {
      errors.push(`${prefix}.stance_revision 必须位于 1..${record.stance_revision}`);
    }
    if (candidate.stance_revision !== record.stance_revision
      && candidate.archived !== true
      && candidate.requalified_for_stance_revision !== record.stance_revision) {
      errors.push(`${prefix} 来自旧 Stance；必须 archived=true 或 requalified_for_stance_revision=${record.stance_revision}`);
    }
    pushText(candidate.mechanism, `${prefix}.mechanism`, errors);
    if (!Array.isArray(candidate.artifact_refs) || candidate.artifact_refs.length === 0) {
      errors.push(`${prefix}.artifact_refs 不能为空`);
    } else {
      candidate.artifact_refs.forEach((ref, refIndex) => artifactRef(versionDir, intentId, ref, `${prefix}.artifact_refs[${refIndex}]`, errors));
    }
    if (!['passed', 'failed', 'pending'].includes(candidate.floor_check)) {
      errors.push(`${prefix}.floor_check 必须是 passed|failed|pending`);
    }
    if (candidate.floor_check === 'passed') pushText(candidate.floor_evidence, `${prefix}.floor_evidence`, errors);
  }
  return candidates;
}

function validateDiversityAxes(record, errors) {
  if (!Array.isArray(record.diversity_axes)) {
    errors.push('diversity_axes 必须是数组');
    return new Set();
  }
  if (!['draft', 'blocked'].includes(record.status) && record.diversity_axes.length < 2) {
    errors.push('Atelier 探索至少需要两个 diversity_axes');
  }
  const ids = new Set();
  for (const [index, axis] of record.diversity_axes.entries()) {
    const prefix = `diversity_axes[${index}]`;
    if (!axis || typeof axis !== 'object' || Array.isArray(axis)) {
      errors.push(`${prefix} 必须是对象`);
      continue;
    }
    pushText(axis.id, `${prefix}.id`, errors);
    if (typeof axis.id === 'string' && axis.id.trim()) {
      if (ids.has(axis.id)) errors.push(`diversity axis id 重复: ${axis.id}`);
      ids.add(axis.id);
    }
    pushText(axis.low, `${prefix}.low`, errors);
    pushText(axis.high, `${prefix}.high`, errors);
    pushText(axis.why, `${prefix}.why`, errors);
    if (typeof axis.low === 'string' && typeof axis.high === 'string' && axis.low.trim() === axis.high.trim()) {
      errors.push(`${prefix}.low 与 high 必须形成真实差异`);
    }
  }
  return ids;
}

function validateSelection(versionDir, intentId, record, candidates, errors) {
  if (!record.selection || typeof record.selection !== 'object' || Array.isArray(record.selection)) {
    errors.push('selection 必须是对象');
    return;
  }
  const selection = record.selection;
  if (!['pending', 'selected', 'baseline_retained'].includes(selection.status)) {
    errors.push('selection.status 必须是 pending|selected|baseline_retained');
  }
  if (!['selected', 'baseline_retained'].includes(record.status) && selection.status !== 'pending') {
    errors.push(`Record status=${record.status} 时 selection.status 必须为 pending`);
  }
  if (selection.status === 'pending' && selection.selected_candidate !== null) {
    errors.push('selection.status=pending 时 selected_candidate 必须为 null');
  }
  const candidateCount = Array.isArray(record.candidates) ? record.candidates.length : 0;
  if (['compared', 'selected'].includes(record.status) && candidateCount < 2) {
    errors.push(`${record.status} 状态至少需要两个机制不同候选`);
  }
  if (record.status === 'selected') {
    if (selection.status !== 'selected') errors.push('Record status=selected 时 selection.status 必须为 selected');
    const selected = candidates.get(selection.selected_candidate);
    if (!selected) errors.push('selection.selected_candidate 必须引用存在的候选');
    else if (selected.floor_check !== 'passed') errors.push('selected candidate 必须通过 Reliability Floor');
    else if (selected.stance_revision !== record.stance_revision
      && selected.requalified_for_stance_revision !== record.stance_revision) {
      errors.push('selected candidate 必须属于当前 Stance 或已重新资格检查');
    }
  }
  if (record.status === 'baseline_retained' && selection.status !== 'baseline_retained') {
    errors.push('Record status=baseline_retained 时 selection.status 必须为 baseline_retained');
  }
  if (record.status === 'baseline_retained' && candidateCount < 1) {
    errors.push('baseline_retained 至少需要一个接受过比较的候选');
  }
  if (record.status === 'baseline_retained' && selection.selected_candidate !== null) {
    errors.push('baseline_retained 时 selection.selected_candidate 必须为 null');
  }
  if (['selected', 'baseline_retained'].includes(record.status)) {
    pushText(selection.method, 'selection.method', errors);
    pushText(selection.why, 'selection.why', errors);
    pushText(selection.remaining_tradeoff, 'selection.remaining_tradeoff', errors);
    if (!Array.isArray(selection.evidence_refs) || selection.evidence_refs.length === 0) {
      errors.push('selection.evidence_refs 不能为空');
    } else {
      selection.evidence_refs.forEach((ref, index) => artifactRef(versionDir, intentId, ref, `selection.evidence_refs[${index}]`, errors));
    }
  }
}

export function validateAtelierRecord(versionDir, intentId, record = null) {
  const intent = getIntent(versionDir, intentId);
  if ((intent.quality_strategy ?? 'adaptive') !== 'atelier') {
    throw new Error(`${intentId} 未启用 quality_strategy=atelier`);
  }
  const path = recordPath(versionDir, intentId);
  const data = record ?? readJsonFile(path, 'Atelier Record');
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Atelier Record 校验失败:\n  - 根节点必须是对象');
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
  if (data.intent_revision !== (intent.revision ?? 1)) {
    errors.push(`intent_revision=${data.intent_revision} 已过期；当前为 ${intent.revision ?? 1}`);
  }
  if (!VALID_STATUS.includes(data.status)) errors.push(`status 必须是 ${VALID_STATUS.join('|')}`);
  if (!Number.isInteger(data.stance_revision) || data.stance_revision < 1) errors.push('stance_revision 必须是正整数');
  validateStance(data, errors);
  if (!data.baseline || typeof data.baseline !== 'object' || Array.isArray(data.baseline)) {
    errors.push('baseline 必须是对象');
  } else if (!['draft', 'blocked'].includes(data.status)) {
    pushText(data.baseline.observed_limit, 'baseline.observed_limit', errors);
    if (!Array.isArray(data.baseline.artifact_refs) || data.baseline.artifact_refs.length === 0) {
      errors.push('baseline.artifact_refs 不能为空');
    } else {
      data.baseline.artifact_refs.forEach((ref, index) => artifactRef(versionDir, intentId, ref, `baseline.artifact_refs[${index}]`, errors));
    }
  }
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
  validateDiversityAxes(data, errors);
  validateCorrections(versionDir, intentId, data, errors);
  const candidates = validateCandidates(versionDir, intentId, data, errors);
  validateSelection(versionDir, intentId, data, candidates, errors);
  if (errors.length) throw new Error(`Atelier Record 校验失败:\n  - ${errors.join('\n  - ')}`);
  return {
    valid: true,
    intent_id: intentId,
    intent_revision: data.intent_revision,
    stance_revision: data.stance_revision,
    status: data.status,
    path,
  };
}

export function getAtelierRecord(versionDir, intentId) {
  const path = recordPath(versionDir, intentId);
  if (!existsSync(path)) throw new Error(`Atelier Record 不存在: ${path}`);
  const record = readJsonFile(path, 'Atelier Record');
  validateAtelierRecord(versionDir, intentId, record);
  return record;
}

export function initAtelierRecord(versionDir, intentId) {
  const intent = getIntent(versionDir, intentId);
  if ((intent.quality_strategy ?? 'adaptive') !== 'atelier') {
    throw new Error(`${intentId} 未启用 quality_strategy=atelier；由 Architect 先声明质量契约、创作空间和策略`);
  }
  const path = recordPath(versionDir, intentId);
  if (existsSync(path)) throw new Error(`Atelier Record 已存在，不会覆盖: ${path}`);
  const templatePath = join(getLoomRoot(), 'templates', 'ATELIER_RECORD_TEMPLATE.json');
  const record = JSON.parse(readFileSync(templatePath, 'utf-8'));
  record._meta._loom_version = basename(versionDir);
  record.intent_id = intentId;
  record.intent_revision = intent.revision ?? 1;
  mkdirSync(join(versionDir, '09_ATELIER', 'files', intentId), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf-8', flag: 'wx' });
  return record;
}
