# LOOM Authorship System — Identity Compiler 与 Atelier Path

> 状态：Proposed
> 设计对象：LOOM 的作者性、创作身份编译、创意分歧保护、艺术指导与主观质量证明
> 依赖基线：`design.md` 的 Quality Engine 与 `CAPABILITY_GRAPH_DESIGN.md` 的能力获取链
> 本文件是进入实现前的系统设计稿，不作为运行时提示词全文注入。

---

## 0. 设计结论

LOOM 已经能够让 Agent 获得项目判断、任务级专业能力、候选比较和独立验证，但它仍然更像
一个可靠的专业执行系统，而不是一个具有作者性的创作系统。

当前缺失的不是更多风格词、更多专家角色或一句更强的 Persona，而是一个能够回答以下问题的
正式机制：

> 这次作品要提出什么创作命题，Agent 将用什么眼光观察问题、拒绝什么默认解、选择什么
> 表达机制，并愿意为这种选择承担什么代价？

本设计将这项能力称为 **Authorship**。它不是模型扮演出来的人格，而是一组可执行、可观察、
可反驳、可积累的创作判断。

融合后的核心链路保持不变：

```text
Doctrine → Intent → Contract
→ Expertise Compiler
   ↳ Authorial Stance（按需）
→ Quality Arena
   ↳ Atelier Path（按需）
→ Quality Proof
   ↳ Authorship Evidence（按需）
→ Reflow and Learning
```

核心决策：

1. 保留 Weaver、Visionary、Architect、Forge、Keeper 五个角色，不增加“艺术家”“缪斯”
   或“创意总监”常驻角色。
2. **Identity Compiler 不是第二个编译器**；它是 Expertise Compiler 在作者性任务中的子阶段。
3. 在 Domain、Taste、Critic、Verifier 之外增加第五种认知职能 **Author**，但不创建固定 Agent。
4. **Atelier 不是第二套 Arena**；它是 Quality Arena 面向高主观、高辨识度任务的深路径。
5. **Authorship Proof 不是新的完成状态或验证维度**；它进入现有
   `quality_achievement` 与 Quality Proof。
6. `acceptance`、`quality_contract`、`creative_scope` 继续分别承担可靠性地板、品质天花板
   和创作权限；不新增平行“创意契约”。
7. 新增一个可选的 `quality_strategy` 字段，只用于显式声明
   `adaptive | atelier`；现有 Direct / Arena 深度继续由 Forge 按任务判断，不把已有运行策略
   重复编码进 Intent。
8. 只有进入 Atelier Path 的 Intent 才创建一个版本化 **Atelier Record**；普通任务不增加文件。
9. Creative Lineage 只有在同一创作判断会跨多个 Intent 反复改变决定时，才作为可选
   Project Doctrine 存在。
10. Asset Library 继续负责素材字节、来源、许可、批准和哈希；Atelier Record 负责艺术指导和
    资产之间的创作关系，不创建第二套素材库。
11. 先通过真实任务对照实验验证 Author 与 Atelier 的增益，再把行为全面写入 CLI 强门。

---

## 1. 问题定义

### 1.1 当前系统已经解决了什么

LOOM 1.1 已经具备以下关键能力：

- Project Doctrine 保存跨 Intent 的长期价值和取舍。
- Capability Graph 防止体验、资产、风险和能力缺口因为“没有被想到”而消失。
- Expertise Compiler 要求 Forge 真实加载 Skill、工具、参考、证据和资产。
- `acceptance` 与 `quality_contract` 分离可靠完成和品质提升。
- Quality Arena 要求高目标任务保留基线并比较机制不同的候选。
- Keeper 在独立上下文中形成 Quality Proof。
- Asset Library 以本地字节、来源、许可、批准和哈希治理素材。
- Reflow and Learning 已经定义一次性发现如何晋升为 Skill、Doctrine 或长期判断。

这些结构不是要被推翻的旧系统，而是 Authorship System 的承重墙。

### 1.2 当前系统为什么仍会趋于平庸

#### 断点 A：Taste 能识别好坏，却不拥有创作欲望

现有四种认知职能回答：

| 职能 | 主要问题 |
|---|---|
| Domain | 领域机制和事实是否正确？ |
| Taste | 什么区分普通、可靠和出众？ |
| Critic | 哪些方案是同质化、脆弱或伪提升？ |
| Verifier | 怎样观察、比较和复现？ |

它们都在判断作品，却没有一个职能正式负责提出作品。

一个世界级设计方案通常不只是“比普通方案更好”，而是包含一条带方向和代价的创作命题：

- 这次优先让用户感到什么。
- 哪个矛盾值得被视觉化、交互化或物质化。
- 哪种表达机制应该成为作品的中心。
- 哪些行业惯例即使安全，也必须拒绝。
- 哪个风险值得承担，哪些结果绝不能牺牲。

没有这层判断，Forge 最自然的行为就是汇总通用最佳实践，再在它们的交集里寻找安全解。

#### 断点 B：能力入口进入上下文，不等于身份真的形成

当前 Context Pack 能注入：

- `capability_needs`
- `creative_scope`
- Capability Graph 节点
- Capability Brief
- Skill、工具和资产的可发现入口

但“阅读了优秀参考”“加载了设计 Skill”仍不能保证 Agent 形成了一个一致的观察立场。
外部信息可能只增加上下文长度，或者被压缩成“现代、简洁、高级”等无行动差异的形容词。

#### 断点 C：同一 Forge 容易自己发散、自己收敛、共享偏见

Quality Arena 已要求机制不同的候选，但目前：

- 候选不强制落盘。
- 候选可以由同一个上下文连续生成。
- 候选在产生时可能已经看到上一方案。
- Forge 同时承担生成、比较和选择。

这足以防止明显换皮，却不足以保护真正不兼容的创作路线。多个候选可能只是同一心智模型的
不同表面表达。

#### 断点 D：成功作品没有形成创作谱系

当前 Quality Proof 可以反哺 Expertise Compiler，但没有一个紧凑结构记录：

- 哪条创作命题最终成立。
- 用户为什么选择它。
- 哪些候选虽失败却暴露了新的可能。
- 哪些 signature move 可以继续生长。
- 哪些成功只是当前场景偶然，不应成为默认模板。

于是一个偶然惊艳的页面可能只留下 CSS 和截图；下一次 Agent 无法知道它的锋芒来自哪里，
更无法判断何时不应重复它。

#### 断点 E：Asset Library 治理素材，却不负责艺术指导

现有 Asset Library 正确地回答：

- 素材字节是否真实存在。
- 来源、作者和许可是否明确。
- 文件是否批准、可校验和可呈现。

但一组优秀美术资产还需要回答：

- 它们属于怎样的视觉世界。
- 轮廓、材质、光照、色彩、运动和叙事关系是否一致。
- 每个资产在产品体验中扮演什么角色。
- 哪些差异是有意的层级，哪些只是生成漂移。

这些是艺术指导问题，不应污染资产治理协议，也不能继续留给 Forge 临场猜测。

### 1.3 模型能力边界

Authorship System 不声称通过提示词让基础模型获得它完全不具备的认知能力。

它能够提升的是**系统级有效能力**：

```text
基础模型
+ 外部作品与知识
+ 专业 Skill 和工具
+ 独立搜索与多路径采样
+ 真实渲染、运行和视觉反馈
+ 人类选择
+ 可追溯的历史经验
= 超过单次零样本生成的复合能力
```

因此，“身份编译”必须改变 Agent 的输入、注意力、动作、候选结构和反馈，而不能只改变
自我介绍。

以下内容不构成身份编译：

- “你是世界顶尖 UI 设计师。”
- “风格要高级、未来、灵动。”
- 罗列一串设计师、工作室或奖项名称。
- 搜索大量参考后只总结共同风格。
- 让同一模型生成三次并称为三位专家。

---

## 2. 融合与减重审计

### 2.1 冗余判断

| 新概念 | 与现有机制的重叠 | 融合决策 | 避免的冗余 |
|---|---|---|---|
| Creative Lineage | Project Doctrine | 作为按需领域 Doctrine，不新建常驻顶层阶段 | 第二套项目哲学 |
| Identity Compiler | Expertise Compiler | 作为作者性任务的子阶段 | 第二个能力编译器 |
| Author | Domain / Taste / Critic / Verifier | 增加第五种认知职能，不增加角色 | 第六角色和角色切换 |
| Atelier | Quality Arena | 作为 Quality Arena 的创作深路径 | 第二套候选竞技系统 |
| Curator | Forge 的比较、Keeper 的验证 | 作为隔离的临时评价职能，不拥有完成判定权 | 第六或第七常驻 Agent |
| Authorship Proof | `quality_achievement` / Quality Proof | 扩展质量证明内容 | 新验证维度和新状态机 |
| Taste Memory | Reflow and Learning | 使用 Decision Capsule 和现有晋升门 | 自动学习子系统 |
| Art Direction | Asset Library + Capability Brief | Atelier 记录方向，Asset Library 记录资产事实 | 第二套素材清单 |
| Quality-Diversity Map | Arena candidates | 作为候选组织和选择策略 | 新 Capability Graph |
| 外部创作研究 | SEARCH_METHODOLOGY | 复用决策相关研究回路 | 第二套搜索规范 |

### 2.2 不新增 Creative Contract

现有三个字段已经足够：

- `acceptance`：任何候选都不能跌破的 Reliability Floor。
- `quality_contract`：结果要达到的 Distinctive Ceiling。
- `creative_scope`：Forge 可以大胆改变什么、必须保持什么。

Authorship System 不再创建 `creative_contract`、`aesthetic_contract` 或
`art_direction_contract`。作者命题属于实现与探索判断，不应成为与产品契约并列的第二需求源。

### 2.3 不新增 Authorship 验证维度

现有 `quality_achievement` 已经负责判断品质契约是否成立。增加
`authorship_achievement` 会产生两个问题：

1. “品质”和“作者性”在创意任务中难以机械分离，容易双写。
2. 普通工程任务会被迫理解一个与自己无关的验证维度。

因此 Authorship Evidence 只在 `quality_strategy=atelier` 时成为 Quality Proof 的必需章节，
最终仍由 `quality_achievement` 给出结论。

### 2.4 不建立全局 Persona 或用户品味画像

用户的一次选择只说明：

- 在这个项目。
- 面对这组候选。
- 在当时目标和约束下。
- 某个机制更合适。

它不自动说明用户永远喜欢某种色彩、布局、动效或创作流派。长期记忆必须保留适用范围、
反例和重新评估条件。

### 2.5 新增复杂度预算

首个可运行版本只新增：

1. 一个认知职能：`Author`。
2. 一个可选 Intent 字段：`quality_strategy`。
3. 一个可选真相源：`09_ATELIER/<intent-id>.json`。
4. 一组 Atelier CLI 的读取、写入与校验入口。
5. 对现有 Quality Proof 的条件化内容校验。

不新增：

- 角色。
- Intent 状态。
- 验证 verdict。
- 第二种完成命令。
- 第二套资产库。
- 自动评分模型。
- 自动偏好训练。
- 强制多 Agent。

---

## 3. 设计原则

### A1：作者性是可观察行为，不是人格描述

一个 Authorial Stance 必须改变至少一项：

- 看什么。
- 不看什么。
- 生成哪些机制不同的候选。
- 淘汰什么。
- 使用哪些工具或素材。
- 怎样比较。
- 怎样在目标宿主中验证。

如果删除身份文字后，Agent 的候选、动作和验证没有变化，该身份就是装饰。

### A2：项目契合先于新奇

新奇不是独立目标。一个方向只有同时满足以下条件才有交付资格：

1. 忠于 Intent。
2. 站稳 Reliability Floor。
3. 服务项目 Doctrine 和目标用户。
4. 产生可说明的机制差异。
5. 新奇带来的价值大于理解成本和系统代价。

### A3：先保护分歧，再允许共识

创作分支在早期不得互相阅读完整方案。只有形成可观察原型后才进入比较。

原因不是追求 Agent 数量，而是防止：

- 第一个候选成为所有后续候选的锚。
- 强势措辞让其他路线过早让步。
- 相同上下文把不同立场压回共同平均值。

### A4：作品先于解释

视觉、动效、音频、插画、游戏手感和空间设计必须尽早产出对应媒介的可观察原型。

- UI：截图、真实页面或交互原型。
- 动效：视频、录屏或可运行时间线。
- 美术资产：contact sheet、关键资产和目标宿主合成图。
- 声音：可播放片段和场景化混音。
- 文案：匿名完整样稿，而不是风格说明。

一页漂亮的创意阐述不能替代作品。

### A5：多样性与品质使用 Pareto 选择，不压成单一总分

Atelier 先用硬门淘汰失格候选，再保留在不同创作机制上成立的方案。它不把
“新奇、清晰、品牌、可用性、成本”简单加权成一个看似科学的总分。

最终选择需要说明：

- 哪些维度不可妥协。
- 哪些维度存在真实取舍。
- 为什么当前候选处于更值得交付的 Pareto 位置。

### A6：艺术指导管理关系，而不是只管理单件资产

单件图像可以漂亮，一组资产仍可能像来自五个平行宇宙。Atelier 的艺术指导必须描述资产之间的
共同规则和有意差异，Asset Library 则继续保证每个实际文件可信。

### A7：惊喜必须有预算

Authorial Stance 明确 `surprise_budget`：

- `low`：用户几乎不需要学习，记忆点来自细节和节奏。
- `medium`：允许一个主要陌生机制，但核心任务路径保持熟悉。
- `high`：允许重构表达范式，只用于可逆原型、品牌表达或用户明确授权的探索。

预算不是审美评分，只决定陌生性和失败成本能扩展到哪里。

### A8：人类选择是创作证据，不是流程失败

机器可以检查一致性、可访问性、响应式、素材完整性和部分偏差；但当两个方向代表不同价值观，
且差异不能由契约消除时，交给用户或专业评审选择是正确闭环。

### A9：学习要保留反例和遗忘能力

任何进入 Creative Lineage 的判断都必须记录：

- 它在哪些场景成立。
- 哪些证据支持。
- 哪些反例已知。
- 什么变化会让它失效。

没有这些信息的“品味记忆”最终只会变成新的模板库。

---

## 4. 总体系统模型

### 4.1 三条路径

Quality Arena 保留三种实际深度：

```text
Direct Path
  明确问题 → 实现 → 观察 → 自测 → Keeper

Arena Path
  Baseline → 机制不同候选 → 比较 → 实现 → 证明

Atelier Path
  Creative Lineage / References
  → Identity Compile
  → Authorial Stance
  → 独立创作分支
  → 真实媒介原型
  → Quality-Diversity Map
  → 匿名选择
  → 实现
  → Authorship Evidence
```

Atelier Path 是 Arena Path 的专门化，不改变顶层状态机。

### 4.2 `quality_strategy`

Intent 新增可选字段：

```json
{
  "quality_strategy": "adaptive"
}
```

合法值：

| 值 | 含义 |
|---|---|
| `adaptive` | 默认值。Forge 根据契约、风险和任务事实使用现有 Direct 或 Arena；可以使用局部作者性方法，但不启用正式 Atelier 闭合门 |
| `atelier` | 明确需要作者命题、媒介原型、独立分支和 Authorship Evidence |

兼容规则：

- 缺失字段等价于 `adaptive`。
- 没有 `quality_contract` 的 Intent 不得设置 `atelier`。
- 设置 `atelier` 时必须同时存在具体 `creative_scope`。
- Architect 在目标明确要求作者性时设置 `atelier`；Forge 若在 `adaptive` 中发现正式 Atelier
  才能满足质量契约，回流 Architect，不静默升级字段。
- `adaptive` 仍可使用 Author、anti-fixation 或小型候选探索，但不会因此产生 Atelier Record
  和额外闭合门。

### 4.3 Atelier 触发条件

以下任一情况成立时优先考虑 Atelier：

- 用户明确要求惊艳、独特、领先、强风格或全新创作方向。
- 结果是高影响公共界面、品牌表达、核心交互或一组美术资产。
- 当前结果可靠但同质化，已有证据表明“普通”是主要失败。
- 多种不兼容的创作机制都有合理可能。
- 任务要建立可跨多个后续产物复用的视觉或体验世界。
- Quality Contract 包含辨识度、情绪、叙事、艺术指导、signature moment 或原创命题。

以下情况不进入 Atelier：

- 普通 bug、依赖升级、机械迁移或明确的局部修复。
- 质量差距能够通过现有设计系统和已知规则直接修正。
- 没有真实渲染、素材或目标宿主，任何审美判断只能停留在文字想象。
- 探索会带来不可恢复风险，且没有授权或隔离环境。
- 用户只要求保持现有风格的一致性扩展。

### 4.4 责任边界

| 内容 | 所有者 |
|---|---|
| 跨 Intent 的 Creative Lineage | Weaver |
| 产品要产生的用户结果 | Visionary |
| `quality_contract`、`creative_scope`、`quality_strategy` | Architect |
| Authorial Stance、候选、原型、选择建议 | Forge / Expertise Compiler / Atelier |
| 临时 Curator 意见 | 隔离评价能力，无状态所有权 |
| 实现与自测 | Forge |
| Quality Proof 与 Authorship Evidence 判定 | Keeper |
| 最终价值取舍 | 用户，或契约已明确授权的负责人 |
| 状态、revision、引用和结构合法性 | CLI |

---

## 5. Creative Lineage

### 5.1 定义

Creative Lineage 是项目可选的长期创作判断系统。它描述项目怎样形成辨识度，而不是冻结一套
视觉皮肤。

建议位置：

```text
.loom/vN/00_PHILOSOPHY/CREATIVE_LINEAGE.md
```

它属于 Weaver 权限，仅在内容会改变多个未来 Intent 时创建。单个页面、一次插画和临时实验
不得为了显得重要而升级为 Creative Lineage。

### 5.2 最小结构

```markdown
# Creative Lineage

## Creative Tension
项目长期希望保持的张力，而不是单向风格形容词。

## Perceptual Commitments
项目反复选择看见什么、强调什么、保护什么。

## Refusals
哪些安全但平庸的默认表达会破坏项目。

## Mechanism Lineage
已经被证据支持的构图、叙事、交互、材质、运动或声音机制。

## Anti-Fixation
近期容易重复的成功套路，以及主动打破它们的条件。

## Evidence Map
项目事实 / 作品 / 用户反馈 → 提取机制 → 决策后果 → 适用边界。
```

### 5.3 内容要求

有效内容示例：

- “产品用精确数据建立可信度，但每个关键转折允许出现一次有生命感的视觉破口。”
- “动效只表现状态关系和时间变化，不作为持续背景装饰。”
- “人物资产保持轮廓可识别和材质一致；情绪差异主要通过姿态与局部形变表达。”

无效内容示例：

- “高级、简洁、未来、科技感。”
- “像 Apple、Linear、Pentagram。”
- “默认使用渐变、玻璃拟态和大标题。”
- “用户上次喜欢紫色，因此项目长期使用紫色。”

### 5.4 晋升与修订

一个判断进入 Creative Lineage 前，必须满足现有 Learning Promotion Gate：

1. 不只是一次偶然。
2. 会改变多个未来决定。
3. 有项目事实、Quality Proof 或用户反馈支持。
4. 能说明适用边界和反例。

Creative Lineage 变化按 Doctrine 影响规则处理；重大创作北极星变化可能触发 Major version。

---

## 6. Identity Compiler 与 Authorial Stance

### 6.1 Identity Compiler 的位置

Identity Compiler 是 Expertise Compiler 的条件化子阶段：

```text
Intent + Contract + Creative Scope
+ Relevant Doctrine / Creative Lineage
+ Current Product and Baseline
+ Capability Briefs
+ Available Skills / Tools / Models
+ Curated External References
+ Prior Quality Proofs
→ Identity Compiler
→ Authorial Stance
```

它不生成永久人格，也不改变 Agent 权限。它为当前 Intent 编译一个临时、可验证的创作立场。

### 6.2 第五认知职能：Author

| 职能 | 关键问题 |
|---|---|
| Domain | 在这个媒介和领域中，什么机制真实成立？ |
| Taste | 哪些作品建立了值得比较的质量标杆？ |
| **Author** | 这次要提出什么创作命题，选择什么并拒绝什么？ |
| Critic | 这条命题最可能怎样滑向自嗨、模仿或平庸？ |
| Verifier | 用户最终会在哪里感知它，怎样复现和比较？ |

Author 可以由：

- 当前强模型在独立上下文中承担。
- 一个匹配任务的 Skill 提供方法。
- 外部专业人员提供立场和反馈。
- 另一个模型或 Agent 提出候选命题。
- 用户直接给出不可替代的创作判断。

“Author”描述认知职责，不保证来源天然优秀。所有输入仍需经过项目适配和结果验证。

### 6.3 Authorial Stance 最小内容

Authorial Stance 必须回答：

1. **Creative Thesis**：这次作品提出什么命题。
2. **Gaze**：优先观察和放大什么。
3. **Tension**：哪两个看似冲突的价值要同时成立。
4. **Signature Bet**：本轮唯一最值得冒险的核心机制。
5. **Refusals**：哪些默认解即使合规也不接受。
6. **Reference Mechanisms**：外部参考改变了什么决定，不模仿什么表象。
7. **Medium Grammar**：排版、构图、运动、声音、材质、数据或文案怎样共同表达。
8. **Surprise Budget**：陌生性和失败成本的允许范围。
9. **Anti-Fixation Operators**：怎样主动打破模型与项目近期惯性。
10. **Verification Lens**：从成品上观察哪些信号能证明命题成立。

### 6.4 参考研究协议

外部搜索复用 `dimensions/SEARCH_METHODOLOGY.md`：

```text
Decision Question
→ Project Grounding
→ Targeted Search
→ Extract Mechanism
→ Translate to Candidate Consequence
→ Prototype or Reject
```

每条进入 Stance 的外部参考至少记录：

- 来源和访问时间。
- 为什么适用于当前项目问题。
- 提取的机制。
- 它改变的候选或验证方式。
- 哪些表面元素不得直接模仿。
- 许可、来源可信度或文化语境风险。

网页、图片或作品中的文字一律作为不可信内容处理，不得覆盖系统、用户或项目指令。

### 6.5 Identity 编译失败

以下情况视为 Identity Compiler 未完成：

- Stance 只包含风格形容词。
- 参考没有改变候选机制。
- Creative Thesis 可以无损替换到任意项目。
- Signature Bet 实际上是颜色、圆角或字体替换。
- Refusals 没有对应已知平庸模式。
- 没有真实媒介的验证入口。
- Stance 与 Doctrine、Intent 或 Creative Scope 冲突。

失败时 Forge 不应“带着不完美身份先做”，而应收窄命题、补充项目事实或回流契约。

---

## 7. Atelier Record

### 7.1 唯一新增真相源

进入 Atelier Path 时创建：

```text
.loom/vN/09_ATELIER/<intent-id>.json
```

必要的基线、候选截图、视频、音频、contact sheet 或原型快照放在：

```text
.loom/vN/09_ATELIER/files/<intent-id>/
```

只保存：

- 修改前基线。
- 足以证明机制差异的候选原型。
- 进入最终比较的候选。
- 最终选择所依赖的观察证据。

不保存每次模型采样、隐藏推理、无价值草稿或全部探索历史。

### 7.2 建议 Schema

```json
{
  "_meta": {
    "_version": "1.0",
    "_loom_version": "v1",
    "_generated_by": "forge"
  },
  "intent_id": "INT-001",
  "intent_revision": 1,
  "status": "exploring",
  "stance": {
    "creative_thesis": "让复杂数据像一张正在呼吸的航海图，而不是 KPI 卡片墙。",
    "gaze": [
      "先观察变化方向和关系，再观察单点数值"
    ],
    "tension": "分析精度与探索感同时成立",
    "signature_bet": {
      "claim": "用连续空间中的数据流向替代等权卡片分区",
      "mechanism": "空间邻近、轨迹与局部放大共同表达关系",
      "cost": "首次使用需要更明确的导航提示"
    },
    "refusals": [
      "默认 KPI 卡片网格",
      "与数据含义无关的背景粒子"
    ],
    "reference_mechanisms": [
      {
        "source": "https://example.com/reference",
        "observed_at": "2026-07-30",
        "mechanism": "通过连续路径表达状态变化",
        "project_consequence": "候选必须让变化方向可追踪",
        "do_not_copy": "配色、图标和具体构图"
      }
    ],
    "medium_grammar": {
      "composition": "连续空间，局部聚焦",
      "motion": "只表现状态变化和因果关系",
      "assets": "真实数据与少量方向性标记"
    },
    "surprise_budget": {
      "level": "medium",
      "allowed": "重构信息布局和导航节奏",
      "protected": "指标定义、业务流程、可访问性和窄屏可用性"
    },
    "anti_fixation": [
      "至少一条候选禁止使用卡片容器"
    ],
    "verification_lens": [
      "用户能否先说出变化方向",
      "用户能否定位异常来源",
      "陌生布局是否增加关键任务时间"
    ]
  },
  "baseline": {
    "artifact_refs": [
      "09_ATELIER/files/INT-001/baseline-desktop.png"
    ],
    "observed_limit": "信息可靠但所有指标等权，用户无法快速看见变化关系"
  },
  "diversity_axes": [
    {
      "id": "structure",
      "low": "离散模块",
      "high": "连续空间",
      "why": "决定用户如何理解指标关系"
    },
    {
      "id": "guidance",
      "low": "系统主动讲述",
      "high": "用户自由探索",
      "why": "决定首次理解与长期发现之间的取舍"
    }
  ],
  "candidates": [
    {
      "id": "CAND-A",
      "thesis_delta": "叙事主导的连续数据旅程",
      "mechanism": "时间轨迹与分段聚焦",
      "artifact_refs": [
        "09_ATELIER/files/INT-001/candidate-a.png"
      ],
      "axis_positions": {
        "structure": "high",
        "guidance": "low"
      },
      "floor_check": "passed",
      "floor_evidence": "键盘路径、窄屏任务和指标定义回归检查通过，见 candidate-a-checks.md",
      "observations": [
        "变化方向清楚，但自由比较效率下降"
      ],
      "major_cost": "高级用户需要额外的快速跳转"
    }
  ],
  "selection": {
    "status": "selected",
    "selected_candidate": "CAND-A",
    "method": "匿名顺序交换比较 + 目标用户任务观察",
    "evidence_refs": [
      "09_ATELIER/files/INT-001/candidate-comparison.md"
    ],
    "why": "在保持任务完成率的同时，显著提高变化关系的复述准确率",
    "remaining_tradeoff": "高级用户的横向比较速度略有下降"
  }
}
```

### 7.3 状态

Atelier Record 状态只描述创作记录，不参与 Intent 完成状态机：

```text
draft → exploring → compared → selected
                     ↘ baseline_retained
                     ↘ blocked
```

含义：

- `draft`：Stance 尚未完整。
- `exploring`：正在形成机制不同候选。
- `compared`：候选已有真实原型和比较证据，但尚未选择。
- `selected`：有明确胜出候选，可进入完整实现。
- `baseline_retained`：没有候选胜过基线，合法停止或重开命题。
- `blocked`：缺少媒介工具、素材、目标宿主、权限或关键人类选择。

Atelier 状态不能使 Intent 自动 completed，也不能替代 Keeper。

### 7.4 Revision 与新鲜度

- `intent_revision` 必须等于当前 Intent revision。
- Intent 语义、质量契约、创作空间或关键 Doctrine anchor 变化时，旧 Atelier Record 失效。
- 纯实现修正不必重做 Stance，但必须重新观察受影响候选和最终产物。
- 旧 Record 保留为历史证据，不覆盖写成当前事实。

---

## 8. Atelier Path

### 8.1 完整流程

```text
Orient
→ Compile Expertise
→ Compile Identity
→ Freeze Baseline
→ Define Diversity Axes
→ Branch Independently
→ Produce Medium-Native Prototypes
→ Floor Gate
→ Map Quality-Diversity Frontier
→ Curate Anonymously
→ Select or Retain Baseline
→ Realize
→ Observe and Adjust
→ Self-check
→ Keeper Quality Proof
```

### 8.2 Freeze Baseline

进入候选生成前必须保存修改前可观察状态：

- 真实页面与多端截图。
- 当前素材 contact sheet。
- 当前交互录屏或性能记录。
- 当前文案完整样稿。
- 目标用户或业务结果的已有信号。

Baseline 必须来自当前 revision 和真实目标宿主。设计稿、过期截图或远程链接不能替代当前状态。

### 8.3 Diversity Axes

Forge 根据当前项目生成少量具有决策价值的创作轴。它们描述**机制差异**，不是审美评分。

候选轴示例：

- 离散模块 ↔ 连续空间。
- 系统叙事 ↔ 用户探索。
- 工具透明 ↔ 世界观沉浸。
- 精确控制 ↔ 有机反馈。
- 直接信息 ↔ 隐喻表达。
- 静态秩序 ↔ 时间驱动。
- 单体图像 ↔ 资产家族。

规则：

- 不使用全项目固定轴。
- 轴必须改变候选结构或用户体验。
- 不使用“丑 ↔ 美”“普通 ↔ 高级”等结果评价作为差异轴。
- 轴数量服从判断需要，不为了绘图而增加维度。

### 8.4 独立分支

每条分支必须：

- 具有不同 Creative Thesis 或 Signature Bet。
- 在形成首个可观察原型前不读取其他候选的完整方案。
- 使用相同 Intent、Reliability Floor 和不可变边界。
- 记录机制、主要代价和最小验证。
- 允许使用不同 Skill、工具、模型或参考，但不为多样性引入明显较弱来源。

宿主支持多 Agent 时，可以使用独立 task/thread；不支持时，使用独立上下文重置、分阶段采样或
明确隔离的连续执行。LOOM 不把“提示自己忘记上一方案”声称为真正隔离。

### 8.5 Anti-Fixation Operators

Atelier 可以按需选择以下探索算子：

#### Anti-Model Pass

先预测当前模型最可能使用的默认结构，再让至少一个分支禁用这些结构。

示例：

- 禁止等权卡片网格。
- 禁止 Hero + 三卖点 + CTA 的标准落地页序列。
- 禁止无数据含义的渐变、粒子和玻璃层。
- 禁止仅通过色彩区分候选。

#### Foreign Medium Transfer

从不同媒介提取机制：

- 舞台调度 → 视线、出现顺序和注意力控制。
- 杂志编排 → 节奏、留白、层级和阅读路径。
- 电影剪辑 → 时间、转场和信息揭示。
- 玩具设计 → 可供性、反馈和情感投射。
- 工业仪表 → 状态、警示和高压环境下的清晰。
- 生物行为 → 生长、适应和非线性反馈。

迁移的是机制，不是表面主题。

#### Constraint Mutation

删除一个被视为理所当然的表达单元，观察问题是否因此被重新理解。

#### Ugly Prototype

允许一个候选暂时不追求完整视觉精修，只验证一个前所未有的交互、叙事或资产机制。
它不能绕过 Reliability Floor，也不能作为未完成视觉的永久借口。

#### Taste Counterfactual

生成一个有意反对当前 Creative Lineage、但仍忠于 Intent 和 Doctrine 的候选，用于检测项目是否
正在重复最近的成功公式。

### 8.6 Floor Gate

进入主观比较前淘汰：

- 破坏 acceptance 或 continuity。
- 使用未批准或来源不明资产。
- 不能在目标宿主真实运行或呈现。
- 窄屏、键盘、读屏、性能或安全出现不可接受退化。
- 创作命题只存在于说明，成品不可感知。
- 候选与其他候选只有皮肤差异。

### 8.7 Quality-Diversity Frontier

通过 Floor Gate 的候选不立即按总分排序。Atelier 先回答：

- 每条路线在哪个创作生态位中成立。
- 它相对基线改变了什么用户感知或行为。
- 它付出了什么代价。
- 哪些候选可以合并，哪些合并会破坏命题。
- 是否存在一条候选在重要维度上被另一候选完全支配。

只有明显被支配的候选被淘汰。剩余候选进入 Curator 或人类比较。

### 8.8 Curator

Curator 是一次性的隔离评价职能，不是新角色。

Curator 接收：

- 匿名候选产物。
- Intent、Doctrine anchors、Reliability Floor 和 Quality Contract。
- 必要的目标用户与场景事实。
- 比较协议。

Curator不接收：

- 候选作者身份。
- Forge 的辩护。
- 候选生成顺序。
- 预期胜出结论。
- 与判断无关的长篇研究过程。

Curator 可以：

- 分维度描述差异。
- 指出伪新奇和项目错配。
- 建议保留的 Pareto 候选。
- 标记必须由人类决定的价值分歧。

Curator不能：

- 修改 Intent 或契约。
- 编码。
- 写入 Keeper verdict。
- 用单次总分宣告审美事实。

### 8.9 选择协议

主观候选至少使用：

1. 匿名标签。
2. 随机顺序。
3. 顺序交换复评，或等价位置偏差检查。
4. 分维度观察，而不是只问“哪个好”。
5. 同时记录选择与原因。
6. 关键方向由目标用户、人类专家或项目所有者确认。

可以组合：

- Pointwise：候选是否独立达到质量门槛。
- Pairwise：两个合格候选之间更偏好哪个。
- Task observation：真实任务完成、理解、记忆或情绪信号。
- Expert critique：机制、工艺与媒介完成度。
- Project owner judgment：不可替代的品牌与价值选择。

没有任何候选真实胜过基线时，使用 `baseline_retained`，不把流程成本转化成发布压力。

### 8.10 Realize 与 Observe

胜出候选进入完整实现后：

- Forge 仍在当前 Intent 和架构边界内工作。
- 实现细节可以调整，但不能静默改变 Creative Thesis。
- 若真实运行推翻候选机制，回到 `exploring` 或 `compared`，不靠解释维持原选择。
- 最终产物必须重新生成多端、交互、性能和资产证据。
- 原型胜出不等于生产实现自动胜出。

---

## 9. 美术资产与其他媒介

### 9.1 Art Direction Record

美术资产任务使用同一 Atelier Record，在 `stance.medium_grammar` 中按需增加：

```json
{
  "shape_language": "轮廓与比例规则",
  "material_language": "表面、颗粒、透明度和触感",
  "color_roles": "颜色承担的叙事或状态职责",
  "light_and_camera": "光照、视角和空间一致性",
  "motion_affordance": "哪些结构需要支持形变或动画",
  "character_rules": "角色身份、姿态、表情和不可改变特征",
  "family_variation": "同系列资产如何变化而不漂移",
  "negative_constraints": "明确禁止的生成偏差"
}
```

Atelier 使用 contact sheet 比较资产家族；Asset Library 只接收最终批准文件，并继续记录来源、
许可、哈希和 evidence 回链。

### 9.2 UI 与交互

UI Atelier 至少观察：

- 信息层级能否在真实内容下成立。
- 创作命题是否进入交互和状态，而不只进入 Hero。
- 空、错、加载、权限和窄屏状态是否仍属于同一视觉世界。
- 动效是否表达关系、状态或时间。
- signature moment 是否可被用户感知且不妨碍任务。
- 真实资产是否在目标宿主呈现。

### 9.3 文案与品牌表达

文案候选使用完整匿名样稿，不只比较 tone words。Authorial Stance 应描述：

- 说话者看见什么。
- 怎样处理权威、亲密、幽默和不确定性。
- 哪种句法、节奏或意象承担核心命题。
- 哪些品牌套话必须拒绝。

### 9.4 工程、架构与算法

Authorship 不应扩张成所有复杂任务的默认仪式。

- 性能优化、架构设计和算法选择通常使用普通 Arena。
- 只有任务本身包含强表达、体验或创造性机制时才进入 Atelier。
- “优雅代码”不能作为脱离可维护性、性能和项目边界的作者性主张。

### 9.5 媒介适配器

不同媒介的专业方法进入 Capability Brief、Skill 或工具，不进入 Authorship 核心 Schema。

这保证核心只负责：

- 作者命题。
- 分歧保护。
- 候选证据。
- 选择与学习。

具体 UI、插画、3D、声音、游戏手感或电影方法按任务渐进加载。

---

## 10. Quality Proof 中的 Authorship Evidence

### 10.1 复用现有质量维度

`quality_strategy=atelier` 时，Keeper 仍写：

```json
{
  "quality_achievement": {
    "verdict": "passed | deviated | blocked | pending_human",
    "evidence": "对照了什么、观察到什么、如何复现",
    "quality_proof_ref": "verifications/INT-001-quality-proof.md#int-001"
  }
}
```

不增加新的 verdict 或完成命令。

### 10.2 Atelier Quality Proof 必需内容

Quality Proof 在原有要求上增加：

1. **Authorial Thesis**：最终作品提出的命题。
2. **Baseline**：修改前可观察状态。
3. **Candidate Diversity**：候选在哪些机制上真正不同。
4. **Anti-Fixation**：采取了什么措施避免模型和项目惯性。
5. **Selection Evidence**：匿名比较、任务观察、专家或人类判断。
6. **Embodied Result**：真实目标宿主中的最终作品。
7. **Perceptibility**：作者命题能否从作品中被感知，而不依赖说明。
8. **Coherence**：页面、状态、动效、文案和资产是否属于同一表达系统。
9. **Useful Surprise**：新奇是否服务用户结果。
10. **Reliability Retention**：完成契约、守恒和关键质量未退化。
11. **Tradeoff**：胜出方案仍付出的主要代价。
12. **Learning Candidate**：哪些发现可能值得未来晋升，为什么现在仍不自动晋升。

### 10.3 判定边界

`quality_achievement` 不得通过：

- 只有 Stance，没有真实产物。
- 只有不同候选，没有基线。
- 只有基线和最终结果，没有选择证据。
- 候选机制差异无法从产物中观察。
- 最终实现丢失原型胜出的关键机制。
- 作品新奇但破坏关键用户结果。
- LLM Judge 结论顺序敏感且未校准。
- 核心价值分歧仍需要人类选择。

机器项都通过但审美价值无法合法裁决时使用 `pending_human`。

### 10.4 Keeper 隔离

Keeper 可以读取：

- 当前 Intent、revision、契约和 Doctrine anchors。
- Atelier Record 的 Stance、基线、候选产物、选择方法和最终结果引用。
- 真实代码、运行结果、截图、视频、音频和指标。

Keeper 不读取：

- Forge 隐藏推理。
- 候选作者身份。
- Forge 对胜出方案的说服性辩护。
- 与验证无关的全部搜索记录。

Keeper 可以独立加载专业验证能力，但不能重写 Authorial Stance 来让最终结果看起来通过。

---

## 11. Taste Memory 与学习

### 11.1 Decision Capsule

Atelier 选择完成后，从 Quality Proof 提取一个短 Decision Capsule：

```text
Decision
当前选择了什么机制。

Why It Won
什么外部结果支持它。

Rejected Alternatives
其他路线为什么没有胜出。

Scope
这个判断适用于哪些场景。

Counterevidence
什么已知事实与它冲突。

Revisit When
什么变化会重新打开判断。
```

首版不单独建立 Memory 数据库。Decision Capsule 保留在 Quality Proof；Expertise Compiler
只按当前任务相关性读取。

### 11.2 晋升路径

```text
一次 Atelier 结果
→ 留在当前 Quality Proof

多个 Intent 重复成立的任务方法
→ Skill

多个 Intent 重复成立的项目取舍
→ Creative Lineage / Doctrine

改变系统边界或公共契约
→ ADR / Architect
```

### 11.3 不做自动偏好学习

首版不：

- 用单次选择更新全局用户画像。
- 自动给颜色、字体或布局加偏好权重。
- 训练审美 Reward Model。
- 根据历史胜率自动淘汰反对路线。
- 把最常胜的方案变成默认模板。

当项目积累足够多、来源一致、可归因的选择后，才评估结构化 preference learning；届时仍需
保留场景、置信度和时间衰减。

### 11.4 主动防止风格锁死

若连续多个 Intent 重复同一 signature move，Expertise Compiler 应触发：

- Taste Counterfactual。
- Creative Lineage 的 Anti-Fixation 检查。
- 对最近成功机制的替代路径搜索。

重复不是自动错误；只有它失去项目必要性、成为模型惯性时才构成风险。

---

## 12. CLI 与程序边界

### 12.1 CLI 应保证什么

CLI 负责：

- `quality_strategy` 合法性和兼容。
- Atelier Record Schema。
- Intent ID、revision 和当前版本一致。
- 引用文件存在、位于合法目录且不路径逃逸。
- 候选 ID、差异轴和选择引用一致。
- `selected_candidate` 指向已存在且通过 Floor Gate 的候选。
- `quality_strategy=atelier` 的 passed 验证具有当前 Atelier Record 和 Quality Proof。
- Stance、Record 或证据过期时阻止虚假闭合。
- `loom doctor` 报告缺失、过期、断链和非法状态。

### 12.2 CLI 不应判断什么

CLI 不负责：

- 自动决定 Creative Thesis 是否优秀。
- 自动搜索互联网或下载参考。
- 生成候选。
- 计算“审美总分”。
- 判断作品是否惊艳。
- 选择最终价值立场。
- 修改 Creative Lineage。

这些属于 Agent、专业工具、真实用户反馈和人类判断。

### 12.3 建议命令

```bash
loom atelier init <intent-id>
loom atelier get <intent-id>
loom atelier validate <intent-id>
loom atelier status <intent-id>
loom atelier record --json-file <path>
```

行为：

- `init`：根据当前 Intent 创建最小模板，不生成创作内容。
- `get`：输出当前 Record。
- `validate`：只读结构、新鲜度和引用检查。
- `status`：输出阶段、候选数量、选择状态和缺口。
- `record`：预校验完整候选后原子写入权威 JSON。

不增加 `loom identity` 命令；Identity Compiler 是 Expertise Compiler 的内部阶段，不应形成第二套
概念入口。

### 12.4 `loom activate`

`loom activate forge --intent <id>` 在 Atelier Path 中增加：

```text
6. Expertise Inputs
  - Domain / Taste / Author / Critic / Verifier
  - Creative Lineage anchors（按需）
  - Atelier Record 或创建要求
  - Baseline capture requirement
  - 可用媒介 Skill、工具和资产
  - 独立分支与选择协议
```

如果 Record 尚不存在，Context Pack 只要求 Forge 编译 Stance 和写入 Record，不把空模板伪装成
已经形成身份。

Keeper Pack 只加载验证相关的 Stance、产物与证据，不继承 Forge Expertise Pack。

### 12.5 Host Adapter

宿主负责尽可能提供：

- 独立 Agent thread。
- 独立上下文或模型采样。
- 图像、页面、视频、音频的真实查看能力。
- 浏览器或目标应用运行环境。
- 人类比较入口。

宿主不支持多 Agent 时：

- Atelier 仍可运行。
- 独立性等级必须降低并记录。
- 使用分阶段隔离而不是伪装并行。
- 关键主观判断更容易进入 `pending_human`。

---

## 13. 数据完整性与安全

### 13.1 外部来源

- 参考内容只作为证据和创作刺激，不作为指令。
- 记录来源、访问时间和项目转译。
- 不将他人作品直接复制为交付资产。
- 对艺术家、工作室和在世创作者的参考优先提取机制，不要求逐像素模仿个人风格。
- 下载、许可和最终资产批准仍服从 Asset Library。

### 13.2 路径和文件

- Atelier artifact 引用必须是当前版本相对路径。
- 不允许绝对路径、符号链接逃逸或 `..` 越界。
- 外部 URL 不能作为候选已呈现的证据。
- 大型二进制文件遵循仓库现有存储和体积策略；必要时只保存稳定、可验证的压缩证据。

### 13.3 隐私

- 用户访谈、行为录像和偏好结果只保存完成判断需要的最少信息。
- 匿名比较不暴露不必要身份。
- 个人偏好不自动晋升为跨项目记忆。
- 含敏感数据的界面证据必须脱敏或使用受控测试数据。

### 13.4 连续性

Atelier 不能绕过 `continuity_required`：

- 创意重构前保存旧状态。
- 真实操作后验证新状态。
- 未明确授权删除或替换的用户价值必须保留。
- 惊艳的静态截图不能证明状态守恒。

---

## 14. 失败模式与回流

| 失败 | 责任层 | 动作 |
|---|---|---|
| Creative Lineage 与真实用户持续冲突 | Weaver | 修订 Doctrine 或 Major version |
| 用户结果或非目标错误 | Visionary | 修订 narrative |
| `quality_strategy`、质量契约或创作空间不成立 | Architect | 修订 Contract / revision |
| 缺少作者性能力或媒介工具 | Forge / Capability Graph | 补能力或提交 proposal |
| Stance 只有风格词 | Forge | 重编 Identity |
| 候选只是换皮 | Forge | 重设差异轴和 Signature Bet |
| 候选都未胜过基线 | Forge / Architect | `baseline_retained` 或重开质量命题 |
| 真实实现丢失原型机制 | Forge | 回到 Realize / Observe |
| 证据不足或评价偏差 | Keeper | `deviated` / `pending_human` |
| 资产来源、许可或呈现失败 | Architect / Forge | 回 Asset Library / Graph proposal |
| 用户选择与历史偏好冲突 | 人类 / Weaver | 保留场景差异，不自动覆盖旧判断 |

### 14.1 特别反模式

- **Persona Theater**：身份描述很强，行动没有变化。
- **Reference Soup**：大量参考被平均成无差别 moodboard。
- **Style Cosplay**：复制某位设计师或热门产品表面特征。
- **Candidate Collusion**：分支过早共享内容，最后一起收敛。
- **Novelty Tax**：为了证明创新，让用户承担不必要学习成本。
- **Proof by Eloquence**：用漂亮阐述替代真实作品。
- **Asset Multiverse**：单件资产各自漂亮，放在一起完全不属于同一世界。
- **Taste Lock-in**：一次成功被无条件复制到所有后续任务。
- **Arena Everywhere**：把普通修复也拖入完整创作流程。
- **Judge Laundering**：用多个相同偏见的模型投票，把主观偏好包装成客观事实。

---

## 15. 迁移与实现计划

### Phase 0：行为实验，不改运行时强门

目标：验证 Authorial Stance 与独立 Atelier 是否产生可观察增益。

使用相同模型、相同工具、相同起点运行：

| 组 | 条件 |
|---|---|
| A | 当前 LOOM Quality Engine |
| B | 当前 LOOM + 手工 Authorial Stance |
| C | Identity Compiler + 独立 Atelier Path |

代表任务：

1. 产品首页或核心界面。
2. 数据密集工作台。
3. 一组角色、插画或图标资产。
4. 一个动效或交互主导的关键时刻。

观察：

- Baseline 匿名胜率。
- 用户能否复述作品的独特命题。
- 候选机制差异。
- 跨状态、跨页面或跨资产的一致性。
- Reliability Floor 保持率。
- 顺序交换后的选择稳定性。
- 时间、token、工具和人工评审成本。

判读：

- B 显著胜过 A：Author 是缺失变量。
- C 显著胜过 B：独立分支和 Quality-Diversity 选择具有额外价值。
- B、C 都未胜过 A：停止扩建，重新检查问题是否来自模型、工具或验证能力。
- C 只提高新奇、不提高项目结果：收紧 Surprise Budget 和选择协议。

### Phase 1：最小提示词与手工 Record

修改：

| 文件 | 改动 |
|---|---|
| `roles/forge.md` | 增加 Author、Identity Compiler 和 Atelier Path |
| `roles/keeper.md` | 增加 Atelier Quality Proof 边界 |
| `roles/architect.md` | 增加 `quality_strategy` 责任 |
| `meta/INTENT_LOOP.md` | 定义路径、Record 和回流 |
| `meta/ROLE_ACTIVATION.md` | 定义 Context Pack 注入 |
| `dimensions/AUTHORSHIP.md` | 新增按需方法，不常驻全局 |
| `templates/ATELIER_RECORD_TEMPLATE.json` | 提供单一 Record 模板 |

这一阶段 Record 可以人工编写，但必须通过测试夹具验证行为。

### Phase 2：CLI Schema 与闭合门

新增或修改：

| 文件 | 改动 |
|---|---|
| `cli/src/atelier.js` | Record 读取、校验、原子写入和新鲜度 |
| `cli/bin/loom.js` | `loom atelier` 命令路由 |
| `cli/src/intent-map.js` | `quality_strategy` 校验与兼容 |
| `cli/src/activate.js` | 条件化注入 Author / Atelier 输入 |
| `cli/src/verify.js` | Atelier passed 的条件要求 |
| `cli/src/diagnostics.js` | 缺失、过期、断链和非法选择诊断 |
| `cli/src/guide.js` | Atelier 中间阶段的唯一下一步 |
| `cli/help/atelier.md` | 用户与 Agent 指南 |
| `cli/test/run-all.js` | Schema、状态、新鲜度、安全和兼容测试 |

### Phase 3：媒介适配

通过 Capability Brief 和 Skill 增加：

- UI / browser render。
- Motion / video evidence。
- Image / illustration contact sheet。
- Audio scene comparison。
- Copy anonymous comparison。

核心 Atelier Schema 不为每个媒介增加顶层字段；媒介细节进入 `medium_grammar` 和对应 Skill。

### Phase 4：Creative Lineage 与长期学习

只有 Phase 0–3 产生重复稳定证据后：

- 增加可选 `CREATIVE_LINEAGE.md` 方法与校验。
- 从 Quality Proof 手工提取 Decision Capsule。
- 验证跨 Intent 召回是否提高质量而不造成风格锁死。
- 再决定是否需要结构化 preference store、视觉 fingerprint 或置信度衰减。

### 15.1 推荐实现切片

实现时保持最小可独立验证单元：

1. `quality_strategy` 与 Atelier Record Schema。
2. Author / Identity Compiler 的 Context Pack 行为。
3. Atelier CLI 与 revision 新鲜度。
4. Quality Proof 条件门。
5. UI + 美术资产两个真实对照场景。
6. 文档、帮助、preview 和兼容测试。

不要先建设自动审美评分、长期偏好模型或大型素材语义索引。

---

## 16. 测试设计

### 16.1 结构测试

- 旧 Intent 缺少 `quality_strategy` 时等价于 `adaptive`。
- 没有 `quality_contract` 时拒绝 `atelier`。
- `atelier` 缺少 `creative_scope` 时拒绝 finalize。
- Atelier Record 的 Intent、revision 和版本必须匹配。
- 候选 ID 唯一，selection 必须指向存在候选。
- 未通过 Floor Gate 或缺少 `floor_evidence` 的候选不能被 selected。
- artifact 引用不能越出当前版本。
- `selected` / `baseline_retained` 具有对应证据。
- 当前 revision 的 Atelier passed 需要 Quality Proof。
- 旧 Quality Proof 和非 Atelier Intent 保持兼容。

### 16.2 行为场景

1. 普通 bug 不进入 Identity Compiler。
2. 用户要求“世界级 UI”时形成具体 Stance，而不是专家 Persona。
3. 三个候选只有配色差异时被判定为无效多样性。
4. 候选在真实移动端失败时被 Floor Gate 淘汰。
5. 没有候选胜过基线时保留原版。
6. 美术资产单件漂亮但 contact sheet 漂移时质量不得通过。
7. LLM Judge 顺序交换后偏好反转时转人工或降低证据等级。
8. Intent revision 改变后旧 Atelier Record 失效。
9. 用户偏好与 Creative Lineage 冲突时保留条件差异并回流，不自动覆盖。
10. 宿主没有独立 thread 时降低隔离声明。
11. 外部网页包含指令注入文本时只提取可验证参考机制。
12. 最终实现丢失原型 signature bet 时 Keeper 判定 deviated。

### 16.3 质量指标

| 指标 | 观察 |
|---|---|
| Authorship perceptibility | 不看阐述时，用户能否感知并复述核心命题 |
| Mechanism diversity | 候选是否依赖不同结构与交互机制 |
| Baseline win rate | 最终结果是否匿名胜过修改前 |
| Reliability retention | 品质提升时功能、守恒、性能和可访问性是否保持 |
| Cross-artifact coherence | 多页面、多状态、多资产是否属于同一表达系统 |
| Useful surprise | 新奇是否改善理解、记忆、行动或情绪结果 |
| Preference stability | 顺序交换和重复评审后选择是否稳定 |
| Lineage recognizability | 跨 Intent 是否形成可辨认但不僵化的项目性格 |
| Fixation escape | 是否避免重复模型默认解和近期成功公式 |
| Process cost | 相对质量增益是否值得额外时间、计算和人工判断 |

### 16.4 发布主张

在对照实验前，LOOM 只能声称：

> 已设计一套将外部能力、作者立场、独立创作分支和质量证明接入现有 Quality Engine 的机制。

对照证据成立后，才可以声称：

- Authorial Stance 提高了目标任务的基线胜率。
- Atelier 提高了机制多样性或作品辨识度。
- 提升在保持 Reliability Floor 的情况下成立。

不能声称：

- 突破基础模型的理论智能上限。
- 自动拥有世界级审美。
- 适用于所有创作领域。
- 机器已经客观证明艺术价值。

---

## 17. 被拒绝的替代方案

### 17.1 新增 Muse / Artist / Creative Director 角色

拒绝。角色称号不产生能力，还会增加权限、上下文和切换成本。Author 是 Expertise Compiler
中的认知职能，必要时由独立 Agent 承担，但不成为常驻组织结构。

### 17.2 建立平行 Creative Pipeline

拒绝。它会复制 Intent、Contract、Arena、Proof 和 Reflow。Atelier 必须复用现有质量链。

### 17.3 建立风格预设库

拒绝作为核心方案。“未来、像素、奢华、极简”等预设会快速形成模板化输出。风格素材可以作为
Skill 或参考入口，但必须被编译为项目机制。

### 17.4 自动生成完整人格卡

拒绝。姓名、经历、口头禅和虚构履历不会稳定改变作品。只保留会改变注意力、候选、动作和验证的
Authorial Stance。

### 17.5 强制多 Agent

拒绝。独立分支有价值，多 Agent 只是实现手段。强制使用会在简单任务中制造成本，也可能引入
弱模型噪声和过早群体共识。

### 17.6 审美总分与自动 Reward Model

首版拒绝。单一总分会掩盖硬失败、价值冲突和评价偏差。先使用 Floor Gate、Pareto 比较和
人类校准。

### 17.7 自动从互联网模仿优秀设计

拒绝。互联网用于发现作品、机制、反例和当前工具能力，不用于复制个人风格或绕过许可。

### 17.8 自动把用户选择写入长期偏好

拒绝。一次选择只在当前上下文成立。长期判断继续使用现有证据晋升门。

---

## 18. 设计验收条件

进入实现前，本设计应满足：

- [x] 没有增加第六角色。
- [x] Identity Compiler 已收进 Expertise Compiler。
- [x] Atelier 已收进 Quality Arena。
- [x] Authorship Evidence 已收进 Quality Proof。
- [x] 没有新增完成状态或 verdict。
- [x] 复用 acceptance、quality_contract 和 creative_scope。
- [x] 只新增一个可选 Intent 字段和一个可选 Record 真相源。
- [x] 普通任务具有零或接近零的新增流程成本。
- [x] UI、美术资产和其他媒介具有适配路径。
- [x] 外部参考、资产许可、隐私和提示注入边界明确。
- [x] 独立分支、主观比较和人类裁决边界明确。
- [x] 没有候选胜过基线时允许合法停止。
- [x] 长期学习复用现有晋升门并防止风格锁死。
- [x] CLI 与 Agent 判断边界明确。
- [x] 迁移、测试、失败回流和实现切片完整。
- [ ] Phase 0 三组对照实验产生真实证据。

最后一项是实施前的首个验证任务。Design 通过不等于 Authorship System 已经有效。

---

## 19. 研究依据与设计影响

这些来源用于校准机制，不构成 LOOM 必须照搬的固定范式：

1. [The Effects of Generative AI on Design Fixation and Divergent Thinking](https://doi.org/10.1145/3613904.3642919)
   设计影响：更多生成不自动产生更多原创性；Atelier 必须显式使用 anti-fixation、独立分支和
   机制差异，而不是把参考或采样数量当作创造力。

2. [Understanding Design Fixation in Generative AI](https://arxiv.org/abs/2502.05870)
   设计影响：将模型内部偏置、提示交互和输出同质化视为创作系统风险；Creative Lineage 必须同时
   保存成功机制和反固着条件。

3. [Breaking Mental Set to Improve Reasoning through Diverse Multi-Agent Debate](https://openreview.net/forum?id=t6QHYUOQL7)
   设计影响：不同 Persona 若使用同一思维策略，仍可能产生同质结果；LOOM 要求分支具有不同
   Creative Thesis、Signature Bet 和机制，而不是不同称号。

4. [Empowering Quality Diversity in Dungeon Design with Interactive Constrained MAP-Elites](https://arxiv.org/abs/1906.05175)
   设计影响：创作搜索应保留多个质量生态位，让用户沿有意义的差异轴探索，而不是过早压成唯一
   最高分；LOOM 将其转译为轻量 Quality-Diversity Frontier，不实现通用进化算法。

5. [COFI: A Framework for Modeling Interaction in Human-AI Co-Creative Systems](https://computationalcreativity.net/iccc21/wp-content/uploads/2021/09/Wkshp2.pdf)
   设计影响：共创质量不仅来自生成模型，还来自发起、贡献、沟通和选择结构；Atelier 明确人类与
   Agent 的决定权和比较入口。

6. [Judging the Judges: A Systematic Study of Position Bias in LLM-as-a-Judge](https://arxiv.org/abs/2406.07791)
   设计影响：主观比较至少使用匿名、随机顺序和顺序交换；单次 LLM 偏好不能成为质量事实。

7. LOOM `test-simulation/quality-engine-demo`
   设计影响：现有系统已经能够偶然形成有辨识度的编辑式界面，但作品中的选择没有进入可复用、
   可反驳的创作谱系。Authorship System 的目标不是证明 LOOM 从未做好过，而是让好作品的产生
   和成长不再依赖偶然。
