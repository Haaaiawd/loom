## 版本演进指南

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
\`\`\`