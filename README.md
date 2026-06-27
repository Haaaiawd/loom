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
