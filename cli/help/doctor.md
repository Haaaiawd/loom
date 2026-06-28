## 诊断与恢复指南

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

LOOM 不内置备份、审计、回滚——这些是版本控制的职责。