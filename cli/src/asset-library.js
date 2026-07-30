// asset-library — versioned, local-first source of truth for project assets.
// It deliberately manages bytes and provenance; it never promises a remote URL is renderable.

import { closeSync, copyFileSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { getCapabilityGraphPath, loadCapabilityGraph, validateCapabilityGraph } from './capability-graph.js';
import { readJsonFile } from './shared/md-utils.js';

const ROOT_DIR = '08_ASSET_LIBRARY';
const MANIFEST_FILE = 'manifest.json';
const FILES_DIR = 'files';
const IMPORT_JOURNAL_FILE = '.asset-import-journal.json';
const KINDS = ['image', 'video', 'audio', 'document', 'model', 'other'];
const STATUSES = ['active', 'archived', 'rejected'];
const APPROVALS = ['approved', 'pending', 'rejected'];

export function getAssetLibraryDir(versionDir) { return join(versionDir, ROOT_DIR); }
export function getAssetManifestPath(versionDir) { return join(getAssetLibraryDir(versionDir), MANIFEST_FILE); }
export function getAssetFilesDir(versionDir) { return join(getAssetLibraryDir(versionDir), FILES_DIR); }
export function getAssetImportJournalPath(versionDir) { return join(getAssetLibraryDir(versionDir), IMPORT_JOURNAL_FILE); }

function removeIfExists(path) {
  if (existsSync(path)) unlinkSync(path);
}

function fsyncFile(path) {
  const fd = openSync(path, 'r');
  try {
    fsyncSync(fd);
  } catch (error) {
    // Some Windows/virtual filesystems reject fsync even for a writable regular
    // file. Rename + journal recovery still preserve consistency; do not turn
    // that platform limitation into an unusable importer.
    if (!['EPERM', 'EINVAL'].includes(error.code)) throw error;
  } finally { closeSync(fd); }
}

function transactionTempPath(path, id) {
  return join(resolve(path, '..'), `.${basename(path)}.loom-import-${id}.tmp`);
}

// A single rename is atomic on the same filesystem. This does not make the whole
// import atomic across files; the journal below makes that multi-file change recoverable.
function writeFileAtomically(path, content, transactionId) {
  const temp = transactionTempPath(path, transactionId);
  writeFileSync(temp, content, 'utf-8');
  fsyncFile(temp);
  renameSync(temp, path);
}

function snapshot(path) {
  return existsSync(path)
    ? { exists: true, content_base64: readFileSync(path).toString('base64') }
    : { exists: false };
}

function restoreSnapshot(path, saved, transactionId) {
  if (!saved || !saved.exists) {
    removeIfExists(path);
    return;
  }
  writeFileAtomically(path, Buffer.from(saved.content_base64, 'base64'), transactionId);
}

function readImportJournal(versionDir) {
  const path = getAssetImportJournalPath(versionDir);
  if (!existsSync(path)) return null;
  const journal = readJsonFile(path, 'Asset import recovery journal');
  if (!journal || journal.schema !== 'loom.asset-import-recovery.v1' || typeof journal.transaction_id !== 'string') {
    throw new Error(`unrecoverable Asset import journal at ${ROOT_DIR}/${IMPORT_JOURNAL_FILE}; restore the manifest and graph from backup before importing again`);
  }
  return journal;
}

function writeImportJournal(versionDir, journal) {
  mkdirSync(getAssetLibraryDir(versionDir), { recursive: true });
  writeFileAtomically(getAssetImportJournalPath(versionDir), `${JSON.stringify(journal, null, 2)}\n`, journal.transaction_id);
}

/**
 * Roll back an interrupted import before any caller reads or writes this library.
 * This is deliberately recovery, not a claim of cross-file OS atomicity.
 */
export function recoverAssetImportTransaction(versionDir) {
  const journal = readImportJournal(versionDir);
  if (!journal) return { recovered: false };
  const transactionId = journal.transaction_id;
  try {
    const destination = safeAssetPath(versionDir, journal.destination_path);
    const temporaryAsset = safeAssetPath(versionDir, journal.temporary_asset_path);
    restoreSnapshot(getAssetManifestPath(versionDir), journal.before.manifest, transactionId);
    if (journal.before.graph) restoreSnapshot(getCapabilityGraphPath(versionDir), journal.before.graph, transactionId);
    removeIfExists(destination);
    removeIfExists(temporaryAsset);
    removeIfExists(transactionTempPath(getAssetManifestPath(versionDir), transactionId));
    if (journal.before.graph) removeIfExists(transactionTempPath(getCapabilityGraphPath(versionDir), transactionId));
    removeIfExists(getAssetImportJournalPath(versionDir));
    return { recovered: true, transaction_id: transactionId, stage: journal.stage || 'unknown' };
  } catch (error) {
    throw new Error(`unfinished Asset import transaction ${transactionId} could not be recovered: ${error.message}`);
  }
}

function nonEmpty(value, label, errors) {
  if (typeof value !== 'string' || value.trim() === '') errors.push(`${label} must be a non-empty string`);
}

function safeAssetPath(versionDir, storedPath) {
  if (typeof storedPath !== 'string' || !storedPath) throw new Error('asset.path must be a non-empty relative path');
  if (isAbsolute(storedPath)) throw new Error(`asset.path must not be absolute: ${storedPath}`);
  const root = resolve(getAssetLibraryDir(versionDir));
  const candidate = resolve(root, storedPath);
  const rel = relative(root, candidate);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`asset.path escapes Asset Library: ${storedPath}`);
  const filesRoot = resolve(getAssetFilesDir(versionDir));
  const filesRel = relative(filesRoot, candidate);
  if (filesRel.startsWith('..') || isAbsolute(filesRel)) throw new Error(`asset.path must be within ${ROOT_DIR}/${FILES_DIR}: ${storedPath}`);
  return candidate;
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function normalizeTags(tags) {
  const raw = Array.isArray(tags) ? tags : String(tags || '').split(',');
  const seen = new Set();
  for (const tag of raw) {
    const normalized = String(tag).trim().replace(/\s+/g, ' ');
    if (normalized) seen.add(normalized);
  }
  return [...seen];
}

function validateRecord(id, asset, versionDir, errors, { checkBytes = true } = {}) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
    errors.push(`assets[${id}] must be an object`);
    return;
  }
  if (asset.id !== id) errors.push(`assets[${id}].id must match its key`);
  if (!/^ASSET-[a-f0-9]{12,64}$/i.test(id)) errors.push(`assets[${id}] must use content-derived ASSET-<sha256-prefix> id`);
  if (!KINDS.includes(asset.kind)) errors.push(`assets[${id}].kind is invalid`);
  if (!Array.isArray(asset.tags) || asset.tags.length === 0 || asset.tags.some((tag) => typeof tag !== 'string' || !tag.trim())) errors.push(`assets[${id}].tags must contain at least one non-empty tag`);
  if (!STATUSES.includes(asset.status)) errors.push(`assets[${id}].status is invalid`);
  if (!APPROVALS.includes(asset.approval)) errors.push(`assets[${id}].approval is invalid`);
  if (!asset.source || typeof asset.source !== 'object' || Array.isArray(asset.source)) {
    errors.push(`assets[${id}].source must be an object`);
  } else {
    nonEmpty(asset.source.label, `assets[${id}].source.label`, errors);
    nonEmpty(asset.source.author, `assets[${id}].source.author`, errors);
    nonEmpty(asset.source.license, `assets[${id}].source.license`, errors);
  }
  if (!/^[a-f0-9]{64}$/i.test(asset.content_hash || '')) errors.push(`assets[${id}].content_hash must be a SHA-256 hex digest`);
  try {
    const filePath = safeAssetPath(versionDir, asset.path);
    if (checkBytes && !existsSync(filePath)) errors.push(`assets[${id}].path does not exist: ${asset.path}`);
    else if (checkBytes && hashFile(filePath) !== asset.content_hash) errors.push(`assets[${id}].content_hash does not match bytes at ${asset.path}`);
  } catch (error) { errors.push(`assets[${id}].path invalid: ${error.message}`); }
  if (asset.evidence_refs !== undefined && (!Array.isArray(asset.evidence_refs) || asset.evidence_refs.some((ref) => typeof ref !== 'string' || !ref.trim()))) {
    errors.push(`assets[${id}].evidence_refs must be a string array`);
  }
}

function validateEvidenceReciprocity(manifest, graph, errors) {
  if (!graph) return;
  for (const [id, asset] of Object.entries(manifest.assets || {})) {
    for (const evidenceId of asset.evidence_refs || []) {
      const node = graph.nodes[evidenceId];
      if (!node || node.kind !== 'evidence') errors.push(`assets[${id}].evidence_refs references missing evidence node ${evidenceId}`);
      else if (!(node.asset_refs || []).includes(id)) errors.push(`assets[${id}] -> ${evidenceId} lacks reciprocal evidence.asset_refs link`);
    }
  }
  for (const node of Object.values(graph.nodes || {})) {
    if (!node.asset_refs) continue;
    if (node.kind !== 'evidence') errors.push(`${node.id}.asset_refs is only allowed on evidence nodes`);
    for (const assetId of node.asset_refs) {
      const asset = manifest.assets[assetId];
      if (!asset) errors.push(`${node.id}.asset_refs references missing asset ${assetId}`);
      else if (!(asset.evidence_refs || []).includes(node.id)) errors.push(`${node.id} -> ${assetId} lacks reciprocal asset.evidence_refs link`);
    }
  }
}

function validateProspectiveImport(versionDir, manifest, graph) {
  const errors = [];
  for (const [id, asset] of Object.entries(manifest.assets || {})) validateRecord(id, asset, versionDir, errors, { checkBytes: false });
  if (graph) {
    try { validateCapabilityGraph(graph); } catch (error) { errors.push(error.message); }
    validateEvidenceReciprocity(manifest, graph, errors);
  }
  if (errors.length) throw new Error(`Asset import prevalidation failed:\n  - ${errors.join('\n  - ')}`);
}

export function validateAssetLibrary(versionDir, { checkGraph = true, recover = true } = {}) {
  if (recover) recoverAssetImportTransaction(versionDir);
  const manifestPath = getAssetManifestPath(versionDir);
  if (!existsSync(manifestPath)) throw new Error(`missing ${ROOT_DIR}/${MANIFEST_FILE}`);
  const manifest = readJsonFile(manifestPath, 'Asset Library manifest');
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) errors.push('manifest must be an object');
  if (!manifest.assets || typeof manifest.assets !== 'object' || Array.isArray(manifest.assets)) errors.push('manifest.assets must be an object');
  else {
    const seenHashes = new Set();
    for (const [id, asset] of Object.entries(manifest.assets)) {
      validateRecord(id, asset, versionDir, errors);
      if (asset?.content_hash) {
        if (seenHashes.has(asset.content_hash)) errors.push(`duplicate content_hash: ${asset.content_hash}`);
        seenHashes.add(asset.content_hash);
      }
    }
  }
  if (checkGraph && manifest.assets && existsSync(getCapabilityGraphPath(versionDir))) {
    try {
      const graph = loadCapabilityGraph(versionDir);
      validateEvidenceReciprocity(manifest, graph, errors);
    } catch (error) { errors.push(`Capability Graph evidence reference check failed: ${error.message}`); }
  }
  if (errors.length) throw new Error(`Asset Library validation failed:\n  - ${errors.join('\n  - ')}`);
  return manifest;
}

export function loadAssetLibrary(versionDir, options = {}) {
  const { required = true, checkGraph = false } = options;
  if (!existsSync(getAssetManifestPath(versionDir))) {
    if (required) throw new Error(`missing ${ROOT_DIR}/${MANIFEST_FILE}`);
    return null;
  }
  return validateAssetLibrary(versionDir, { checkGraph });
}

export function importAsset(versionDir, inputPath, metadata = {}) {
  // Never start a new import on top of a previous interrupted one.
  recoverAssetImportTransaction(versionDir);
  if (!inputPath || typeof inputPath !== 'string') throw new Error('asset import requires an explicit local file path');
  const sourcePath = resolve(inputPath);
  if (!existsSync(sourcePath)) throw new Error(`source file does not exist: ${inputPath}`);
  if (lstatSync(sourcePath).isSymbolicLink()) throw new Error('asset import rejects symbolic links; import the real local file explicitly');
  if (!statSync(sourcePath).isFile()) throw new Error('asset import accepts files only');
  const libraryRoot = resolve(getAssetLibraryDir(versionDir));
  const sourceReal = realpathSync(sourcePath);
  const sourceRel = relative(libraryRoot, sourceReal);
  if (!sourceRel.startsWith('..') && !isAbsolute(sourceRel)) throw new Error('asset import rejects files already inside the library; use existing asset id instead');
  const tags = normalizeTags(metadata.tags);
  const kind = metadata.kind || 'image';
  const approval = metadata.approval || 'pending';
  const errors = [];
  if (!KINDS.includes(kind)) errors.push(`invalid kind: ${kind}`);
  if (!tags.length) errors.push('at least one --tags value is required');
  if (!metadata.source) errors.push('--source is required');
  if (!metadata.author) errors.push('--author is required');
  if (!metadata.license) errors.push('--license is required');
  if (approval !== 'approved') errors.push('import requires --approval approved; pending or rejected bytes cannot enter the usable library');
  if (errors.length) throw new Error(errors.join('; '));

  // The existing state must already be internally consistent before we create a
  // candidate. This prevents a new import from laundering an old one-sided link.
  const manifest = loadAssetLibrary(versionDir, { checkGraph: true });
  const evidenceRefs = normalizeTags(metadata.evidenceRefs || []);
  let graph = null;
  if (evidenceRefs.length) {
    graph = loadCapabilityGraph(versionDir);
    for (const evidenceId of evidenceRefs) {
      const node = graph.nodes[evidenceId];
      if (!node || node.kind !== 'evidence') throw new Error(`--evidence references missing evidence node: ${evidenceId}`);
    }
  }
  const contentHash = hashFile(sourceReal);
  if (Object.values(manifest.assets).some((asset) => asset.content_hash === contentHash)) throw new Error(`duplicate asset bytes: SHA-256 ${contentHash} already exists in this library`);
  const id = `ASSET-${contentHash.slice(0, 16)}`;
  if (manifest.assets[id]) throw new Error(`duplicate asset id: ${id}`);
  const suffix = extname(basename(sourceReal)).toLowerCase().replace(/[^.a-z0-9]/g, '');
  const storedPath = `${FILES_DIR}/${id}${suffix || '.bin'}`;
  const destination = safeAssetPath(versionDir, storedPath);
  mkdirSync(getAssetFilesDir(versionDir), { recursive: true });
  if (existsSync(destination)) throw new Error(`destination already exists: ${storedPath}`);
  const asset = {
    id,
    kind,
    tags,
    status: 'active',
    approval,
    content_hash: contentHash,
    path: storedPath,
    source: { label: metadata.source, author: metadata.author, license: metadata.license },
    original_name: basename(sourceReal),
    evidence_refs: evidenceRefs,
  };
  const nextManifest = structuredClone(manifest);
  const nextGraph = graph ? structuredClone(graph) : null;
  nextManifest.assets[id] = asset;
  if (nextGraph) {
    for (const evidenceId of evidenceRefs) {
      const node = nextGraph.nodes[evidenceId];
      node.asset_refs = [...new Set([...(node.asset_refs || []), id])];
    }
  }

  // Full preflight happens before a journal or any live file is touched.
  validateProspectiveImport(versionDir, nextManifest, nextGraph);

  const transactionId = `${id.slice(6).toLowerCase()}-${Date.now().toString(36)}`;
  const temporaryAsset = transactionTempPath(destination, transactionId);
  const manifestPath = getAssetManifestPath(versionDir);
  const graphPath = getCapabilityGraphPath(versionDir);
  const journal = {
    schema: 'loom.asset-import-recovery.v1',
    transaction_id: transactionId,
    stage: 'prepared',
    destination_path: storedPath,
    temporary_asset_path: relative(getAssetLibraryDir(versionDir), temporaryAsset).replace(/\\/g, '/'),
    before: { manifest: snapshot(manifestPath), graph: nextGraph ? snapshot(graphPath) : null },
  };

  try {
    // Journal first. Each live-file replacement is same-directory temp + rename;
    // the journal is what makes the three-file operation recoverable on failure.
    writeImportJournal(versionDir, journal);
    copyFileSync(sourceReal, temporaryAsset, 0);
    fsyncFile(temporaryAsset);
    if (hashFile(temporaryAsset) !== contentHash) throw new Error('copied asset hash mismatch; import aborted');

    const manifestTemp = transactionTempPath(manifestPath, transactionId);
    writeFileSync(manifestTemp, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf-8');
    fsyncFile(manifestTemp);
    const graphTemp = nextGraph ? transactionTempPath(graphPath, transactionId) : null;
    if (graphTemp) {
      writeFileSync(graphTemp, `${JSON.stringify(nextGraph, null, 2)}\n`, 'utf-8');
      fsyncFile(graphTemp);
    }
    journal.stage = 'staged';
    writeImportJournal(versionDir, journal);

    renameSync(temporaryAsset, destination);
    journal.stage = 'asset_committed';
    writeImportJournal(versionDir, journal);

    renameSync(manifestTemp, manifestPath);
    journal.stage = 'manifest_committed';
    writeImportJournal(versionDir, journal);
    if (metadata.failureInjection === 'after_manifest') throw new Error('injected asset import failure after manifest write');
    if (metadata.failureInjection === 'crash_after_manifest') {
      // Test-only crash seam: leave the durable journal in place so the next
      // validate/startup path proves it can restore a half-committed import.
      throw Object.assign(new Error('injected crash after manifest write'), { skipAssetImportRollback: true });
    }

    if (graphTemp) {
      renameSync(graphTemp, graphPath);
      journal.stage = 'graph_committed';
      writeImportJournal(versionDir, journal);
    }

    // Validate the fully committed candidate before discarding its recovery record.
    validateAssetLibrary(versionDir, { checkGraph: true, recover: false });
    removeIfExists(getAssetImportJournalPath(versionDir));
    return asset;
  } catch (error) {
    if (error.skipAssetImportRollback) throw error;
    try { recoverAssetImportTransaction(versionDir); } catch (recoveryError) {
      throw new Error(`${error.message}; rollback also failed: ${recoveryError.message}`);
    }
    throw error;
  }
}

export function listAssets(versionDir) {
  const manifest = loadAssetLibrary(versionDir, { checkGraph: false });
  return Object.values(manifest.assets).map((asset) => ({ ...asset }));
}

export function searchAssets(versionDir, query, { approvedOnly = true } = {}) {
  const needle = String(query || '').trim().toLocaleLowerCase();
  if (!needle) throw new Error('asset search requires a non-empty query');
  return listAssets(versionDir).filter((asset) => (!approvedOnly || (asset.approval === 'approved' && asset.status === 'active'))
    && [asset.id, asset.kind, ...asset.tags, asset.original_name]
    .some((value) => String(value || '').toLocaleLowerCase().includes(needle)));
}

export function getAsset(versionDir, id) {
  const asset = loadAssetLibrary(versionDir, { checkGraph: false }).assets[id];
  if (!asset) throw new Error(`asset not found: ${id}`);
  return asset;
}
