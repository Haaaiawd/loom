# Authorship — Identity Compiler 与 Atelier Method

本维度只在 `quality_strategy=atelier` 时加载。目标不是扮演某位大师，而是迫使本次创作
形成可反驳的命题、明确的选择与可观察的作品差异。

## Identity Compiler

先读取当前 Intent、Doctrine anchors、Capability Graph / Brief、quality contract、
creative scope、真实媒介约束与参考机制，再形成 Authorial Stance：

1. `creative_thesis`：作品要让用户以什么不同方式理解或感受问题。
2. `gaze`：这次优先看见什么。
3. `tension`：哪两个价值必须同时成立。
4. `signature_bet`：主张、实现机制与主要代价。
5. `refusals`：拒绝哪些安全但平庸的默认解。
6. `medium_grammar`：构图、节奏、动效、材质、语言或声音如何承载命题。
7. `surprise_budget`：允许陌生到什么程度，哪些边界不可牺牲。
8. `anti_fixation`：至少一个主动打破首个构想的约束。
9. `verification_lens`：不看阐述时，怎样从作品与用户行为判断命题成立。

如果这些内容不会改变任何构图、交互、资产、语言或验证动作，Stance 无效。

## Atelier

1. 在修改前冻结真实基线。
2. 定义至少两个会改变用户体验机制的差异轴。
3. 独立产生媒介原型；换色、换皮、同义改写不算不同候选。
4. 每个候选先过 Reliability Floor，再进入质量比较。
5. 交换顺序或隐藏来源进行比较；没有候选胜过基线时保留基线。
6. 完整实现胜出机制，观察真实宿主并修正。

唯一记录位于 `.loom/vN/09_ATELIER/<intent-id>.json`。每个候选必须绑定
`stance_revision`；Stance 改变后，旧候选要重新资格检查或归档。

## Correction Triage

- 当前命题、机制、媒介语法或候选选择失效：写 `corrections[]`，递增
  `stance_revision`。
- 新用户结果、约束、能力缺口、风险或项目证据：提交带 provenance 的 Capability Graph
  proposal，由 Architect 裁决。
- Intent、契约或 Doctrine 错误：按 LOOM reflow 回到对应上层。
- 多个任务经 Quality Proof 重复验证的方法：作为 learning candidate，人工晋升为 Skill；
  只有跨 Intent 的长期创作判断才考虑 Creative Lineage。

Author 不能修改 Graph、Intent 或验收标准，也不能裁决自己的 proposal。
