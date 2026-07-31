#!/usr/bin/env node
// loom — LOOM 框架的 CLI 传感器层
// Agent 通过这个 CLI 访问 Intent Map / 哲学 / 验证记录，不直接读文件。

import { argv, cwd, env, exit } from 'node:process';
import { resolve, join, dirname } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { findLoomRoot, findVersionDir, readCurrentPointer } from '../src/shared/paths.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

import { deprecateIntent, getNextIntent, getStatus, getDependencyGraph, getIntent, loadIntentMap, updateIntentStatus, getNarrative, diffIntentVersions } from '../src/intent-map.js';
import { assessPhilosophyImpact, getPhilosophy, listPhilosophyFiles, revisePhilosophy, validateInspirationSources } from '../src/philosophy.js';
import { writeVerification, createQuickVerification, getVerificationHistory, getAcrossVersionVerificationHistory, getPendingVerifications, listVerifications, getVerificationContract, isVerificationCurrent } from '../src/verify.js';
import { initProject } from '../src/init.js';
import { activateRole } from '../src/activate.js';
import { listVersions, newVersion, useVersion, diffVersions } from '../src/version.js';
import { doctor, contextSummary, traceIntent, reverseDep, reverseRef } from '../src/diagnostics.js';
import { getHelpTopic, listHelpTopics } from '../src/help.js';
import { guideProject } from '../src/guide.js';
import { isAutoOn, autoOn, autoOff, autoStatus, getAutoMode } from '../src/auto.js';
import { generatePreviewPrompt, getPreviewStatus } from '../src/preview.js';
import { getPatch, listPatches, recordPatch, validatePatches } from '../src/patch.js';
import { addIntentDraft, finalizeIntentDraft, getIntentDraft, reviseIntentDraft } from '../src/intent-draft.js';
import { resolveIntentRef } from '../src/shared/intent-ref.js';
import { compileCapabilityInputs, getCapabilityCoverage, getCapabilityFrontier, getCapabilityGraphProjection, getCapabilityNode } from '../src/capability-graph.js';
import { getAsset, importAsset, listAssets, recoverAssetImportTransaction, searchAssets, validateAssetLibrary } from '../src/asset-library.js';
import { closeCapabilityProposal, decideCapabilityProposal, getCapabilityProposal, listCapabilityProposals, submitCapabilityProposal } from '../src/capability-proposals.js';
import { getAtelierRecord, initAtelierRecord, validateAtelierRecord } from '../src/atelier.js';
import { assertExpertiseReady, getExpertisePack, initExpertisePack, validateExpertisePack } from '../src/expertise-pack.js';

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

    case 'capability': {
      const versionDir = findVersionDir();
      switch (sub) {
        case 'graph':
          output(getCapabilityGraphProjection(versionDir));
          break;
        case 'frontier':
          output(getCapabilityFrontier(versionDir));
          break;
        case 'get': {
          const id = rest[0];
          if (!id) die('用法: loom capability get <node-id>');
          output(getCapabilityNode(versionDir, id));
          break;
        }
        case 'coverage':
          output(getCapabilityCoverage(versionDir));
          break;
        case 'compile': {
          const intentId = rest[0];
          if (!intentId) die('用法: loom capability compile <intent-id>');
          output(compileCapabilityInputs(versionDir, intentId));
          break;
        }
        case 'proposal': {
          const action = rest[0];
          if (action === 'list') output(listCapabilityProposals(versionDir));
          else if (action === 'get') {
            if (!rest[1]) die('用法: loom capability proposal get <CGP-ID>');
            output(getCapabilityProposal(versionDir, rest[1]));
          } else if (action === 'submit') {
            const fileIndex = argv.indexOf('--json-file');
            const path = fileIndex === -1 ? null : argv[fileIndex + 1];
            if (!path) die('用法: loom capability proposal submit --json-file <proposal.json>');
            output(submitCapabilityProposal(versionDir, JSON.parse(readFileSync(path, 'utf-8'))));
          } else if (action === 'decide') {
            const rationaleIndex = argv.indexOf('--rationale');
            if (!rest[1] || !rest[2] || rationaleIndex === -1 || !argv[rationaleIndex + 1]) die('用法: loom capability proposal decide <CGP-ID> <decision> --rationale <text>');
            output(decideCapabilityProposal(versionDir, rest[1], rest[2], argv[rationaleIndex + 1]));
          } else if (action === 'close') {
            const resolutionIndex = argv.indexOf('--resolution-file');
            if (!rest[1] || resolutionIndex === -1 || !argv[resolutionIndex + 1]) die('用法: loom capability proposal close <CGP-ID> --resolution-file <resolution.json>');
            output(closeCapabilityProposal(versionDir, rest[1], JSON.parse(readFileSync(argv[resolutionIndex + 1], 'utf-8'))));
          } else die('用法: loom capability proposal [list|get|submit|decide|close]');
          break;
        }
        default:
          die(`未知 capability 子命令: ${sub}\n用法: loom capability [graph|frontier|get|coverage|compile|proposal]`);
      }
      break;
    }

    case 'asset': {
      const versionDir = findVersionDir();
      switch (sub) {
        case 'import': {
          const filePath = rest[0];
          const option = (name) => {
            const index = argv.indexOf(name);
            return index === -1 ? undefined : argv[index + 1];
          };
          if (!filePath || filePath.startsWith('--')) die('用法: loom asset import <本地文件> --tags <标签,...> --source <来源> --author <作者> --license <许可> --approval approved [--kind image] [--evidence <节点,...>]');
          output(importAsset(versionDir, filePath, {
            tags: option('--tags'), source: option('--source'), author: option('--author'), license: option('--license'),
            approval: option('--approval'), kind: option('--kind'), evidenceRefs: option('--evidence'),
            failureInjection: env.NODE_ENV === 'test' && option('--test-fail-after') === 'manifest' ? 'after_manifest'
              : env.NODE_ENV === 'test' && option('--test-fail-after') === 'crash-manifest' ? 'crash_after_manifest' : undefined,
          }));
          break;
        }
        case 'list': output(listAssets(versionDir)); break;
        case 'search': {
          const query = rest[0];
          if (!query) die('用法: loom asset search <查询>');
          output(searchAssets(versionDir, query));
          break;
        }
        case 'get': {
          const id = rest[0];
          if (!id) die('用法: loom asset get <asset-id>');
          output(getAsset(versionDir, id));
          break;
        }
        case 'validate': {
          const recovery = recoverAssetImportTransaction(versionDir);
          output({ valid: true, assets: Object.keys(validateAssetLibrary(versionDir).assets).length, recovered_transaction: recovery.recovered ? recovery : null });
          break;
        }
        default: die(`未知 asset 子命令: ${sub}\n用法: loom asset [import|list|search|get|validate]`);
      }
      break;
    }

    case 'atelier': {
      const versionDir = findVersionDir();
      const intentId = rest[0];
      if (!intentId) die(`用法: loom atelier ${sub || '<init|get|validate>'} <intent-id>`);
      switch (sub) {
        case 'init':
          output(initAtelierRecord(versionDir, intentId));
          break;
        case 'get':
          output(getAtelierRecord(versionDir, intentId));
          break;
        case 'validate':
          output(validateAtelierRecord(versionDir, intentId));
          break;
        default:
          die(`未知 atelier 子命令: ${sub}\n用法: loom atelier [init|get|validate] <intent-id>`);
      }
      break;
    }

    case 'expertise': {
      const versionDir = findVersionDir();
      const intentId = rest[0];
      if (!intentId) die(`用法: loom expertise ${sub || '<init|get|validate>'} <intent-id>`);
      switch (sub) {
        case 'init':
          output(initExpertisePack(versionDir, intentId));
          break;
        case 'get':
          output(getExpertisePack(versionDir, intentId));
          break;
        case 'validate':
          output(validateExpertisePack(versionDir, intentId));
          break;
        default:
          die(`未知 expertise 子命令: ${sub}\n用法: loom expertise [init|get|validate] <intent-id>`);
      }
      break;
    }

    case 'intent': {
      const versionDir = findVersionDir();
      switch (sub) {
        case 'add': {
          const titleIdx = argv.indexOf('--title');
          const dependsIdx = argv.indexOf('--depends-on');
          const title = titleIdx !== -1 ? argv[titleIdx + 1] : null;
          const dependencies = dependsIdx !== -1 && argv[dependsIdx + 1]
            ? argv[dependsIdx + 1].split(',').map((id) => id.trim()).filter(Boolean)
            : [];
          if (!title) die('用法: loom intent add --title <text> [--depends-on INT-001,INT-002]');
          output(addIntentDraft(versionDir, title, dependencies));
          break;
        }
        case 'revise': {
          const id = rest[0];
          const reasonIdx = argv.indexOf('--reason');
          const reason = reasonIdx !== -1 ? argv[reasonIdx + 1] : null;
          if (!id || !reason) die('用法: loom intent revise <id> --reason <text>');
          output(reviseIntentDraft(versionDir, id, reason));
          break;
        }
        case 'draft': {
          const id = rest[0];
          if (!id) die('用法: loom intent draft <id>');
          output(getIntentDraft(versionDir, id));
          break;
        }
        case 'finalize': {
          const id = rest[0];
          if (!id) die('用法: loom intent finalize <id>');
          const parseIds = (name) => {
            const index = argv.indexOf(name);
            if (index === -1) return [];
            const value = argv[index + 1];
            if (!value || value.startsWith('--')) die(`${name} 需要逗号分隔的 Intent ID`);
            return value.split(',').map((item) => item.trim()).filter(Boolean);
          };
          output(finalizeIntentDraft(versionDir, id, {
            review: parseIds('--review'),
            unaffected: parseIds('--unaffected'),
          }));
          break;
        }
        case 'deprecate': {
          const id = rest[0];
          const readFlag = (name) => {
            const index = argv.indexOf(name);
            return index === -1 ? null : argv[index + 1];
          };
          const parseIds = (name) => {
            const value = readFlag(name);
            if (value === null) return [];
            if (!value || value.startsWith('--')) die(`${name} 需要逗号分隔的 Intent ID`);
            return value.split(',').map((item) => item.trim()).filter(Boolean);
          };
          const reason = readFlag('--reason');
          if (!id || !reason || reason.startsWith('--')) die('用法: loom intent deprecate <id> --reason <text> [--confirm [--replacement <id>] [--review <ids>] [--unaffected <ids>]]');
          const replacement = readFlag('--replacement');
          if (argv.includes('--replacement') && (!replacement || replacement.startsWith('--'))) die('--replacement 需要当前版本的 Intent ID');
          output(deprecateIntent(versionDir, id, {
            reason,
            confirm: argv.includes('--confirm'),
            replacement,
            review: parseIds('--review'),
            unaffected: parseIds('--unaffected'),
          }));
          break;
        }
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
          console.log(`  needs_review: ${s.counts.needs_review}    ${fmt(s.ids.needs_review)}`);
          console.log(`  deprecated:   ${s.counts.deprecated}    ${fmt(s.deprecated)}`);
          break;
        }
        case 'graph':
          output(getDependencyGraph(versionDir));
          break;
        case 'get': {
          const id = rest[0];
          if (!id) die('用法: loom intent get <id>');
          const resolved = resolveIntentRef(versionDir, id);
          output(getIntent(resolved.versionDir, resolved.intentId));
          break;
        }
        case 'narrative': {
          const id = rest[0];
          if (!id) die('用法: loom intent narrative <id>');
          const resolved = resolveIntentRef(versionDir, id);
          output(getNarrative(resolved.versionDir, resolved.intentId));
          break;
        }
        case 'diff': {
          const from = rest[0];
          const to = rest[1];
          if (!from || !to) die('用法: loom intent diff <v1> <v2>');
          output(diffIntentVersions(findLoomRoot(), from, to));
          break;
        }
        case 'validate':
          loadIntentMap(versionDir);
          console.log('Intent Map 校验通过');
          break;
        case 'trace': {
          const id = rest[0];
          if (!id) die('用法: loom intent trace <id>');
          const resolved = resolveIntentRef(versionDir, id);
          output(traceIntent(resolved.versionDir, getVerificationsDir(resolved.versionDir), getPhilosophyDir(resolved.versionDir), resolved.intentId));
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
        case 'done': {
          // loom intent done <id> — 自动走 pending→in_progress→completed，检查验证记录
          const id = rest[0];
          if (!id) die('用法: loom intent done <id>');
          const verificationsDir = getVerificationsDir(versionDir);
          // 检查有没有验证记录
          const history = getVerificationHistory(verificationsDir, id);
          if (!history || history.records.length === 0) {
            die(`${id} 没有验证记录。先跑: loom verify pass ${id} --summary "..."`);
          }
          // 最新记录必须针对当前 revision 且通过，旧 revision 的通过不能闭合 Intent。
          const latest = history.records[history.records.length - 1];
          if (latest.verdict !== 'passed') {
            die(`${id} 最新验证记录是 ${latest.verdict}（非 passed）。只有 passed 的 Intent 才能 done。`);
          }
          // 获取当前状态，自动走两步
          const intent = getIntent(versionDir, id);
          if (!isVerificationCurrent(intent, latest)) {
            die(`${id} 最新 passed 验证不属于当前 Intent revision ${intent.revision ?? 1}。先重新验证。`);
          }
          const expertise = assertExpertiseReady(versionDir, id);
          if (expertise && (latest.expertise?.record_ref !== `10_EXPERTISE_PACKS/${id}.json`
            || latest.expertise?.intent_revision !== expertise.intent_revision
            || latest.expertise?.source_count !== expertise.source_count
            || latest.expertise?.capsule_count !== expertise.capsule_count
            || latest.expertise?.pack_digest !== expertise.pack_digest)) {
            die(`${id} 最新 passed 未绑定当前 Expertise Pack。请在新的 Keeper task 中重新打开来源并验证。`);
          }
          if (intent.quality_strategy === 'atelier') {
            const atelier = validateAtelierRecord(versionDir, id);
            if (!['selected', 'baseline_retained'].includes(atelier.status)) {
              die(`${id} 的 Atelier Record 尚未完成选择（当前: ${atelier.status}）`);
            }
            if (latest.atelier?.record_ref !== `09_ATELIER/${id}.json`
              || latest.atelier?.stance_revision !== atelier.stance_revision
              || latest.atelier?.status !== atelier.status) {
              die(`${id} 最新 passed 未绑定当前 Atelier Record 与 stance_revision。请在新的 Keeper task 中重新验证。`);
            }
          }
          const currentStatus = intent.status;
          if (currentStatus === 'completed') {
            console.log(`${id} 已经是 completed，无需操作`);
            break;
          }
          if (currentStatus === 'pending') {
            updateIntentStatus(versionDir, id, 'in_progress');
          }
          updateIntentStatus(versionDir, id, 'completed');
          console.log(`${id} 已完成（${currentStatus} → completed）`);
          break;
        }
        default:
          die(`未知子命令: intent ${sub}\n用法: loom intent [add|revise|draft|finalize|deprecate|next|status|graph|get|narrative|diff|validate|trace|reverse-dep|reverse-ref|update|done]`);
      }
      break;
    }

    case 'init': {
      if (sub === '--help' || sub === '-h') {
        console.log('用法: loom init\\n\\n在当前目录创建 LOOM 项目骨架。若目录已有 .loom/，不会覆盖现有文件。');
        break;
      }
      const result = initProject(cwd());
      console.log('LOOM 项目已初始化');
      for (const c of result.created) console.log(`  [created] ${c}`);
      for (const s of result.skipped) console.log(`  [skipped] ${s} (already exists)`);
      if (result.created.length === 0 && result.skipped.length > 0) {
        console.log('  所有文件已存在，无需操作。');
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
      const intentIdx = argv.indexOf('--intent');
      const intentId = intentIdx !== -1 ? argv[intentIdx + 1] : null;
      if (intentIdx !== -1 && !intentId) die('用法: loom activate <role> --intent <id>');
      const prompt = activateRole(role, versionDir, intentId);
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
        case 'impact': {
          const anchor = rest[0];
          if (!anchor) die('用法: loom philosophy impact <anchor>');
          output(assessPhilosophyImpact(versionDir, anchor));
          break;
        }
        case 'revise': {
          const anchor = rest[0];
          const readFlag = (name) => {
            const index = argv.indexOf(name);
            return index === -1 ? null : argv[index + 1];
          };
          const parseIds = (name) => {
            const value = readFlag(name);
            if (value === null) return [];
            if (!value || value.startsWith('--')) die(`${name} 需要逗号分隔的 Intent ID`);
            return value.split(',').map((item) => item.trim()).filter(Boolean);
          };
          const classification = readFlag('--classification');
          const reason = readFlag('--reason');
          if (!anchor || !classification || classification.startsWith('--') || !reason || reason.startsWith('--')) {
            die('用法: loom philosophy revise <anchor> --classification <clarification|minor|major> --reason <text> [--confirm --review <ids> --unaffected <ids>]');
          }
          output(revisePhilosophy(versionDir, anchor, {
            classification,
            reason,
            confirm: argv.includes('--confirm'),
            review: parseIds('--review'),
            unaffected: parseIds('--unaffected'),
          }));
          break;
        }
        case 'check': {
          const philDir = getPhilosophyDir(versionDir);
          const inspiration = validateInspirationSources(philDir);
          const allIssues = inspiration.issues;
          const allPassed = inspiration.passed;

          // --json: 结构化输出，供 Agent 程序化消费
          if (argv.includes('--json')) {
            output({
              passed: allPassed,
              issues: allIssues,
              sources: inspiration.sources.map(({ file, sources }) => ({ file, count: sources.length })),
            });
            exit(allPassed ? 0 : 1);
          }

          if (allPassed) {
            console.log('✓ 哲学文档校验通过');
            console.log('  灵感来源:');
            for (const { file, sources } of inspiration.sources) {
              console.log(`    ${file}: ${sources.length} 个源`);
            }
          } else {
            const high = allIssues.filter((i) => i.severity === 'high').length;
            const medium = allIssues.filter((i) => i.severity === 'medium').length;
            console.log(`✗ 哲学文档校验未通过（${allIssues.length} 个问题: ${high} high, ${medium} medium）`);
            for (const issue of allIssues) {
              const icon = issue.severity === 'high' ? '⚠' : '·';
              console.log(`  ${icon} [${issue.severity}] ${issue.msg}`);
            }
            console.log('\n参见 meta/PHILOSOPHY_WEAVER.md + dimensions/SEARCH_METHODOLOGY.md。');
            exit(1);
          }
          break;
        }
        default:
          die(`未知子命令: philosophy ${sub}\n用法: loom philosophy [get <anchor>|list|check|impact <anchor>|revise <anchor> --classification <clarification|minor|major> --reason <text>]`);
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
          if (argv.includes('--across-versions')) {
            output(getAcrossVersionVerificationHistory(versionDir, id));
          } else {
            const resolved = resolveIntentRef(versionDir, id);
            const history = getVerificationHistory(getVerificationsDir(resolved.versionDir), resolved.intentId);
            output(history ?? `没有 ${resolved.ref} 的验证记录`);
          }
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
          const result = writeVerification(versionDir, verificationsDir, record);
          console.log(`验证记录已写入: ${result.filePath}`);
          console.log(`  轮次: ${result.round}, verdict: ${record.verdict}`);
          if (record.verdict === 'deviated') {
            console.log(`  deviated 累计: ${result.deviated_count} 轮`);
            if (result.should_escalate) {
              updateIntentStatus(versionDir, record.intent_id, 'blocked');
              console.log(`  ⚠ 已达到 3 轮上限，${record.intent_id} 已自动升级为 blocked`);
            }
          }
          break;
        }
        case 'pass':
        case 'fail': {
          // loom verify pass <id> --summary "..." --verified-by <id> --verification-context <independent_thread|human_review>
          // loom verify fail <id> --summary "..." [--deviation "..."] [--reproduction-command "..."]
          const id = rest[0];
          if (!id) die(`用法: loom verify ${sub} <id> --summary "..." [--reproduction-command "..."]${sub === 'pass' ? ' [--preservation-evidence "..."] [--quality-proof "..."]' : ' [--deviation "..."]'}`);
          const summaryIdx = argv.indexOf('--summary');
          const reproIdx = argv.indexOf('--reproduction-command');
          const deviationIdx = argv.indexOf('--deviation');
          const qualityProofIdx = argv.indexOf('--quality-proof');
          const preservationIdx = argv.indexOf('--preservation-evidence');
          const verifiedByIdx = argv.indexOf('--verified-by');
          const verificationContextIdx = argv.indexOf('--verification-context');
          const summary = summaryIdx !== -1 ? argv[summaryIdx + 1] : null;
          if (!summary) die(`缺少 --summary: loom verify ${sub} ${id} --summary "..."`);
          const intent = getIntent(versionDir, id);
          if (sub === 'pass' && intent.continuity_required && !(preservationIdx !== -1 && argv[preservationIdx + 1])) {
            die(`Intent ${id} 声明了 continuity_required；通过前必须提供 --preservation-evidence，证明旧状态 → 新操作后的完整序列未发生未授权丢失。`);
          }
          if (sub === 'pass' && intent.quality_contract && !(qualityProofIdx !== -1 && argv[qualityProofIdx + 1])) {
            die(`Intent ${id} 声明了 quality_contract；通过前必须提供 --quality-proof，指向项目内真实的 Quality Proof Markdown 锚点。`);
          }
          if (sub === 'pass' && !(verifiedByIdx !== -1 && argv[verifiedByIdx + 1] && verificationContextIdx !== -1 && argv[verificationContextIdx + 1])) {
            die(`Intent ${id} 通过前必须声明独立验证来源：--verified-by <thread/run/人类标识> --verification-context <independent_thread|human_review>。同一会话自检请记录为自检，不得写 passed。`);
          }
          const extras = {};
          if (reproIdx !== -1 && argv[reproIdx + 1]) extras.reproduction_command = argv[reproIdx + 1];
          if (sub === 'fail' && deviationIdx !== -1 && argv[deviationIdx + 1]) extras.deviation_detail = argv[deviationIdx + 1];
          if (sub === 'pass' && qualityProofIdx !== -1 && argv[qualityProofIdx + 1]) extras.quality_proof_ref = argv[qualityProofIdx + 1];
          if (sub === 'pass' && preservationIdx !== -1 && argv[preservationIdx + 1]) extras.preservation_evidence = argv[preservationIdx + 1];
          if (sub === 'pass') extras.verification_provenance = { verified_by: argv[verifiedByIdx + 1], context: argv[verificationContextIdx + 1] };
          const verdict = sub === 'pass' ? 'passed' : 'deviated';
          const result = createQuickVerification(versionDir, verificationsDir, id, verdict, summary, extras);
          console.log(`验证记录已写入: ${result.filePath}`);
          console.log(`  轮次: ${result.round}, verdict: ${verdict}`);
          if (verdict === 'deviated') {
            console.log(`  deviated 累计: ${result.deviated_count} 轮`);
            if (result.should_escalate) {
              updateIntentStatus(versionDir, id, 'blocked');
              console.log(`  ⚠ 已达到 3 轮上限，${id} 已自动升级为 blocked`);
            }
          }
          break;
        }
        default:
          die(`未知子命令: verify ${sub}\n用法: loom verify [contract <id>|history <id>|pending|list|write --json-file <path>|--json <string>|pass <id> --summary "..."|fail <id> --summary "..."]`);
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

    case 'patch': {
      const versionDir = findVersionDir();
      switch (sub) {
        case 'record': {
          const fileFlagIdx = argv.indexOf('--json-file');
          const inputPath = fileFlagIdx !== -1 ? argv[fileFlagIdx + 1] : null;
          if (!inputPath) die('用法: loom patch record --json-file <path>');
          let record;
          try {
            record = JSON.parse(readFileSync(inputPath, 'utf-8'));
          } catch (e) {
            die(`JSON 文件解析失败: ${inputPath}\n原因: ${e.message}`);
          }
          output(recordPatch(versionDir, record));
          break;
        }
        case 'list':
          output(listPatches(versionDir));
          break;
        case 'get': {
          const id = rest[0];
          if (!id) die('用法: loom patch get <id>');
          output(getPatch(versionDir, id));
          break;
        }
        case 'validate':
          output(validatePatches(versionDir));
          break;
        default:
          die(`未知子命令: patch ${sub}\n用法: loom patch [record --json-file <path>|list|get <id>|validate]`);
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
          if (issue.fix_hint) {
            console.log(`    → 修复: ${issue.fix_hint}`);
          }
        }
        console.log(`\n参见 meta/PHILOSOPHY_WEAVER.md + dimensions/SEARCH_METHODOLOGY.md。`);
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
      const dryRun = argv.includes('--dry-run');
      const jsonOut = argv.includes('--json');
      const result = guideProject(cwd(), { dryRun });
      if (jsonOut) {
        output(result);
        break;
      }
      console.log(`阶段 ${result.stage_num}: ${result.stage}`);
      if (dryRun) {
        console.log('诊断: dry-run（不写 heartbeat）');
      }
      const modeDesc = {
        'manual': '手动（每步需确认）',
        'auto-loop': 'AUTO auto-loop（设计阶段需 review，Intent Loop 自动）',
        'auto-design': 'AUTO auto-design（全部自动）',
      };
      console.log(`模式: ${modeDesc[result.auto_mode] || result.auto_mode}`);
      console.log(`\n${result.message}`);
      console.log(`\n下一步: ${result.next_action}`);
      console.log(`  → ${result.next_command}`);
      if (result.inputs && result.inputs.length > 0) {
        console.log(`\n需要读取:`);
        for (const f of result.inputs) console.log(`  - ${f}`);
      }
      if (result.outputs && result.outputs.length > 0) {
        console.log(`\n需要产出:`);
        for (const f of result.outputs) console.log(`  - ${f}`);
      }
      if (result.verify_command) {
        console.log(`\n完成后校验: ${result.verify_command}`);
      }
      if (result.auto_mode === 'manual' && result.stage_num > 0 && result.stage_num < 6) {
        console.log(`\n提示: 开启 AUTO 模式可自动连续执行 — loom auto on`);
      }
      break;
    }

    case 'auto': {
      const loomRoot = findLoomRoot();
      switch (sub) {
        case 'on': {
          // loom auto on → auto-loop（默认）
          // loom auto on --design → auto-design
          const wantDesign = argv.includes('--design');
          const mode = wantDesign ? 'auto-design' : 'auto-loop';
          autoOn(loomRoot, mode);
          if (mode === 'auto-design') {
            console.log('AUTO 模式: auto-design（全部自动，含哲学/愿景/架构）');
            console.log('Agent 自动连续执行所有阶段，不等人类确认。');
          } else {
            console.log('AUTO 模式: auto-loop（Intent Loop 自动，设计阶段需 review）');
            console.log('  - stage 1-3（哲学/愿景/架构）：自动执行但需人类 review');
            console.log('  - stage 4+（Intent Loop）：自动连续执行');
          }
          console.log('核心契约: 持续运行，除非出意外否则不允许私自停止。');
          console.log('  - L3 human_review 由 Keeper 自主判定，不停下等人类');
          console.log('  - 唯一允许停下的情况: blocked（依赖阻塞/契约无法判定/连续 3 轮 deviated 升级）');
          console.log('切换: loom auto on --design | loom auto off');
          break;
        }
        case 'off':
          autoOff(loomRoot);
          console.log('AUTO 模式: manual（每步需人类确认）');
          break;
        case 'status': {
          const status = autoStatus(loomRoot);
          const modeDesc = {
            'manual': 'manual（每步需人类确认）',
            'auto-loop': 'auto-loop（Intent Loop 自动，设计阶段需 review）',
            'auto-design': 'auto-design（全部自动，含哲学/愿景/架构）',
          };
          console.log(`AUTO 模式: ${modeDesc[status.mode] || status.mode}`);
          if (status.mode === 'auto-loop') {
            console.log('  规则: stage 1-3 需人类 review，stage 4+ 自动执行');
          } else if (status.mode === 'auto-design') {
            console.log('  规则: 全部阶段自动执行，不需人类 review');
          }
          if (status.heartbeat) {
            const hb = status.heartbeat;
            console.log(`  心跳: ${hb.timestamp}`);
            console.log(`    阶段: ${hb.stage} (stage ${hb.stage_num})`);
            console.log(`    下一步: ${hb.next_action}`);
            console.log(`    命令: ${hb.next_command}`);
          } else if (status.mode !== 'manual') {
            console.log('  心跳: 尚未记录（运行 loom guide 后生成）');
          }
          break;
        }
        default:
          die(`未知子命令: auto ${sub}\n用法: loom auto [on [--design]|off|status]`);
      }
      break;
    }

    case 'preview': {
      const previewFile = join(cwd(), 'loom-preview.html');
      if (argv.includes('--help') || argv.includes('-h')) {
        console.log(`用法:
  loom preview              打开新鲜 preview；过期时提示重新生成
  loom preview --regen      输出生成提示词，让 Agent 重写 loom-preview.html
  loom preview status       检查 preview 是否存在、是否新鲜
  loom preview --stale      强行打开过期 preview
  loom preview --help       显示本帮助`);
        break;
      }
      const status = getPreviewStatus(cwd());
      const hasPreview = status.exists;
      const regenOnly = argv.includes('--regen') || argv.includes('-r');
      const openStale = argv.includes('--stale');

      if (sub === 'status') {
        output(status);
        break;
      }

      // 已有 HTML 且没指定 --regen：直接打开浏览器
      if (hasPreview && !regenOnly) {
        if (!status.fresh && !openStale) {
          console.log('preview 已过期：.loom 源文件比 loom-preview.html 更新。');
          console.log(`  preview: ${status.preview_mtime || '未知'}`);
          console.log(`  最新源: ${status.source_latest_mtime || '未知'} ${status.latest_source_file ? `(${status.latest_source_file})` : ''}`);
          console.log('\n下一步: loom preview --regen');
          console.log('强行打开旧 preview: loom preview --stale');
          break;
        }
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
        console.log(status.fresh ? `重新生成: loom preview --regen` : `已打开旧 preview。重新生成: loom preview --regen`);
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
  loom guide --dry-run          只读诊断当前阶段，不写 heartbeat
  loom auto on|off|status       AUTO 编排协议开关（由 Agent/runtime 消费，不由 CLI 自行执行）
  loom activate <role> [--intent <id>]  输出普通或 Intent-scoped 角色激活提示词

  loom version list             列出所有版本（* 标记当前）
  loom version current          显示当前版本
  loom version new              创建 v{N+1} + 自动切换为当前
  loom version use <v>          切换当前版本
  loom version diff <v1> <v2>   对比两个版本的文件差异

  loom patch record --json-file <path>  记录 Patch 并生成 Markdown 投影
  loom patch list               列出当前版本的 Patch
  loom patch get <id>           返回指定 Patch
  loom patch validate           校验 Patch ledger 和 Markdown 投影

  loom capability graph         输出 Capability Graph 的 Mermaid 投影与摘要
  loom capability frontier      列出尚未路由的高影响节点
  loom capability get <id>      返回节点、关系、Brief 与 Intent 回链
  loom capability coverage      检查图谱覆盖、Brief 和 Intent 回链
  loom capability compile <id>  只读显示会进入该 Intent 的能力输入
  loom expertise init <id>      创建当前 Intent 的外部能力获取记录
  loom expertise get <id>       返回并校验当前 Expertise Pack
  loom expertise validate <id>  校验检索、来源、Capsule 与 revision
  loom atelier init <id>        为 atelier Intent 创建唯一创作记录
  loom atelier get <id>         返回并校验当前 Atelier Record
  loom atelier validate <id>    校验 Record、revision、候选与证据引用

  loom intent next              返回下一个可执行 Intent
  loom intent add --title <text> [--depends-on <ids>]  创建新增 draft
  loom intent revise <id> --reason <text>  创建修订 draft 并报告反向依赖
  loom intent draft <id>        查看 draft
  loom intent finalize <id>     校验并原子写入官方 Intent Map
  loom intent deprecate <id> --reason <text>  只读评估；加 --confirm 才弃用
  loom intent status            返回进度概览
  loom intent graph             输出 Mermaid 依赖图
  loom intent get <id>          返回某 Intent 完整信息
  loom intent narrative <id>    返回某 Intent 的意图叙事（解析 narrative_ref）
  loom intent diff <v1> <v2>    按显式 lineage 对比 Intent 语义
  loom intent validate          校验 Intent Map 结构
  loom intent trace <id>        返回某 Intent 的完整追溯链（依赖+验证+哲学+叙事）
  loom intent reverse-dep <id>  返回依赖某 Intent 的所有 Intent（变更影响评估）
  loom intent reverse-ref <anchor>  返回引用某哲学锚点的所有 Intent
  loom intent update <id> --status <s>  更新 Intent 状态（Keeper 用）
  loom intent done <id>          当前 revision 验证通过后闭合 Intent

  loom doctor                   项目健康检查（一致性+孤儿引用+循环依赖+僵尸）
  loom context                  上下文摘要（进度+下一步+待验证+风险）
  loom preview                  打开新鲜 HTML；过期则提示重新生成
  loom preview status           检查 preview 是否存在、是否新鲜
  loom preview --regen          强制重新输出提示词（让 AI 重新生成 HTML）
  loom preview --stale          强行打开过期 preview
  loom help <topic>             分层指南（含 patch 工作流）

  loom philosophy get <anchor>  按锚点加载哲学章节
  loom philosophy list          列出哲学文档文件
  loom philosophy check         校验灵感来源质量（源数量/多样性/理由）
  loom philosophy impact <anchor>  只读分析直接引用和传递影响
  loom philosophy revise <anchor> --classification <type> --reason <text>  只读评估；加 --confirm 才记录 clarification/minor

  loom verify contract <id>     返回某 Intent 的验收契约（解析引用）
  loom verify history <id>      返回某 Intent 本地验证历史
  loom verify history <ref> --across-versions  递归返回 lineage 各版本的本地历史
  loom verify pending           返回待验证的 Intent
  loom verify list              列出所有验证记录
  loom verify write --json-file <path>  从文件读入并写入验证记录
  loom verify write --json <string>     从命令行字符串写入验证记录
  loom verify pass|fail <id> --summary <text>  快捷写入验证结果
    --quality-proof <ref>  声明相对质量提升时，指向基线比较与稳定性证据

参数:
  --loom-dir <path>  指定 .loom/v{N} 目录（默认读 .loom/current 指针）`);
      break;

    default:
      die(`未知命令: ${cmd}\n运行 loom --help 查看用法`);
  }
} catch (e) {
  die(e.message);
}
