#!/usr/bin/env node
// loom — LOOM 框架的 CLI 传感器层
// Agent 通过这个 CLI 访问 Intent Map / 哲学 / 验证记录，不直接读文件。

import { argv, cwd, exit } from 'node:process';
import { resolve, join } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

import { getNextIntent, getStatus, getDependencyGraph, getIntent, loadIntentMap, updateIntentStatus, getNarrative } from '../src/intent-map.js';
import { getPhilosophy, listPhilosophyFiles } from '../src/philosophy.js';
import { writeVerification, getVerificationHistory, getPendingVerifications, listVerifications, getVerificationContract } from '../src/verify.js';
import { initProject } from '../src/init.js';
import { activateRole } from '../src/activate.js';
import { listVersions, readCurrentPointer, newVersion, useVersion, diffVersions } from '../src/version.js';
import { doctor, contextSummary, traceIntent, reverseDep, reverseRef } from '../src/diagnostics.js';
import { getHelpTopic, listHelpTopics } from '../src/help.js';

// ─── 路径解析 ──────────────────────────────────────────
// LOOM 项目目录结构: .loom/v{N}/
// 优先读 .loom/current 指针；不存在则回退到自动探测最新版本。
// 也接受 --loom-dir 参数直接指定版本目录。

function findLoomRoot() {
  const flagIdx = argv.indexOf('--loom-dir');
  if (flagIdx !== -1 && argv[flagIdx + 1]) {
    // --loom-dir 直接指向版本目录，反推 .loom root
    const dir = resolve(argv[flagIdx + 1]);
    return resolve(dir, '..');
  }
  return join(cwd(), '.loom');
}

function findLoomDir() {
  const flagIdx = argv.indexOf('--loom-dir');
  if (flagIdx !== -1 && argv[flagIdx + 1]) {
    return resolve(argv[flagIdx + 1]);
  }
  const loomRoot = join(cwd(), '.loom');
  if (!existsSync(loomRoot)) {
    die(`找不到 .loom 目录: ${loomRoot}`);
  }
  const current = readCurrentPointer(loomRoot);
  if (!current) {
    die(`.loom 下没有版本目录 (v1, v2, ...)`);
  }
  return join(loomRoot, current);
}

function getPhilosophyDir(loomDir) {
  return join(loomDir, '00_PHILOSOPHY');
}

function getVerificationsDir(loomDir) {
  return join(loomDir, 'verifications');
}

// ─── 输出工具 ──────────────────────────────────────────

function output(data) {
  if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

function die(msg, code = 1) {
  console.error(`错误: ${msg}`);
  exit(code);
}

// ─── 命令路由 ──────────────────────────────────────────

const [cmd, sub, ...rest] = argv.slice(2);

try {
  switch (cmd) {
    case 'intent': {
      const loomDir = findLoomDir();
      switch (sub) {
        case 'next':
          output(getNextIntent(loomDir) ?? '没有可执行的 Intent');
          break;
        case 'status': {
          const s = getStatus(loomDir);
          console.log(`进度: ${s.counts.completed}/${s.counts.total} 完成`);
          console.log(`  pending:     ${s.counts.pending}    ${s.ids.pending.join(', ') || '-'}`);
          console.log(`  in_progress: ${s.counts.in_progress}    ${s.ids.in_progress.join(', ') || '-'}`);
          console.log(`  completed:   ${s.counts.completed}    ${s.ids.completed.join(', ') || '-'}`);
          console.log(`  blocked:     ${s.counts.blocked}    ${s.ids.blocked.join(', ') || '-'}`);
          break;
        }
        case 'graph':
          output(getDependencyGraph(loomDir));
          break;
        case 'get': {
          const id = rest[0];
          if (!id) die('用法: loom intent get <id>');
          output(getIntent(loomDir, id));
          break;
        }
        case 'narrative': {
          const id = rest[0];
          if (!id) die('用法: loom intent narrative <id>');
          output(getNarrative(loomDir, id));
          break;
        }
        case 'validate':
          loadIntentMap(loomDir);
          console.log('Intent Map 校验通过');
          break;
        case 'trace': {
          const id = rest[0];
          if (!id) die('用法: loom intent trace <id>');
          output(traceIntent(loomDir, getVerificationsDir(loomDir), getPhilosophyDir(loomDir), id));
          break;
        }
        case 'reverse-dep': {
          const id = rest[0];
          if (!id) die('用法: loom intent reverse-dep <id>');
          output(reverseDep(loomDir, id));
          break;
        }
        case 'reverse-ref': {
          const anchor = rest[0];
          if (!anchor) die('用法: loom intent reverse-ref <anchor>\n例: loom intent reverse-ref PRODUCT_PHILOSOPHY.md#core-belief');
          output(reverseRef(loomDir, anchor));
          break;
        }
        case 'update': {
          const id = rest[0];
          const statusFlagIdx = argv.indexOf('--status');
          const newStatus = statusFlagIdx !== -1 ? argv[statusFlagIdx + 1] : null;
          if (!id || !newStatus) die('用法: loom intent update <id> --status <pending|in_progress|completed|blocked|needs_review>');
          updateIntentStatus(loomDir, id, newStatus);
          console.log(`${id} status 已更新为 ${newStatus}`);
          break;
        }
        default:
          die(`未知子命令: intent ${sub}\n用法: loom intent [next|status|graph|get <id>|narrative <id>|validate|trace <id>|reverse-dep <id>|reverse-ref <anchor>|update <id> --status <...>]`);
      }
      break;
    }

    case 'init': {
      const result = initProject(cwd());
      console.log('LOOM 项目已初始化');
      console.log(`  创建: ${result.created.length} 项`);
      for (const c of result.created) console.log(`    + ${c}`);
      if (result.skipped.length) {
        console.log(`  跳过（已存在）: ${result.skipped.length} 项`);
        for (const s of result.skipped) console.log(`    - ${s}`);
      }
      console.log('\n下一步: loom activate weaver');
      break;
    }

    case 'activate': {
      const role = sub;
      if (!role) die('用法: loom activate <role>\n角色: weaver | visionary | architect | forge | keeper');
      // weaver 不需要 loomDir（项目还没初始化时也能激活）
      let loomDir = null;
      if (role !== 'weaver') {
        try { loomDir = findLoomDir(); } catch { /* 项目还没初始化，weaver 之外的角色会缺少项目上下文 */ }
      }
      const prompt = activateRole(role, loomDir);
      output(prompt);
      break;
    }

    case 'philosophy': {
      const loomDir = findLoomDir();
      switch (sub) {
        case 'get': {
          const anchor = rest[0];
          if (!anchor) die('用法: loom philosophy get <anchor>\n例: loom philosophy get PRODUCT_PHILOSOPHY.md#core-belief');
          output(getPhilosophy(getPhilosophyDir(loomDir), anchor));
          break;
        }
        case 'list':
          output(listPhilosophyFiles(getPhilosophyDir(loomDir)));
          break;
        default:
          die(`未知子命令: philosophy ${sub}\n用法: loom philosophy [get <anchor>|list]`);
      }
      break;
    }

    case 'verify': {
      const loomDir = findLoomDir();
      const verificationsDir = getVerificationsDir(loomDir);
      switch (sub) {
        case 'contract': {
          const id = rest[0];
          if (!id) die('用法: loom verify contract <id>');
          output(getVerificationContract(loomDir, id));
          break;
        }
        case 'history': {
          const id = rest[0];
          if (!id) die('用法: loom verify history <id>');
          const history = getVerificationHistory(verificationsDir, id);
          output(history ?? `没有 ${id} 的验证记录`);
          break;
        }
        case 'pending':
          output(getPendingVerifications(loomDir, verificationsDir));
          break;
        case 'list':
          output(listVerifications(verificationsDir));
          break;
        case 'write': {
          // 支持两种输入方式：--json-file <path>（推荐）或 --json <string>
          // verdict 合法值: passed | deviated | blocked | pending_human
          const fileFlagIdx = argv.indexOf('--json-file');
          const jsonFlagIdx = argv.indexOf('--json');
          let record;
          if (fileFlagIdx !== -1 && argv[fileFlagIdx + 1]) {
            record = JSON.parse(readFileSync(argv[fileFlagIdx + 1], 'utf-8'));
          } else if (jsonFlagIdx !== -1 && argv[jsonFlagIdx + 1]) {
            record = JSON.parse(argv[jsonFlagIdx + 1]);
          } else {
            die('用法: loom verify write --json-file <path> | --json <json-string>');
          }
          const result = writeVerification(verificationsDir, record);
          console.log(`验证记录已写入: ${result.filePath}`);
          console.log(`  轮次: ${result.round}, verdict: ${record.verdict}`);
          if (record.verdict === 'deviated') {
            console.log(`  deviated 累计: ${result.deviated_count} 轮`);
            if (result.should_escalate) {
              console.log(`  ⚠ 达到 3 轮上限，应升级为 blocked——Keeper 应执行: loom intent update ${record.intent_id} --status blocked`);
            }
          }
          break;
        }
        default:
          die(`未知子命令: verify ${sub}\n用法: loom verify [contract <id>|history <id>|pending|list|write --json-file <path>|--json <string>]`);
      }
      break;
    }

    case 'version': {
      const loomRoot = findLoomRoot();
      switch (sub) {
        case 'list': {
          const { versions, current } = listVersions(loomRoot);
          for (const v of versions) {
            const mark = v === current ? ' *' : '  ';
            console.log(`${mark}${v}`);
          }
          if (current) console.log(`\n当前版本: ${current}`);
          break;
        }
        case 'current': {
          const current = readCurrentPointer(loomRoot);
          output(current ?? '没有版本目录');
          break;
        }
        case 'new': {
          const result = newVersion(cwd());
          console.log(`已创建新版本: ${result.version}`);
          console.log(`  创建: ${result.created.length} 项`);
          for (const c of result.created) console.log(`    + ${c}`);
          if (result.skipped.length) {
            console.log(`  跳过（已存在）: ${result.skipped.length} 项`);
            for (const s of result.skipped) console.log(`    - ${s}`);
          }
          console.log(`\n当前版本已切换为 ${result.version}`);
          console.log('下一步: loom activate weaver（参考上一版本哲学织造新哲学）');
          break;
        }
        case 'use': {
          const v = rest[0];
          if (!v) die('用法: loom version use <v1|v2|...>');
          const switched = useVersion(loomRoot, v);
          console.log(`当前版本已切换为 ${switched}`);
          break;
        }
        case 'diff': {
          const v1 = rest[0];
          const v2 = rest[1];
          if (!v1 || !v2) die('用法: loom version diff <v1> <v2>');
          output(diffVersions(loomRoot, v1, v2));
          break;
        }
        default:
          die(`未知子命令: version ${sub}\n用法: loom version [list|current|new|use <v>|diff <v1> <v2>]`);
      }
      break;
    }

    case 'doctor': {
      const loomDir = findLoomDir();
      const { issues, summary } = doctor(loomDir, getVerificationsDir(loomDir), getPhilosophyDir(loomDir));
      if (summary.healthy) {
        console.log('✓ 项目健康，未发现问题');
      } else {
        console.log(`发现 ${summary.total_issues} 个问题（fatal: ${summary.fatal}, high: ${summary.high}, medium: ${summary.medium}）`);
        for (const issue of issues) {
          const icon = issue.severity === 'fatal' ? '☠' : issue.severity === 'high' ? '⚠' : '·';
          console.log(`  ${icon} [${issue.severity}] ${issue.type}: ${issue.msg}`);
        }
      }
      break;
    }

    case 'context': {
      const loomDir = findLoomDir();
      output(contextSummary(loomDir, getVerificationsDir(loomDir), getPhilosophyDir(loomDir)));
      break;
    }

    case 'help': {
      // sub 是 topic（loom help workflow → sub='workflow'）
      // 过滤掉 --help/-h 这种被路由进来的情况
      const topic = (sub && !sub.startsWith('-')) ? sub : null;
      if (!topic) {
        console.log('LOOM 指南 topics:');
        for (const t of listHelpTopics()) {
          console.log(`  loom help ${t}`);
        }
        console.log('\n运行 loom --help 查看所有命令。');
      } else {
        const content = getHelpTopic(topic);
        if (!content) {
          die(`未知 topic: ${topic}\n可用 topics: ${listHelpTopics().join(', ')}`);
        }
        console.log(content);
      }
      break;
    }

    case '--help':
    case '-h':
    case undefined:
      console.log(`loom — LOOM 框架 CLI

用法:
  loom init                     初始化项目（创建 .loom/v1/ 骨架 + 模板）
  loom activate <role>          输出角色激活提示词（weaver|visionary|architect|forge|keeper）

  loom version list             列出所有版本（* 标记当前）
  loom version current          显示当前版本
  loom version new              创建 v{N+1} + 自动切换为当前
  loom version use <v>          切换当前版本
  loom version diff <v1> <v2>   对比两个版本的文件差异

  loom intent next              返回下一个可执行 Intent
  loom intent status            返回进度概览
  loom intent graph             输出 Mermaid 依赖图
  loom intent get <id>          返回某 Intent 完整信息
  loom intent narrative <id>    返回某 Intent 的意图叙事（解析 narrative_ref）
  loom intent validate          校验 Intent Map 结构
  loom intent trace <id>        返回某 Intent 的完整追溯链（依赖+验证+哲学+叙事）
  loom intent reverse-dep <id>  返回依赖某 Intent 的所有 Intent（变更影响评估）
  loom intent reverse-ref <anchor>  返回引用某哲学锚点的所有 Intent
  loom intent update <id> --status <s>  更新 Intent 状态（Keeper 用）

  loom doctor                   项目健康检查（一致性+孤儿引用+循环依赖+僵尸）
  loom context                  上下文摘要（进度+下一步+待验证+风险）
  loom help <topic>             分层指南（workflow|concepts|loop|version|doctor）

  loom philosophy get <anchor>  按锚点加载哲学章节
  loom philosophy list          列出哲学文档文件

  loom verify contract <id>     返回某 Intent 的验收契约（解析引用）
  loom verify history <id>      返回某 Intent 验证历史
  loom verify pending           返回待验证的 Intent
  loom verify list              列出所有验证记录
  loom verify write --json-file <path>  从文件读入并写入验证记录
  loom verify write --json <string>     从命令行字符串写入验证记录

参数:
  --loom-dir <path>  指定 .loom/v{N} 目录（默认读 .loom/current 指针）`);
      break;

    default:
      die(`未知命令: ${cmd}\n运行 loom --help 查看用法`);
  }
} catch (e) {
  die(e.message);
}
