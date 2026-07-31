## LOOM 核心概念

LOOM 用一条完整链路把长期判断、当前意图、专业能力、创造性探索和独立证明连起来：

```text
Doctrine → Intent narrative → Capability Graph → Contract
→ Expertise Compiler → Quality Arena → Quality Proof
→ Reflow
```

最后三步合称 **LOOM Quality Engine**。

## Doctrine

项目长期使用的判断系统：保护什么、冲突时如何取舍、什么算优秀、哪些反模式不能接受。
Weaver 从项目事实和决策相关证据中织造 Doctrine；它不预写产品需求、架构或实现步骤。

## Intent

一个需要保护的产品结果，而不是任务清单。每个 Intent 包含：

- `narrative_ref`：为什么存在。
- `revision`：语义版本。
- `depends_on`：依赖关系。
- `acceptance`：完成契约，即 Reliability Floor。
- `continuity_required`：仅对会修改既有用户或系统状态的 Intent 启用；要求守恒证据，但不另存一份契约。
- `quality_contract`：可选的质量契约，即 Distinctive Ceiling。
- `capability_needs`：可选的专业能力需求。
- `creative_scope`：可选的探索边界。
- `philosophy_anchors`、`status` 与 `verification_method`。

Architect 是 Intent DAG 与两类契约的唯一负责人。

## Capability Graph

Capability Graph 位于 Vision 和 Intent Map 之间。它将项目初衷展开成 `outcome`、`concern`、`capability`、`risk`、`evidence` 五类节点，描述哪些问题必须被理解、设计、实现或证明。

它不是执行 DAG，也不替代 Intent Map：Graph 保留未知、研究与分叉；Intent 只保留边界明确、能独立验收的承诺。高影响节点必须有明确路由（继续展开、Brief、Intent、延后或排除），每个 Intent 必须回链至少一个图谱节点。只有需要专业方法、调研或即将进入当前 Intent 的节点才创建短小的项目化 Capability Brief。

## System Boundary

LOOM 不假装能够清除宿主 Agent 的既有记忆。`loom activate` 生成有序 Context Pack，
明确当前角色、当前 Intent、硬约束、成功契约与停止条件；系统和用户指令始终优先。

## Expertise Compiler

Forge 针对当前 Intent 临时组装一个 Expertise Pack。先由 Capability Graph 编译关联节点和 Capability Brief，再回答：

1. 这是什么专业问题。
2. 优秀作品的判断标准是什么。
3. 哪些项目事实和约束会改变做法。
4. 应加载哪些真实能力、资料或工具。
5. 最可能出现哪些“合格但平庸”的失败。
6. 如何验证专业质量。

能力名称只表示“可发现”；只有真实加载并转化为任务判断的内容才算进入 Expertise Pack。
当 External Acquisition Gate 为 required 时，Forge 只能自行派生 Search Plan，内容必须来自
实际打开的 Skill、网络、官方文档或研究资料；Pack 写入当前 Intent revision 的
`10_EXPERTISE_PACKS`，每个 Capability Capsule 都直接回链来源。Pack 仅服务当前任务，不成为
长期 Doctrine。

## Quality Arena

Forge 的实现环境。结果显然时走直接路径；当目标是“更好、惊艳、出众”时：

```text
Baseline → Mechanism-different Candidates → Compare → Realize → Observe → Adjust
```

候选必须依赖不同机制，而不是同一方案换皮。没有候选真实胜过基线时，保留原方案是合法结论。

## Quality Proof

Keeper 在独立上下文中验证：

- `intent_fidelity`
- `philosophy_consistency`
- `baseline_compliance`
- `acceptance_achievement`
- `preservation_achievement`（仅 `continuity_required` 时）
- `quality_achievement`（仅有 `quality_contract` 时）

质量提升声明必须有 Quality Proof：修改前基线、可观察主张、候选选择依据、稳定性证据与代价。
完成可以通过而质量未通过；此时不得宣称“更好”。

## Reflow

发现问题时回到真正拥有该问题的层：

- 长期价值判断 → Weaver
- 产品目标与 narrative → Visionary
- 系统边界、Intent、契约 → Architect
- 图谱遗漏、未路由高影响节点或新的能力缺口 → Architect 更新 Capability Graph
- 专业能力与实现 → Forge
- 证据不足或判定偏离 → Keeper

相关入口：

- `loom context`
- `loom intent next|get|trace|validate`
- `loom activate <role> --intent <id>`
- `loom verify contract|write|pass|history`
- `loom doctor`
