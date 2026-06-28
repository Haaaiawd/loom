#!/usr/bin/env node
// loom — LOOM 框架的 CLI 传感器层
// Agent 通过这个 CLI 访问 Intent Map / 哲学 / 验证记录，不直接读文件。

import { argv, cwd, exit } from 'node:process';
import { resolve, join, dirname } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { findLoomRoot, findVersionDir, readCurrentPointer } from '../src/shared/paths.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

import { getNextIntent, getStatus, getDependencyGraph, getIntent, loadIntentMap, updateIntentStatus, getNarrative } from '../src/intent-map.js';
import { getPhilosophy, listPhilosophyFiles } from '../src/philosophy.js';
import { writeVerification, getVerificationHistory, getPendingVerifications, listVerifications, getVerificationContract } from '../src/verify.js';
import { initProject } from '../src/init.js';
import { activateRole } from '../src/activate.js';
import { listVersions, newVersion, useVersion, diffVersions } from '../src/version.js';
import { doctor, contextSummary, traceIntent, reverseDep, reverseRef } from '../src/diagnostics.js';
import { getHelpTopic, listHelpTopics } from '../src/help.js';
import { guideProject } from '../src/guide.js';
import { isAutoOn, autoOn, autoOff, autoStatus } from '../src/auto.js';
import { generatePreviewPrompt } from '../src/preview.js';

// ─── 路径解析 ──────────────────────────────────────────
// findLoomRoot / findVersionDir / readCurrentPointer 已提取到 shared/paths.js
// 这里只保留目录辅助函数。

function getPhilosophyDir(versionDir) {
  return join(versionDir, '00_PHILOSOPHY');
}

function getVerificationsDir(versionDir) {
  return join(versionDir, 'verifications');
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
    case '--version':
    case '-v': {
      // 从根 package.json 读版本号（cli/bin -> cli -> LOOM root）
      const pkgPath = resolve(__dirname, '..', '..', 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      console.log(`loom ${pkg.version}`);
      break;
    }

    case 'intent': {
      const versionDir = findVersionDir();
      switch (sub) {
        case 'next':
          output(getNextIntent(versionDir) ?? '没有可执行的 Intent');
          break;
        case 'status': {
          const s = getStatus(versionDir);
          const fmt = (ids) => ids.map((id) => s.titles[id] ? `${id}(${s.titles[id]})` : id).join(', ') || '-';
          console.log(`进度: ${s.counts.completed}/${s.counts.total} 完成`);
          console.log(`  pending:     ${s.counts.pending}    ${fmt(s.ids.pending)}`);
          console.log(`  in_progress: ${s.counts.in_progress}    ${fmt(s.ids.in_progress)}`);
          console.log(`  completed:   ${s.counts.completed}    ${fmt(s.ids.completed)}`);
          console.log(`  blocked:     ${s.counts.blocked}    ${fmt(s.ids.blocked)}`);
          break;
        }
        case 'graph':
          output(getDependencyGraph(versionDir));
          break;
        case 'get': {
          const id = rest[0];
          if (!id) die('用法: loom intent get <id>');
          output(getIntent(versionDir, id));
          break;
        }
        case 'narrative': {
          const id = rest[0];
          if (!id) die('用法: loom intent narrative <id>');
          output(getNarrative(versionDir, id));
          break;
        }
        case 'validate':
          loadIntentMap(versionDir);
          console.log('Intent Map 校验通过');
          break;
        case 'trace': {
          const id = rest[0];
          if (!id) die('用法: loom intent trace <id>');
          output(traceIntent(versionDir, getVerificationsDir(versionDir), getPhilosophyDir(versionDir), id));
          break;
        }
        case 'reverse-dep': {
          const id = rest[0];
          if (!id) die('用法: loom intent reverse-dep <id>');
          output(reverseDep(versionDir, id));
          break;
        }
        case 'reverse-ref': {
          const anchor = rest[0];
          if (!anchor) die('用法: loom intent reverse-ref <anchor>\n例: loom intent reverse-ref PRODUCT_PHILOSOPHY.md#core-belief');
          output(reverseRef(versionDir, anchor));
          break;
        }
        case 'update': {
          const id = rest[0];
          const statusFlagIdx = argv.indexOf('--status');
          const newStatus = statusFlagIdx !== -1 ? argv[statusFlagIdx + 1] : null;
          if (!id || !newStatus) die('用法: loom intent update <id> --status <pending|in_progress|completed|blocked|needs_review>');
          updateIntentStatus(versionDir, id, newStatus);
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
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('To Agent: 运行 loom guide 诊断当前阶段，按引导执行');
      console.log('To Human: 把以下指令给你的 AI agent:');
      console.log('  "项目已用 LOOM 初始化。请运行 loom guide 看下一步，');
      console.log('   然后激活 Weaver 角色织造产品哲学。"');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      break;
    }

    case 'activate': {
      const role = sub;
      if (!role) die('用法: loom activate <role>\n角色: weaver | visionary | architect | forge | keeper');
      // weaver 不需要 versionDir（项目还没初始化时也能激活）
      let versionDir = null;
      if (role !== 'weaver') {
        try {
          versionDir = findVersionDir();
        } catch (e) {
          // 只吞"找不到 .loom 目录"——其他错误（权限、磁盘）向上抛
          if (!String(e.message).includes('找不到 .loom')) throw e;
        }
      }
      const prompt = activateRole(role, versionDir);
      output(prompt);
      break;
    }

    case 'philosophy': {
      const versionDir = findVersionDir();
      switch (sub) {
        case 'get': {
          const anchor = rest[0];
          if (!anchor) die('用法: loom philosophy get <anchor>\n例: loom philosophy get PRODUCT_PHILOSOPHY.md#core-belief');
          output(getPhilosophy(getPhilosophyDir(versionDir), anchor));
          break;
        }
        case 'list':
          output(listPhilosophyFiles(getPhilosophyDir(versionDir)));
          break;
        default:
          die(`未知子命令: philosophy ${sub}\n用法: loom philosophy [get <anchor>|list]`);
      }
      break;
    }

    case 'verify': {
      const versionDir = findVersionDir();
      const verificationsDir = getVerificationsDir(versionDir);
      switch (sub) {
        case 'contract': {
          const id = rest[0];
          if (!id) die('用法: loom verify contract <id>');
          output(getVerificationContract(versionDir, id));
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
          output(getPendingVerifications(versionDir, verificationsDir));
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
            try {
              record = JSON.parse(readFileSync(argv[fileFlagIdx + 1], 'utf-8'));
            } catch (e) {
              die(`JSON 文件解析失败: ${argv[fileFlagIdx + 1]}\n原因: ${e.message}`);
            }
          } else if (jsonFlagIdx !== -1 && argv[jsonFlagIdx + 1]) {
            try {
              record = JSON.parse(argv[jsonFlagIdx + 1]);
            } catch (e) {
              die(`JSON 字符串解析失败: ${e.message}`);
            }
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
      const versionDir = findVersionDir();
      const { issues, summary } = doctor(versionDir, getVerificationsDir(versionDir), getPhilosophyDir(versionDir));
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
      const versionDir = findVersionDir();
      output(contextSummary(versionDir, getVerificationsDir(versionDir), getPhilosophyDir(versionDir)));
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

    case 'guide': {
      const result = guideProject(cwd());
      console.log(`阶段 ${result.stage_num}: ${result.stage}`);
      if (result.auto) {
        console.log(`模式: AUTO（自动执行，不等确认）`);
      } else {
        console.log(`模式: 手动（每步需用户确认）`);
      }
      console.log(`\n${result.message}`);
      console.log(`\n下一步: ${result.next_action}`);
      console.log(`  → ${result.next_command}`);
      if (!result.auto && result.stage_num > 0 && result.stage_num < 6) {
        console.log(`\n提示: 开启 AUTO 模式可自动连续执行 — loom auto on`);
      }
      break;
    }

    case 'auto': {
      const loomRoot = findLoomRoot();
      switch (sub) {
        case 'on':
          autoOn(loomRoot);
          console.log('AUTO 模式已开启。Agent 将自动连续执行，不等用户确认。');
          console.log('核心契约: 持续运行，除非出意外否则不允许私自停止。');
          console.log('  - L3 human_review 由 Keeper 自主判定，不停下等人类');
          console.log('  - 唯一允许停下的情况: blocked（依赖阻塞/契约无法判定/连续 3 轮 deviated 升级）');
          console.log('关闭: loom auto off');
          break;
        case 'off':
          autoOff(loomRoot);
          console.log('AUTO 模式已关闭。每步需要用户确认。');
          break;
        case 'status': {
          const status = autoStatus(loomRoot);
          if (status.on) {
            console.log(`AUTO 模式: 开启（自 ${status.since}）`);
            console.log('  规则: stage 1-3（哲学/愿景/架构）需人类 review，stage 4+（Intent Loop）自动执行');
            if (status.heartbeat) {
              const hb = status.heartbeat;
              console.log(`  心跳: ${hb.timestamp}`);
              console.log(`    阶段: ${hb.stage} (stage ${hb.stage_num})`);
              console.log(`    下一步: ${hb.next_action}`);
              console.log(`    命令: ${hb.next_command}`);
            } else {
              console.log('  心跳: 尚未记录（运行 loom guide 后生成）');
            }
          } else {
            console.log('AUTO 模式: 关闭（所有阶段都需人类确认）');
          }
          break;
        }
        default:
          die(`未知子命令: auto ${sub}\n用法: loom auto [on|off|status]`);
      }
      break;
    }

    case 'preview': {
      const previewFile = join(cwd(), 'loom-preview.html');
      const hasPreview = existsSync(previewFile);
      const regenOnly = argv.includes('--regen') || argv.includes('-r');

      // 已有 HTML 且没指定 --regen：直接打开浏览器
      if (hasPreview && !regenOnly) {
        const { spawn } = await import('node:child_process');
        const target = previewFile.replace(/\\/g, '/');
        if (process.platform === 'win32') {
          spawn('cmd', ['/c', 'start', target], { detached: true, stdio: 'ignore' }).unref();
        } else if (process.platform === 'darwin') {
          spawn('open', [target], { detached: true, stdio: 'ignore' }).unref();
        } else {
          spawn('xdg-open', [target], { detached: true, stdio: 'ignore' }).unref();
        }
        console.log(`已打开浏览器: ${previewFile}`);
        console.log(`重新生成: loom preview --regen`);
        break;
      }

      // 没有 HTML 或指定 --regen：输出提示词让 AI 生成
      const prompt = generatePreviewPrompt();
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('To Agent: 按以下提示词读 .loom/ 文件并生成 loom-preview.html');
      console.log('  生成完成后再次运行 loom preview 会自动打开浏览器');
      console.log('To Human: 把以下内容给你的 AI agent');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log(prompt);
      break;
    }

    case '--help':
    case '-h':
    case undefined:
      console.log(`loom — LOOM 框架 CLI
哲学驱动开发：哲学 → 愿景 → 架构 → Intent Loop

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To Agent:
  你是 AI agent。本项目使用 LOOM 框架。
  第一步: 运行 loom guide 诊断当前阶段
  第二步: 按引导执行对应命令
  学习: loom help <topic> 获取详细指南
  状态: loom context 获取当前进度
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To Human:
  请把以下指令给你的 AI agent:
  "请用 LOOM 框架初始化并推进这个项目。
   先运行 loom --help 了解命令，再运行 loom guide 看当前阶段，
   然后按引导一步步执行。"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

用法:
  loom init                     初始化项目（创建 .loom/v1/ 骨架 + 模板）
  loom guide                    诊断当前阶段，输出下一步引导
  loom auto on|off|status       AUTO 模式开关（on 时 Agent 自动连续执行）
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
  loom preview                  已有 HTML 则打开浏览器，否则输出提示词让 AI 生成
  loom preview --regen          强制重新输出提示词（让 AI 重新生成 HTML）
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
