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

高影响节点不能停在 `open`。它必须继续展开、生成 Capability Brief、编译为 Intent，或带理由地
延后/排除。`loom capability frontier` 显示尚未路由的高影响节点；`loom capability coverage` 检查
图谱与 Intent 的双向追溯。

高影响 `outcome` 还必须有一条真实的观察链：以 `validated_by` 指向 `evidence` 节点。该 evidence 的
`verification` 对象必须包含 `method`、`target`、`procedure`、`pass_criteria` 和 `artifact`，并以
`intent_refs` 回链负责产出该证据的 Intent。`target` 写结果真正要被看见、接收或使用的位置，例如目标
宿主的渲染面、用户拿到的导出文件、外部系统的接收端或人工验收现场。不要把“HTTP 200”“URL 可访问”或
“本地生成了文件”当作用户已得到结果。

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
