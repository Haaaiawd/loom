# INTENT_LOOP — LOOM 意图循环控制流规范

> **"Loop 的单元是意图。验证的问题是'是否忠于原始意图'。"**
>
> 这份文件定义 LOOM 的 Intent-Driven Loop：控制流骨架、Intent Map 底线、Verification 底线。
> 它是 loop 可靠性的保证——底线之上，Agent 根据哲学自由决定具体形态。

---

## 核心理念

### Intent-Driven Loop

LOOM 的 loop 单元是**意图**，不是任务。验证的核心问题是"这个实现是否忠实于原始意图"。

意图在传递链中可能被扭曲——从产品意图到系统设计到代码，每一层翻译都可能偏离原始意思。Intent Loop 通过三个机制对抗这种偏离：

1. **每个 Intent 携带意图叙事**——"为什么存在"跟着 Intent 走到实现层，不只在愿景文档里
2. **独立验证角色**——Keeper 持有原始意图，作为子代理独立验证实现忠实度
3. **Keeper 兜底 context rot**——Forge 主会话的 context 累积不可阻止，但 Keeper 作为子代理独立验证，rot 导致的偏离会被抓住（详见"上下文隔离策略"）

---

## Intent Map 底线

Intent Map 是 loop 的地图。它不是扁平任务表，是**带依赖关系的意图图**。

### IM-1：形态底线

**约束**：Intent Map 必须是图（有依赖边），不是扁平列表。

**为什么**：意图之间有依赖关系——"用户资料"依赖"用户认证"。扁平列表无法表达依赖，会导致乱序执行和集成冲突。图结构让 Keeper 能按拓扑序选 Intent，避免"先做依赖项再做被依赖项"的错误。

**最低要求**：
- Intent Map 是有向无环图（DAG）
- 每个 Intent 有明确的依赖边（前置 Intent ID 列表）
- 图中无环（循环依赖是设计错误，必须解决后才能进入 loop）
- 有拓扑序（Keeper 按拓扑序选 Intent）

**格式**：JSON（结构化，机器可读，CLI 可查询）。叙事留在愿景文档里，JSON 用 ref 引用。

**自由空间**（哲学决定）：
- 图的详细程度（粗粒度 User Story 级 vs 细粒度 REQ 级）
- 依赖边的标注方式（仅 ID / 带依赖类型 / 带依赖强度）
- 是否标注 Intent 的优先级权重

### IM-2：Intent 节点底线

**约束**：每个 Intent 节点必须包含以下字段。

**为什么**：这些字段是 Keeper 验证和 Forge 实现的最小信息集。缺任何一个，loop 就会断裂——Keeper 不知道验证什么，Forge 不知道为什么做。

**必填字段**：

| 字段 | 说明 | 为什么需要 |
|---|---|---|
| `id` | 稳定标识（如 `INT-001`） | 全局引用，不随重命名丢失 |
| `narrative_ref` | 意图叙事的引用（指向愿景文档的章节） | Keeper 验证的依据——"为什么存在" |
| `depends_on` | 前置 Intent ID 列表 | 拓扑序计算、依赖检查 |
| `acceptance` | 验收契约（什么算"忠实实现"） | Keeper 判定通过/偏离的标准 |
| `philosophy_anchors` | 哲学锚点引用（这个 Intent 主要受哪些哲学约束） | Forge 加载相关哲学的指引 |
| `status` | 状态（pending / in_progress / completed / blocked / needs_review） | Loop 状态追踪 |

**自由空间**（哲学决定）：
- `narrative_ref` 指向的叙事多长、什么风格
- `acceptance` 的具体形式（Given-When-Then / 用户故事验收 / 自定义）
- 是否有额外字段（如 `estimated_effort`、`priority`、`sprint`）

**acceptance 质量底线**：`acceptance` 必须具体到可验证——Keeper 读完后能明确判断"满足/不满足"。禁止模糊措辞（如"实现正确即可"、"功能正常"）。如果 Keeper 验证时发现 acceptance 无法判定，必须标记 `blocked`，要求 Architect 重新定义。

**acceptance 示例**：

```
✓ 具体可验证：
"Given 用户已注册且邮箱已验证
 When 用户输入正确的邮箱和密码
 Then 用户成功登录并跳转到 /dashboard
 And  错误的密码显示'用户名或密码错误'"

✓ 具体可验证（性能）：
"从 MySQL 抽取 100 万行数据完成时间 < 5 分钟（在标准测试环境下）"

✗ 模糊不可验证：
"实现正确即可"
"功能正常"
"用户体验良好"
```

### IM-3：可引用性底线

**约束**：Intent Map 必须可被 Keeper 和 CLI 引用和查询。

**为什么**：Keeper 验证时要定位"这个 Intent 的原始意图是什么"。CLI 要回答"下一个可执行的 Intent 是哪个"。如果 Intent Map 不可被精确引用，loop 就退化成手动扫描。

**最低要求**：
- 每个 Intent 有唯一 ID，ID 在项目生命周期内稳定
- Intent Map 可被 CLI 工具解析和查询（JSON 格式保证这一点）
- 意图叙事可通过 `narrative_ref` 精确定位到愿景文档的具体章节

---

## Verification 底线

Verification 是 loop 的验证环节。它不是 code review（那是看代码质量的），是 **intent review**（看意图忠实度的）。

### V-1：独立性底线

**约束**：验证必须由独立子代理（Keeper）执行，实现者（Forge）不得自评。

**为什么**：实现者验证自己的实现，会有确认偏差——"我做的肯定是对的"。独立验证才能发现"实现偏离了意图但实现者没意识到"的问题。

这是 maker-checker split 的应用：写代码的 agent 和验证的 agent 不是同一个。

**最低要求**：
- Keeper 作为子代理运行，不继承 Forge 的实现上下文
- Keeper 从磁盘重新加载：哲学文档 + 意图叙事 + 验收契约
- Keeper 的判断基于"原始意图 vs 实际实现"，不是"实现过程是否合理"
- Forge 不得参与自己的验证判定

### V-1.5：验证能力底线

**约束**：Keeper 的验证能力不是只有"读代码"。根据验收契约的类型，Keeper 必须能选择对应的验证方式。

**为什么**：LOOM 最初假设"静态读代码 + 文档对照"就够验证。但现实项目的验收契约包含运行时指标（性能、数据质量、模型准确率）和主观体验（游戏手感、UI 体验）。只读代码无法验证这些。如果不定义验证能力分层，Keeper 要么无法验证（loop 断裂），要么越权执行（破坏隔离）。

**三个验证层级**：

| 层级 | 验证方式 | Keeper 怎么做 | 适用场景 |
|---|---|---|---|
| **L1 静态审查**（默认） | 读代码 + 读文档 + 对照契约 | Keeper 读实现代码，对照意图叙事和验收契约判定 | 功能性验收（"用户能登录"、"接口返回正确结构"） |
| **L2 运行时验证**（需 Architect 在验收契约中声明） | 执行验证脚本 / 跑测试 / 读运行时产物 | Keeper 执行 Architect 指定的验证脚本，读取测试输出/日志/指标，基于结果判定 | 性能验收（"100 万行 5 分钟"）、数据质量验收（"准确率 > 99%"）、AI/ML 评估集验收 |
| **L3 人类反馈**（主观验收） | Keeper 做静态维度判定，运行时/体验维度标记"需人类验证" | Keeper 完成 L1 维度判定，将无法自动验证的维度标记为 `pending_human`，报告用户 | 游戏手感、UI 体验、创意类验收 |

**L2 运行时验证的规则**：
- Architect 在 Intent 的 `verification_method` 字段（可选）中定义验证方式——如"运行 tests/perf/test-001.js"或"执行 scripts/eval.py --intent INT-001"
- Keeper **只执行 Architect 指定的验证脚本**，不自己写验证代码（保持独立性）
- Keeper 可以读取运行时产物（测试输出、日志、截图、指标文件），但不能修改代码
- 如果 `verification_method` 未定义但验收契约需要运行时验证，Keeper 标记为 `blocked`，报告"验收契约需要运行时验证但未定义验证方式"

**L3 人类反馈的规则**：
- Keeper 在验证记录中对 `pending_human` 的维度给出"静态维度的初步判定" + "需要人类验证的维度和原因"
- 用户完成人类验证后，通过 `verify write` 补充该维度的判定
- 在人类验证完成前，Intent 的总判定为 `blocked`（不能标记 completed）
- 如果用户长期不补充判定（默认 7 天），Keeper 将该 Intent 升级为 `blocked`，报告"人类验证超时"

**自由空间**（哲学决定）：
- 哪些 Intent 用 L1、哪些用 L2、哪些用 L3——由 Architect 在 Intent Map 中通过 `verification_method` 字段声明
- 验证脚本的具体形式（单元测试 / 集成测试 / 评估集 / 性能基准）由 Architect 和哲学决定
- 是否允许 Keeper 自主选择运行时验证方式（默认不允许——必须由 Architect 预定义）

### V-2：验证内容底线

**约束**：每次验证必须覆盖以下维度。

**为什么**：只验证"功能实现了没"是不够的。实现可能功能正确但违反哲学、触碰底线、偏离意图。多维验证才能保证实现真正忠实。

**必须覆盖**：

| 维度 | 验证问题 | 依据 |
|---|---|---|
| 意图忠实度 | "这个实现忠实于原始意图吗？" | 意图叙事 + 验收契约 |
| 哲学一致性 | "这个实现违反了哲学文档的约束吗？" | 哲学锚点引用 |
| 底线合规 | "结构设计/硬编码/接口契约/可追溯——都合规吗？" | BASELINE.md |
| 验收达成 | "验收契约的条件满足了吗？" | Intent 的 `acceptance` 字段（唯一真相源） |

**证据要求**：每个维度的判定必须给出具体证据——不是"看起来没问题"，是"对照意图叙事第 X 段，实现中缺失了 Y"或"验收契约要求 < 3 秒，测试结果 2.1 秒"。证据写在验证记录的 MD 文件（`notes_ref`）中。模糊的判定理由等于未验证。

**自由空间**（哲学决定）：
- 每个维度的具体验证方式
- 验证的详细程度（轻量 Intent 简验 / 关键 Intent 深验）
- 是否引入额外验证维度（如性能、安全——按项目哲学决定）

### V-3：验证结果底线

**约束**：验证结果必须有明确判定，且可追溯。

**为什么**：模糊的验证结果（"大概可以"、"基本满足"）无法驱动 loop。Keeper 必须给出明确判定，loop 才能决定下一步。可追溯的验证记录让后续 Intent 能引用"前一个 Intent 已验证通过"。

**最低要求**：
- 判定必须是四选一：`passed`（通过）/ `deviated`（偏离）/ `blocked`（阻塞）/ `pending_human`（需人类验证）
- 偏离时必须记录：偏离什么意图、偏离程度、修正方向
- 阻塞时必须记录：阻塞原因、需要什么才能解除
- `pending_human` 时必须记录：哪些维度需要人类验证、为什么、Keeper 的静态维度初步判定
- 验证记录落盘（JSON 存判定 + MD 存叙事说明），可被后续引用

**验证记录格式**：

```json
// verifications/INT-{id}.json
{
  "intent_id": "INT-001",
  "verdict": "passed | deviated | blocked | pending_human",
  "fidelity": "high | medium | low",
  "verification_level": "L1 | L2 | L3",
  "checked_at": "ISO 8601 时间戳",
  "dimensions_checked": ["intent_fidelity", "philosophy_consistency", "baseline_compliance", "acceptance"],
  "pending_human_dimensions": ["acceptance"],
  "notes_ref": "verifications/INT-001.md"
}
```

```markdown
<!-- verifications/INT-001.md -->
Keeper 验证 INT-001：
- 意图忠实度：[判定 + 理由]
- 哲学一致性：[判定 + 理由]
- 底线合规：[判定 + 理由]
- 验收达成：[判定 + 理由]
- 总判定：[passed/deviated/blocked]
- 偏离说明（如有）：[偏离什么、修正方向]
```

---

## Loop 控制流

Intent Loop 的固定骨架。底线之上，具体形态由哲学决定。

```
┌─────────────────────────────────────────────────┐
│  1. Intent Selection                            │
│     Keeper 按拓扑序选下一个可执行 Intent         │
│     （依赖满足 + status=pending）                │
│     必须解释"为什么选这个"                       │
├─────────────────────────────────────────────────┤
│  2. Intent Realization                          │
│     Forge 加载意图链（叙事→哲学→设计→验收）      │
│     Forge 在哲学约束下自主实现                   │
│     底线违规时必须停                             │
├─────────────────────────────────────────────────┤
│  3. Intent Verification                         │
│     Keeper 子代理独立验证                        │
│     按 Verification 底线执行                     │
├─────────────────────────────────────────────────┤
│  4. Intent Closure / Correction                 │
│     passed → 标记完成，回到 1                    │
│     deviated → Keeper 与 Forge 对话修正 → 重新实现 → 重新验证
│     blocked → 停下，报告用户                     │
├─────────────────────────────────────────────────┤
│  ← 回到 1，下一个 Intent                        │
└─────────────────────────────────────────────────┘
```

### Step 1：Intent Selection

**底线**：
- Keeper 按拓扑序选择，不能跳过未完成的依赖
- 必须解释"为什么选这个 Intent"（引用依赖图和优先级）
- 选择基于磁盘上的 Intent Map，不依赖上一轮 context
- **选定后 Keeper 必须更新该 Intent 的 status 为 in_progress**（通过 CLI `intent update <id> --status in_progress`）

**自由空间**：
- 多个可执行 Intent 时的优先级策略（由哲学决定）
- 是否一次选一个还是批量选（由哲学决定，但验证仍逐个进行）

### Step 2：Intent Realization

**底线**：
- Forge 必须加载意图链：`narrative_ref` 指向的意图叙事 + `philosophy_anchors` 指向的哲学 + `acceptance` 验收契约
- Forge 在哲学约束下自主实现——哲学是边界，边界内自由
- 底线（BASELINE）违规时必须停，不能"先做了再说"
- 接口契约变更必须回流（不能偷偷改契约）

**自由空间**：
- 实现方式完全由 Forge 决定（在哲学和底线约束内）
- 是否重构、怎么组织代码、用什么模式——Forge 自主
- Forge 可以质疑设计（通过 Keeper 对话，不是偷偷改）

### Step 3：Intent Verification

**底线**：
- Keeper 作为子代理独立运行（见 Verification 底线 V-1）
- 按 V-2 覆盖四个验证维度
- 按 V-3 给出明确判定和可追溯记录

**自由空间**：
- 验证的具体方式（对话式 / 报告式 / 测试式）
- 验证的详细程度

### Step 4：Intent Closure / Correction

**底线**：
- `passed` → Keeper 更新该 Intent 的 `status` 为 `completed`（通过 CLI `intent update <id> --status completed`），回到 Step 1
- `deviated` → Keeper 与 Forge 对话修正，Forge 重新实现，重新验证（不是机械回流改文档，是讨论后重新实现）
- `blocked` → Keeper 更新该 Intent 的 `status` 为 `blocked`（通过 CLI `intent update <id> --status blocked`），停下，报告用户，说明阻塞原因
- `pending_human` → Keeper 保持该 Intent 的 `status` 为 `in_progress`，报告用户"需要人类验证的维度"，等待用户通过 `verify write` 补充判定后重新评估
- `needs_review`（变更回流触发）→ Keeper 重新验证该 Intent（按原 verification_method 走）：
  - 验证通过 → Keeper 更新 `status` 为 `completed`（变更未影响该 Intent 的验收）
  - 验证偏离 → Keeper 更新 `status` 为 `pending`，回到 Step 2 让 Forge 修正（变更影响了该 Intent 的实现）
  - 验证阻塞 → Keeper 更新 `status` 为 `blocked`，报告用户

**status 更新权归 Keeper**：Keeper 是 loop 的控制者，负责所有运行时 status 更新。Architect 绘制 Intent Map 的结构（节点、依赖、字段），Keeper 不改结构，只更新 status。Forge 不能改 .loom/ 下任何文档。

**自由空间**：
- 偏离的修正流程（Keeper 与 Forge 怎么对话）
- 偏离程度的判定标准

**deviated 循环退出底线**：

同一个 Intent 连续判定 `deviated` 超过 **3 轮**（默认值），必须升级为 `blocked`，停下报告用户。

哲学可以定义不同的上限（如关键 Intent 2 轮、轻量 Intent 5 轮），但**必须定义上限**——不允许"无限修正"的哲学。如果哲学没有定义，按默认 3 轮。

**轮次计算规则**：统计同一个 Intent 的**连续** deviated 次数。中间出现 passed 则重置为 0；出现 blocked 后回到 pending 也重置为 0。CLI 的 `verify write` 自动计算并记录轮次。

验证记录中必须记录当前是第几轮 deviated，Keeper 每次判定时检查轮次。

### Loop 终止条件

- 所有 Intent 的 `status` 为 `completed` → 项目阶段完成
- 用户主动停止
- 阻塞无法解决，Keeper 判定 `blocked` 且无法通过对话修正

---

## 变更回流机制

### 问题：Intent Map 不是永恒的

LOOM 原本假设 Architect 退场后 Intent Map 结构不变。但现实中：
- Forge 实现时发现接口契约需要调整（如数据源 schema 和预期不同）
- Keeper 验证时发现验收契约不可行（如性能指标在当前技术栈下达不到）
- 外部依赖变化（如 API 升级、模型更新）导致 Intent 需要调整

没有回流机制时，Forge 要么偷偷改（违反底线），要么项目卡死。

### 变更回流的触发

变更请求可以由两个角色发起：

| 发起者 | 触发场景 | 流程 |
|---|---|---|
| **Forge** | 实现时发现接口契约/验收契约/Intent 范围需要调整 | Forge 停下实现 → 通过 Keeper 对话提出变更请求 → Keeper 评估 |
| **Keeper** | 验证时发现验收契约不可行、或 Intent 间存在未预期的耦合 | Keeper 标记 Intent 为 `blocked` → 在验证记录中说明变更需求 → 报告用户 |

### Keeper 的变更评估

Keeper 收到变更请求后，评估三件事：

1. **变更范围**：是微调（改 acceptance 措辞）还是结构性变更（加/删 Intent、改依赖、改接口契约）
2. **影响传播**：这个变更影响哪些已完成的 Intent？哪些 in_progress 的 Intent？哪些 pending 的 Intent？
3. **处理路径**：微调由 Keeper 直接处理；结构性变更需要 Architect 重新激活

### Keeper 的有限修改权

Keeper 可以做以下微调（不需要 Architect 介入）：
- 修改 Intent 的 `acceptance` 字段的措辞（澄清，不是改变验收标准）
- 修改 Intent 的 `verification_method` 字段（调整验证方式）
- 在 Intent 的 `_optional` 中追加备注

Keeper **不能**做以下结构性变更（需要 Architect 重新激活）：
- 增加或删除 Intent
- 修改 Intent 的 `depends_on`（依赖关系）
- 修改 Intent 的 `narrative_ref`（意图叙事引用）
- 修改 Intent 的 `philosophy_anchors`（哲学锚点）

### 微调 vs 结构性变更的判定标准

"微调"和"结构性变更"的边界用以下规则判定：

**判定规则：变更是否影响其他 Intent？**

- 如果变更**只影响当前 Intent**（不传播到依赖它的 Intent）→ 微调，Keeper 可以处理
- 如果变更**影响其他 Intent**（依赖它的 Intent 的验收契约或实现需要调整）→ 结构性变更，需要 Architect

**具体判定**：

| 变更内容 | 影响传播？ | 判定 |
|---|---|---|
| 改 acceptance 措辞（语义不变） | 不传播 | 微调 |
| 改 acceptance 标准（如 "< 3 秒" → "< 5 秒"） | 传播（依赖该接口的 Intent 可能受影响） | 结构性变更 |
| 改 verification_method（调整验证方式） | 不传播 | 微调 |
| 改接口契约的字段名 | 传播 | 结构性变更 |
| 改接口契约的字段类型 | 传播 | 结构性变更 |
| 加/删 Intent | 传播（依赖关系变化） | 结构性变更 |
| 改 depends_on | 传播 | 结构性变更 |

**Keeper 评估变更时必须检查影响传播**：Keeper 不能只看变更本身，必须检查所有 `depends_on` 包含该 Intent 的后续 Intent，判断它们是否受影响。如果受影响，即使变更本身看起来很小，也判定为结构性变更。

**"措辞澄清"的边界**：措辞澄清是不改变验收标准的语义，只是让表述更清晰。例如：
- "响应时间 < 3 秒" → "响应时间应小于 3 秒" → 微调（语义不变）
- "响应时间 < 3 秒" → "响应时间 < 5 秒" → 结构性变更（标准变了）
- "用户能登录" → "用户能用邮箱和密码登录" → 结构性变更（细化了验收条件，可能影响实现）

### Architect 重新激活

当 Keeper 判定需要结构性变更时：

1. Keeper 将相关 Intent 标记为 `blocked`
2. Keeper 在验证记录中说明：变更需求、影响范围、为什么需要 Architect
3. **Keeper 必须报告用户**——通知用户"需要 Architect 重新激活处理变更"，说明变更内容和影响范围
4. **用户确认后**，Architect 重新激活——读取变更请求，评估是否接受
5. 如果接受：Architect 更新 Intent Map 结构（加/删 Intent、改依赖、改验收契约）
6. Architect 更新后，受影响的 Intent 标记为 `needs_review`，由 Keeper 重新验证
7. 已完成且不受影响的 Intent 保持 `completed`，不需要重做

**用户知情权**：任何结构性变更（加/删 Intent、改依赖、改接口契约）必须通知用户并等待确认。用户是变更的最终决策者——Keeper 评估、Architect 执行，但用户批准。这不是"用户 micromanage 每个 Intent"，是"用户在结构变更层面保持知情权和决策权"。

**Architect 不是一次性退场**——它是"按需重激活"。退场是指"不主动参与 Loop"，不是"永远不能回来"。变更请求触发重激活时，Architect 回来处理完变更再次退场。

### 变更影响传播

当一个 Intent 的接口契约或验收契约变更时，依赖它的 Intent 可能受影响。传播规则：

- Architect 在更新 Intent Map 时，必须检查所有 `depends_on` 包含该 Intent 的后续 Intent
- 如果后续 Intent 的验收契约依赖前一个 Intent 的接口，且接口变了，后续 Intent 的验收契约可能需要更新
- Architect 在变更记录中列出受影响的 Intent 清单
- 受影响的 Intent 如果已经 `completed`，标记为 `needs_review`（需要重新验证）；如果 `pending` 或 `in_progress`，保持原状态但验收契约可能已更新

### 变更记录

所有结构性变更必须记录在 `.loom/v{N}/03_DECISIONS/` 下（遵循 BASELINE B4 决策可追溯）：
- 变更内容（改了什么）
- 变更原因（为什么改）
- 影响范围（哪些 Intent 受影响）
- 触发来源（Forge 提出 / Keeper 发现）

---

## 上下文隔离策略

### 问题：context rot

长会话中 context 会 rot——Agent 记住越来越多细节，但越来越偏离原始意图。做完 INT-001 再做 INT-002 时，INT-001 的实现细节还在 context 里，可能干扰对 INT-002 原始意图的判断。

### 现实约束

Agent 没法真的"清空记忆"。单会话里 context 是累积的，没法 wipe。LOOM 不假装能阻止 Forge 的 context rot——这是物理约束。

LOOM 的立场是：**不阻止 rot，而是让 rot 导致的偏离被抓住。**

### 各角色的隔离能力

| 角色 | 隔离方式 | 说明 |
|---|---|---|
| Keeper | **子代理，真隔离** | 每次验证启动新子代理，天然新 context，不继承 Forge 的实现细节 |
| Forge（默认） | **不隔离，靠 Keeper 兜底** | 主会话累积 context，rot 可能发生，但 Keeper 验证会抓住偏离 |
| Forge（子代理模式） | **子代理，真隔离** | 每个 Intent 一个 Forge 子代理，真正的 reset，开销大 |

### 为什么不在 Forge 主会话里搞"锚定协议"

之前考虑过让 Forge 每个 Intent 开始时"显式复述原始意图"来对抗 rot。但这依赖 Agent 自律——rot 严重的时候，Agent 连"该复述了"都可能忘。半吊子的自律机制不如没有，会给人"已经对抗了 rot"的错觉，反而放松警惕。

### 真正的防线：Keeper 兜底

不管 Forge 怎么 rot，Keeper 是子代理，独立验证，拿着原始意图对照实现。rot 导致的偏离会在验证阶段暴露。

Keeper 判定 `deviated` 时，可以在偏离说明中附带**重置建议**：
- "本次偏离可能是 context rot 导致，建议重置 Forge 上下文后重新实现"
- Agent 收到建议后自主决定是否启动 Forge 子代理，用户也可以随时介入

### 重置 Forge 上下文的方式

Agent 有自主权决定是否启动 Forge 子代理。用户也可以随时介入要求重置。

1. **启动 Forge 子代理**——Agent 收到 Keeper 的重置建议后，自主决定启动 Forge 子代理重新实现这个 Intent。真隔离，但需要框架支持子代理调度
2. **开新会话**——用户开新的 Agent 会话，从磁盘加载 Intent Map 继续。最简单，零框架开销
3. **不重置，直接重新实现**——如果偏离不严重，Keeper 与 Forge 对话修正后继续，接受 rot 风险

### 何时应该重置

Agent 参考 Keeper 的重置建议自主判断，用户也可以随时介入。以下信号意味着 rot 已经影响判断：
- Keeper 连续判定 `deviated`，且偏离方向一致（说明 Forge 被某个早期实现细节带偏了）
- Forge 开始"自圆其说"——实现明显偏离意图，但 Forge 觉得没问题
- 用户自己感觉 Forge 的输出开始"跑偏"

### Forge 子代理模式（可选升级）

对于高风险或复杂的 Intent，Agent 可以自主把 Forge 也变成子代理——每个 Intent 一个新的 Forge 子代理，父会话只负责调度。

这是真正的 context reset。代价：
- 父会话失去实现细节的连续性（需要重新读代码了解前置 Intent 的接口）
- 子代理启动开销

Agent 有自主权决定何时启用。大部分 Intent 在主会话里做就够了，Keeper 会兜底；高风险或 rot 信号出现时，Agent 可以主动切换到子代理模式。

### 不隔离的内容

- 已完成代码的接口（Forge 需要知道前置 Intent 实现了什么接口）
- 已完成 Intent 的验证记录（Keeper 需要知道前置 Intent 已通过验证）

这些通过**磁盘引用**获取，不是通过 context 继承。

---

## CLI 访问层

Intent Map 和验证记录是 JSON，但 Agent 不应直接读整个文件。通过 CLI 按需获取——省 token、更高效、还能做校验。

### CLI 命令底线

以下命令是 LOOM 系统必须提供的：

| 命令 | 功能 | 为什么需要 |
|---|---|---|
| `intent next` | 返回下一个可执行 Intent | Keeper 不用扫描全图 |
| `intent status` | 返回当前进度 | 一句话了解全局 |
| `intent graph` | 输出依赖图 | 可视化依赖关系 |
| `intent get <id>` | 返回某 Intent 的完整信息 | Forge 加载意图链 |
| `intent narrative <id>` | 返回某 Intent 的意图叙事（解析 narrative_ref） | Keeper 获取验证依据——"原始意图" |
| `intent update <id> --status <s>` | 更新 Intent 状态 | Keeper 推进 loop（pending→in_progress→completed/blocked） |
| `intent validate` | 校验 Intent Map 结构 | 提前发现格式错误 |
| `verify contract <id>` | 返回某 Intent 的验收契约（解析引用） | Keeper 获取验证依据 |
| `verify history <id>` | 返回某 Intent 的验证历史 | Keeper 查前置验证 |
| `verify pending` | 返回待验证的 Intent | 批量验证场景 |
| `verify write --json-file <path>` | 写入验证记录 | Keeper 落盘判定结果 |
| `philosophy get <anchor>` | 返回特定哲学锚点内容 | 角色按需加载哲学 |

### CLI 与文件的关系

- JSON 是**真相源**（CLI 读它）
- Agent 通过 **CLI 访问**，不直接读文件
- 人类想看全貌时直接读 JSON 或用 CLI 渲染

---

## 给 Philosophy Weaver 的指令

Philosophy Weaver 织造哲学时，必须考虑 Intent Loop 的需求：

1. 哲学文档必须**可被 Intent 引用**——Intent 的 `philosophy_anchors` 字段能精确指向哲学文档的章节
2. 哲学文档必须**包含决策标准**——Keeper 验证"哲学一致性"时需要判断依据
3. 哲学文档必须**包含反模式清单**——Forge 实现时需要知道"什么不做"
4. 验收契约的形式由哲学决定——Weaver 织造产品哲学时定义"什么算忠实实现"

---

## 元规范与哲学的边界

| 由这份文件规定（底线） | 由哲学决定（自由） |
|---|---|
| Intent Map 必须是图 | 图的详细程度 |
| Intent 必须有 6 个必填字段 | 是否有额外字段 |
| 验证必须独立子代理 | 子代理怎么对话 |
| 验证必须覆盖 4 个维度 | 每个维度怎么验 |
| 验证能力分三层（L1/L2/L3） | 每个 Intent 用哪层（由 Architect 声明） |
| 验证结果必须四选一 | 偏离的修正流程 |
| deviated 连续 3 轮必须升级 blocked | 哲学可定义不同轮次上限 |
| Keeper 子代理兜底 context rot | 重置方式由用户决定、何时用 Forge 子代理 |
| 变更回流：结构性变更需 Architect 重激活 | 微调由 Keeper 处理 |
| 必须有 CLI 命令 | CLI 的具体实现 |

底线守住 loop 不会崩，自由度留给哲学发挥。

---

## 运行假设与故障恢复

### 执行模型：单 Agent 顺序执行

LOOM 的 Intent Loop 假设**单 Agent 顺序执行**——同一时刻只有一个角色（Keeper 或 Forge）在操作 Intent Map 和验证记录。

**为什么**：Intent Map 和验证记录是单文件 JSON，没有文件锁。多 Agent 并行写入会导致数据损坏。

**多 Agent 并行的场景**：如果需要并行（如多个 Forge 同时实现不同 Intent），必须由外部编排器协调——例如：
- 每个 Forge 操作独立的代码区域，不交叉
- Intent Map 的更新由单一协调者串行执行
- 验证记录按 Intent ID 分文件，不共享

LOOM 不提供内置并发控制。并行是外部编排器的责任。

### 崩溃恢复

Agent 崩溃后可能留下不一致状态。恢复流程：

**场景 A：Forge 崩溃，Intent 留在 in_progress**

1. Keeper 检测到 `in_progress` 但无对应验证记录的 Intent
2. Keeper 报告用户：`INT-XXX 处于 in_progress 但无验证记录，可能上次执行中断`
3. 用户决定：
   - **继续**：重新激活 Forge，从当前代码状态接着做
   - **重置**：`loom intent update INT-XXX --status pending`，从头来
4. Keeper 不自动决定——崩溃后的恢复涉及代码状态判断，需要人类介入

**场景 B：Keeper 崩溃，验证记录写了一半**

1. 验证记录是追加模式（数组），半条记录不会污染已有记录
2. 下次 Keeper 验证时，重新写入完整记录即可
3. 不需要特殊恢复

**场景 C：Intent Map 文件损坏**

1. `loom intent validate` 会检测到格式错误
2. 从版本控制（Git）恢复 Intent Map
3. LOOM 不提供自动备份——版本控制是项目的基本卫生

### 版本控制是前提

LOOM 假设项目使用版本控制（Git）。所有 `.loom/` 下的文件（哲学、愿景、架构、Intent Map、验证记录）都应纳入版本控制。

这解决了：
- 文件损坏 → 从 Git 恢复
- 误操作 → 从 Git 回滚
- 变更追溯 → Git log 就是审计日志

LOOM 不内置备份、审计、回滚——这些是版本控制的职责。
