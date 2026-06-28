## LOOM 核心概念

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
- \`loom verify pending\` — 待验证的 Intent