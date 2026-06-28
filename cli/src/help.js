// help — LOOM CLI 分层指南
// loom help <topic> 输出结构化工作指南，不是 man page 参数说明。
// 指南内容是 agent 能直接理解的："做什么、用什么命令、怎么判断做对了"。

const TOPICS = {
  workflow: `# LOOM 工作流

从零到交付的完整流程。每个阶段有明确的产出和验收标准。

## 第一步：诊断当前阶段

\`\`\`bash
loom guide
\`\`\`

guide 检测项目当前在哪个阶段，输出"你在阶段 X，下一步做 Y"。
Agent 每完成一步都跑 guide 确认下一步。

## AUTO 模式

\`\`\`bash
loom auto on      # 开启：Agent 自动连续执行，不等确认
loom auto off     # 关闭：每步需要用户确认
\`\`\`

AUTO on 时 Agent 一路跑到底，跑完生成 preview 给人看。
AUTO off 时每步停下等用户说继续。

## 阶段 1：织造哲学（Weaver）

\`\`\`bash
loom activate weaver
\`\`\`

Weaver 根据项目特征从真实思想体系织造定制化哲学。产出：
- PRODUCT_PHILOSOPHY.md — 产品价值观、反模式清单、决策取舍规则
- ENGINEERING_CREED.md — 工程原则（按需）
- DECISION_RUBRIC.md — 冲突时的优先级（按需）
- PROJECT_BASELINE.md — 项目特定底线（按需）

**验收**：哲学有北极星、有反模式、有决策标准。全是空话就重做。

## 阶段 2：定义愿景（Visionary）

\`\`\`bash
loom activate visionary
\`\`\`

基于哲学定义产品愿景，为每个 Intent 写意图叙事（"为什么存在"）。产出：
- 01_VISION.md — 北极星 + 意图叙事列表

**验收**：叙事是"为什么"不是"做什么"。写成功能列表就重做。

## 阶段 3：设计系统（Architect）

\`\`\`bash
loom activate architect
\`\`\`

基于愿景设计系统结构，绘制 Intent Map。产出：
- 02_ARCHITECTURE.md — 系统设计
- 04_INTENT_MAP.json — Intent 依赖图 + 验收契约 + 哲学锚点

**验收**：验收契约具体到可验证，依赖无环，每个 Intent 有叙事引用。
跑 \`loom intent validate\` 校验结构，跑 \`loom doctor\` 检查完整性。

## 阶段 4：Intent Loop

\`\`\`bash
loom activate keeper    # Keeper 选 Intent、验证
loom activate forge     # Forge 实现
loom intent next        # 下一个可执行 Intent
loom context            # 当前状态摘要
\`\`\`

每个 Intent 独立走一圈：选 → 实现 → 验证 → 闭合或修正。
详细流程见 \`loom help loop\`。

## 阶段 5：人类预览

\`\`\`bash
loom preview
\`\`\`

输出提示词，Agent 按提示词读 .loom/ 文件、拆解信息、生成 HTML 可视化预览。
人类用浏览器打开 HTML 看全局——哲学、愿景、架构、Intent 进度、验证历史。
这是只读投影，修改请编辑源文件后重新生成。

## 阶段 6：版本演进（按需）

当哲学前提/愿景北极星/架构边界变了，需要 Major 升级。
详细流程见 \`loom help version\`。

## 核心原则

- **哲学是经线，意图是纬线** — 所有角色共享哲学锚点
- **底线不可协商** — BASELINE 5 条 + 项目特定底线，角色激活时强制加载
- **意图可回溯** — 每个 Intent 携带叙事，Keeper 独立验证忠实度
- **文档开销不超过开发开销** — 小项目可以粗粒度，不必教条`,

  concepts: `# LOOM 核心概念

## 哲学

项目的价值观和工程原则——为什么存在、什么不做、冲突时谁优先。
由 Philosophy Weaver 从真实思想体系织造，不是模板填空。
所有角色激活时强制加载哲学作为共同锚点。

相关命令：
- \`loom philosophy get <anchor>\` — 加载哲学章节
- \`loom philosophy list\` — 列出哲学文档
- \`loom intent reverse-ref <anchor>\` — 哪些 Intent 引用了这个哲学锚点

## Intent

一个意图单元——不是"做什么"（任务），是"为什么做"（意图）。
每个 Intent 携带：
- narrative_ref — 意图叙事引用（为什么存在）
- depends_on — 依赖的 Intent（拓扑序）
- acceptance — 验收契约（Keeper 据此判定）
- philosophy_anchors — 哲学锚点（引用哪些哲学原则）
- status — 状态（pending|in_progress|completed|blocked|needs_review）
- verification_method — 验证方式（L1 静态|L2 运行时|L3 人类反馈，可选）

相关命令：
- \`loom intent next\` — 下一个可执行 Intent
- \`loom intent get <id>\` — Intent 详情
- \`loom intent narrative <id>\` — 意图叙事
- \`loom intent trace <id>\` — 完整追溯链
- \`loom intent reverse-dep <id>\` — 谁依赖这个 Intent

## Intent Map

所有 Intent 的依赖图（JSON）。Architect 绘制，定义拓扑序和依赖关系。
必须是 DAG（有向无环图），不能有循环依赖。

相关命令：
- \`loom intent validate\` — 校验结构 + 依赖一致性
- \`loom intent graph\` — Mermaid 依赖图
- \`loom intent status\` — 进度概览

## Intent Loop

核心循环：Keeper 选 Intent → Forge 实现 → Keeper 验证 → 闭合或修正。
每个 Intent 独立走一圈。详细流程见 \`loom help loop\`。

## Keeper

独立验证子代理——不继承 Forge 的实现上下文，从磁盘重新加载意图和契约。
判定四维度：意图忠实度 / 哲学一致性 / 底线合规 / 验收达成。
判定结果：passed / deviated / blocked / pending_human。

## 底线

不可妥协的约束（BASELINE.md 5 条 + 项目特定底线）。
角色激活时强制加载，哲学不能覆盖。违反底线必须立即停止。

## 验证记录

Keeper 每次验证写入一条记录（追加模式），包含：
- verdict（passed/deviated/blocked/pending_human）
- 四维度判定
- 证据
- 偏离说明（如果 deviated）

deviated 连续 3 轮升级 blocked。pending_human 默认 7 天超时升级 blocked。

相关命令：
- \`loom verify contract <id>\` — 获取验收契约
- \`loom verify write --json-file <path>\` — 写入验证记录
- \`loom verify history <id>\` — 验证历史
- \`loom verify pending\` — 待验证的 Intent`,

  loop: `# Intent Loop 详细流程

每个 Intent 独立走一圈。Loop 终止条件：所有 Intent 为 completed。

## Step 1：Keeper 选 Intent

\`\`\`bash
loom intent next          # 返回下一个可执行 Intent（pending 且依赖都 completed）
loom context              # 当前状态摘要（进度+下一步+风险）
\`\`\`

如果没有可执行的 Intent：
- 全部 completed → 项目阶段完成
- 有 blocked → 需要人工介入
- 有 in_progress 但无验证记录 → 可能上次中断，跑 \`loom doctor\` 诊断

## Step 2：更新状态

\`\`\`bash
loom intent update <id> --status in_progress
\`\`\`

## Step 3：Forge 实现

\`\`\`bash
loom activate forge
\`\`\`

Forge 加载：意图叙事 + 哲学锚点 + 验收契约，在约束下自主实现代码。
辅助命令：
- \`loom intent narrative <id>\` — 读意图叙事
- \`loom intent trace <id>\` — 完整追溯链（含哲学锚点内容）
- \`loom verify contract <id>\` — 读验收契约
- \`loom philosophy get <anchor>\` — 读哲学原则

## Step 4：Keeper 验证

\`\`\`bash
loom activate keeper
loom verify contract <id>     # 重新加载验收契约
\`\`\`

Keeper 独立验证四维度：
1. 意图忠实度 — 实现是否忠于原始意图叙事
2. 哲学一致性 — 实现是否符合哲学原则
3. 底线合规 — 是否违反 BASELINE
4. 验收达成 — 是否满足验收契约

写入验证记录：
\`\`\`bash
loom verify write --json-file verification.json
\`\`\`

验证记录格式（\`loom verify write\` 的输入）：
\`\`\`json
{
  "intent_id": "INT-001",
  "verdict": "passed",
  "timestamp": "2026-06-28T12:00:00.000Z",
  "summary": "具体证据描述——不是'看起来没问题'",
  "reproduction_command": "LLM_API_KEY=mock npm test",
  "dimensions": {
    "intent_fidelity": "passed",
    "philosophy_consistency": "passed",
    "baseline_compliance": "passed",
    "acceptance_achievement": "passed"
  }
}
\`\`\`
CLI 自动包装成 \`{ intent_id, records: [{ round, ... }] }\` 追加到验证文件。
\`reproduction_command\` 是复现验证的命令——别人跑这个命令能复现你的验证结果。L2 必填。

## Step 5：根据判定结果

| verdict | 处理 |
|---|---|
| passed | \`loom intent update <id> --status completed\`，回到 Step 1 |
| deviated | 与 Forge 对话修正，重新实现重新验证。连续 3 轮升级 blocked |
| blocked | \`loom intent update <id> --status blocked\`，停下报告用户 |
| pending_human | **手动模式**：等用户补充判定（L3 人类反馈）。7 天超时升级 blocked |

**AUTO 模式下的判定规则**（关键差异）：
- AUTO 模式开启时（\`loom auto on\`），**不允许 pending_human**
- Keeper 遇到 L3 verification_method 时，用 L1+L2 能耐自主判定所有维度
- 要么 passed（有证据），要么 deviated（有偏离说明），不停下等人类
- **持续运行，除非出意外否则不允许私自停止**
- "出意外" = blocked（依赖阻塞/契约无法判定/连续 3 轮 deviated 升级）、fatal 错误

## 变更回流

如果 Forge 发现验收契约不合理、或 Architect 的设计需要调整：
1. Keeper 评估变更范围（微调 vs 结构性变更）
2. 微调（验收措辞、验证方式）→ Keeper 直接改
3. 结构性变更（增减 Intent、改依赖）→ 重新激活 Architect
4. 受影响的已完成 Intent 标记为 needs_review

详细规则见 .loom/v{N}/ 下的 INTENT_LOOP.md。`,

  version: `# 版本演进指南

LOOM 用 .loom/v{N}/ 目录支持多版本共存与演进。

## 什么时候升级版本

| 变更类型 | 判定标准 | 处理方式 |
|---|---|---|
| Minor | 不改哲学前提、不改愿景北极星、不改架构边界 | 当前版本内改（变更回流机制） |
| Major | 哲学前提变了、愿景北极星变了、架构边界变了 | 创建新版本 |

判定由用户 + Agent 对话完成，CLI 不做决策。

## Major 升级流程

\`\`\`bash
# 1. 创建新版本（空目录 + 模板，自动切换为当前）
loom version new

# 2. 看看旧版本有什么（Agent 决定参考什么）
loom version diff v1 v2

# 3. Weaver 读旧哲学，织造新哲学
loom activate weaver
# → 必须读 .loom/v1/00_PHILOSOPHY/，记录"相对 v1 变了什么"

# 4. Visionary 读旧愿景，定义新愿景
loom activate visionary
# → 必须读 .loom/v1/01_VISION.md

# 5. Architect 读旧架构，设计新架构
loom activate architect
# → 必须读 .loom/v1/02_ARCHITECTURE.md + 04_INTENT_MAP.json

# 6. 进入新版本的 Intent Loop
\`\`\`

## 关键设计

- **空目录 + 模板**：\`loom version new\` 不自动复制旧版本内容。强制重新思考——参考 ≠ 复制。
- **旧版本只读**：当前指针指向的版本是当前真相，旧版本保留作历史参考。
- **Intent ID 重新编号**：v2 的 INT-001 和 v1 的 INT-001 没有关系。追溯靠 Git history 和 \`loom version diff\`。

## 版本管理命令

\`\`\`bash
loom version list              # 列出所有版本（* 标记当前）
loom version current           # 显示当前版本
loom version new               # 创建 v{N+1} + 自动切换
loom version use <v>           # 切换当前版本
loom version diff <v1> <v2>    # 对比文件差异
\`\`\`

## 切换回旧版本

\`\`\`bash
loom version use v1            # 切回 v1 查看历史
loom intent trace <id>         # 在 v1 中追溯 Intent 历史
loom version use v2            # 切回 v2 继续
\`\`\``,

  doctor: `# 诊断与恢复指南

## 健康检查

\`\`\`bash
loom doctor
\`\`\`

检测 6 类问题：

| 问题类型 | 严重度 | 说明 |
|---|---|---|
| cycle | fatal | 循环依赖（Intent Map 有环） |
| orphan_philosophy_ref | high | 哲学锚点指向不存在的文件 |
| orphan_dependency | high | depends_on 引用不存在的 Intent |
| completed_no_record | high | completed 但无验证记录 |
| completed_depends_blocked | high | completed 依赖 blocked 的 Intent |
| in_progress_no_record | medium | in_progress 但无验证记录（可能中断） |
| zombie | medium | in_progress/blocked 超过 7 天无活动 |

## 上下文摘要

\`\`\`bash
loom context
\`\`\`

一条命令获取：进度 + 下一个 Intent + 待验证 + 不一致项 + 风险。
Agent 重启后先跑这个，快速知道"我在哪、接下来做什么"。

## 崩溃恢复

### Forge 崩溃（Intent 留在 in_progress）

1. 跑 \`loom doctor\` 确认哪些 Intent 状态不一致
2. 跑 \`loom context\` 看整体状态
3. 用户决定：
   - 继续：重新激活 Forge，从当前代码接着做
   - 重置：\`loom intent update <id> --status pending\`，从头来

### Intent Map 文件损坏

1. \`loom intent validate\` 会检测到格式错误
2. 从 Git 恢复（.loom/ 应纳入版本控制）

### 验证记录丢失

1. \`loom doctor\` 会检测到 completed 无记录
2. 重新验证该 Intent，或从 Git 恢复

## 追溯工具

\`\`\`bash
# Intent 完整追溯链（依赖+验证+哲学+叙事）
loom intent trace <id>

# 反向依赖（谁依赖这个 Intent → 变更影响评估）
loom intent reverse-dep <id>

# 反向哲学引用（哪些 Intent 引用这个锚点 → 哲学变更影响评估）
loom intent reverse-ref <anchor>
\`\`\`

## 版本控制是前提

LOOM 假设项目使用 Git。所有 .loom/ 下的文件都应纳入版本控制：
- 文件损坏 → 从 Git 恢复
- 误操作 → 从 Git 回滚
- 变更追溯 → Git log 就是审计日志

LOOM 不内置备份、审计、回滚——这些是版本控制的职责。`,
};

/**
 * 获取指定 topic 的指南内容。
 * @param {string} topic
 * @returns {string|null}
 */
export function getHelpTopic(topic) {
  return TOPICS[topic] ?? null;
}

/**
 * 列出所有可用 topic。
 * @returns {string[]}
 */
export function listHelpTopics() {
  return Object.keys(TOPICS);
}
