# Daymark Capability Lab

这是一次只做架构与研究输入的 LOOM 演练，不包含前端实现。Daymark 是一个本地优先的小工具：人们在一天中用一小段文字和一个主观刻度记下注意力与精力片段，随后在时间带和周视图中回看自己的模式。

它不是医疗产品、心理诊断、效率评分器或行为处方系统。任何模式都只能被呈现为用户可回看、可修正的个人记录，不能被推断为健康状况、能力高低或应采取的行动。

## 本次要检验什么

1. 具体 capability 是否写成用户可观察的结果，而不是 `CAP-UI`、`CAP-UX` 或一份待办清单。
2. 高影响 capability 是否真的被外部资料改变了设计和验证约束。
3. Brief 是否能成为 Forge 的工作输入，而不是泛泛的“你是专家”提示词。

## 目录

- `.loom/v1/07_CAPABILITY_GRAPH.json`：能力边界、关系与路由。
- `.loom/v1/07_CAPABILITY_BRIEFS/`：四项高影响能力的项目化输入。
- `research/RESEARCH_PLAN.md`：检索问题、来源选择和转译记录。
- `.loom/v1/04_INTENT_MAP.json`：仅用于检查编译与回链的拟议 Intent，不授权实现。

## 复核命令

```powershell
loom capability graph
loom capability frontier
loom capability coverage
loom capability compile INT-001
loom capability compile INT-002
```

在本目录执行上述命令；所有 Intent 仍为 `pending`，没有任何实现或验证通过的声明。
