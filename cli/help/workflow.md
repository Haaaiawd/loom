## LOOM 工作流

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
- **文档开销不超过开发开销** — 小项目可以粗粒度，不必教条