import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { extractMdSection } from './md-utils.js';

/** Resolve a root-relative Markdown proof reference without allowing path escape. */
export function resolveQualityProofReference(versionDir, ref) {
  if (typeof ref !== 'string' || !ref.trim()) throw new Error('quality_proof_ref 必须是非空字符串');
  const match = ref.trim().match(/^([^#]+)#([\w-]+)$/);
  if (!match) throw new Error('quality_proof_ref 必须是项目相对路径加 Markdown 锚点，例如 verifications/INT-001-quality-proof.md#int-001');
  const [, file, anchor] = match;
  if (isAbsolute(file)) throw new Error('quality_proof_ref 不得使用绝对路径');
  const projectDir = resolve(versionDir, '..', '..');
  const filePath = resolve(projectDir, file);
  const relation = relative(projectDir, filePath);
  if (relation.startsWith('..') || isAbsolute(relation)) throw new Error('quality_proof_ref 不得越出项目目录');
  if (!existsSync(filePath)) throw new Error(`quality_proof_ref 指向的文件不存在: ${file}`);
  extractMdSection(readFileSync(filePath, 'utf-8'), anchor, 'Quality Proof');
  return { filePath, anchor, ref: ref.trim() };
}
