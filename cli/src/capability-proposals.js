// capability-proposals — auditable incoming change, deliberately separate from the official graph.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { loadCapabilityGraph } from './capability-graph.js';
import { loadIntentMap } from './intent-map.js';
import { readJsonFile } from './shared/md-utils.js';

const DIR = '07_GRAPH_PROPOSALS';
const ORIGINS = ['user_request', 'research', 'keeper_finding', 'forge_finding'];
const CANDIDATES = ['outcome', 'concern', 'capability', 'risk', 'evidence', 'constraint'];
const DECISIONS = ['covered', 'graph_update', 'intent_change', 'acceptance_change', 'minor', 'major', 'reject'];
const DECISION_ARTIFACT_DIR = '03_DECISIONS';

export function getCapabilityProposalsDir(versionDir) { return join(versionDir, DIR); }

function proposalPath(versionDir, id) {
  if (!/^CGP-[A-Z0-9][A-Z0-9-]*$/.test(id || '')) throw new Error('proposal id must use CGP-<UPPERCASE-ID>');
  return join(getCapabilityProposalsDir(versionDir), `${id}.json`);
}

function text(value, name, errors) { if (typeof value !== 'string' || !value.trim()) errors.push(`${name} must be a non-empty string`); }

function fileHash(path) {
  return existsSync(path) && statSync(path).isFile()
    ? createHash('sha256').update(readFileSync(path)).digest('hex')
    : null;
}

function directoryHash(path) {
  if (!existsSync(path)) return null;
  const entries = readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const digest = createHash('sha256');
  for (const entry of entries) {
    const child = join(path, entry.name);
    digest.update(entry.name);
    digest.update(entry.isDirectory() ? directoryHash(child) || '' : fileHash(child) || '');
  }
  return digest.digest('hex');
}

function acceptanceHash(versionDir) {
  const mapPath = join(versionDir, '04_INTENT_MAP.json');
  const verificationPath = join(versionDir, '05_VERIFICATION.md');
  let inline = null;
  if (existsSync(mapPath)) {
    try {
      const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
      inline = Object.fromEntries(Object.entries(map.intents || {}).map(([id, intent]) => [id, intent.acceptance]));
    } catch { inline = null; }
  }
  return createHash('sha256').update(JSON.stringify(inline)).update(fileHash(verificationPath) || '').digest('hex');
}

function snapshot(versionDir) {
  return {
    graph: fileHash(join(versionDir, '07_CAPABILITY_GRAPH.json')),
    intent_map: fileHash(join(versionDir, '04_INTENT_MAP.json')),
    acceptance: acceptanceHash(versionDir),
    decisions: directoryHash(join(versionDir, DECISION_ARTIFACT_DIR)),
  };
}

function nonEmptyStringArray(value, label, errors) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || !item.trim())) errors.push(`${label} must be a non-empty string array`);
}

function validateResolutionShape(resolution, decision, errors) {
  if (!resolution || typeof resolution !== 'object' || Array.isArray(resolution)) {
    errors.push('resolution must be an object');
    return;
  }
  if (decision === 'graph_update') {
    if (!resolution.graph || typeof resolution.graph !== 'object' || Array.isArray(resolution.graph)) errors.push('resolution.graph is required for graph_update');
    else nonEmptyStringArray(resolution.graph.node_ids, 'resolution.graph.node_ids', errors);
  }
  if (decision === 'intent_change') nonEmptyStringArray(resolution.intent_ids, 'resolution.intent_ids', errors);
  if (decision === 'acceptance_change') nonEmptyStringArray(resolution.acceptance_intent_ids, 'resolution.acceptance_intent_ids', errors);
  if (decision === 'covered') {
    if (!resolution.coverage || typeof resolution.coverage !== 'object' || Array.isArray(resolution.coverage)) errors.push('resolution.coverage is required for covered');
    else {
      nonEmptyStringArray(resolution.coverage.node_ids, 'resolution.coverage.node_ids', errors);
      text(resolution.coverage.rationale, 'resolution.coverage.rationale', errors);
    }
  }
  if (['minor', 'major', 'reject'].includes(decision)) text(resolution.decision_artifact_ref, 'resolution.decision_artifact_ref', errors);
}

export function validateCapabilityProposal(proposal) {
  const errors = [];
  text(proposal?.id, 'id', errors);
  if (!ORIGINS.includes(proposal?.origin)) errors.push(`origin must be one of ${ORIGINS.join(', ')}`);
  if (!CANDIDATES.includes(proposal?.candidate_kind)) errors.push(`candidate_kind must be one of ${CANDIDATES.join(', ')}`);
  text(proposal?.title, 'title', errors);
  text(proposal?.why_now, 'why_now', errors);
  if (!proposal?.provenance || typeof proposal.provenance !== 'object') errors.push('provenance is required');
  else {
    text(proposal.provenance.source, 'provenance.source', errors);
    text(proposal.provenance.observed_at, 'provenance.observed_at', errors);
    text(proposal.provenance.evidence, 'provenance.evidence', errors);
  }
  if (!['submitted', 'decided', 'closed'].includes(proposal?.status)) errors.push('status must be submitted, decided, or closed');
  if (proposal?.status !== 'submitted') {
    if (!DECISIONS.includes(proposal?.decision)) errors.push(`decision must be one of ${DECISIONS.join(', ')}`);
    text(proposal?.decision_rationale, 'decision_rationale', errors);
    if (!proposal.decision_baseline || typeof proposal.decision_baseline !== 'object') errors.push('decision_baseline is required after Architect decision');
  }
  if (proposal?.status === 'closed') validateResolutionShape(proposal.resolution, proposal.decision, errors);
  if (errors.length) throw new Error(`Capability Graph proposal validation failed:\n  - ${errors.join('\n  - ')}`);
  return proposal;
}

export function listCapabilityProposals(versionDir, { unresolvedOnly = false } = {}) {
  const dir = getCapabilityProposalsDir(versionDir);
  if (!existsSync(dir)) return [];
  const proposals = readdirSync(dir).filter((file) => file.endsWith('.json')).sort()
    .map((file) => validateCapabilityProposal(readJsonFile(join(dir, file), 'Capability Graph proposal')));
  return unresolvedOnly ? proposals.filter((proposal) => proposal.status !== 'closed') : proposals;
}

export function getCapabilityProposal(versionDir, id) {
  const path = proposalPath(versionDir, id);
  if (!existsSync(path)) throw new Error(`proposal not found: ${id}`);
  return validateCapabilityProposal(readJsonFile(path, 'Capability Graph proposal'));
}

export function submitCapabilityProposal(versionDir, proposal) {
  validateCapabilityProposal(proposal);
  if (proposal.status !== 'submitted') throw new Error('new proposal must start as status=submitted');
  const path = proposalPath(versionDir, proposal.id);
  if (existsSync(path)) throw new Error(`proposal already exists: ${proposal.id}`);
  mkdirSync(getCapabilityProposalsDir(versionDir), { recursive: true });
  writeFileSync(path, `${JSON.stringify(proposal, null, 2)}\n`, 'utf-8');
  return proposal;
}

export function decideCapabilityProposal(versionDir, id, decision, rationale) {
  if (!DECISIONS.includes(decision)) throw new Error(`invalid decision: ${decision}`);
  if (!rationale || !rationale.trim()) throw new Error('--rationale is required');
  const proposal = getCapabilityProposal(versionDir, id);
  if (proposal.status !== 'submitted') throw new Error(`${id} is already ${proposal.status}; it cannot be decided again`);
  proposal.status = 'decided';
  proposal.decision = decision;
  proposal.decision_rationale = rationale;
  proposal.decision_baseline = snapshot(versionDir);
  writeFileSync(proposalPath(versionDir, id), `${JSON.stringify(proposal, null, 2)}\n`, 'utf-8');
  return proposal;
}

function isEffectiveCoverage(node) {
  return node?.status === 'covered' && ['brief', 'intent', 'defer', 'exclude', 'covered_by'].includes(node.route);
}

function assertGraphResolution(versionDir, proposal, resolution) {
  const graph = loadCapabilityGraph(versionDir);
  if (snapshot(versionDir).graph === proposal.decision_baseline.graph) throw new Error('graph_update requires a real change to 07_CAPABILITY_GRAPH.json after the Architect decision');
  for (const nodeId of resolution.graph.node_ids) {
    const node = graph.nodes[nodeId];
    if (!node) throw new Error(`resolution.graph.node_ids references missing Graph node: ${nodeId}`);
    if (!(node.proposal_refs || []).includes(proposal.id)) throw new Error(`Graph node ${nodeId} must record proposal_refs including ${proposal.id}`);
  }
  if (proposal.candidate_kind === 'constraint') {
    const carrier = (graph.constraints || []).find((constraint) => constraint.proposal_id === proposal.id);
    if (!carrier) throw new Error(`constraint proposal ${proposal.id} requires a formal Graph constraints carrier`);
    if (!carrier.node_refs.some((nodeId) => resolution.graph.node_ids.includes(nodeId))) throw new Error(`constraint carrier ${proposal.id} must reference a resolved Graph node`);
  }
}

function assertIntentResolution(versionDir, proposal, resolution, { acceptance = false } = {}) {
  const current = snapshot(versionDir);
  const baselineKey = acceptance ? 'acceptance' : 'intent_map';
  if (current[baselineKey] === proposal.decision_baseline[baselineKey]) {
    throw new Error(`${proposal.decision} requires a real ${acceptance ? 'acceptance contract' : '04_INTENT_MAP.json'} change after the Architect decision`);
  }
  const map = loadIntentMap(versionDir);
  const intentIds = acceptance ? resolution.acceptance_intent_ids : resolution.intent_ids;
  for (const intentId of intentIds) {
    const intent = map.intents[intentId];
    if (!intent) throw new Error(`resolution references missing Intent: ${intentId}`);
    if (!(intent.proposal_refs || []).includes(proposal.id)) throw new Error(`Intent ${intentId} must record proposal_refs including ${proposal.id}`);
  }
}

function resolveDecisionArtifact(versionDir, reference) {
  if (typeof reference !== 'string' || !reference.trim() || isAbsolute(reference)) throw new Error('resolution.decision_artifact_ref must be a relative decision artifact path');
  const decisionsRoot = resolve(versionDir, DECISION_ARTIFACT_DIR);
  const artifactPath = resolve(versionDir, reference);
  const relation = relative(decisionsRoot, artifactPath);
  if (relation.startsWith('..') || isAbsolute(relation) || relation === '') throw new Error(`decision artifact must be inside ${DECISION_ARTIFACT_DIR}/`);
  if (!existsSync(artifactPath) || !statSync(artifactPath).isFile()) throw new Error(`decision artifact does not exist: ${reference}`);
  return artifactPath;
}

function assertDecisionArtifactResolution(versionDir, proposal, resolution) {
  const artifactPath = resolveDecisionArtifact(versionDir, resolution.decision_artifact_ref);
  if (snapshot(versionDir).decisions === proposal.decision_baseline.decisions) throw new Error('decision resolution requires a new or changed 03_DECISIONS artifact after the Architect decision');
  if (!readFileSync(artifactPath, 'utf-8').includes(proposal.id)) throw new Error(`decision artifact must name proposal ${proposal.id}`);
}

function assertCoveredResolution(versionDir, resolution) {
  const graph = loadCapabilityGraph(versionDir);
  for (const nodeId of resolution.coverage.node_ids) {
    if (!isEffectiveCoverage(graph.nodes[nodeId])) throw new Error(`coverage node is not an effective current Graph coverage: ${nodeId}`);
  }
}

export function closeCapabilityProposal(versionDir, id, resolution) {
  const proposal = getCapabilityProposal(versionDir, id);
  if (proposal.status !== 'decided') throw new Error(`${id} must be decided before it can be closed`);
  const errors = [];
  validateResolutionShape(resolution, proposal.decision, errors);
  if (errors.length) throw new Error(`proposal close requires structured resolution:\n  - ${errors.join('\n  - ')}`);

  if (proposal.decision === 'graph_update') assertGraphResolution(versionDir, proposal, resolution);
  else if (proposal.decision === 'intent_change') assertIntentResolution(versionDir, proposal, resolution);
  else if (proposal.decision === 'acceptance_change') assertIntentResolution(versionDir, proposal, resolution, { acceptance: true });
  else if (proposal.decision === 'covered') assertCoveredResolution(versionDir, resolution);
  else assertDecisionArtifactResolution(versionDir, proposal, resolution);

  proposal.status = 'closed';
  proposal.resolution = resolution;
  writeFileSync(proposalPath(versionDir, id), `${JSON.stringify(proposal, null, 2)}\n`, 'utf-8');
  return proposal;
}
