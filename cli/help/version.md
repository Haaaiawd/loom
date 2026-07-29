## 版本演进指南

LOOM 用 .loom/v{N}/ 目录支持多版本共存与演进。

## 什么时候演进版本

| 变更类型 | 判定标准 | 处理方式 |
|---|---|---|
| Patch | 不触及 Intent，不改变验收契约，只修 bug / 样式 / 实现细节 | 当前版本内修正，跑验证并记录 changelog；不进入 Intent Loop |
| Minor | 新增或修改 Intent，但不改哲学前提、不改愿景北极星、不改架构边界 | 当前版本内改（变更回流机制），相关 Intent 进入 pending / needs_review |
| Major | 哲学前提变了、愿景北极星变了、架构边界变了 | 创建新版本 |

判定由用户 + Agent 对话完成，CLI 不做决策。

哲学修订可用 CLI 做后果分析和审计记录，但 CLI 不自动编辑哲学正文：

```bash
loom philosophy impact <anchor>
loom philosophy revise <anchor> --classification clarification --reason "<why>"
loom philosophy revise <anchor> --classification minor --reason "<why>"
loom philosophy revise <anchor> --classification major --reason "<why>"
```

前两条 revise 在没有 `--confirm` 时严格只读，并返回精确确认命令。确认 clarification 时 `--review` 必须为空，所有直接引用和传递影响均归入 `--unaffected`。确认 minor 时每个影响必须恰好一次归入 `--review` 或 `--unaffected`；review 中仅 `completed` 转为 `needs_review`，其余状态原样报告。两者均不改 acceptance，并写入下一个 `03_DECISIONS/PHIL-REV-NNN.md`。Major 即使带 `--confirm` 也不改当前版本，只提示 `loom version new`。哲学正文随后由 Weaver/用户单独编辑。

## Patch 流程

Patch 用于纯实现修正：bugfix、样式微调、文案 typo、测试补强。它不改变 Intent，也不改变验收契约。

```bash
# 1. 确认当前 Intent 都已完成
loom guide

# 2. 修改实现细节后，按项目约定跑测试 / lint

# 3. 如修复影响已有承诺，补一条验证记录
loom verify write --json-file <path>

# 4. 通过 CLI 写入权威 JSON 并生成 Markdown 投影
loom patch record --json-file <path>
loom patch validate
```

Patch 不应使用 `loom version new`，也不应新增 Intent。如果变更需要改验收契约，它已经不是 Patch。
完整输入契约见 `loom help patch`。

## Minor 流程

Minor 用于当前哲学和架构边界内的能力演进。

常见情况：
- 新增功能 → 由 Visionary 补叙事，Architect 增加 Intent，再进入 Intent Loop
- 修改已有功能承诺 → 将相关 Intent 标记为 `needs_review`，重新验证 / 实现
- 一个改动影响已完成 Intent → 通过反向依赖 / 哲学引用找影响面，标记 `needs_review`
- 当前版本能力退出但仍需保留历史与依赖图 → 用 `intent deprecate` 记录 lifecycle，不虚构 `deprecated` status

```bash
# 新增：先创建 draft，再分别由 Visionary / Architect 补齐叙事、契约和锚点
loom intent add --title "<title>" --depends-on INT-001,INT-002
loom activate visionary --intent INT-003
loom activate architect --intent INT-003
loom intent finalize INT-003

# 修订：revision 自动递增，并返回直接/传递反向依赖
loom intent revise <id> --reason "<why>"
loom activate visionary --intent <id>
loom activate architect --intent <id>
# 必须完整分类所有直接与传递下游；review 会使已完成下游回流复验
loom intent finalize <id> --review <ids> --unaffected <ids>

# 弃用：先评估，确认时完整分类所有直接和传递依赖方
loom intent deprecate <id> --reason "<why>"
loom intent deprecate <id> --reason "<why>" --confirm --review <ids> --unaffected <ids>

# 继续按 guide 进入收敛趟
loom guide
```

`add` / `revise` 在 finalize 前不修改官方 `04_INTENT_MAP.json` 和 `topo_order`。`add` 还会向愿景和验证文档追加明确标记的 draft 章节；finalize 通过后提升这些章节并删除 draft。新增 Intent 是 `pending`；修订保留 `pending` / `in_progress` / `blocked` / `needs_review`，原 `completed` 变为 `needs_review`，旧 revision 的验证自动失效。

当前版本内演进不是偷懒；只要哲学前提、北极星、架构边界没变，Minor 就应该留在当前版本。

弃用要求目标已完成。它写入 `lifecycle.deprecation = { deprecated_at, reason, replacement }`，不改变目标的 `completed` status，也不删除节点、依赖或契约。可选 replacement 必须是另一个当前版本 Intent。所有直接和传递依赖方必须在 review/unaffected 中恰好分类一次；叶子无需分类。重复确认会失败，避免不同参数被误认为已应用。

## Major 升级流程

\`\`\`bash
# 1. 创建新版本（空目录 + 模板，自动切换为当前）
loom version new

# 2. 看文件变化与显式 Intent 沿革
loom version diff v1 v2
loom intent diff v1 v2

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
- **显式 Intent lineage**：可用 `lineage: { predecessors: [{ version: "v1", intent_id: "INT-003" }], change_summary, change_ref? }` 表达修订、拆分或合并。它不属于 `depends_on`；同 ID/标题不会自动映射。
- **版本元数据**：脚手架写入真实 `_loom_version`，并写入 `_parent_version`（v1 为 `null`，新版本为创建前的当前版本）。
- **历史只读**：`v1:INT-003` 可用于 `intent get/narrative/trace` 和 `verify history`，写命令仍只操作当前版本。

## 版本管理命令

\`\`\`bash
loom version list              # 列出所有版本（* 标记当前）
loom version current           # 显示当前版本
loom version new               # 创建 v{N+1} + 自动切换
loom version use <v>           # 切换当前版本
loom version diff <v1> <v2>    # 对比文件差异
loom intent diff <v1> <v2>     # 对比显式 lineage 与语义字段
loom verify history v2:INT-007 --across-versions
\`\`\`

## 切换回旧版本

\`\`\`bash
loom version use v1            # 切回 v1 查看历史
loom intent trace v1:INT-003   # 无需切换即可只读历史 Intent
loom version use v2            # 切回 v2 继续
\`\`\`
