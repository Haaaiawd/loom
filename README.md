# LOOM

> **Loop + Orchestration + Ontology + Mind**
>
> 哲学是经线，意图是纬线，loop 的往复就是织机运作，织出软件。

---

## LOOM 是什么

LOOM 是一个**哲学驱动的 Agent 质量框架**，核心理念：

**让 Agent 先拥有项目判断，再为当前任务编译专业能力；在可靠完成之上，通过比较与独立证据追求出众。**

LOOM 的核心机制：
1. **Project Doctrine** 从项目事实中形成长期判断，而不是套用规范模板
2. **Intent + Contract** 同时定义可靠完成的底线与可选的质量上限
3. **Expertise Compiler** 为当前任务临时组装领域、品味、批评与验证能力
4. **Quality Arena + Quality Proof** 用机制不同的候选和独立证据支撑质量提升

---

## 核心概念

| 概念 | 一句话解释 |
|---|---|
| **哲学** | 项目的价值观和工程原则——为什么存在、什么不做、冲突时谁优先。由 Weaver 从真实思想体系织造，不是模板填空 |
| **Intent** | 一个意图单元——不是"做什么"（任务），是"为什么做"（意图）。每个 Intent 有验收契约，Keeper 据此判定实现是否忠实 |
| **Intent Map** | 所有 Intent 的依赖图（JSON）。Architect 绘制，定义拓扑序和依赖关系 |
| **Capability Graph** | 在 Intent 前展开项目问题面、能力缺口、风险和证据；高影响节点必须路由，并回链到 Intent |
| **Expertise Pack** | Forge 针对当前任务临时编译的专业认知，不成为永久规则 |
| **Quality Arena** | 以基线和机制不同候选进行探索、比较、实现与观察 |
| **Quality Proof** | Keeper 独立验证完成与质量声明，证据不足时不允许宣称提升 |
| **Intent Loop** | 选择 → 编译专业能力 → 实现/比较 → 独立证明 → 闭合或回流 |
| **Keeper** | 独立验证角色——不继承 Forge 的解释，从磁盘重新加载意图和契约 |
| **底线** | 不可妥协的约束（BASELINE.md 5 条 + 项目特定底线）。角色激活时强制加载，哲学不能覆盖 |

### Intent Loop 怎么跑

```
Host/Orchestrator 选 Intent（拓扑序第一个 pending 且依赖都 completed 的）
  ↓
Host/Orchestrator 更新 status → in_progress
  ↓
Forge 编译 Expertise Pack，并在需要时运行 Quality Arena
  ↓
Keeper 验证（基础四维；有质量契约时增加 quality_achievement，相对提升时附 Quality Proof）
  ↓
判定结果：
  passed        → status → completed，回到选 Intent
  deviated      → 与 Forge 对话修正，重新实现重新验证（连续 3 轮升级 blocked）
  blocked       → status → blocked，停下报告用户
  pending_human → 等用户补充判定（L3 人类反馈，如游戏手感）
```

**Loop 终止**：所有 Intent 的 status 为 completed → 项目阶段完成。

对会变更既有用户或系统状态的 Intent，Architect 设 `continuity_required: true`。它不创建第二份需求文档，而是要求同一份 acceptance 明确“哪些旧状态不得消失”与“旧状态 → 操作 → 新状态”的验证序列。此类 Intent 只有结果、守恒、可复现证据（以及按需的质量证明）同时通过，才允许闭合。

---

## 快速开始

### 步骤 0：诊断当前阶段

```bash
loom guide
loom guide --dry-run  # 只读诊断，不写 heartbeat
```

guide 检测项目当前在哪个阶段，输出"你在阶段 X，下一步做 Y"。
Agent 每完成一步都跑 guide 确认下一步。
如果只是审计或探测，不希望产生任何状态写入，用 `loom guide --dry-run`。

### AUTO 模式

```bash
loom auto on      # Agent 自动连续执行，不等确认
loom auto off     # 每步需要用户确认
```

### 步骤 1：初始化项目

```bash
loom init
```

**输入**：无（在项目根目录执行）
**产出**：`.loom/v1/` 目录结构 + 模板文件 + AGENTS.md 锚点
**下一步**：`loom guide` → 激活 Weaver 织造哲学

### 步骤 2：织造哲学

```bash
loom activate weaver
```

**输入**：项目特征（什么类型的项目、目标用户、技术栈、约束）
**Weaver 会做什么**：扫描 `dimensions/` 判断激活哪些维度 → 搜索高质量参考 → 萃取原则 → 产出哲学文档
**产出**：`.loom/v1/00_PHILOSOPHY/` 下的哲学文档（PRODUCT_PHILOSOPHY、ENGINEERING_CREED、DECISION_RUBRIC，按需领域哲学，按需 PROJECT_BASELINE）
**怎么判断合格**：哲学文档有北极星、有反模式清单、有决策取舍规则。如果全是空话，让它重做
**下一步**：激活 Visionary 定义愿景

### 步骤 3：定义愿景

```bash
loom activate visionary
```

**输入**：用户需求（产品要解决什么问题、目标用户是谁）
**Visionary 会做什么**：基于哲学定义产品愿景 → 为每个 Intent 写意图叙事（"为什么存在"）
**产出**：`.loom/v1/01_VISION.md`（含北极星 + 意图叙事列表）
**怎么判断合格**：意图叙事是"为什么"不是"做什么"。如果写成了功能列表，让它重做
**下一步**：激活 Architect 设计系统

### 步骤 4：设计系统

```bash
loom activate architect
```

**输入**：愿景文档 + 哲学文档
**Architect 会做什么**：先展开 Capability Graph → 设计系统边界 → 绘制 Intent Map → 定义完成契约、按需的质量契约与专业能力需求
**产出**：`.loom/v1/07_CAPABILITY_GRAPH.json` + `07_CAPABILITY_BRIEFS/` + `.loom/v1/02_ARCHITECTURE.md` + `.loom/v1/04_INTENT_MAP.json`
**怎么判断合格**：高影响图谱节点都有路由、Intent 都可回链到图谱，完成契约可观察，质量契约可比较，依赖无环
**下一步**：进入 Intent Loop

### 步骤 5：进入 Intent Loop

```bash
# Keeper 选 Intent 并更新状态
loom intent next              # 查看下一个可执行 Intent
loom intent update INT-001 --status in_progress

# Forge 编译专业能力并实现
loom activate forge --intent INT-001

# Keeper 独立形成 Quality Proof
loom activate keeper --intent INT-001
loom verify contract INT-001  # 查看验收契约
loom verify write --json-file verification.json  # 写入验证记录

# 根据判定结果
loom intent update INT-001 --status completed    # passed
loom intent update INT-001 --status blocked      # blocked

# 查看进度
loom intent status
```

**Loop 结束**：`loom intent status` 显示所有 Intent 为 completed。

### 步骤 6：人类预览

```bash
loom preview status   # 先检查 preview 是否新鲜
loom preview          # 新鲜则打开；过期则提示重新生成
loom preview --regen  # 输出生成提示词，让 Agent 重写 loom-preview.html
```

preview 是人类总览用的只读投影：哲学、愿景、架构、Intent 进度、验证历史。
`loom preview` 会用 mtime 检查 `.loom/v{N}` 是否比 `loom-preview.html` 更新：
- 新鲜：直接打开 `loom-preview.html`
- 过期：不打开旧投影，提示 `loom preview --regen`
- 强行打开旧投影：`loom preview --stale`

Agent 在用户说"看看进度 / 打开 preview / 看全局"时，先跑 `loom preview status`。

**版本演进三档**：

| 档位 | 什么时候用 | LOOM 流程 |
|---|---|---|
| Patch | 不触及 Intent，只修 bug / 样式 / 实现细节 | 不走 Intent Loop；跑验证并用 `loom patch record` 记录 |
| Minor | 新增或修改 Intent，但不改变哲学前提、愿景北极星、架构边界 | 当前版本内变更；相关 Intent 进入 `pending` / `needs_review` |
| Major | 哲学前提、愿景北极星或架构边界变化 | `loom version new` 创建新版本，全套重跑 |

当前版本全部完成后，运行 `loom guide` 会提示按三档判断，而不是默认开新版本。

**CLI 命令一览**：

| 命令 | 用途 |
|---|---|
| `loom init` | 初始化项目 |
| `loom guide` | 诊断当前阶段，输出下一步引导 |
| `loom guide --dry-run` | 只读诊断当前阶段，不写 heartbeat |
| `loom auto on\|off\|status` | AUTO 模式开关 |
| `loom activate <role>` | 输出角色激活提示词 |
| `loom activate <role> --intent <id>` | 输出仅含指定 draft/官方 Intent 的角色上下文 |
| `loom preview` | 打开新鲜 HTML 预览；过期时提示重新生成 |
| `loom preview status` | 检查 `loom-preview.html` 是否存在、是否新鲜 |
| `loom preview --regen` | 输出提示词，让 Agent 重写 HTML 预览 |
| `loom preview --stale` | 强行打开过期预览 |
| `loom help <topic>` | 分层指南（workflow\|concepts\|loop\|version\|patch\|doctor\|preview） |
| `loom version list` | 列出所有版本（* 标记当前） |
| `loom version new` | 创建新版本 + 自动切换（Major 升级） |
| `loom version use <v>` | 切换当前版本 |
| `loom version diff <v1> <v2>` | 对比两个版本的文件差异 |
| `loom patch record --json-file <path>` | 写入权威 Patch JSON 并生成 Markdown 投影 |
| `loom patch list` | 列出当前版本 Patch |
| `loom patch get <id>` | 查看单条 Patch |
| `loom patch validate` | 校验 Patch ledger 和生成投影 |
| `loom intent next` | 下一个可执行 Intent |
| `loom intent status` | 进度概览 |
| `loom intent get <id>` | Intent 详情 |
| `loom intent add --title <text> [--depends-on <ids>]` | 创建当前版本新增 Intent draft |
| `loom intent revise <id> --reason <text>` | 创建修订 draft 并报告反向依赖 |
| `loom intent draft <id>` | 查看 draft |
| `loom intent finalize <id> [--review <ids> --unaffected <ids>]` | 校验 draft 并原子更新官方 Map/topo_order；修订时必须分类全部下游影响 |
| `loom capability graph\|frontier\|get\|coverage\|compile` | 查看能力图谱、未路由前沿、覆盖缺口和当前 Intent 的能力编译输入 |
| `loom intent deprecate <id> --reason <text>` | 只读评估当前版本弃用影响；加 `--confirm` 并完整分类依赖方后原子写入 |
| `loom intent narrative <id>` | Intent 意图叙事 |
| `loom intent trace <id>` | Intent 完整追溯链（依赖+验证+哲学+叙事） |
| `loom intent diff <v1> <v2>` | 按显式 lineage 比较新建、修订、拆分、合并和未映射 Intent |
| `loom intent reverse-dep <id>` | 反向依赖（谁依赖这个 Intent） |
| `loom intent reverse-ref <anchor>` | 反向哲学引用（哪些 Intent 引用这个锚点） |
| `loom intent update <id> --status <s>` | 更新状态（Keeper 用） |
| `loom philosophy get <anchor>` | 加载哲学章节 |
| `loom philosophy impact <anchor>` | 只读返回直接引用该锚点的 Intent 及传递依赖影响 |
| `loom philosophy revise <anchor> --classification <clarification\|minor\|major> --reason <text>` | 只读评估哲学修订；clarification/minor 加 `--confirm` 和完整分区后写审计 ADR |
| `loom verify contract <id>` | 获取验收契约 |
| `loom verify write --json-file <path>` | 写入验证记录 |
| `loom verify history <ref> --across-versions` | 沿 predecessors 读取各 owning version 的本地验证历史 |
| `loom doctor` | 项目健康检查 |
| `loom context` | 上下文摘要（Agent 重启后一条命令获取状态） |

读命令 `intent get`、`intent narrative`、`intent trace` 和 `verify history` 支持 `v1:INT-003` 形式的跨版本引用；裸 ID 仍指当前版本。历史引用只读。跨版本沿革必须显式写在可选 `lineage.predecessors` 中，同 ID 或同标题不会建立映射，且 lineage 不属于 `depends_on`。

弃用只适用于当前版本中已 `completed` 的 Intent。首次运行 `loom intent deprecate <id> --reason "<why>"` 只返回目标、直接/传递依赖方、各自状态和确认命令，不写文件。确认时用 `--review` 与 `--unaffected` 将所有依赖方恰好分类一次；叶子 Intent 不需要分类参数。弃用记录写入 `lifecycle.deprecation`，目标仍为 `completed`，依赖和契约不被修改。重复确认会明确失败。

哲学修订由 CLI 分析后果和记录审计，不由 CLI 自动改写哲学文本。`philosophy impact` 与未确认的 `philosophy revise` 严格只读。确认 clarification 时全部受影响 Intent 必须归入 `--unaffected`；确认 minor 时可将确需重验的 Intent 归入 `--review`，其中 `completed` 才转为 `needs_review`。两者都不改 acceptance，并在 `03_DECISIONS/PHIL-REV-NNN.md` 记录审计。Major 永不修改当前版本，只返回 `loom version new`。

---

## 系统结构

```
LOOM/
├── README.md                    你在这里。系统总览
│
├── meta/                        元规范（薄而硬——我们写的核心）
│   ├── BASELINE.md              不可妥协的底线（5 条）
│   ├── ROLE_ACTIVATION.md       角色怎么激活、哲学怎么加载
│   ├── INTENT_LOOP.md           Loop 控制流 + Intent Map + Verification 底线
│   └── PHILOSOPHY_WEAVER.md     哲学织造器规范
│
├── dimensions/                  哲学维度库（Weaver 的弹药库）
│   ├── SEARCH_METHODOLOGY.md    检索方法论（怎么找到优质思想）
│   ├── universal/               通用层：产品/工程/协作（按需填充）
│   ├── domain/                  领域层：UX/游戏/后端/AI（按需填充）
│   └── crosscutting/            交叉层：性能/安全/心理学/增长（按需填充）
│
├── roles/                       角色原型定义
│   ├── visionary.md             远见者——定义愿景，织造意图叙事
│   ├── architect.md             建筑师——展开图谱，设计系统，绘制 Intent Map
│   ├── forge.md                 锻造师——在哲学约束下自主实现
│   └── keeper.md                守护者——验证意图忠实度
│
├── cli/                         CLI 传感器层（Agent 通过 CLI 访问磁盘数据）
│   ├── bin/loom.js              命令入口
│   ├── src/                     核心库（intent-map / philosophy / verify）
│   └── test/                    端到端测试
│
└── templates/                   项目级起点骨架
    ├── PHILOSOPHY_TEMPLATE.md   哲学文档起点
    ├── VISION_TEMPLATE.md       愿景文档起点
    ├── INTENT_MAP_TEMPLATE.json Intent Map 起点
    ├── CAPABILITY_GRAPH_TEMPLATE.json Capability Graph 起点
    └── CAPABILITY_BRIEF_TEMPLATE.md   Capability Brief 起点
```

### 文档导航

**想了解什么 → 读哪个文件**：

| 想了解 | 读这个 |
|---|---|
| 底线是什么、什么不能做 | `meta/BASELINE.md` |
| Loop 怎么跑、验证怎么判定 | `meta/INTENT_LOOP.md` |
| 角色怎么激活 | `meta/ROLE_ACTIVATION.md` |
| 哲学怎么织造 | `meta/PHILOSOPHY_WEAVER.md` |
| Visionary 做什么 | `roles/visionary.md` |
| Architect 做什么 | `roles/architect.md` |
| Forge 做什么 | `roles/forge.md` |
| Keeper 做什么 | `roles/keeper.md` |
| 哲学文档长什么样 | `templates/PHILOSOPHY_TEMPLATE.md` |
| 愿景文档长什么样 | `templates/VISION_TEMPLATE.md` |
| Capability Graph 与 Brief 长什么样 | `cli/help/capability.md`、`templates/CAPABILITY_GRAPH_TEMPLATE.json` |
| Intent Map 长什么样 | `templates/INTENT_MAP_TEMPLATE.json` |
| 怎么搜索高质量参考 | `dimensions/SEARCH_METHODOLOGY.md` |

---

## 我们写的 vs Agent 生成的

**我们写的**（LOOM 的内核，薄而硬）：
- `meta/` — 元规范：怎么织造哲学、loop 怎么跑、角色怎么激活、底线是什么
- `roles/` — 角色原型：每个角色的身份、自主空间、职责
- `templates/` — 起点骨架：Agent 生成的起点，不是填空模板

**Agent 生成的**（每个项目跑出来的，厚而灵活）：
- 哲学文档体系（Weaver 决定要几个、多详细）
- 愿景文档（带意图叙事）
- 架构文档（根据哲学决定结构）
- Capability Graph 与按需生成的 Capability Brief
- Intent Map（意图依赖图，JSON）
- 验证契约和验证记录

**我们的规范是元规范**——规范"怎么生成规范"，不直接规范"规范长什么样"。

---

## 四个角色

| 角色 | 原型 | 职责 | 激活时机 |
|---|---|---|---|
| **Visionary** 远见者 | 产品联合创始人 | 定义愿景，织造意图叙事 | 项目启动 |
| **Architect** 建筑师 | 系统建筑师 | 展开 Capability Graph，设计系统，绘制 Intent Map | Visionary 完成后 |
| **Forge** 锻造师 | 高级工程师 | 在哲学约束下自主实现 | Intent Loop 实现阶段 |
| **Keeper** 守护者 | 独立验证者（独立激活） | 从磁盘事实验证意图与质量主张 | Intent Loop 验证阶段 |

Visionary 和 Keeper **同源但独立**——同一个产品哲学，但 Keeper 是"回溯验证者"，作为子代理运行，不继承 Forge 的实现上下文。

---

## Intent-Driven Loop

```
Host/Orchestrator 选 Intent → Forge 加载意图链并自主实现 → Keeper 子代理独立验证 → 判定
     ↑                                                                    │
     │                                                                    │
     └────────────── passed: 闭合，下一个 Intent ──────────────────────────┘
                      deviated: Keeper 与 Forge 对话修正 → 重新实现 → 重新验证
                      blocked: 停下，报告用户
```

Loop 的单元是意图，验证的核心问题是"实现是否忠实于原始意图"。

---

## 五条底线

所有角色、所有哲学、所有项目都必须遵守：

1. **B1：必须有结构设计** — 编码前必须有明确的结构设计
2. **B2：禁止硬编码** — 密钥、配置、环境值不进代码
3. **B3：接口契约必须显式** — 对外可观察的接口必须有显式定义
4. **B4：决策必须可追溯** — 影响架构/接口/技术栈的决策必须记录
5. **B5：意图必须可回溯** — 任何实现都必须能回溯到原始意图

底线不可被哲学覆盖。哲学内化底线，不是绕过底线。

---

## 项目级文档结构

Agent 在项目中生成的文档结构：

```
.loom/
└── v{N}/                         版本目录（跟随项目演进）
    ├── 00_PHILOSOPHY/             Weaver 产出
    │   ├── PRODUCT_PHILOSOPHY.md
    │   ├── ENGINEERING_CREED.md
    │   ├── DECISION_RUBRIC.md
    │   └── ...（按需，Weaver 决定）
    ├── 01_VISION.md               Visionary 产出（带意图叙事）
    ├── 02_ARCHITECTURE.md         Architect 产出
    ├── 03_DECISIONS/              架构决策记录
    ├── 04_INTENT_MAP.json         意图依赖图（DAG）
    ├── 05_VERIFICATION.md         每个 Intent 的验证契约
    ├── 06_CHANGELOG.json          Patch 变更记录（唯一权威来源）
    ├── 06_CHANGELOG.md            确定性生成的只读投影
    ├── 07_CAPABILITY_GRAPH.json   问题面、能力缺口、风险、证据与 Intent 回链
    ├── 07_CAPABILITY_BRIEFS/      按需生成的项目化能力 Brief
    └── verifications/             Keeper 的验证记录
        ├── INT-001.json
        ├── INT-001.md
        └── ...
```

---

## 格式原则

| 内容 | 格式 | 理由 |
|---|---|---|
| 哲学、愿景、架构、决策 | **MD** | 叙事性，人类可读，Git diff 友好 |
| Intent Map、验证判定 | **JSON** | 结构化，机器可读，CLI 可查询 |
| 混合内容 | **JSON + MD + ref 互引** | JSON 存结构，MD 存叙事 |

Agent 通过 **CLI 访问** JSON，不直接读文件——省 token、更高效、还能做校验。

---

## 运行流程

```
1. Weaver 织造 Project Doctrine
   → 读取项目事实 → 提炼长期判断 → 按决策未知搜索 → 转译为原则、边界与 Evidence Map

2. Visionary 定义愿景
   → 基于哲学写愿景 → 每个意图带意图叙事 → 识别需要的哲学维度

3. Architect 先展开 Capability Graph，再设计系统
   → 基于愿景检查问题面、能力缺口、风险与证据 → 路由高影响节点 → 绘制 Intent Map → 定义验证契约

4. LOOM Quality Engine
   → Forge 编译 Expertise Pack → Quality Arena 实现/比较 → Keeper 形成 Quality Proof
   → 循环直到所有 Intent 闭合
```

---

## 当前状态

- [x] `meta/` 元规范（4 个文件）
- [x] `roles/` 角色原型（4 个角色）
- [x] `templates/` 起点骨架（5 个模板）
- [x] `README.md` 系统总览
- [x] `dimensions/SEARCH_METHODOLOGY.md` 检索方法论
- [x] `cli/` CLI 访问层（Capability Graph / Brief / Coverage，130 个测试全过）
- [ ] `dimensions/` 维度文件（按需填充，Weaver 可自主判断）

---

> **LOOM 的信条**：编排而非控制。给 Agent 价值观和边界，让它在边界内自主发挥。底线守住不会崩，哲学填充边界内的内容，loop 确保实现忠实于意图。
