# LOOM

> **Loop + Orchestration + Ontology + Mind**
>
> 哲学是经线，意图是纬线，loop 的往复就是织机运作，织出软件。

---

## LOOM 是什么

LOOM 是一个**规范驱动开发框架**，核心理念：

**不写死规范模板，让 Agent 根据项目特征从真实存在的思想体系中织造定制化哲学，作为所有开发角色的共同锚点。**

LOOM 的核心机制：
1. **Philosophy Weaver** 根据项目特征织造定制化哲学
2. **Intent-Driven Loop** 以意图为 loop 单元，验证实现是否忠实于原始意图
3. **独立 Keeper** 作为子代理验证意图忠实度
4. **底线内化** 把不可妥协的约束写进哲学，角色激活时强制加载

---

## 核心概念

| 概念 | 一句话解释 |
|---|---|
| **哲学** | 项目的价值观和工程原则——为什么存在、什么不做、冲突时谁优先。由 Weaver 从真实思想体系织造，不是模板填空 |
| **Intent** | 一个意图单元——不是"做什么"（任务），是"为什么做"（意图）。每个 Intent 有验收契约，Keeper 据此判定实现是否忠实 |
| **Intent Map** | 所有 Intent 的依赖图（JSON）。Architect 绘制，定义拓扑序和依赖关系 |
| **Intent Loop** | 核心循环：Keeper 选 Intent → Forge 实现 → Keeper 验证 → 闭合或修正。每个 Intent 独立走一圈 |
| **Keeper** | 独立验证子代理——不继承 Forge 的实现上下文，从磁盘重新加载意图和契约，判定 passed/deviated/blocked/pending_human |
| **底线** | 不可妥协的约束（BASELINE.md 5 条 + 项目特定底线）。角色激活时强制加载，哲学不能覆盖 |

### Intent Loop 怎么跑

```
Keeper 选 Intent（拓扑序第一个 pending 且依赖都 completed 的）
  ↓
Keeper 更新 status → in_progress
  ↓
Forge 实现（加载意图叙事 + 哲学 + 验收契约）
  ↓
Keeper 验证（四维度：意图忠实度 / 哲学一致性 / 底线合规 / 验收达成）
  ↓
判定结果：
  passed        → status → completed，回到选 Intent
  deviated      → 与 Forge 对话修正，重新实现重新验证（连续 3 轮升级 blocked）
  blocked       → status → blocked，停下报告用户
  pending_human → 等用户补充判定（L3 人类反馈，如游戏手感）
```

**Loop 终止**：所有 Intent 的 status 为 completed → 项目阶段完成。

---

## 快速开始

### 步骤 1：初始化项目

```bash
loom init
```

**输入**：无（在项目根目录执行）
**产出**：`.loom/v1/` 目录结构 + 模板文件（01_VISION.md、04_INTENT_MAP.json、00_PHILOSOPHY/PRODUCT_PHILOSOPHY.md）
**下一步**：激活 Weaver 织造哲学

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
**Architect 会做什么**：设计系统结构 → 绘制 Intent Map（依赖图 + 验收契约 + 哲学锚点）
**产出**：`.loom/v1/02_ARCHITECTURE.md` + `.loom/v1/04_INTENT_MAP.json`
**怎么判断合格**：验收契约具体到可验证（不是"实现正确即可"），依赖关系无环，每个 Intent 有意图叙事引用
**下一步**：进入 Intent Loop

### 步骤 5：进入 Intent Loop

```bash
# Keeper 选 Intent 并更新状态
loom activate keeper
loom intent next              # 查看下一个可执行 Intent
loom intent update INT-001 --status in_progress

# Forge 实现
loom activate forge           # Forge 加载意图叙事 + 哲学 + 验收契约，实现代码

# Keeper 验证
loom activate keeper          # Keeper 独立验证四维度
loom verify contract INT-001  # 查看验收契约
loom verify write --json-file verification.json  # 写入验证记录

# 根据判定结果
loom intent update INT-001 --status completed    # passed
loom intent update INT-001 --status blocked      # blocked

# 查看进度
loom intent status
```

**Loop 结束**：`loom intent status` 显示所有 Intent 为 completed。

**CLI 命令一览**：

| 命令 | 用途 |
|---|---|
| `loom init` | 初始化项目 |
| `loom activate <role>` | 输出角色激活提示词 |
| `loom intent next` | 下一个可执行 Intent |
| `loom intent status` | 进度概览 |
| `loom intent get <id>` | Intent 详情 |
| `loom intent narrative <id>` | Intent 意图叙事 |
| `loom intent update <id> --status <s>` | 更新状态（Keeper 用） |
| `loom philosophy get <anchor>` | 加载哲学章节 |
| `loom verify contract <id>` | 获取验收契约 |
| `loom verify write --json-file <path>` | 写入验证记录 |

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
│   ├── architect.md             建筑师——设计系统，绘制 Intent Map
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
    └── INTENT_MAP_TEMPLATE.json Intent Map 起点
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
- Intent Map（意图依赖图，JSON）
- 验证契约和验证记录

**我们的规范是元规范**——规范"怎么生成规范"，不直接规范"规范长什么样"。

---

## 四个角色

| 角色 | 原型 | 职责 | 激活时机 |
|---|---|---|---|
| **Visionary** 远见者 | 产品联合创始人 | 定义愿景，织造意图叙事 | 项目启动 |
| **Architect** 建筑师 | 系统建筑师 | 设计系统，绘制 Intent Map | Visionary 完成后 |
| **Forge** 锻造师 | 高级工程师 | 在哲学约束下自主实现 | Intent Loop 实现阶段 |
| **Keeper** 守护者 | 产品联合创始人（独立激活） | 选 Intent，验证意图忠实度 | Intent Loop 选择和验证阶段 |

Visionary 和 Keeper **同源但独立**——同一个产品哲学，但 Keeper 是"回溯验证者"，作为子代理运行，不继承 Forge 的实现上下文。

---

## Intent-Driven Loop

```
Keeper 选 Intent → Forge 加载意图链并自主实现 → Keeper 子代理独立验证 → 判定
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
    ├── 06_CHANGELOG.md            版本变更记录
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
1. Philosophy Weaver 织造哲学
   → 识别项目特征 → 激活哲学维度 → 逐维度搜索/萃取/转译/落地 → 整合冲突 → 版本锚定

2. Visionary 定义愿景
   → 基于哲学写愿景 → 每个意图带意图叙事 → 识别需要的哲学维度

3. Architect 设计系统
   → 基于愿景设计结构 → 绘制 Intent Map → 定义验证契约

4. Intent Loop
   → Keeper 选 Intent → Forge 实现 → Keeper 验证 → 判定 → 下一个
   → 循环直到所有 Intent 闭合
```

---

## 当前状态

- [x] `meta/` 元规范（4 个文件）
- [x] `roles/` 角色原型（4 个角色）
- [x] `templates/` 起点骨架（3 个模板）
- [x] `README.md` 系统总览
- [x] `dimensions/SEARCH_METHODOLOGY.md` 检索方法论
- [x] `cli/` CLI 访问层（18 个测试全过）
- [ ] `dimensions/` 维度文件（按需填充，Weaver 可自主判断）

---

> **LOOM 的信条**：编排而非控制。给 Agent 价值观和边界，让它在边界内自主发挥。底线守住不会崩，哲学填充边界内的内容，loop 确保实现忠实于意图。
