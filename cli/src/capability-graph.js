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
const VERIFICATION_FIELDS = ['method', 'target', 'procedure', 'pass_criteria', 'artifact'];
const EVIDENCE_ARTIFACT_DIRS = ['verifications', '08_ASSET_LIBRARY/files'];

export function getCapabilityGraphPath(versionDir) {
  return join(versionDir, GRAPH_FILE);
}

export function getCapabilityBriefsDir(versionDir) {
  return join(versionDir, BRIEFS_DIR);
}

function assertString(value, label, errors) {
  if (typeof value !== 'string' || value.trim() === '') errors.push(`${label} 必须是非空字符串`);
}

function validateNode(id, node, allIds, errors) {
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
    for (const [id, node] of Object.entries(data.nodes)) validateNode(id, node, ids, errors);
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
    },
    mermaid: lines.join('\n'),
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

function getHighOutcomesWithoutObservableEvidence(versionDir, graph, intentMap, intentMappingRequired) {
  const gaps = [];
  for (const outcome of Object.values(graph.nodes)) {
    if (outcome.kind !== 'outcome' || outcome.impact !== 'high') continue;
    const evidenceRelations = (outcome.relationships || []).filter((relation) => relation.type === 'validated_by');
    const validEvidence = evidenceRelations.find((relation) => {
      const evidence = graph.nodes[relation.target];
      if (!evidence || evidence.kind !== 'evidence' || !evidence.verification) return false;
      if (!resolveEvidenceArtifact(versionDir, evidence.verification.artifact)) return false;
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
  const highUnrouted = getCapabilityFrontier(versionDir);
  const orphanIntentRefs = [];
  const mappedIntentIds = new Set();
  const capabilitiesWithoutPlan = [];
  const routingGaps = [];
  const outcomesWithoutConcern = [];

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
    if (node.brief_ref) {
      try { resolveBrief(versionDir, node.brief_ref); } catch (error) {
        capabilitiesWithoutPlan.push({ node_id: node.id, reason: error.message });
      }
    }
  }

  const unmappedIntents = intentMappingRequired
    ? Object.keys(intentMap.intents).filter((id) => !mappedIntentIds.has(id))
    : [];
  const highOutcomesWithoutObservableEvidence = getHighOutcomesWithoutObservableEvidence(versionDir, graph, intentMap, intentMappingRequired);
  return {
    summary: {
      nodes: nodes.length,
      outcomes: nodes.filter((node) => node.kind === 'outcome').length,
      high_unrouted: highUnrouted.length,
      orphan_intent_refs: orphanIntentRefs.length,
      capabilities_without_plan: capabilitiesWithoutPlan.length,
      routing_gaps: routingGaps.length,
      outcomes_without_concern: outcomesWithoutConcern.length,
      high_outcomes_without_observable_evidence: highOutcomesWithoutObservableEvidence.length,
      intent_mapping_required: intentMappingRequired,
      unmapped_intents: unmappedIntents.length,
      ready: highUnrouted.length === 0
        && orphanIntentRefs.length === 0
        && capabilitiesWithoutPlan.length === 0
        && routingGaps.length === 0
        && outcomesWithoutConcern.length === 0
        && highOutcomesWithoutObservableEvidence.length === 0
        && unmappedIntents.length === 0,
    },
    high_unrouted: highUnrouted,
    orphan_intent_refs: orphanIntentRefs,
    capabilities_without_plan: capabilitiesWithoutPlan,
    routing_gaps: routingGaps,
    outcomes_without_concern: outcomesWithoutConcern,
    high_outcomes_without_observable_evidence: highOutcomesWithoutObservableEvidence,
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
    briefs,
    warnings,
    acquisition: {
      required: requiredNodeIds.length > 0,
      required_node_ids: requiredNodeIds,
      nodes: acquisitionNodes,
    },
  };
}
