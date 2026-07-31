## LOOM 工作流

## 0. 诊断

```bash
loom guide
loom context
```

只读探测使用 `loom guide --dry-run`。

## 1. Doctrine — Weaver

```bash
loom activate weaver
loom philosophy check
```

输出项目长期判断、卓越标准、决策原则、创作空间、反模式与 Evidence Map。
研究数量不设配额；只保留真实改变判断、能够追溯的证据。

## 2. Intent — Visionary

```bash
loom activate visionary
```

输出产品目标、成功图景、非目标与 Intent narrative。Visionary 不写 acceptance、DAG 或架构。

## 3. Capability Graph — Architect

```bash
loom activate architect
loom capability graph
loom capability frontier
loom capability coverage
```

在写 Intent Map 前，Architect 先把愿景展开为项目问题面、能力缺口、风险与证据。图谱不是待办列表：高影响节点必须继续展开、形成项目化 Capability Brief、编译为 Intent，或带理由地延后/排除。每个 Intent 必须回链图谱；只有边界清楚且可独立验证的结果才进入 Intent Map。

## 4. Contract — Architect

```bash
loom activate architect
loom intent validate
loom doctor
```

Architect 产出系统边界、Intent DAG、完成契约和可选质量契约，并声明
`capability_needs` 与 `creative_scope`。

完成契约定义 **Reliability Floor**：做到什么才算可靠完成。
质量契约定义 **Distinctive Ceiling**：什么可观察差异让结果不止合格。

## 5. Quality Engine — Forge 与 Keeper

```bash
loom intent next
loom intent update <id> --status in_progress
loom activate forge --intent <id>
loom activate keeper --intent <id>
```

Forge 编译 Expertise Pack，在 Quality Arena 中实现与比较。
Keeper 从当前磁盘事实和契约独立验证，不继承 Forge 的解释。

当 `loom capability compile <id>` 报告 `acquisition.required=true` 时，先运行：

```bash
loom expertise init <id>
# 实际执行 find skill / web / official docs / research 检索并填写 Pack
loom expertise validate <id>
```

门未闭合时不能写入 passed。Keeper 会重新打开关键来源，passed 记录绑定当前 Pack。

无质量契约时，四个基础维度通过即可闭合。存在质量契约时，额外验证
`quality_achievement`；声明相对提升时，在该维度中链接 Quality Proof：

```bash
loom verify pass <id> \
  --summary "<具体证据>" \
  --reproduction-command "<可复现命令>" \
  --quality-proof "<基线、比较和稳定性证据的位置>"

loom intent done <id>
```

复杂或混合判定使用 `loom verify write --json-file <path>`。

## 6. Reflow

验证偏离时，不要把所有问题都扔回 Forge：

- Doctrine 不足 → Weaver
- 产品目标错误 → Visionary
- 问题面、能力缺口或 Intent 路由遗漏 → Architect 更新 Capability Graph
- 契约、边界或依赖错误 → Architect
- 专业判断或实现不足 → Forge
- 证据不足 → Keeper 补证或 `pending_human`

连续三次 `deviated` 自动升级为 `blocked`。所有当前 revision 和当前验证 epoch 的 Intent 都有最新 passed
记录，且没有 `needs_review`、`loom doctor` 没有 fatal/high 风险时，本轮收敛。

## 7. 演进

- Patch：不改变 Intent 语义，验证后记录 changelog。
- Minor：用 `loom intent add|revise` 创建 draft，经限定作用域的 Visionary/Architect 更新后 finalize。
- Major：Doctrine、北极星或主要架构边界改变，使用 `loom version new`。

原则只有一句：流程成本必须小于它降低的风险；质量声明必须小于等于它拥有的证据。
