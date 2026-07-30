# Capability Graph — 从项目初衷到能力获取

> 状态：1.1.0 已进入运行时；真实项目图谱演练仍待进行。

## 1. 缺口

LOOM 的 Intent Map 是执行图：它表达已经决定要做的闭合单元及其依赖。它不能证明在决定
做什么之前，项目的体验、系统、资产、风险与专业能力是否已经被看见。

这会让 Agent 从“这是一个网页项目”直接跳到技术栈、几个页面和第一个可运行实现。UI、UX、
资产、身份、数据、后台、性能、可访问性或运营能力只会在它恰好想到时出现；
`capability_needs` 因而退化为领域标签。

Capability Graph 的目标是让项目初衷向外展开为可追溯的**问题空间与能力缺口**。它不取代
Intent Map，不是第二份任务列表，也不要求穷尽一切分支。它要求每一个重要分支都有去向：
继续展开、形成能力 Brief、编译为 Intent、明确延后、明确排除，或由既有节点覆盖。

```text
Doctrine + Vision
  → Capability Graph（什么必须被理解、设计、实现或证明）
  → Architecture + Intent Map（当前版本承诺做什么）
  → Expertise Compiler（为被选中的节点获取真实能力）
  → Forge / Quality Arena → Keeper / Quality Proof
  → 新风险、遗漏、假设被推翻时回写 Graph
```

## 2. 两张图的边界

| 图 | 回答的问题 | 节点 | 收敛条件 |
|---|---|---|---|
| Capability Graph | 为实现项目初衷，哪些问题面与能力必须被处理？ | outcome、concern、capability、risk、evidence | 高影响节点都有明确路由 |
| Intent Map | 本轮承诺完成哪些可验证结果，顺序与依赖是什么？ | 可闭合 Intent | 当前 revision / epoch 的验证通过 |

Capability Graph 可以有假设、替代路径、未知与递归分叉；Intent Map 只收录边界已清楚、能在受控周期
完成并独立验证的承诺。不能为了让 Intent Map 看起来完整，把仍需调研的“登录方案选择”或
“首屏用户理解是否成立”伪装成实现任务。

## 3. 生长协议

Visionary 只播下根节点：目标用户、期望结果、非目标和不可妥协的项目事实。Architect 选择与
项目类型匹配的透镜并完成首轮展开；不是所有项目都默认拥有后端、数据库或登录系统。

Web 产品的候选透镜：

1. 用户、角色与关键旅程；
2. 体验与交互：信息层级、反馈、响应式、可访问性；
3. 产品能力与业务规则；
4. 系统边界：客户端、服务端、数据、身份、外部集成、运营后台；
5. 资产与内容：品牌、素材、许可、状态文案；
6. 横切品质：安全、隐私、性能、可靠性、可观测性；
7. 风险、未知与需要证据验证的假设。

对每个透镜，Architect 必须作出唯一判断：**适用并展开、由其他节点覆盖、明确不适用并说明原因**。
这不是一套全栈检查清单，而是防止重要领域因没有被想起而消失的检查接口。

节点用以下问题继续展开，直到能被路由：

- 它服务哪个项目结果，缺少它会让谁失败？
- 它是体验、系统能力、资产/内容、横切约束，还是未验证风险？
- 要把它做好，缺的是知识、方法、工具、项目事实，还是外部证据？
- 它应生成 Intent，还是先形成可逆的调研、原型或验证节点？
- 它和哪些节点相互依赖、相互限制或可以复用？

“无限分叉”的正确含义是**无限可展开、有限可收敛**：无新证据时不得为显得深入而继续长图；
新事实出现时允许重新打开对应分支。

## 4. 节点、边与状态

```json
{
  "id": "CAP-UX-ONBOARDING",
  "kind": "capability",
  "title": "设计并验证首次使用的行动路径",
  "status": "open",
  "impact": "high",
  "origin_refs": ["01_VISION.md#activation"],
  "question": "首次进入的用户能否理解价值并完成首个关键行动？",
  "route": "brief",
  "brief_ref": "07_CAPABILITY_BRIEFS/CAP-UX-ONBOARDING.md",
  "intent_refs": [],
  "evidence_needed": ["现有行为数据或用户测试", "窄屏操作复现"],
  "relationships": [
    { "type": "constrains", "target": "CONCERN-UI-HOMEPAGE" },
    { "type": "requires", "target": "CAP-ACCESSIBILITY-INPUT" }
  ]
}
```

`kind` 只能是：

- `outcome`：项目要为谁改变什么；
- `concern`：必须被设计或解决的问题面；
- `capability`：Agent 或团队需要获取、调用或验证的专业能力；
- `risk`：可能使结果失效的障碍、假设或未知；
- `evidence`：决定或质量主张需要的外部事实与验证入口。

边只保留有判断价值的关系：`refines`、`requires`、`realizes`、`constrains`、`risks`、
`validated_by`。状态为 `open | researched | covered | deferred | out_of_scope`；`route` 为
`expand | brief | intent | defer | exclude | covered_by`。图谱不是视觉炫技，不记录任意关联。

## 5. Capability Brief：被激活能力节点的小型 MD

“每个节点一个 MD”的方向成立，但不能让低价值叶子生成文档垃圾。

- Graph 保存完整结构、状态和关系；
- 只有高影响、需要外部调研、需要专业方法或将被编译进当前 Intent 的节点创建 Brief；
- 一个 Brief 可以服务多个 Intent，一个 Intent 也可引用多个 Brief；
- 已有可靠 Skill、官方文档或项目规范能直接回答时，Brief 只写项目适配与选择理由，不复制原文。

`07_CAPABILITY_BRIEFS/<node-id>.md` 必须短而具体：

1. 项目问题：连接的用户结果、系统面和失败后果；
2. 成功判断：什么证据说明能力被正确应用；
3. 项目约束：不可改变的接口、资产、隐私、品牌或历史状态；
4. 获取计划：所需 Skill、工具、官方资料、样本、基线或人类输入；
5. 产出与验证入口：将形成什么结论/设计/实现，如何被 Keeper 检查；
6. 非目标：本次不把该能力扩张成什么。

Brief 不是“你是一位 UX 专家”的角色扮演提示词。它把抽象能力变成当前项目中可获取、
可使用、可验证的专业工作。

## 6. 对接 Expertise Compiler

Forge 激活 Intent 时，Compiler 不再只读取手填的 `capability_needs`，而是：

1. 取得该 Intent 回链的 Graph 节点及其必要祖先、约束边和风险边；
2. 收集对应 Capability Brief；
3. 将每项缺口分类为项目事实、可复用方法、工具/权限、外部证据或人类决定；
4. 只为当前 Intent 选择可用的 Skill、工具、参考与验证方法；
5. 输出 Expertise Pack，并保留“为何需要、从何获得、怎样验证适用”的证据链。

于是首页改造会同时看见 UX 路径、视觉层级、品牌资产、移动端、加载性能和可访问性；
纯 API 修复不会被迫装载整套视觉能力。

## 7. 覆盖与回流

`loom capability coverage` 必须报告具体缺口：

- 每个 outcome 是否至少通向一个已处理 concern；
- 所有高影响节点是否已路由，且没有停在 `open`；
- 每个 capability 是否有 Brief、已有能力来源，或明确“不获取”的理由；
- 每个 Intent 是否能回链至图谱节点；
- 被排除/延后的分支是否有理由、风险和重新触发条件；
- Forge 的新发现是否回写图谱，而不是只藏在会话里。

收敛不是“图上没有更多可画的节点”，而是当前版本的高影响分支都具有可审计去向。

| 角色 | 对图谱的职责 |
|---|---|
| Visionary | 提供 outcome、角色、非目标与根问题；不指定技术能力方案 |
| Architect | 选择透镜、展开/合并节点、定义路由、创建 Brief、将成熟节点编译为 Intent |
| Forge | 消费已编译能力；发现新依赖、风险或缺口时提交图谱回流，不静默扩展 |
| Keeper | 检查高影响节点的路由是否兑现；发现遗漏时回写 risk / evidence 节点 |
| Weaver | 只在能力缺口被多次 Proof 证明为长期原则时，将其提升为 Doctrine 或可复用方法 |

## 8. 运行时建议与兼容

建议新增真相源：

```text
.loom/v{N}/07_CAPABILITY_GRAPH.json
.loom/v{N}/07_CAPABILITY_BRIEFS/<node-id>.md
```

建议入口：

```bash
loom capability graph              # Mermaid + 摘要投影
loom capability frontier           # 尚未路由的重要节点
loom capability get <node-id>      # 节点、关系、Brief 与 Intent 回链
loom capability coverage           # 覆盖缺口与排除理由
loom capability compile <intent>   # 只读显示将进入 Expertise Pack 的节点
```

现有项目保持 1.0 行为；没有 Graph 时 `loom doctor` 给出 medium 迁移提示。新项目在 Architect
阶段必须完成一次透镜扫描，才能创建正式 Intent Map。Graph 的结构性变更应回流受影响 Intent，
不能用重画图谱掩盖既有验证。

## 9. 设计验收

- [ ] 真实网页项目的图谱能展示 UI、UX、资产、数据/身份、后台和横切质量的适用或排除结论。
- [x] 一个能力 Brief 能被编译进具体 Intent，而非只显示领域标签。
- [x] coverage 能抓住“高影响节点未路由”“Intent 无图谱来源”“能力没有获取计划”和未展开 outcome。
- [x] Forge 激活时可读取 Graph/Brief；发现新需求的回流责任已写入角色契约。
- [ ] 纯后端或 CLI 任务不会因默认透镜被强迫产生 UI/资产文档（待真实项目演练）。
- [x] Capability Graph、Intent Map、Quality Proof 保持追溯边界，且不制造平行完成状态模型。
