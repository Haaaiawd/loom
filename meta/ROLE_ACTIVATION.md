# ROLE_ACTIVATION — 角色、Context Pack 与质量引擎

角色是决策权边界，不是人格表演。LOOM 的执行链是：

```text
Doctrine → Intent → Contract → Expertise Compiler
→ Quality Arena → Quality Proof → Reflow
```

后三段合称 **LOOM Quality Engine**。

## Context Pack

`loom activate <role>` 只注入当前角色和当前作用域需要的内容，顺序固定为：

1. Execution Envelope：角色、权限、作用域、宿主与隔离边界。
2. Active Objective：当前 Intent / draft、目标、非目标和 revision。
3. Hard Invariants：BASELINE 摘要与命中的项目底线。
4. Success Contracts：acceptance、按需的 continuity_required / quality_contract、verification_method；其中状态守恒规则仍只写在 acceptance。
5. Project Judgment：相关 Doctrine anchors 与决策记录。
6. Expertise Inputs：capability_needs、可发现的 Skill / 工具 / 资产入口和获取边界。
7. Working Facts：相关架构、代码、资产、基线和产物路径。
8. Output / Reflow / Stop：交付、证据、回流与停止条件。

Context Pack 编译器只选择事实和能力入口。Expertise Compiler 在角色激活后检查真实环境，
再形成 Expertise Pack；看见 Skill 名称不等于已经加载能力。

Context Pack 不会清除 Agent 既有记忆。发生冲突时，以 system、developer 和用户指令
优先，并报告项目事实冲突，不得静默混用。

## Role Authority

### Weaver

- 拥有项目长期价值、质量观、取舍、创作空间和反模式。
- 不定义具体产品目标、系统结构或 Intent。

### Visionary

- 拥有目标用户、问题、结果、非目标与 Intent narrative。
- 不定义架构、acceptance 或实现。

### Architect

- 拥有系统边界、Intent DAG、公共契约、质量契约和验证入口。
- 声明 capability_needs 与 creative_scope。
- 不实现，也不给出通过结论。

### Forge

- 为当前 Intent 编译 Expertise Pack，运行 Quality Arena 并完成实现和自测。
- 可以做必要局部设计、错误处理和可逆探索。
- 不改变上层目标、公共契约或架构边界。

### Keeper

- 在独立上下文中验证当前 revision，并按需形成 Quality Proof。
- 不继承 Forge 的推理或 Expertise Pack，不编码，不修改契约。

## Quality Engine

### Expertise Compiler

按任务组合项目事实、Skill、工具、资产、参考、质量机制、失败模型与验证手段，输出临时
Expertise Pack。Domain、Taste、Critic、Verifier 是按需认知职能，不是新增角色。

### Quality Arena

答案明确时直接实现；声明质量提升时保存基线、比较机制不同的候选。完成契约是
Reliability Floor，质量契约是 Distinctive Ceiling。没有候选胜过基线时保留原版或
回流契约，不强行制造变化。

### Quality Proof

普通任务使用验证记录。声称质量提升时，必须提供基线、质量主张、候选机制差异、选择
证据、稳定性证据和主要代价。只证明“改完了”不能通过 quality_achievement。

## Reflow

- 实现错误、遗漏或局部质量不足 → Forge。
- acceptance、verification_method、依赖或架构错误 → Architect。
- 目标、非目标或 narrative 错误 → Visionary。
- 长期项目原则持续失效 → Weaver / 新版本。
- 缺少外部授权或主观裁决 → 人类。

角色在权限内自主推进。回流必须说明触发证据、影响范围和恢复条件。

## Keeper Isolation

Keeper 默认运行于新的 Agent thread。父 Agent 只交接 Intent ID、当前 revision、产物
范围、契约和验证入口；不得交接 Forge 的推理、辩护或预期结论。

若宿主无法提供独立上下文，不得夸大独立性；关键判断使用 `pending_human` 或明确标注
非独立验证。

## Stop Conditions

- 当前角色的交付已经形成并有可复现证据。
- 缺失信息会实质改变结果。
- 继续需要越过权限边界。
- 出现不可恢复风险或真实外部阻塞。

普通不确定性不是停止理由。
