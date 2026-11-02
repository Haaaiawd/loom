# 2026 年 AI 开发方法对照：LOOM 缺在哪里

检索日：2026-10-18。用户关注的时间范围：2026 年下半年，当前已发生的部分为 2026-07-01 至 2026-10-18。本报告检查当日可访问的官方资料；较早发表但仍有参考价值的工程方法明确注明日期，不把它们称为下半年新发明。

本轮使用 Exa 做了 10 次成功检索，返回 47 条候选结果，并通过官方仓库、官方文档及原作者工程文章核对机制。47 是检索结果条数，含重复，不是 47 个独立验证来源。比较选择五个社区框架、一个集成产品和一组厂商工程方法，覆盖规范驱动、开发纪律、上下文、既有仓库、生命周期与宿主集成。社区规模、持续维护和官方工程经验是入选信号，不是市场占有率或效果排行。

**结论：LOOM 的理解与连续性方向成立。相较这些方法，主要缺口在于按情景选择最少必要流程、让当前事实与旧证据持续对齐、控制恢复成本，以及让检查真正连接运行结果。** 增加角色、模板和文档数量，并不能补齐这些缺口。

## 1. 哪些方法值得对照

### GitHub Spec Kit：规范到实现的再收敛

官方当前 SDD 路径包含 constitution、specify、plan、tasks、implement、converge，也有 clarify、checklist、analyze。analyze 面向规范、计划和任务之间的一致性；converge 在实现后寻找未兑现部分，补任务后继续实现。当前仓库还将修 bug、判断想法作为不同入口，不宜只用早期“线性 SDD 模板”概括它。

借鉴点：交付前重新核对承诺有没有兑现，不能只数任务勾选。限制：模型做一致性检查不等于执行验证；官方列出机制也不证明其实际收益。

来源：[官方仓库](https://github.com/github/spec-kit)、[SDD Quickstart](https://github.github.com/spec-kit/quickstart.html)。

### OpenSpec：以一次变更为单位维护当前规范

它区分当前规范与进行中的 change，后者有 proposal、delta specs、design、tasks。实施中可以改规划，完成后 sync/archive。一次急修可成为另一个 change，之后返回原变更。这里值得学习的是变化的边界和闭合位置。

限制：官方明确 verify 不阻止 archive，未完成任务也可以仅警告。因此不能把 OpenSpec 描述成自动保证交付完整或强事务系统。不同 agent action 与 CLI archive 路径的同步行为也有区别。

来源：[官方仓库](https://github.com/Fission-AI/OpenSpec)、[官方 Workflows](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/workflows.md)。

### BMAD Method：当前文档比旧印象轻

当前官方允许很小的低风险编辑跳过框架；Build 根据意图缺口、不可逆动作和影响范围选择轻重路径。存量仓库以代码为主要事实源，保留真正难发现的约束。新的 project-context 支持 adopt、refresh、record、audit，旧 document-project 已弃用。

借鉴点：不是为所有项目准备相同文件，而是补当前工作缺失的理解。限制：它仍有显著的工作流、角色和维护成本；其人类审批方式不必照搬到“LOOM 对用户不可见”的产品目标。

来源：[Build a Change](https://docs.bmad-method.org/build/build-a-change/)、[存量仓库入口](https://docs.bmad-method.org/existing-codebases/start-in-an-existing-codebase/)、[上下文维护](https://docs.bmad-method.org/existing-codebases/set-and-maintain-project-context/)、[规划尺度](https://docs.bmad-method.org/plan/choose-a-planning-path/)。

### Superpowers：把工程纪律做成可触发的技能

它将澄清、计划、执行、调试、代码审查和收尾组织成技能。verification-before-completion 特别要求成功声明之前运行并读取新鲜验证结果。它的价值是缩短“应该验证”和“实际做验证”的距离。

限制：技能指令仍靠宿主遵循，并不是独立的真实性证明。强 TDD、很细的任务和频繁审查也不适用于所有文字、运维、探索工作。

来源：[官方仓库](https://github.com/obra/superpowers)、[完成前验证技能](https://github.com/obra/superpowers/blob/HEAD/skills/verification-before-completion/SKILL.md)。

### GSD / GSD Core：把非理想路径纳入日常操作

检索确认旧 gsd-build/get-shit-done 仓库已归档并指向 open-gsd/gsd-core。当前文档有既有仓库 onboard、pause/resume、工作范围调整、状态诊断、升级后本地修改恢复，也强调为新上下文准备可执行工作单元。

借鉴点：暂停、恢复、升级和自定义文件保留是产品路径，不应全靠 Agent 临场补救。限制：多运行时适配和大量命令也带来复杂度。部分机制来自当前 next 分支文档，未逐项安装验证，也不承诺 npm 稳定版包含同样行为；新旧仓库的关注量不能相加当用户数。

来源：[旧仓库迁移声明](https://github.com/gsd-build/get-shit-done)、[GSD Core](https://github.com/open-gsd/gsd-core)、[当前用户指南](https://github.com/open-gsd/gsd-core/blob/next/docs/USER-GUIDE.md)。

### Kiro：事件能把规则接到执行时刻

Hooks 支持在会话、工具或任务事件触发 shell 命令或 Agent 提示；PreToolUse 可进行前置校验。它说明持续性规则可以由宿主事件唤起，不必每次等模型自己想起。

限制：表面/版本支持不同；文件事件只响应 Agent 的文件修改，不响应人类手动编辑。因此 hooks 不能替代恢复时核对仓库差异，也不是所有命令自动成功。

来源：[官方 Hooks](https://kiro.dev/docs/hooks/)、[事件与支持范围](https://kiro.dev/docs/hooks/types/)。检索标注该文档更新于 2026-10-10。

### Anthropic 的 harness 工程方法：只保留仍然有用的脚手架

2026-03-24 的长程开发实验使用规划、生成和评价，在运行中的应用上检查结果；作者也报告评价者会漏错、会错误放行。换更强模型后，一些分解和逐轮评价可被移除。2026-04-02 的文章继续强调检查哪些约束已不再必要。

借鉴点：评价要接触真实结果，流程要随模型和任务难度变化。限制：这些是具体团队与任务上的工程实验，不是证明所有 Agent 都应采用同样架构的通用基准。

来源：[Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)、[3 patterns for harness design](https://claude.com/resources/articles/harnessing-claudes-intelligence)。

## 2. 回到 LOOM：八个具体不足

以下是结合外部机制和本地证据的判断，并非外部作者对 LOOM 的评价。

### A. 流程重量主要由 Agent 自觉调整，项目入口缺少相应支持

LOOM 已明确反对固定问卷、无必要测试和通用软件模板。但 `markReady`（store.js:798）仍统一要求真实 PROJECT、至少一个设计文档和非空任务图。任务级的 design/capability exemption 不能替代项目级的轻入口。

对照 BMAD、Spec Kit 不同入口，缺口不在理念，而在能否让实现支持理念。一次明确低风险修复，不应为了过同一道项目门槛补出虚假的“完整设计”。

建议：按不确定性、影响范围和可逆性路由为直接处理、一次变更、跨阶段项目；三者共用相同诚实证据原则，按需扩大上下文。不要另造三套重复框架。

### B. 接入现有仓库偏脚手架，缺少事实校准和维护入口

上一轮 P01 证实 init 保留源码和已有规则，但 PROJECT 仍是模板。`installAgentAnchor`（146）追加固定协议，不能判断已存在指令的适用性，也无 adopt/refresh/audit 路径。

BMAD 当前实践尤其提醒我们：不要为“理解项目”复制一遍代码中能直接发现的信息。LOOM 的 PROJECT 和 STRUCTURE 有明确的地图价值，应保留；需要减少的是重复说明和无来源的概括。

建议：接入只建立与本次任务有关的可信基线；记录难重建的意图、例外、运行前提和错误教训。保留来源与最近核对位置；常规技术事实尽量指向配置和代码。

### C. 变更有日志，没有完整的影响与闭合机制

LOOM 有 decision、affected_tasks、update/reopen，并非不能处理演化。但影响对象由 Agent 手填，完成后的依赖失效不自动显现。上一轮 P06：上游重开为 open，下游仍 done，check 没有相关警告。

从 OpenSpec 借的应是一次变更的明确边界：为什么改、修改哪些当前承诺、旧证据哪些还有效、何时闭合。无需照搬它的目录，也不能声称它自动解决语义依赖。

建议：构建轻量变更记录连接既有 decision 与 tasks，给依赖闭包标注待复核；Agent 判断实质影响，无影响则保留，有影响再重验。取消与缩小范围也需要正式出口。

### D. 验证承诺强，证据与现实的绑定仍弱

LOOM 完成任务需要逐项 evidence，并校验本地输出存在，这是已有优点。问题是 evidence 仍是文本，CLI 无法知道其是否来自本次运行、哪个版本、什么环境。上一轮 P07 还表明，存在未覆盖交付时项目可 complete，check 可 healthy=true。

借鉴 Spec Kit converge、Superpowers 和 Anthropic 运行中评价：完成前需要一次跨层核对。Keeper 检查首次可交接性；它不能替代结果验收。LOOM 已能用普通 Task 做阶段审查，缺的是默认触发条件与可追溯证据，而不是再创一个角色。

建议：对高风险或跨组件交付，记录验证命令/观察方法、退出码、日志/截图引用、代码或输入摘要、范围和时间。外部人工验证仍允许，但来源要诚实。把结构健康、任务完成、交付覆盖和真实结果分开报告。

### E. 上下文聚焦只控制任务选择，尚未控制输入体积

`compileContext`（928–993）总是加入协议、PROJECT、STRUCTURE；active 时再加执行协议和全部 reads 文件。当前没有整体预算、分层按需取用或体积预警；STRUCTURE 如在 reads 中会重复加入。

本轮 TASK-016 的实测输出为 156,362 字符，其中通用协议 10,560、执行协议 5,519；store.js 68,156、protocol.js 45,718；STRUCTURE 注入两次。它是本轮广范围审查的压力例子，不代表普通任务平均值，也没有将字符数冒充 token 数。

对照 BMAD 的上下文精简和 GSD 的工作单元设计，LOOM 需要证明“选择了相关文件”之外的效果：恢复时能否保留关键限制，同时减少重复和无关内容。

建议：最小恢复包给出当前意图、任务、风险和精确引用；细节按需读取，支持可追溯的节选或节点，不静默截断。先做去重、字符体积分解和大输入警告，再决定是否需要复杂检索。

### F. 暂停、升级、损坏恢复没有完成产品化

状态仅 open/active/blocked/done；没有 pause/cancel，临时插队借用 block。P02 表明重复 init 不同步锚点，P03 表明已存在 state 时 init 不修复损坏 tasks，P09 表明 check 不识别普通锚点丢失。state 仅记录 schema，缺少 CLI/protocol 来源关系。

GSD 的文档直接展示了这些路径的重要性。LOOM 不必复制几十个命令，但需要让 Agent 有明确的诊断、保存、恢复和验证步骤。

建议：优先做只读诊断和可审阅同步；保留升级前快照与自定义锚点外内容；恢复时核对代码、状态、协议三者。单文件 atomic rename 不是多文件事务，并发能力仍需单独设计。

### G. “不可见基础设施”尚缺宿主能力适配

当前依赖 AGENTS 提醒 Agent 在边界运行 context，没有会话/停止/工具事件的适配契约。初次 Keeper 的隔离由宿主负责，sidecar 参数也要宿主持续传入。

Kiro 的事件式操作给出一种可选机制。但 LOOM 的可移植性有价值，不应为了 hooks 绑定某 IDE。

建议：保留 CLI 核心，定义宿主可提供哪些事件、独立执行环境、检查结果与工作区身份；有能力时自动接入，没有时明确使用提示协议。只在有意义边界触发，不在每次保存时重新注入全部上下文。

### H. 框架新增机制还没有足够的边际收益证据

不能说 LOOM 没有评估。EVIL_EVAL.md 已规定等模型、等信息、等预算、重复、盲评和消融；pilot-001 也实际做过比较。结果记录坦诚说明：每条件仅一次，预算未计量、干预不对称、评审包曾损坏，因此只有方向性观察，不能证明普遍收益。live-use 同样是单次观察。

这与 Anthropic 随模型能力删除脚手架的做法呼应。我们现在最缺的不是再写一份评估原则，而是执行已写下的原则，并将模型版本纳入复查条件。

建议：同模型/预算比较普通 Agent、最小 PROJECT+Task、完整 LOOM；先测现仓接入、途中改意图、暂停恢复三个场景，每条件至少三次。观测结果正确性、漏验率、用户负担、耗时、token 和文档维护量。首轮不要同时给多家框架全套配平，否则实验成本先失控；最小 LOOM 若已有效，再加入最贴近的外部方法基线。

## 3. 哪些差异应该保留

LOOM 的自然交流、当前整体入口、专业判断卷宗、能力节点与任务的连接、跨上下文可追溯性，仍是值得保留和测试的组合。不能因其他项目关注量更大，就把它们都改成软件 PRD 或固定角色接力。

不建议照搬：每任务强制新 Agent、全场景 TDD、固定数量的小任务、默认工作树/提交、所有小改都写规范、角色越多越专业，以及把 CLI 绿色或 LLM 审查判决当真实完成。

更值得形成的定位是：**在目标和环境不断变化时，为 Agent 保存最少且足够、能查到来源、知道何时要重验的项目判断。** 它比“让 Agent 更认真规划”更具体，也更容易被实验推翻或证实。

## 4. 建议下一轮按什么顺序验证

1. **完成和变化的可信度**：复现 P06/P07；上游变化应让相关下游进入待复核，未覆盖交付不应被展示成结果已交付；证据能指向对应输入和版本。对无影响任务不强制重做。
2. **最小恢复与轻重路由**：去重并量化 context；分别测试微修、普通变更、长期项目。成功标准是关键限制保留、用户额外操作减少、总体成本下降，不是文件更少。
3. **现仓与升级路径**：在有自定义 AGENTS、有未提交代码的仓库接入；模拟协议版本不同、暂停插队、JSON 损坏。要求不覆盖原规则、不制造双真相、能给出可执行恢复出口。
4. **跑消融而非继续累加**：把上述候选机制逐个加入最小 LOOM，看收益是否仍成立。没有收益就删减，不因为已经实现而保留。

## 本地证据入口

- `docs/loom-journey-audit.md`：上一轮 38 个情景及 12 个隔离探针的解释。
- `tmp/loom-journey-probe-results.json`：P01–P12 的原始观察，本轮引用既有结果，未称重新运行。
- `cli/src/store.js`：当前实现；行号均为本轮定位。
- `EVIL_EVAL.md`：已有因果比较协议。
- `evals/pilot-001/PILOT_RESULT.md`：方向性试验与混杂因素。
- `evals/live-use-001/ROOT_REVIEW.md`：早期单次实用观察；若干缺陷已修，不将旧发现一概当作当前缺陷。

## 不确定性

未安装或端到端运行这些外部框架；官方功能描述与源码/技能约定不等于实际效果。当前 mutable 文档不是锁定版本；某些早期索引与官方新文档冲突时，以新官方入口为准并保留限制。此次未覆盖所有流行工具，也未对任何框架给出全面优劣或市场份额结论。本轮仅交付研究与建议，没有修改 LOOM 运行时。
