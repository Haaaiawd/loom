// intent-map.js — Intent Map 的加载、校验、查询
// 真相源是磁盘上的 04_INTENT_MAP.json，这个库负责按需查询，不返回整个文件。

import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { extractMdSection, readJsonFile } from './shared/md-utils.js';
import { formatIntentRef, INTENT_ID_PATTERN, VERSION_PATTERN } from './shared/intent-ref.js';
import { commandCoversVerificationMethod, getIntentVerificationMethod } from './shared/verification-method.js';
import { resolveQualityProofReference } from './shared/proof-reference.js';

/** 必填字段（INTENT_LOOP.md 底线） */
const REQUIRED_FIELDS = ['id', 'title', 'narrative_ref', 'depends_on', 'acceptance', 'philosophy_anchors', 'status'];

/** 合法 status 值和唯一状态转换表。guide、命令和测试都应遵循这里。 */
export const VALID_STATUS = ['pending', 'in_progress', 'completed', 'blocked', 'needs_review'];
export const VALID_TRANSITIONS = {
  pending: ['in_progress', 'blocked'],
  in_progress: ['completed', 'blocked'],
  completed: ['needs_review'],
  blocked: ['pending'],
  needs_review: ['in_progress', 'completed', 'blocked'],
};

const LEGACY_REVISION = Symbol('legacyIntentRevision');

/** 意图叙事引用格式: 01_VISION.md#anchor */
const NARRATIVE_REF_RE = /^(?:see\s+)?([^#]+)#([\w-]+)$/i;
const NARRATIVE_FILE = '01_VISION.md';

function parseNarrativeRef(ref, label = 'narrative_ref') {
  if (typeof ref !== 'string') {
    throw new Error(`${label} 必须是字符串`);
  }
  const match = ref.trim().match(NARRATIVE_REF_RE);
  if (!match) {
    throw new Error(`${label} 格式非法: ${ref}（应为 ${NARRATIVE_FILE}#<anchor>）`);
  }
  const file = match[1].trim();
  if (basename(file) !== file || file !== NARRATIVE_FILE) {
    throw new Error(`${label} 只能指向 ${NARRATIVE_FILE}: ${ref}`);
  }
  return { file, section: match[2].trim() };
}

function withEffectiveRevision(intent) {
  if (intent.revision !== undefined) return intent;
  const effective = { ...intent, revision: 1 };
  Object.defineProperty(effective, LEGACY_REVISION, { value: true });
  return effective;
}

export function hasLegacyIntentRevision(intent) {
  return intent.revision === undefined || intent[LEGACY_REVISION] === true;
}

/** A reflow can invalidate evidence without changing an Intent's semantic revision. */
export function getEffectiveVerificationEpoch(intent) {
  return intent?.verification_epoch ?? 1;
}

/**
 * 加载 Intent Map 文件。
 * @param {string} versionDir — .loom/v{N}/ 目录的绝对路径
 * @returns {{ _meta: object, intents: Record<string, object>, topo_order: string[] }}
 */
export function loadIntentMap(versionDir) {
  const filePath = join(versionDir, '04_INTENT_MAP.json');
  const data = readJsonFile(filePath, 'Intent Map');
  validateIntentMap(data);
  return data;
}

/**
 * 校验 Intent Map 结构合规性（INTENT_LOOP.md I-1, I-2 底线）。
 * 抛出错误列表，不静默修复。
 */
export function validateIntentMap(data) {
  const errors = [];

  if (!data.intents || typeof data.intents !== 'object') {
    errors.push('缺少 intents 对象');
    throw new Error(`Intent Map 校验失败:\n  - ${errors.join('\n  - ')}`);
  }

  if (!Array.isArray(data.topo_order)) {
    errors.push('缺少 topo_order 数组');
  }

  for (const [id, intent] of Object.entries(data.intents)) {
    if (intent.id !== id) {
      errors.push(`intents["${id}"].id 与 key 不一致 (实际: "${intent.id}")`);
    }
    for (const field of REQUIRED_FIELDS) {
      if (!(field in intent)) {
        errors.push(`intents["${id}"] 缺少必填字段: ${field}`);
      }
    }

    if (!Array.isArray(intent.depends_on)) {
      errors.push(`intents["${id}"].depends_on 必须是数组`);
    } else {
      for (const dep of intent.depends_on) {
        if (!INTENT_ID_PATTERN.test(dep || '')) {
          errors.push(`intents["${id}"].depends_on 含非法 Intent ID: ${dep}`);
        }
      }
    }

    if (!Array.isArray(intent.philosophy_anchors)) {
      errors.push(`intents["${id}"].philosophy_anchors 必须是字符串数组`);
    } else {
      for (const [index, anchor] of intent.philosophy_anchors.entries()) {
        if (typeof anchor !== 'string' || anchor.trim() === '') {
          errors.push(`intents["${id}"].philosophy_anchors[${index}] 必须是合法锚点`);
        } else {
          const file = anchor.split('#')[0]?.trim();
          if (!file || basename(file) !== file || !file.endsWith('.md')) {
            errors.push(`intents["${id}"].philosophy_anchors[${index}] 文件部分必须是 .md 文件名（无路径）: ${anchor}`);
          }
        }
      }
    }

    try {
      parseNarrativeRef(intent.narrative_ref);
    } catch (error) {
      errors.push(`intents["${id}"].${error.message}`);
    }

    if (intent.status && !VALID_STATUS.includes(intent.status)) {
      errors.push(`intents["${id}"].status 非法: "${intent.status}" (合法: ${VALID_STATUS.join('|')})`);
    }
    if ('revision' in intent && (!Number.isInteger(intent.revision) || intent.revision < 1)) {
      errors.push(`intents["${id}"].revision 非法: ${JSON.stringify(intent.revision)} (必须是正整数)`);
    }
    if ('verification_epoch' in intent && (!Number.isInteger(intent.verification_epoch) || intent.verification_epoch < 1)) {
      errors.push(`intents["${id}"].verification_epoch 非法: ${JSON.stringify(intent.verification_epoch)} (必须是正整数)`);
    }
    validateLineage(data, id, intent.lineage, errors);
    validateLifecycle(data, id, intent.lifecycle, errors);
    validateOptionalIntentFields(id, intent, errors);
    if (Array.isArray(intent.depends_on)) {
      for (const dep of intent.depends_on) {
        if (!(dep in data.intents)) {
          errors.push(`intents["${id}"].depends_on 引用了不存在的 Intent: ${dep}`);
        }
        // 依赖状态一致性：completed 的 Intent 不能依赖 blocked 的 Intent
        const depIntent = data.intents[dep];
        if (depIntent && intent.status === 'completed' && depIntent.status === 'blocked') {
          errors.push(`intents["${id}"] 状态为 completed 但依赖 blocked 的 ${dep}`);
        }
      }
    }
    // acceptance 质量底线（IM-2）：必须具体到可验证，不能是占位符
    if (intent.acceptance && typeof intent.acceptance === 'string') {
      const acc = intent.acceptance.trim();
      if (acc === '...' || acc === '' || acc.length < 20) {
        errors.push(
          `intents["${id}"].acceptance 太短（${acc.length}字符）——必须是具体可验证的契约，不能是占位符。\n` +
          `    acceptance 应包含功能承诺 + 防御承诺（见 INTENT_LOOP.md IM-2 "acceptance 承诺分层"）。`
        );
      }
    }
  }

  // topo_order 必须覆盖所有 Intent
  if (Array.isArray(data.topo_order)) {
    const topoSet = new Set(data.topo_order);
    if (topoSet.size !== data.topo_order.length) errors.push('topo_order 含重复 Intent');
    for (const id of data.topo_order) {
      if (!(id in data.intents)) errors.push(`topo_order 含不存在的 Intent: ${id}`);
    }
    for (const id of Object.keys(data.intents)) {
      if (!topoSet.has(id)) {
        errors.push(`topo_order 缺少 Intent: ${id}`);
      }
    }
    const positions = new Map(data.topo_order.map((id, index) => [id, index]));
    for (const [id, intent] of Object.entries(data.intents)) {
      const deps = Array.isArray(intent.depends_on) ? intent.depends_on : [];
      for (const dependency of deps) {
        if (positions.has(dependency) && positions.has(id) && positions.get(dependency) >= positions.get(id)) {
          errors.push(`topo_order 顺序非法: ${dependency} 必须位于 ${id} 之前`);
        }
      }
    }
    try {
      computeTopoOrder(data.intents, data.topo_order);
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Intent Map 校验失败:\n  - ${errors.join('\n  - ')}`);
  }
}

function validateLifecycle(data, id, lifecycle, errors) {
  if (lifecycle === undefined) return;
  const prefix = `intents["${id}"].lifecycle`;
  if (!lifecycle || typeof lifecycle !== 'object' || Array.isArray(lifecycle)) {
    errors.push(`${prefix} 必须是对象`);
    return;
  }
  if (lifecycle.deprecation === undefined) return;
  const deprecation = lifecycle.deprecation;
  const deprecationPrefix = `${prefix}.deprecation`;
  if (!deprecation || typeof deprecation !== 'object' || Array.isArray(deprecation)) {
    errors.push(`${deprecationPrefix} 必须是对象`);
    return;
  }
  if (typeof deprecation.deprecated_at !== 'string' || Number.isNaN(Date.parse(deprecation.deprecated_at))) {
    errors.push(`${deprecationPrefix}.deprecated_at 必须是 ISO 8601 时间戳`);
  }
  if (typeof deprecation.reason !== 'string' || deprecation.reason.trim() === '') {
    errors.push(`${deprecationPrefix}.reason 必须是非空字符串`);
  }
  if (!('replacement' in deprecation) || (deprecation.replacement !== null && typeof deprecation.replacement !== 'string')) {
    errors.push(`${deprecationPrefix}.replacement 必须是 Intent ID 或 null`);
  } else if (typeof deprecation.replacement === 'string') {
    if (deprecation.replacement === id) errors.push(`${deprecationPrefix}.replacement 不能引用自身`);
    else if (!(deprecation.replacement in data.intents)) errors.push(`${deprecationPrefix}.replacement 引用了不存在的当前 Intent: ${deprecation.replacement}`);
  }
}

function validateOptionalIntentFields(id, intent, errors) {
  const prefix = `intents["${id}"]`;

  if ('continuity_required' in intent && typeof intent.continuity_required !== 'boolean') {
    errors.push(`${prefix}.continuity_required 必须是布尔值；仅在本 Intent 会变更既有用户或系统状态且必须证明未误伤旧状态时设为 true`);
  }

  if ('quality_contract' in intent) {
    if (typeof intent.quality_contract !== 'string' || intent.quality_contract.trim().length < 10) {
      errors.push(`${prefix}.quality_contract 必须是非空质量契约或 05_VERIFICATION.md 章节引用`);
    } else if (/^(?:\.{3}|…|todo|tbd|待填)$/i.test(intent.quality_contract.trim())) {
      errors.push(`${prefix}.quality_contract 不能是占位符`);
    }
  }

  if ('capability_needs' in intent) {
    if (!Array.isArray(intent.capability_needs)) {
      errors.push(`${prefix}.capability_needs 必须是字符串数组`);
    } else {
      const normalized = [];
      for (const [index, need] of intent.capability_needs.entries()) {
        if (typeof need !== 'string' || need.trim().length < 2) {
          errors.push(`${prefix}.capability_needs[${index}] 必须是非空专业领域`);
        } else {
          normalized.push(need.trim().toLowerCase());
        }
      }
      if (new Set(normalized).size !== normalized.length) {
        errors.push(`${prefix}.capability_needs 含重复专业领域`);
      }
    }
  }

  if ('creative_scope' in intent) {
    if (typeof intent.creative_scope !== 'string' || intent.creative_scope.trim().length < 10) {
      errors.push(`${prefix}.creative_scope 必须说明可以改变什么、必须保持什么`);
    }
  }
}

function validateLineage(data, id, lineage, errors) {
  if (lineage === undefined) return;
  const prefix = `intents["${id}"].lineage`;
  if (!lineage || typeof lineage !== 'object' || Array.isArray(lineage)) {
    errors.push(`${prefix} 必须是对象`);
    return;
  }
  if (!Array.isArray(lineage.predecessors)) {
    errors.push(`${prefix}.predecessors 必须是数组`);
  } else {
    const seen = new Set();
    for (const [index, predecessor] of lineage.predecessors.entries()) {
      const refPrefix = `${prefix}.predecessors[${index}]`;
      if (!predecessor || typeof predecessor !== 'object' || Array.isArray(predecessor)) {
        errors.push(`${refPrefix} 必须是 { version, intent_id } 对象`);
        continue;
      }
      if (!VERSION_PATTERN.test(predecessor.version || '')) errors.push(`${refPrefix}.version 格式非法`);
      if (!INTENT_ID_PATTERN.test(predecessor.intent_id || '')) errors.push(`${refPrefix}.intent_id 格式非法`);
      const ref = `${predecessor.version}:${predecessor.intent_id}`;
      if (seen.has(ref)) errors.push(`${prefix}.predecessors 含重复引用: ${ref}`);
      seen.add(ref);
      if (predecessor.version === data._meta?._loom_version && predecessor.intent_id === id) {
        errors.push(`${prefix} 不能自引用: ${ref}`);
      }
    }
  }
  if (typeof lineage.change_summary !== 'string' || lineage.change_summary.trim() === '') {
    errors.push(`${prefix}.change_summary 必须是非空字符串`);
  }
  if ('change_ref' in lineage && (typeof lineage.change_ref !== 'string' || lineage.change_ref.trim() === '')) {
    errors.push(`${prefix}.change_ref 必须是非空字符串`);
  }
}

const NON_SEMANTIC_FIELDS = new Set(['id', 'revision', 'status', 'lineage', '_runtime']);

function semanticIntent(intent) {
  return Object.fromEntries(Object.entries(intent).filter(([key]) => !NON_SEMANTIC_FIELDS.has(key)));
}

function changedSemanticFields(before, after) {
  const a = semanticIntent(before);
  const b = semanticIntent(after);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]))
    .sort();
}

/** Compare Intent semantics using only explicit target-version predecessor references. */
export function diffIntentVersions(loomRoot, fromVersion, toVersion) {
  const from = fromVersion.startsWith('v') ? fromVersion : `v${fromVersion}`;
  const to = toVersion.startsWith('v') ? toVersion : `v${toVersion}`;
  if (!VERSION_PATTERN.test(from) || !VERSION_PATTERN.test(to)) throw new Error('版本格式应为 v1、v2 等');
  const fromMap = loadIntentMap(join(loomRoot, from));
  const toMap = loadIntentMap(join(loomRoot, to));
  const sourceToTargets = new Map(Object.keys(fromMap.intents).map((id) => [id, []]));
  const targetMappings = new Map();
  const targetLineages = new Map();
  const warnings = [];

  for (const [targetId, target] of Object.entries(toMap.intents)) {
    const refs = target.lineage?.predecessors || [];
    const mapped = refs.filter((ref) => ref.version === from);
    targetLineages.set(targetId, refs);
    targetMappings.set(targetId, mapped);
    for (const ref of mapped) {
      if (fromMap.intents[ref.intent_id]) sourceToTargets.get(ref.intent_id).push(targetId);
      else warnings.push(`${formatIntentRef(to, targetId)} 引用了不存在的 predecessor ${formatIntentRef(from, ref.intent_id)}`);
    }
    if (fromMap.intents[targetId] && !mapped.some((ref) => ref.intent_id === targetId)) {
      warnings.push(`${formatIntentRef(from, targetId)} 与 ${formatIntentRef(to, targetId)} ID 相同但没有显式 lineage，不作映射`);
    }
    if (refs.length > 0 && mapped.length === 0) {
      warnings.push(`${formatIntentRef(to, targetId)} 没有指向比较源版本 ${from} 的 predecessor`);
    }
  }

  const split = [...sourceToTargets.entries()]
    .filter(([, targets]) => targets.length > 1)
    .map(([sourceId, targets]) => ({ from: formatIntentRef(from, sourceId), to: targets.map((id) => formatIntentRef(to, id)) }));
  const merged = [...targetMappings.entries()]
    .filter(([, refs]) => refs.filter((ref) => fromMap.intents[ref.intent_id]).length > 1)
    .map(([targetId, refs]) => ({ from: refs.filter((ref) => fromMap.intents[ref.intent_id]).map((ref) => formatIntentRef(from, ref.intent_id)), to: formatIntentRef(to, targetId) }));
  const revised = [];
  const unchanged = [];
  for (const [targetId, refs] of targetMappings) {
    const valid = refs.filter((ref) => fromMap.intents[ref.intent_id]);
    if (valid.length !== 1 || sourceToTargets.get(valid[0].intent_id).length !== 1) continue;
    const fields = changedSemanticFields(fromMap.intents[valid[0].intent_id], toMap.intents[targetId]);
    const item = { from: formatIntentRef(from, valid[0].intent_id), to: formatIntentRef(to, targetId), changed_fields: fields };
    (fields.length ? revised : unchanged).push(item);
  }

  const unmappedFrom = [...sourceToTargets.entries()].filter(([, targets]) => targets.length === 0).map(([id]) => formatIntentRef(from, id));
  const unmappedTo = [...targetLineages.entries()]
    .filter(([id, refs]) => refs.length > 0 && !targetMappings.get(id).some((ref) => fromMap.intents[ref.intent_id]))
    .map(([id]) => formatIntentRef(to, id));
  return {
    from,
    to,
    new: Object.entries(toMap.intents)
      .filter(([, intent]) => !intent.lineage?.predecessors?.length)
      .map(([id]) => formatIntentRef(to, id)),
    revised,
    split,
    merged,
    unmapped: [...unmappedFrom, ...unmappedTo],
    unmapped_from: unmappedFrom,
    unmapped_to: unmappedTo,
    unchanged,
    warnings,
  };
}

/** Compute a stable topological order, preferring the previous order where possible. */
export function computeTopoOrder(intents, previousOrder = []) {
  const ids = Object.keys(intents);
  const rank = new Map(previousOrder.map((id, index) => [id, index]));
  const compare = (a, b) => (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER) || a.localeCompare(b);
  const indegree = new Map(ids.map((id) => [id, 0]));
  const dependents = new Map(ids.map((id) => [id, []]));
  for (const [id, intent] of Object.entries(intents)) {
    const deps = Array.isArray(intent.depends_on) ? intent.depends_on : [];
    for (const dependency of deps) {
      if (!indegree.has(dependency)) throw new Error(`${id} 引用了不存在的依赖: ${dependency}`);
      indegree.set(id, indegree.get(id) + 1);
      dependents.get(dependency).push(id);
    }
  }
  const ready = ids.filter((id) => indegree.get(id) === 0).sort(compare);
  const order = [];
  while (ready.length) {
    const id = ready.shift();
    order.push(id);
    for (const dependent of dependents.get(id).sort(compare)) {
      indegree.set(dependent, indegree.get(dependent) - 1);
      if (indegree.get(dependent) === 0) {
        ready.push(dependent);
        ready.sort(compare);
      }
    }
  }
  if (order.length !== ids.length) throw new Error('Intent 依赖图存在循环');
  return order;
}

/**
 * 返回下一个可执行 Intent：
 * status=pending 且 depends_on 全部 completed，按 topo_order 取第一个。
 * @returns {object|null} Intent 对象，或 null（没有可执行的）
 */
export function getNextIntent(versionDir) {
  const { intents, topo_order } = loadIntentMap(versionDir);
  for (const id of topo_order) {
    const intent = intents[id];
    if (intent.lifecycle?.deprecation) continue;
    if (intent.status !== 'pending') continue;
    const deps = Array.isArray(intent.depends_on) ? intent.depends_on : [];
    const depsReady = deps.every(
      (dep) => intents[dep]?.status === 'completed'
    );
    if (depsReady) return withEffectiveRevision(intent);
  }
  return null;
}

/**
 * 返回进度概览：各状态的 Intent 数量 + ID 列表。
 */
export function getStatus(versionDir) {
  const { intents } = loadIntentMap(versionDir);
  const summary = { pending: [], in_progress: [], completed: [], blocked: [], needs_review: [] };
  const titles = {};
  const deprecated = [];
  for (const [id, intent] of Object.entries(intents)) {
    const s = intent.status;
    if (summary[s]) summary[s].push(id);
    titles[id] = intent.title || '';
    if (intent.lifecycle?.deprecation) deprecated.push(id);
  }
  return {
    counts: {
      pending: summary.pending.length,
      in_progress: summary.in_progress.length,
      completed: summary.completed.length,
      blocked: summary.blocked.length,
      needs_review: summary.needs_review.length,
      total: Object.keys(intents).length,
      deprecated: deprecated.length,
    },
    ids: summary,
    titles,
    deprecated,
  };
}

export function dependentClosure(intents, targetId) {
  const direct = Object.values(intents)
    .filter((intent) => intent.depends_on?.includes(targetId))
    .map((intent) => intent.id);
  const seen = new Set(direct);
  const queue = [...direct];
  while (queue.length) {
    const current = queue.shift();
    for (const intent of Object.values(intents)) {
      if (intent.depends_on?.includes(current) && !seen.has(intent.id)) {
        seen.add(intent.id);
        queue.push(intent.id);
      }
    }
  }
  return { direct, transitive: [...seen], all: [...seen] };
}

/** Validate an exact, one-time partition of an impact set. */
export function validateImpactPartition(impactedIds, review = [], unaffected = []) {
  const duplicate = (ids) => ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate(review)) throw new Error(`--review 含重复 ID: ${duplicate(review)}`);
  if (duplicate(unaffected)) throw new Error(`--unaffected 含重复 ID: ${duplicate(unaffected)}`);
  const overlap = review.filter((id) => unaffected.includes(id));
  if (overlap.length) throw new Error(`review 与 unaffected 重叠: ${overlap.join(', ')}`);
  const related = new Set(impactedIds);
  const unrelated = [...review, ...unaffected].filter((id) => !related.has(id));
  if (unrelated.length) throw new Error(`分区包含无关 Intent: ${[...new Set(unrelated)].join(', ')}`);
  const classified = new Set([...review, ...unaffected]);
  const missing = impactedIds.filter((id) => !classified.has(id));
  if (missing.length) throw new Error(`依赖分区不完整，缺少: ${missing.join(', ')}`);
}

/** Apply the canonical completed -> needs_review transition and report every reviewed state. */
export function applyImpactReview(data, review, { incrementPassOnce = false } = {}) {
  const completedIds = [];
  const reviewed = review.map((id) => {
    const intent = data.intents[id];
    const before = intent.status;
    if (before !== 'pending') intent.verification_epoch = getEffectiveVerificationEpoch(intent) + 1;
    if (before === 'completed') {
      if (!VALID_TRANSITIONS.completed.includes('needs_review')) throw new Error('completed 不能进入 needs_review');
      intent.status = 'needs_review';
      completedIds.push(id);
    }
    return { id, status_before: before, status_after: intent.status };
  });
  if (completedIds.length) registerReviewCycle(data, completedIds, incrementPassOnce);
  return { reviewed, completedReviewed: completedIds.length > 0 };
}

/** Track one convergence event while retaining all Intents still being reworked. */
export function registerReviewCycle(data, intentIds, incrementPass = true) {
  if (!intentIds.length) return;
  data._meta ??= {};
  const reviewing = new Set(Array.isArray(data._meta.reviewing_ids) ? data._meta.reviewing_ids : []);
  for (const id of intentIds) reviewing.add(id);
  data._meta.reviewing_ids = [...reviewing];
  if (incrementPass) data._meta.pass_count = (data._meta.pass_count || 0) + 1;
}

function finishReviewCycleIntent(data, intentId) {
  const reviewing = new Set(Array.isArray(data._meta?.reviewing_ids) ? data._meta.reviewing_ids : []);
  if (!reviewing.delete(intentId)) return;
  data._meta.reviewing_ids = [...reviewing];
  if (reviewing.size === 0) {
    data._meta.pass_count = 0;
    delete data._meta.reviewing_ids;
  }
}

function deprecationEntry(intent) {
  return { id: intent.id, title: intent.title || '', status: intent.status };
}

function validateDeprecationTarget(data, intentId, reason) {
  if (typeof reason !== 'string' || reason.trim() === '') throw new Error('--reason 必须是非空文本');
  const target = data.intents[intentId];
  if (!target) throw new Error(`Intent 不存在: ${intentId}`);
  if (target.lifecycle?.deprecation) throw new Error(`Intent ${intentId} 已弃用，不能重复确认`);
  if (target.status !== 'completed') throw new Error(`Intent ${intentId} 必须是 completed 才能弃用（当前: ${target.status}）`);
  return target;
}

/** Assess or atomically confirm deprecation of a completed current-version Intent. */
export function deprecateIntent(versionDir, intentId, options) {
  const filePath = join(versionDir, '04_INTENT_MAP.json');
  const data = readJsonFile(filePath, 'Intent Map');
  validateIntentMap(data);
  const target = validateDeprecationTarget(data, intentId, options.reason);
  const dependents = dependentClosure(data.intents, intentId);
  const describe = (ids) => ids.map((id) => deprecationEntry(data.intents[id]));
  const impact = {
    target: deprecationEntry(target),
    dependents: { direct: describe(dependents.direct), transitive: describe(dependents.transitive) },
  };

  if (!options.confirm) {
    const ids = dependents.all.join(',');
    const escapedReason = options.reason.trim().replace(/"/g, '\\"');
    const command = dependents.all.length
      ? `loom intent deprecate ${intentId} --reason "${escapedReason}" --confirm --review <IDs from ${ids}> --unaffected <remaining IDs from ${ids}>`
      : `loom intent deprecate ${intentId} --reason "${escapedReason}" --confirm`;
    return {
      mode: 'assessment',
      mutated: false,
      ...impact,
      required_partition: dependents.all,
      follow_up: {
        command,
        guidance: dependents.all.length
          ? 'Classify every listed dependent exactly once between --review and --unaffected; omit an empty group.'
          : 'This is a leaf Intent; confirm without --review or --unaffected.',
      },
    };
  }

  const replacement = options.replacement || null;
  if (replacement !== null) {
    if (replacement === intentId) throw new Error('--replacement 必须是另一个当前 Intent');
    if (!(replacement in data.intents)) throw new Error(`replacement 不是当前 Intent: ${replacement}`);
  }
  const review = options.review || [];
  const unaffected = options.unaffected || [];
  validateImpactPartition(dependents.all, review, unaffected);

  const { reviewed } = applyImpactReview(data, review, { incrementPassOnce: true });
  const unchanged = unaffected.map((id) => ({ id, status_before: data.intents[id].status, status_after: data.intents[id].status }));
  target.lifecycle = {
    ...(target.lifecycle || {}),
    deprecation: { deprecated_at: new Date().toISOString(), reason: options.reason.trim(), replacement },
  };
  validateIntentMap(data);
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  try {
    renameSync(tempPath, filePath);
  } catch (error) {
    try { unlinkSync(tempPath); } catch {}
    throw error;
  }
  return { mode: 'confirmed', mutated: true, ...impact, deprecation: target.lifecycle.deprecation, reviewed, unaffected: unchanged };
}

/**
 * 输出 Mermaid 依赖图。
 */
export function getDependencyGraph(versionDir) {
  const { intents, topo_order } = loadIntentMap(versionDir);
  const lines = ['```mermaid', 'graph TD'];
  for (const id of topo_order) {
    const intent = intents[id];
    const shape = intent.status === 'completed' ? ':::done'
      : intent.status === 'blocked' ? ':::blocked'
      : intent.status === 'in_progress' ? ':::active'
      : '';
    lines.push(`  ${id}${shape}`);
    if (intent.depends_on && intent.depends_on.length > 0) {
      for (const dep of intent.depends_on) {
        lines.push(`  ${dep} --> ${id}`);
      }
    }
  }
  lines.push('```');
  return lines.join('\n');
}

/**
 * 按 ID 返回单个 Intent 的完整信息。
 */
export function getIntent(versionDir, intentId) {
  const { intents } = loadIntentMap(versionDir);
  if (!(intentId in intents)) {
    throw new Error(`Intent 不存在: ${intentId}`);
  }
  return withEffectiveRevision(intents[intentId]);
}

/**
 * 更新 Intent 的运行时 status。
 * 只允许合法的状态转换，防止跳变（如 completed→pending）。
 * @param {string} versionDir — .loom/v{N}/ 目录
 * @param {string} intentId — Intent ID
 * @param {string} newStatus — pending | in_progress | completed | blocked
 * @returns {object} 更新后的 Intent
 */
function ensureDepsCompleted(data, intentId) {
  const deps = Array.isArray(data.intents[intentId].depends_on)
    ? data.intents[intentId].depends_on
    : [];
  const incompleteDeps = deps.filter(
    (dep) => data.intents[dep]?.status !== 'completed'
  );
  if (incompleteDeps.length > 0) {
    throw new Error(
      `Intent ${intentId} 的依赖尚未完成: ${incompleteDeps.join(', ')}` +
      '\n先完成依赖，或运行 loom intent next 获取当前可执行 Intent。'
    );
  }
}

export function updateIntentStatus(versionDir, intentId, newStatus) {
  if (!INTENT_ID_PATTERN.test(intentId || '')) {
    throw new Error(`Intent ID 非法: ${intentId || '(empty)'}`);
  }
  if (!VALID_STATUS.includes(newStatus)) {
    throw new Error(`非法 status: "${newStatus}" (合法: ${VALID_STATUS.join('|')})`);
  }

  const filePath = join(versionDir, '04_INTENT_MAP.json');
  const data = readJsonFile(filePath, 'Intent Map');

  if (!(intentId in data.intents)) {
    throw new Error(`Intent 不存在: ${intentId}`);
  }

  const oldStatus = data.intents[intentId].status;
  if (!VALID_TRANSITIONS[oldStatus]?.includes(newStatus)) {
    throw new Error(
      `非法状态转换: ${oldStatus} → ${newStatus}` +
      `\n合法转换: ${oldStatus} → [${VALID_TRANSITIONS[oldStatus]?.join(', ') || '无（终态）'}]`
    );
  }

  // in_progress 和 completed 都必须依赖已经完成；completed 还会额外检查验证记录
  if (newStatus === 'in_progress' || newStatus === 'completed') {
    ensureDepsCompleted(data, intentId, newStatus);
  }

  // completed 是事实声明，不是自由状态标签。无当前 revision 的最后一条 passed
  // 验证时，必须通过 `loom intent done` 的受保护闭合路径，而不是直接 update。
  if (newStatus === 'completed') {
    const verificationPath = join(versionDir, 'verifications', `${intentId}.json`);
    if (!existsSync(verificationPath)) {
      throw new Error(
        `Intent ${intentId} 没有验证记录，不能标记 completed。` +
        `\n先运行 loom verify pass ${intentId} --summary "..."，再运行 loom intent done ${intentId}。`
      );
    }
    const history = readJsonFile(verificationPath, '验证记录');
    const latest = history?.records?.[history.records.length - 1];
    const expectedRevision = data.intents[intentId].revision ?? 1;
    const recordRevision = Number.isInteger(latest?.intent_revision)
      ? latest.intent_revision
      : (data.intents[intentId].revision === undefined ? 1 : null);
    if (latest?.verdict !== 'passed' || recordRevision !== expectedRevision) {
      throw new Error(
        `Intent ${intentId} 缺少当前 revision ${expectedRevision} 的最后一条 passed 验证，不能标记 completed。` +
        `\n先重新验证，再运行 loom intent done ${intentId}。`
      );
    }
    if (data.intents[intentId].quality_contract) {
      const quality = latest.dimensions?.quality_achievement;
      if (quality?.verdict !== 'passed') {
        throw new Error(
          `Intent ${intentId} 含 quality_contract，但最新验证缺少通过的 quality_achievement，不能标记 completed。`
        );
      }
      try {
        resolveQualityProofReference(versionDir, quality.quality_proof_ref);
      } catch (error) {
        throw new Error(`Intent ${intentId} 的 Quality Proof 无效，不能标记 completed：${error.message}`);
      }
    }
    if (data.intents[intentId].continuity_required) {
      const preservation = latest.dimensions?.preservation_achievement;
      if (preservation?.verdict !== 'passed') {
        throw new Error(
          `Intent ${intentId} 声明了 continuity_required，但最新验证缺少通过的 preservation_achievement，不能标记 completed。`
        );
      }
    }
    const expectedEpoch = getEffectiveVerificationEpoch(data.intents[intentId]);
    const recordEpoch = Number.isInteger(latest?.verification_epoch)
      ? latest.verification_epoch
      : (data.intents[intentId].verification_epoch === undefined ? 1 : null);
    if (recordEpoch !== expectedEpoch) {
      throw new Error(
        `Intent ${intentId} 缺少验证代次 ${expectedEpoch} 的最新 passed 记录，不能标记 completed。` +
        '\n回流后必须重新验证，旧证据不能闭合当前 Intent。'
      );
    }
    const method = getIntentVerificationMethod(data.intents[intentId]);
    if (method && !latest?.reproduction_command) {
      throw new Error(`Intent ${intentId} 声明了 verification_method，但最新验证缺少 reproduction_command，不能标记 completed。`);
    }
    if (method && !commandCoversVerificationMethod(latest.reproduction_command, method)) {
      throw new Error(`Intent ${intentId} 的 reproduction_command 未覆盖 verification_method，不能标记 completed。`);
    }
  }

  // completed → needs_review 开启一轮回流；同轮跟踪到该 Intent 再次闭合。
  if (oldStatus === 'completed' && newStatus === 'needs_review') {
    data.intents[intentId].verification_epoch = getEffectiveVerificationEpoch(data.intents[intentId]) + 1;
    registerReviewCycle(data, [intentId]);
  }

  data.intents[intentId].status = newStatus;
  if ((newStatus === 'completed' || newStatus === 'blocked') && oldStatus !== 'completed') {
    finishReviewCycleIntent(data, intentId);
  }

  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  try {
    renameSync(tempPath, filePath);
  } catch (error) {
    try { unlinkSync(tempPath); } catch {}
    throw error;
  }
  return data.intents[intentId];
}

/**
 * 获取某 Intent 的意图叙事（解析 narrative_ref，读愿景文档对应章节）。
 * narrative_ref 格式: "01_VISION.md#int-001" 或 "01_VISION.md#int-001"
 * @returns {string} 意图叙事内容
 */
export function getNarrative(versionDir, intentId) {
  const { intents } = loadIntentMap(versionDir);
  if (!(intentId in intents)) {
    throw new Error(`Intent 不存在: ${intentId}`);
  }
  const ref = intents[intentId].narrative_ref;
  const { section } = parseNarrativeRef(ref, `intents["${intentId}"].narrative_ref`);

  const filePath = join(versionDir, NARRATIVE_FILE);
  if (!existsSync(filePath)) {
    throw new Error(`愿景文档不存在: ${filePath}`);
  }
  const content = readFileSync(filePath, 'utf-8');
  return extractMdSection(content, section, '意图叙事');
}
