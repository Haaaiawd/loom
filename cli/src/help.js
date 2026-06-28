// help — LOOM CLI 分层指南
// loom help <topic> 输出结构化工作指南，不是 man page 参数说明。
// 指南内容是 agent 能直接理解的："做什么、用什么命令、怎么判断做对了"。
//
// 内容存储在 cli/help/*.md 文件中，运行时读取。
// 这样改帮助内容不用改代码，未来支持多语言也方便。

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HELP_DIR = join(__dirname, '..', 'help');

/** topic 列表（从 cli/help/ 目录扫描） */
export function listHelpTopics() {
  if (!existsSync(HELP_DIR)) return [];
  return readdirSync(HELP_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace('.md', ''))
    .sort();
}

/**
 * 获取某个 topic 的帮助内容。
 * @param {string} topic — topic 名（如 workflow / concepts / loop / version / doctor）
 * @returns {string} 帮助内容（MD 格式）
 * @throws {Error} topic 不存在时抛错
 */
export function getHelpTopic(topic) {
  if (!topic) {
    const topics = listHelpTopics();
    throw new Error(`请指定 topic。可用: ${topics.join(', ')}`);
  }
  const filePath = join(HELP_DIR, `${topic}.md`);
  if (!existsSync(filePath)) {
    const topics = listHelpTopics();
    throw new Error(`未知 topic: ${topic}\n可用: ${topics.join(', ')}`);
  }
  return readFileSync(filePath, 'utf-8');
}
