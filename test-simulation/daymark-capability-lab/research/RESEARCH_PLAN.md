# Daymark — 外部能力研究计划与转译记录

> 检索执行日：2026-08-01。此文件记录的是已实际查阅的来源与由此产生的项目约束；不是一个未来会去搜索的愿望清单。

## 研究原则

Daymark 记录的是用户对注意力和精力的主观描述。它不测量健康、疾病、诊断、认知能力或生产力。因此外部研究的用途不是给产品添加“科学权威感”，而是防止设计把个人记录偷换成评判。

本轮只研究四项会直接改变入口、图形、文案、数据控制或验证方式的 high-impact capability。它们均设为 `external_required`；若把其中任一项错判为 medium 或 low，当前机制允许 Agent 不创建 Brief，从而直接跳过检索。这正是本演练要暴露的 Impact Gate 风险。

## 已查阅来源

| ID | 来源与选择理由 | 得到的可用事实 | 转成 Daymark 的约束 |
| --- | --- | --- | --- |
| S1 | [Li, Dey, Forlizzi — A Stage-Based Model of Personal Informatics Systems](https://www.cs.cmu.edu/~jhm/Readings/2010-ianli-chi-stage-based-model.pdf)。原始 HCI 研究，直接讨论个人信息系统中的准备、收集、整合、反思与行动，以及前段障碍如何向后传递。 | 自我记录不是单点表单；收集和反思是迭代的，并需要平衡自动化与用户控制。 | 记录入口不能逼迫解释；回看只显示用户留过的材料和空白，不能自动声称因果或行动建议。 |
| S2 | [Epstein et al. — A Lived Informatics Model of Personal Informatics](https://pmc.ncbi.nlm.nih.gov/articles/PMC12435389/)。同行评审的开放全文，补足了暂停与重新开始并非失败。 | 人会中断记录、改变目的、之后重启；系统不应假设连续采集。 | 不做 streak、补录催促或“本周完成率”；缺口以“未记录”呈现，而不是负分。 |
| S3 | [van Berkel et al. — Beyond self-reflection: rumination in personal informatics](https://link.springer.com/article/10.1007/s00779-021-01573-w)。针对个人信息学中反思可能转为反刍的风险。 | 反思并不天然有益；用数据强化负向循环是一个要主动规避的设计风险。 | 周视图不输出“你效率低/状态恶化/应该休息”等结论；所有模式都回链可见记录，并允许用户忽略或修改描述。 |
| S4 | [W3C WAI — Complex Images](https://www.w3.org/WAI/tutorials/images/complex/) 与 [W3C WAI — Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/)。W3C 的可访问信息结构指引，直接对应时间带和周内表。 | 复杂图形需要文字的长描述和结构化数据等价物；只依赖视觉线索会使人失去关系与上下文。 | 每个图形必须有可见摘要、可浏览的记录列表/表格和键盘焦点；颜色不单独传递刻度、是否记录或选中状态。 |
| S5 | [NIST Privacy Framework](https://www.nist.gov/privacy-framework/privacy-framework) 及其 [Control / Data Management 说明](https://www.nist.gov/system/files/documents/2019/06/27/privacyframework101-webinar-deck.pdf)。NIST 明确把选择性收集、查看、修改和删除列为数据控制能力。 | “隐私”需要能查看、改变和删除数据的过程，而非单一告知。 | 默认不联网传输记录；单条记录可编辑/删除；导出含字段说明；任何未来同步必须显式选择且不阻碍本地使用。 |

## 从检索到 Brief 的路由

| Capability | 外部研究是否改变方案 | 可编译给 Forge 的输入 |
| --- | --- | --- |
| `CAP-MOMENT-SIZED-CAPTURE` | 是。S1/S2 排除了打卡、长表单和连续性假设。 | 可选短语 + 主观刻度 + 自动时间；跳过、之后再记和编辑与提交同等合法。 |
| `CAP-INTERPRETABLE-TIME-BAND` | 是。S4 排除了仅用热力色块/拖拽的“漂亮图表”。 | 图形、记录表、文字摘要三种读法同源；焦点能定位片段；无记录是明示的未知。 |
| `CAP-LAPSE-TOLERANT-REFLECTION` | 是。S1/S2/S3 排除了连续天数、排名、自动建议与诊断式总结。 | 使用“记录显示 / 未记录 / 你可以自行解释”的语言；禁止效率分、病征、因果与处方。 |
| `CAP-LOCAL-REVERSIBLE-RECORDS` | 是。S5 把“local-first”从存储口号推进为可查看、可改、可删的流程。 | 默认本地；逐条编辑/删除；可读导出；未来同步只能主动开启。 |

## Impact Gate 演练结论

当前 Graph 的 `impact` 是自由文本枚举，没有必填的 `impact_rationale`，也没有 CLI 校验“high 判定是否有用户后果、误判代价与获取策略”的说明。本演练使用了额外字段 `impact_rationale`，但 Loom 不会要求它。

这意味着两类失败仍很容易发生：

1. Agent 把关键能力轻率标为 `medium`，便不会触发 high capability 默认的外部获取强门；
2. Agent 把一切都标为 `high`，又会制造无差别研究负担，使图谱退化成仪式。

建议的最小后续改进是引入 **Impact Gate**：对每个 capability 强制写“若做错会破坏哪项用户结果”“为什么当前版本必须解决”“若标为非 high，为何允许不检索”；`high + external_required` 则要求 Brief 中至少一条已访问的一手或同行评审来源，才能从 `open` 进入 `researched`。这不是在 Graph 里保存搜索关键词，而是让影响判定对外部获取真正负责任。

## Proposed Intent Boundaries

- `INT-001`：捕捉一个短小、可修改的日常片段；不需要连续记录，不保存到网络。
- `INT-002`：将片段与未知以时间带、周内结构和可访问等价视图呈现；不输出评分或建议。
- `INT-003`：证明数据控制和非诊断边界在真实任务中仍成立；必须由独立审查者完成。

这些边界用于 `loom capability compile` 演练，尚不是实施授权。
