# LOOM 框架闭环检测报告

> **检测日期**：2026-06-26
> **检测方式**：完整模拟一个极简待办列表应用（MiniTodo），走完 Philosophy Weaver → Visionary → Architect → Intent Loop 全流程
> **检测环境**：Node.js v22.16.0，Windows (PowerShell)
> **检测结论**：框架主干闭环成立，但存在 3 个断点和 2 个设计缺漏

---

## 一、模拟结果

### 阶段 0：Philosophy Weaver 织造哲学

| 产出文件 | 路径 | 是否成功 |
|---|---|---|
| 产品哲学 | `.loom/v1/00_PHILOSOPHY/PRODUCT_PHILOSOPHY.md` | ✅ |
| 工程哲学 | `.loom/v1/00_PHILOSOPHY/ENGINEERING_CREED.md` | ✅ |
| 决策取舍 | `.loom/v1/00_PHILOSOPHY/DECISION_RUBRIC.md` | ✅ |

每个文档包含：核心信念、不可妥协的价值/决策原则、反模式清单、底线内化声明、章节锚点。

**注**：章节标题使用英文，因为 CLI slugify 函数不支持中文字符（详见发现 #1）。

### 阶段 1：Visionary 定义愿景

| 产出文件 | 路径 | 是否成功 |
|---|---|---|
| 愿景文档 | `.loom/v1/01_VISION.md` | ✅ |

包含 3 个意图（INT-001 用户认证、INT-002 创建待办、INT-003 列表展示），每个意图有意图叙事（为什么存在）、验收契约、哲学锚点。

### 阶段 2：Architect 设计系统

| 产出文件 | 路径 | 是否成功 |
|---|---|---|
| 架构文档 | `.loom/v1/02_ARCHITECTURE.md` | ✅ |
| Intent Map | `.loom/v1/04_INTENT_MAP.json` | ✅ |
| 验证契约 | `.loom/v1/05_VERIFICATION.md` | ✅ |

Intent Map 是 DAG，3 个 Intent，INT-002 和 INT-003 依赖 INT-001。每个 Intent 有 6 个必填字段。INT-001 acceptance 内联定义，INT-002/INT-003 引用 05_VERIFICATION.md。

### 阶段 3：Intent Loop 模拟

| 步骤 | 命令 | 结果 |
|---|---|---|
| INT-001 next | `loom intent next` | ✅ 返回 INT-001 |
| INT-001 选定 | `loom intent update INT-001 --status in_progress` | ✅ |
| INT-001 验收契约 | `loom verify contract INT-001` | ✅ 内联返回 |
| INT-001 验证写入 | `loom verify write --json-file ...` | ✅ |
| INT-001 完成 | `loom intent update INT-001 --status completed` | ✅ |
| INT-002 next | `loom intent next` | ✅ 返回 INT-002 |
| INT-002 验收契约 | `loom verify contract INT-002` | ✅ 引用解析 |
| INT-002 完成 | 同上流程 | ✅ |
| INT-003 next | `loom intent next` | ✅ 返回 INT-003 |
| INT-003 完成 | 同上流程 | ✅ |
| 最终状态 | `loom intent status` | ✅ 3/3 完成 |
| 无可执行 | `loom intent next` | ✅ 返回"没有可执行的 Intent" |

---

## 二、闭环检测结果

### A. 角色激活闭环

| 检测点 | 判定 | 说明 |
|---|---|---|
| **A1** Philosophy Weaver 定位是否清晰 | **通过** | ROLE_ACTIVATION.md 明确定义为"系统启动角色，不是开发角色，不参与 Intent Loop"。PHILOSOPHY_WEAVER.md 定义为"独立的 Agent 步骤，先于所有开发角色"。定位清晰。 |
| **A2** Visionary 激活时能否找到哲学文档 | **通过** | 哲学文档写入 `.loom/v1/00_PHILOSOPHY/`，CLI `philosophy list` 能列出，`philosophy get <anchor>` 能按锚点加载章节。章节锚点与 Visionary 的引用格式对得上。 |
| **A3** Architect 激活时能否找到哲学和愿景 | **部分通过** | 哲学文档可通过 CLI 加载。但愿景文档（01_VISION.md）**无法通过 CLI 获取**——`philosophy get` 只读 `00_PHILOSOPHY/` 目录，没有命令读愿景文档。Architect 需要直接读文件。 |
| **A4** Forge 能否通过 CLI 获取 Intent 和哲学锚点 | **通过** | `intent get <id>` 返回完整 Intent 信息（含 philosophy_anchors），`philosophy get <anchor>` 返回哲学章节内容，`verify contract <id>` 返回验收契约。 |
| **A5** Keeper 能否通过 CLI 获取验收契约和意图叙事 | **断裂** | 验收契约可通过 `verify contract <id>` 获取。但**意图叙事无法通过 CLI 获取**——narrative_ref 指向 01_VISION.md，而 CLI 没有任何命令能解析 narrative_ref 并返回愿景文档中的叙事内容。Keeper 必须直接读文件，违反"Agent 通过 CLI 访问，不直接读文件"原则。 |

### B. 数据流闭环

| 检测点 | 判定 | 说明 |
|---|---|---|
| **B1** narrative_ref 能否精确引用 | **部分通过** | 结构上匹配——Intent Map 的 narrative_ref（如 `01_VISION.md#int-001-user-authentication`）与愿景文档 heading slug 完全对应。但 CLI 无法解析这个引用，没有命令能返回 narrative_ref 指向的叙事内容。 |
| **B2** Intent Map 能否被 CLI 正确解析 | **通过** | `intent validate`、`intent next`、`intent status`、`intent graph`、`intent get` 全部正确工作。 |
| **B3** 05_VERIFICATION.md 能否被 verify contract 解析 | **通过** | acceptance 字段为 `see 05_VERIFICATION.md#int-002` 时，CLI 正则匹配引用，读取文件并提取对应章节。内联 acceptance 直接返回。 |
| **B4** Keeper 能否获取所有验证信息 | **断裂** | 验收契约 ✅（`verify contract`）、哲学锚点 ✅（`philosophy get`）、意图叙事 ❌（无 CLI 命令）。Keeper 缺少意图叙事这一关键验证依据。 |

### C. Loop 状态闭环

| 检测点 | 判定 | 说明 |
|---|---|---|
| **C1** 能否更新 status 为 in_progress | **通过** | `intent update INT-001 --status in_progress` 正确执行。 |
| **C2** 能否更新 status 为 completed | **通过** | `intent update INT-001 --status completed` 正确执行。 |
| **C3** 非法转换是否被阻止 | **通过** | `completed→pending`、`completed→in_progress`、非法 status 值全部被拦截，错误信息清晰。状态转换矩阵：pending→in_progress/blocked，in_progress→completed/blocked，completed→终态，blocked→pending。 |
| **C4** 所有 completed 后 status 是否正确 | **通过** | `loom intent status` 显示 `3/3 完成`，`loom intent next` 返回"没有可执行的 Intent"。 |
| **C5** deviated 循环退出底线 | **断裂** | INTENT_LOOP.md 规定"连续 3 轮 deviated 必须升级 blocked"，但 CLI 的 `verify write` 使用 `writeFileSync` **覆盖**之前的记录，无法累积 deviated 历史。没有轮次追踪逻辑，没有自动升级 blocked 机制。Keeper 无法通过 CLI 检查"当前是第几轮 deviated"。 |

### D. 权限闭环

| 检测点 | 判定 | 说明 |
|---|---|---|
| **D1** Forge 是否被禁止修改 .loom/ 文档 | **通过** | forge.md 明确规定"修改 `.loom/` 下的任何文档（愿景、架构、Intent Map、哲学——都是只读的）"在"不能做"清单中。 |
| **D2** Keeper 是否只能更新 status 不能改结构 | **通过** | keeper.md 明确规定"修改 Intent Map 的结构（节点、依赖、字段——由 Architect 绘制）"在"不能做"清单中。CLI 的 `intent update` 只改 status 字段，不改结构。 |
| **D3** 谁负责更新 status 是否明确 | **通过** | INTENT_LOOP.md 明确规定"status 更新权归 Keeper"。keeper.md 的自主空间中明确列出"更新 Intent 的运行时 status"。Forge 不能改 .loom/ 下任何文档。职责清晰，单一归属。 |

### E. 边界情况

| 检测点 | 判定 | 说明 |
|---|---|---|
| **E1** 内联 acceptance 能否直接返回 | **通过** | INT-001 的 acceptance 是内联文本，`verify contract INT-001` 直接返回字符串。 |
| **E2** 引用 acceptance 能否解析 | **通过** | INT-002/INT-003 的 acceptance 是 `see 05_VERIFICATION.md#int-002`，CLI 正则匹配后读取文件并提取章节。 |
| **E3** 哲学文档不存在时的错误处理 | **通过** | `philosophy get NONEXISTENT.md#anchor` 报错"哲学文档不存在: <path>"。`philosophy get FILE.md#nonexistent` 报错"章节未找到: #nonexistent"。`.loom` 目录不存在时报错"找不到 .loom 目录"。错误信息清晰。 |
| **E4** Intent Map 格式错误能否检测 | **通过** | `intent validate` 检测出 6 类错误：引用不存在的 Intent、缺少必填字段、id/key 不一致、非法 status、topo_order 缺少 Intent。校验全面。 |

---

## 三、发现的问题

### 断点 1：CLI slugify 不支持中文字符（严重）

**位置**：`cli/src/philosophy.js` 第 22-27 行，`cli/src/verify.js` 第 113-126 行

**问题**：slugify 函数使用 `[^\w\s-]` 过滤，JavaScript 的 `\w` 只匹配 `[a-zA-Z0-9_]`，不匹配中文字符。中文标题（如 `## 核心信念`）经 slugify 后变成空字符串 `""`，导致锚点永远匹配不上。

**影响**：
- 哲学文档如果用中文标题，`philosophy get PRODUCT_PHILOSOPHY.md#core-belief` 会报"章节未找到"
- 05_VERIFICATION.md 如果用中文标题，`verify contract` 解析引用会失败
- 框架模板（PHILOSOPHY_TEMPLATE.md）的标题是中文（`## 核心信念`），但锚点列表是英文（`#core-belief`），两者无法对应

**复现**：
```
node -e "function slugify(t){return t.toLowerCase().replace(/[^\w\s-]/g,'').replace(/\s+/g,'-').trim()} console.log(slugify('核心信念'))"
// 输出: ""（空字符串）
```

**修复建议**：slugify 使用 Unicode-aware 正则：`/[^\p{L}\p{N}\s-]/gu`（`\p{L}` 匹配所有 Unicode 字母），或在哲学文档中要求使用 HTML 锚点标签（`<a id="core-belief"></a>`）代替 heading slug。

### 断点 2：CRLF 换行符导致 slug 尾部多连字符（中等）

**位置**：`cli/src/philosophy.js` extractSection 函数，`cli/src/verify.js` extractMdSection 函数

**问题**：在 Windows 环境下，文件使用 `\r\n` 换行。extractSection 按 `\n` split 后，heading 行尾部带 `\r`。slugify 将 `\r`（属于 `\s`）转为 `-`，导致 slug 变成 `core-belief-`（尾部多连字符），与锚点 `core-belief` 不匹配。

**影响**：Windows 环境下，即使使用英文标题，锚点解析也会失败。

**复现**：
```
node -e "function slugify(t){return t.toLowerCase().replace(/[^\w\s-]/g,'').replace(/\s+/g,'-').trim()} console.log(slugify('Core Belief\r'))"
// 输出: "core-belief-"（尾部多连字符）
```

**修复建议**：extractSection 在 split 前先 `content.replace(/\r\n/g, '\n')`，或在 slugify 中 `.replace(/[\r\n]+$/,'')` 去尾部换行符。

### 断点 3：无 CLI 命令获取意图叙事（严重）

**位置**：CLI 命令层整体缺漏

**问题**：INTENT_LOOP.md 规定"Agent 通过 CLI 访问，不直接读文件"。但 CLI 没有任何命令能解析 `narrative_ref` 并返回愿景文档中的意图叙事内容。

- `philosophy get` 只读 `00_PHILOSOPHY/` 目录，读不了 `01_VISION.md`
- `intent get` 返回 narrative_ref 字符串，但不解析引用内容
- `verify contract` 只返回 acceptance，不返回 narrative

**影响**：
- Keeper 验证时需要意图叙事作为"原始意图"的依据（V-2 验证内容底线第一维度）
- Keeper 无法通过 CLI 获取意图叙事，必须直接读 01_VISION.md
- 违反"Agent 通过 CLI 访问，不直接读文件"原则
- B1（narrative_ref 精确引用）和 A5（Keeper 获取意图叙事）因此断裂

**修复建议**：增加 CLI 命令 `loom vision get <narrative_ref>` 或 `loom intent narrative <id>`，解析 narrative_ref 并返回愿景文档中对应的意图叙事章节。

### 设计缺漏 1：验证记录覆盖写入，deviated 轮次无法追踪（严重）

**位置**：`cli/src/verify.js` 第 34-36 行

**问题**：`writeVerification` 使用 `writeFileSync`（覆盖写入），文件名为 `${intent_id}.json`。同一个 Intent 多次验证（如 deviated 后重新验证），新记录覆盖旧记录，验证历史丢失。

INTENT_LOOP.md 规定：
- "验证记录中必须记录当前是第几轮 deviated"
- "Keeper 每次判定时检查轮次"
- "连续 3 轮 deviated 必须升级 blocked"

但 CLI 不支持：
- 无轮次追踪逻辑
- 无 deviated 计数
- 无自动升级 blocked 机制
- 覆盖写入导致历史记录丢失，Keeper 无法查"已有几次 deviated"

**影响**：C5 断裂。deviated 循环退出底线在 CLI 层面无法实现，完全依赖 Agent 自律手动追踪——而 INTENT_LOOP.md 明确批评"半吊子的自律机制不如没有"。

**修复建议**：
1. `writeVerification` 改为追加模式（数组存储多条记录）
2. 增加 `verify round <id>` 命令返回当前 deviated 轮次
3. 或在 `intent update` 中增加自动检查：deviated 达到上限时拒绝继续 in_progress，强制 blocked

### 设计缺漏 2：验证记录 MD 文件无 CLI 支持（轻微）

**位置**：CLI verify 命令层

**问题**：INTENT_LOOP.md 规定验证记录格式为"JSON 存判定 + MD 存叙事说明"，但 CLI 的 `verify write` 只处理 JSON，没有命令写入或读取 `.md` 叙事说明文件。Keeper 需要手动创建 MD 文件。

**影响**：轻微。MD 文件是人类可读的叙事说明，不影响 loop 控制流。但破坏了"CLI 是唯一访问层"的一致性。

**修复建议**：`verify write` 命令支持 `--md-file <path>` 参数，同时写入 JSON 和 MD。

---

## 四、总结

### 闭环成立的部分

LOOM 框架的**主干闭环是成立的**：

1. **角色链路**：Philosophy Weaver → Visionary → Architect → Intent Loop 的顺序激活清晰，每个角色的职责边界明确，权限划分合理（D1-D3 全部通过）。
2. **Intent Map 数据流**：JSON 格式的 Intent Map 能被 CLI 正确解析、查询、校验（B2、E4 通过），DAG 拓扑序正确驱动 `intent next`。
3. **验收契约流**：内联和引用两种 acceptance 格式都能被 `verify contract` 正确处理（E1、E2 通过）。
4. **状态机**：pending→in_progress→completed/blocked 的状态转换被 CLI 严格校验，非法转换被拦截（C1-C4 全部通过）。
5. **哲学锚点流**：`philosophy get <anchor>` 能按锚点加载哲学章节，角色激活时能获取哲学约束（A2、A4 通过）。
6. **错误处理**：文件不存在、章节不存在、格式错误都有明确错误信息（E3、E4 通过）。

### 闭环断裂的部分

**3 个断点 + 2 个设计缺漏**，集中在 CLI 传感器层：

| 严重度 | 问题 | 影响的检测点 |
|---|---|---|
| 严重 | slugify 不支持中文 | A2（中文文档场景）、所有锚点解析 |
| 中等 | CRLF 导致 slug 尾部多连字符 | Windows 环境下所有锚点解析 |
| 严重 | 无 CLI 命令获取意图叙事 | A5、B1、B4 |
| 严重 | 验证记录覆盖写入 | C5 |
| 轻微 | MD 验证记录无 CLI 支持 | 一致性 |

### 核心判断

**LOOM 框架在"规范层"是闭环的**——元规范（meta/）、角色定义（roles/）、模板（templates/）之间的引用关系完整，逻辑自洽。

**LOOM 框架在"实现层"有局部断裂**——CLI 传感器层存在 3 个 bug/缺漏，导致：
1. 中文环境不可用（slugify bug）
2. Windows 环境不可用（CRLF bug）
3. Keeper 无法通过 CLI 获取意图叙事（数据流断裂）
4. deviated 循环退出底线无法通过 CLI 实现（安全网缺失）

**修复优先级**：
1. 🔴 slugify Unicode 支持 + CRLF 处理（否则非英文环境完全不可用）
2. 🔴 增加 narrative_ref 解析命令（否则 Keeper 验证依据不完整）
3. 🟡 验证记录改为追加模式 + 轮次追踪（否则 deviated 安全网失效）
4. 🟢 MD 验证记录 CLI 支持（一致性优化）

---

> **检测者声明**：本报告基于真实模拟运行，所有判定都有可复现的命令和输出。发现的问题未因"框架设计精巧"而忽略——闭环检测的意义就是找到断裂点，而不是证明"已经闭环"。
