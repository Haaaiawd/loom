// intent-ref.js — Resolve current and version-qualified Intent read references.

import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

export const VERSION_PATTERN = /^v\d+$/;
export const INTENT_ID_PATTERN = /^INT-\d+$/;

export function formatIntentRef(version, intentId) {
  return `${version}:${intentId}`;
}

/** Resolve INT-003 against the current version or v1:INT-003 against .loom/v1. */
export function resolveIntentRef(currentVersionDir, input) {
  const currentVersion = basename(currentVersionDir);
  if (!VERSION_PATTERN.test(currentVersion)) {
    throw new Error(`无法从目录确定当前 LOOM 版本: ${currentVersionDir}`);
  }

  const parts = String(input || '').split(':');
  if (parts.length > 2) throw new Error(`Intent 引用格式非法: ${input}`);
  const qualified = parts.length === 2;
  const version = qualified ? parts[0] : currentVersion;
  const intentId = qualified ? parts[1] : parts[0];
  if (!VERSION_PATTERN.test(version) || !INTENT_ID_PATTERN.test(intentId)) {
    throw new Error(`Intent 引用格式非法: ${input}（应为 INT-003 或 v1:INT-003）`);
  }

  const versionDir = qualified ? join(dirname(currentVersionDir), version) : currentVersionDir;
  if (!existsSync(versionDir)) throw new Error(`版本不存在: ${version}`);
  return {
    ref: formatIntentRef(version, intentId),
    version,
    intentId,
    versionDir,
    historical: version !== currentVersion,
  };
}
