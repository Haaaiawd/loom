## 决策图谱 Atlas

Atlas 是当前版本的必交付 H5：它把 Doctrine、Vision、Architecture、Capability Graph、Capability Domains、Intent 契约、验证设计和 ADR 讲成可审查的结构。它不是项目进度页。

```bash
loom atlas build
loom atlas --regen
loom atlas validate
loom atlas
```

## 固定内容，开放风格

`loom atlas --regen` 会直接装配 Atlas Model 与 Composer Pack。视觉 Agent 可以自主决定视觉语言、字体、排版、图形和转场，但不得改动以下内容结构：

1. `#atlas-origin`：原则、北极星和非目标。
2. `#atlas-structure`：愿景、架构边界与 Intent 结构。
3. `#atlas-capabilities`：Outcome / Concern / Capability、Lens Contract 与 Capability Domains。
4. `#atlas-decisions`：关键取舍与决策记录。
5. `#atlas-review`：结构性缺口、未决问题与每项的 source refs。

页面必须同时提供“放映”和“审查地图”读法。放映帮助普通人逐章理解；审查地图让人从目标、能力、专业领域、Intent 与验证设计之间追溯关系。不要展示看板、完成百分比、Intent 状态、燃尽图、验证轮次或 Patch 时间线。

## 图形不是装饰

Atlas 应把资料变成可审查的图，而不是把文字塞进有颜色的卡片。每章只用一张回答明确问题的 SVG / 图形：原则与非目标的张力、架构层与 Intent 依赖、能力链、ADR 分叉、或结构断线。节点、标签、连线和 source refs 必须来自 Atlas Model；不确定的地方明确标为待确认，不得用编造的数据填满画面。

审查地图中的节点必须可点击和键盘访问，选中后在同屏检查台说明其作用、关联对象和来源。每个 SVG 都要有可读描述，不能只靠颜色表达含义；动效只帮助关系出现、章节切换和节点选中，并在减少动态效果时保持可读。

## 视觉质量循环

Composer 先选择一个贯穿全页的视觉母题，再完成一个方向，不交付多份半成品，也不把 Atlas 做成通用 SaaS 看板。默认方向是可翻阅的“决策日报”：暖米色纸张、墨黑正文、砖红强调、报纸式标题层级、细线分栏，以及主报道区与侧栏图表/边注的非对称排布。它借用日报的阅读逻辑，不复制任何真实报纸的报头、标识或报道内容。

五章的构图必须各自回答问题而非重复卡片：起点建立张力，结构解释边界，能力展示网络，决策展示分叉，审查暴露缺口。

Atlas 的目标是“可翻阅的图文决策日报”，不是稀疏展览海报：每页应同时有关键结论、三到五条由 Model 提炼的事实或取舍、有标签的主图、一到两条短读图/边注和来源入口。桌面优先使用主报道区加侧栏图表/边注；窄屏按标题、事实栏、图表、读图注、来源重排，页面本身可纵向阅读，切章控件始终可达。信息密度来自结构化事实与图形，而不是缩小字体或贴整段 Markdown。

交付前须在 390px 触屏宽度和 1440px 桌面宽度检查：切章、滑动、键盘、章节定位、放映/地图切换、节点选择、来源显示和减少动态效果。无法实际检查时，必须保留未验证项，不能假装已经通过。首屏没有信息图形、只有标题加孤立图形、长文堆叠、五章同构、图形只有装饰、关键内容只能 hover 读取、手机要双指缩放、对比度不足或动效妨碍审查，均应返工。

## 交付门

`loom atlas build` 写入 `.loom/vN/11_DECISION_ATLAS/atlas-model.json`，其中包含当前资料的 source digest。生成的项目根 `loom-atlas.html` 必须在 head 内带同一个：

```html
<meta name="loom-atlas-source-digest" content="...">
```

`loom atlas validate` 校验资料模型、HTML、digest 与五个章节。全部 Intent 闭合后，缺少或过期的 Atlas 会让 `loom guide` 停在 `need_decision_atlas`；它不是可选美化。
