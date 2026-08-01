# External Acquisition 与 Expertise Pack

LOOM 把“知道任务需要某项能力”和“真正获得了这项能力”分开。Capability Graph 只决定是否
需要外部获取；Forge 在当前 Intent 中派生查询、实际检索，再把有来源的核心信息编译成
Capability Capsules。

```bash
loom capability compile <intent-id>
loom expertise init <intent-id>
# 编辑 .loom/vN/10_EXPERTISE_PACKS/<intent-id>.json，并实际执行检索
loom expertise validate <intent-id>
loom activate forge --intent <intent-id>
```

## 什么时候强制

- capability 显式声明 `acquisition_mode: external_required`；
- 或高影响 capability 没有显式声明模式（默认即为 `external_required`）。

Graph schema 1.3 中，高影响 capability 不允许 `adaptive` 或 `project_only`：它必须实际检索。
中低影响任务默认为 `adaptive`；仅依赖未公开内部协议、外部知识不会改变做法的机械任务可以用
`project_only`，但必须写 `acquisition_rationale`。若外部知识仍可能改变方案，应回流 Impact Gate 上调，
而不是把检索省掉。

## Search Plan

Forge 根据 capability question、Capability Brief、Intent narrative、质量契约、creative
scope、媒介约束和基线缺口派生查询。每个 `external_required` capability 都是一项主动探索：先写清它需要回答的专业决定，再记录哪一条来源会让设计、实现或验证路径不同。关键词是运行时证据，不写回 Graph。

必须实际使用 Skill registry、网络、官方文档或研究资料。模型自行生成的原则、没有打开的
搜索摘要和只看标题的结果都不能登记为来源。首个来源如果只是通用建议、无法改变具体决定或与另一来源冲突，继续探索或回流，不得把它凑成 Capsule。每个计划必须写停止条件，避免无边界浏览。

## Capability Capsule

每个 required capability 至少有一个 Capsule，包含：

- 专业问题与适用时机；
- 规则和工作流；
- 决策门与失败模式；
- 可观察验证信号；
- 至少一个直接外部来源引用。

Pack 只保存项目化综合和定位信息，不复制第三方 Skill 或网页正文，也不会自动变成 Doctrine
或通用 Skill。Intent revision 改变后，旧 Pack 自动失效。

## Keeper

CLI 能检查 Pack 当前、来源可定位、Capsule 直接引用外部资料，但不能仅凭 JSON 判断来源是否
真的支持结论。Keeper 必须在独立 task 中重新打开至少一个关键来源，核对规则与判断门，并让
`loom verify pass` 将当前 Pack 的内容摘要绑定进验证记录；之后 Pack 内容发生变化必须重验。

更多设计边界见 `EXTERNAL_ACQUISITION_DESIGN.md`。
