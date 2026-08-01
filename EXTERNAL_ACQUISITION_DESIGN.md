# External Acquisition Gate — 来源化能力网络设计

> 状态：Implemented  
> 目标：阻止 AI 在专业能力不足时闭门生成，并把真实外部检索编译成当前 Intent 可使用、可追溯、会随 revision 失效的核心信息组。

## 1. 问题

LOOM 已经能识别任务需要哪些能力，但“识别能力”不等于“获得能力”。如果 Forge 只根据模型已有知识临时生成一段设计原则，它仍可能做出结构正确、审美普通的结果，并把自洽误当成专业。

本设计把能力链拆成四个不同事实：

1. Capability Graph：项目为什么需要某项能力。
2. Search Plan：本轮要用什么问题和关键词去外部寻找。
3. Expertise Pack：实际打开来源后，哪些规则、工作流、判断门和失败模式可用于本 Intent。
4. Quality Proof：这些判断是否真的让结果胜过基线。

Graph 不保存网站、Skill 名称或固定关键词；Pack 不复制第三方 Skill 或网页正文。

## 2. 核心不变量

- AI 可以生成检索计划，不能把自己生成的内容登记为外部专业知识。
- `external_required` 能力必须实际使用 Skill registry、网络、官方文档或研究资料。
- 搜索结果标题、未打开的摘要、模型记忆和“行业通常如此”都不是来源。
- 每个 Capability Capsule 必须直接引用至少一个已打开、可回查的外部来源。
- Pack 绑定 `intent_revision`；Intent 修订后旧 Pack 自动失效。
- Forge 可以使用 Pack；Keeper 不继承 Forge 的结论，必须重新打开关键来源。
- 来源化不等于正确。CLI 证明结构与追溯，Keeper 证明来源是否真的支持判断。

## 3. 触发模型

Capability 节点可选：

```json
{
  "acquisition_mode": "adaptive | external_required | project_only",
  "acquisition_rationale": "project_only 时必填"
}
```

有效模式按以下顺序计算：

1. Graph 显式声明的模式优先。
2. 未声明时，高影响 capability 自动提升为 `external_required`。
3. 中低影响 capability 默认为 `adaptive`。

`project_only` 只适合未公开内部协议、纯机械迁移等外部知识不会改变做法的任务，必须说明理由。外部交付依赖与只读研究访问是两件事：允许检索资料，不等于允许把外部服务写进产品架构。

## 4. 运行流程

```text
Capability Graph
  → compile acquisition requirement
  → derive Search Plan from project signals
  → perform real external retrieval
  → synthesize Capability Capsules
  → validate Expertise Pack
  → Author / Atelier / implementation
  → independent Keeper source check
  → passed record binds current Pack
```

搜索词由 Forge 根据以下信号动态派生：

- capability question 与 Brief；
- Intent narrative、quality contract 和 creative scope；
- 当前媒介、宿主、技术与许可约束；
- 基线中已经观察到的具体缺口；
- Authorial Stance 尚未解决的机制问题。

关键词属于本轮工作证据，不回写 Graph。这样 LOOM 不会把“网页设计等于某几个灵感站”固化成框架偏见。

## 5. Expertise Pack

位置：

```text
.loom/vN/10_EXPERTISE_PACKS/<intent-id>.json
```

Pack 包含：

- `search_plan`：决策问题、项目信号、派生查询、约束和停止条件；
- `sources`：类型、权威层级、HTTPS 定位、获取时间、选择理由和已打开证据；
- `capsules`：专业问题、适用时机、规则、工作流、判断门、失败模式、验证信号和来源引用；
- `required_capability_refs` 与 `intent_revision`；
- `status: draft | ready | blocked`。

Capability Capsule 是“类似 Skill 的核心信息组”，但它有三个刻意限制：

1. 只服务当前 Intent，不假装是通用知识；
2. 只保存项目化综合，不复制来源内容；
3. 未经多个真实任务和 Quality Proof 支持，不自动晋升为 Skill 或 Doctrine。

## 6. Author 与自我更正

外部获取发生在 Author/Atelier 之前。Authorial Stance 必须建立在已经来源化的机制和项目事实之上，而不是用人格、风格词或模型偏好代替研究。

自我更正分三层：

- Capsule 解释错误、来源不支持规则：修正 Pack，重新验证；如果已 passed，必须由 Keeper 重验。
- 当前构图、措辞、动效或候选选择失效：写入 Atelier `corrections[]`，递增 `stance_revision`。
- 出现新的用户结果、约束、风险或能力缺口：提交 Capability Graph proposal，由 Architect 裁决。

Author 不能修改 Graph 后继续自证，也不能用一次局部修正把任务长期知识化。

## 7. 强门与验证

以下入口共同阻止绕过：

- `loom guide`：优先引导创建或补齐 Pack；
- `loom activate forge --intent <id>`：Pack 未 ready 时显示 OPEN 门，只允许勘察、基线和检索；
- `loom expertise validate <id>`：检查 revision、真实外部来源、直接引用和 Capsule 完整性；
- `loom verify pass`：强门未闭合时拒绝 passed，并把当前 Pack 的内容摘要绑定到验证记录；
- `loom intent done`：拒绝未绑定、内容摘要变化或已经过期的 Pack；
- `loom doctor`：报告缺失、失效和 passed 绑定漂移；
- Keeper Context Pack：只给出证据入口，不注入 Forge 的 Capsule 结论。

## 8. 搜索预算与停止条件

LOOM 不规定固定网站数量，也不鼓励无限浏览。每个 Search Plan 必须写停止条件。通常在以下条件同时成立时停止：

- 每个 required capability 都有直接来源化 Capsule；
- 来源足以回答当前决策问题，而不只是提供视觉相似物；
- 已能写出可执行的判断门、失败模式和验证信号；
- 新来源只重复已有机制，不再改变候选或验证方法。

如果来源互相冲突、关键资料不可访问或许可不清，Pack 应进入 `blocked`，而不是让模型补齐空白。

## 9. 与现有系统的去重

- Capability Brief 负责“项目问题与获取边界”；Pack 负责“本轮实际获得了什么”。二者不重复。
- Authorship 负责“基于材料做什么独特选择”；Pack 负责“选择前有哪些可信材料”。二者不重复。
- Atelier Record 保存候选与修正；Pack 保存外部能力证据。二者不合并。
- Quality Proof 证明结果提升；Pack 只证明专业判断有来源。来源不能替代结果。
- Doctrine 保存长期项目判断；Pack 默认短命。未经重复外部结果支持，不进入 Doctrine。

## 10. 非目标

- 不在 LOOM 仓库内安装、镜像或维护第三方 Skill。
- 不建立固定网站白名单或 UI 专用关键词表。
- 不声称只要检索就能突破基础模型的所有智能边界。
- 不用来源数量、星标或流行度替代任务适配性。
- 不让 CLI 自动编造 Capsule；CLI 只建模、校验、编译和阻断。
