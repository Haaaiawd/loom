## Capability Graph 指南

Capability Graph 位于 Vision 与 Intent Map 之间：它把项目初衷展开为需要被理解、设计、实现或证明的
问题面、能力缺口、风险与证据。它不是待办列表，也不替代 Intent Map。

```bash
loom capability graph
loom capability frontier
loom capability get <node-id>
loom capability coverage
loom capability compile <intent-id>
```

## 工作方式

Visionary 给出 outcome、角色、非目标与项目事实。Architect 用项目类型相符的透镜检查用户旅程、
体验、系统、资产、横切质量和未知；每个透镜必须被展开、覆盖或明确排除。

## Lens Contract：先检查，再命名能力

新建 Graph 必须先写 `lens_contract`。它要求 Architect 对用户旅程、交互与可访问性、视觉与信息表达、内容与沟通、系统与数据、横切质量与风险逐项做出判断：

- 适用：用 `node_refs` 连到具体的 outcome、concern、capability、risk 或 evidence；
- 不适用：写明基于项目事实的理由；
- 需要额外维度：可以增补自定义透镜，但不能删掉六项必审方向。

透镜不是能力节点。`CAP-UI`、`CAP-UX`、`CAP-视觉优化` 这类标题没有用户结果，不能代替能力边界。应写成可观察、可取舍的结果，例如“让错误状态与恢复入口保持可理解”或“让长报告中的证据层级能在窄屏扫读”。一个 capability 可以被多个透镜引用，也可以支持多个 outcome；这正是 Graph 不应退化为 Intent 镜像的原因。

## Capability Domains：专业能力从哪里来

`capability_domains` 记录的不是产品功能，而是会改变设计、实现或验证方法的专业领域。UI/UX、3D 建模、光影与材质、网络安全、心理学、生物学等都可以是 domain；是否进入图谱只看一个问题：**若不了解这个领域，当前方案或判断会不会实质不同？**

每个 domain 必须写清专业问题、为什么现在需要，并用 `node_refs` 连接具体 capability；每个 capability 也用 `domain_refs` 回链领域。这样：

- `DOMAIN-INTERACTION-DESIGN` 可以支撑“状态与恢复可理解”；
- `DOMAIN-3D-LIGHTING` 可以支撑“光影与材质传达空间尺度”；
- `DOMAIN-WEB-SECURITY` 可以支撑“敏感操作具备可恢复的授权边界”；
- `DOMAIN-BEHAVIORAL-PSYCHOLOGY` 可以支撑“敏感沟通不以操控性暗示替代用户选择”。

领域不是“我们已经拥有专家”的声明，也不是固定分类表。它只让 Forge 知道：这项具体能力需要什么专业问题、是否应进入外部获取，以及 Keeper 应按什么角度反证。

完整、有共享关系的最小例子见 `templates/CAPABILITY_GRAPH_EXAMPLE.json`。它不是可以照抄的产品方案，而是展示如何让 outcome、concern、capability、risk、evidence 和 capability domain 交叉连接。

## Impact Gate：先判断代价，后写 Intent

在 Graph schema 1.3 中，每个具体 capability 都必须有 `impact_assessment`。它不是形式化打分，而是先把容易被偷懒跳过的问题说清：它影响哪个用户结果？省略或误判的代价是什么？外部知识会不会改变方案或验证？理由是什么？Architect 完成初判后，必须开一个新的 Agent thread / 子代理运行 `loom activate impact-reviewer`，由它将逐项结论写入根级 `impact_review`；同一上下文里的自我复述不算独立审查。

若代价为 `hard_to_reverse`，或外部知识会改变决定，CLI 会要求 `impact: high`；这种节点只允许 `external_required`（或省略该字段、采用默认值）。不能把关键能力标为 medium/low，或写 `adaptive`，来绕过外部获取。并且 `high` 必须至少占具体 capability 的 **30%**（向上取整，至少一个）；分母不包含 outcome、risk、evidence 等节点，避免靠增加陪跑节点稀释比例。

```json
{
  "impact": "high",
  "impact_assessment": {
    "affected_user_result": "用户能以键盘和文字理解时间带，而非只能依赖颜色与拖拽",
    "failure_cost": "material",
    "external_knowledge_changes_decision": true,
    "rationale": "可访问数据表达会改变交互、备用文本和验收方式；普通图表经验不足以替代。"
  },
  "acquisition_mode": "external_required"
}
```

高影响节点不能停在 `open`。它必须继续展开、生成 Capability Brief、编译为 Intent，或带理由地
延后/排除。`loom capability frontier` 显示尚未路由的高影响节点；`loom capability coverage` 检查
图谱与 Intent 的双向追溯。

高影响 `outcome` 还必须有一条真实的观察链：以 `validated_by` 指向 `evidence` 节点。该 evidence 的
`verification` 对象必须包含 `method`、`target`、`procedure`、`pass_criteria` 和 `artifact`，并以
`intent_refs` 回链负责产出该证据的 Intent。`target` 写结果真正要被看见、接收或使用的位置，例如目标
宿主的渲染面、用户拿到的导出文件、外部系统的接收端或人工验收现场。不要把“HTTP 200”“URL 可访问”或
“本地生成了文件”当作用户已得到结果。设计阶段可以先声明计划中的本地 `artifact` 路径；只有负责它的
Intent completed 后，CLI 才要求该证据文件实际存在，避免用空占位文件伪造验证。

不新增媒体、平台或版权专用节点类型：目标宿主与交付链路用 `concern` / `capability` 表达，许可、来源、
隐私或平台限制用 `risk` 和 `constrains` 关系表达；只有需要项目化判断时才为相关节点创建 Brief，并在其
“项目约束”和“产出与验证入口”中写清授权边界与实际交付验证。

```json
{
  "id": "EVIDENCE-DELIVERY-RENDER",
  "kind": "evidence",
  "title": "在目标宿主中实际呈现交付物",
  "status": "covered",
  "impact": "high",
  "route": "intent",
  "intent_refs": ["INT-004"],
  "verification": {
    "method": "manual_visual",
    "target": "目标桌面客户端的消息渲染面",
    "procedure": "在干净会话中发送产物并观察实际渲染",
    "pass_criteria": "用户无需打开外链即可看见完整内容",
    "artifact": "verifications/INT-004-host-render.png"
  },
  "relationships": []
}
```

## Capability Brief

只有高影响、需要调研、需要专业方法或将进入当前 Intent 的能力节点才需要 Brief。Brief 位于：

```text
.loom/vN/07_CAPABILITY_BRIEFS/<node-id>.md
```

它写当前项目问题、成功判断、约束、能力获取计划、产出/验证入口与非目标。不要复制通用教程，
也不要用“你是某领域专家”代替项目化能力说明。

## 编译与回流

`loom capability compile <intent-id>` 只读显示会进入当前 Intent 的图谱节点与 Brief。Forge 激活
Intent 时会获得同一份输入；发现新依赖、风险或能力缺口时必须回流 Architect 更新 Graph，不能静默
扩展实现。Keeper 以图谱回链检查高影响问题是否真的被兑现。

Capability 节点可选声明 `acquisition_mode: adaptive | external_required | project_only`。
schema 1.3 的 high capability 只允许 `external_required` 或省略（默认即为 `external_required`）；
较低影响的 `project_only` 必须附 `acquisition_rationale`。Graph 只保存获取必要性，不保存网站、Skill 名称或
搜索词；Forge 在本轮 Expertise Pack 中按项目信号派生查询并记录真实来源。
