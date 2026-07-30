# INTENT LOOP — LOOM Quality Engine Runtime

Intent Loop 将一个产品意图变成可验证结果，并在证据不足时回流到真正负责的层。

```text
Doctrine → Intent narrative → Capability Graph → Contract
→ Expertise Compiler → Quality Arena → Quality Proof
→ Close or Reflow
```

## 1. 权威边界

| 内容 | 唯一负责人 |
|---|---|
| 长期价值、卓越标准、反模式 | Weaver |
| 产品目标、非目标、Intent narrative | Visionary |
| Capability Graph、系统边界、Intent DAG、完成/质量契约 | Architect |
| Expertise Pack、Authorial Stance、Atelier 候选、实现、自测 | Forge |
| 独立判定、Quality Proof | Keeper |

Keeper 不修改契约；Forge 不以实现困难改写 Intent；Visionary 不写 acceptance；Weaver 不拆实施模块。

## 2. Intent Schema

必需字段：

- `title`
- `narrative_ref`
- `depends_on`
- `philosophy_anchors`
- `acceptance`
- `continuity_required`：仅在会变更既有用户或系统状态时启用；保留规则与时序验证仍写在 acceptance。
- `status`
- `revision`

可选质量字段：

- `quality_contract`：相对基线可观察的质量主张与最小有意义差异。
- `capability_needs`：任务需要的专业认知、工具或审美能力。
- `creative_scope`：允许探索与不得改变的边界。
- `quality_strategy`：`adaptive | atelier`，缺失等价于 `adaptive`；Atelier 只用于明确需要作者命题、媒介原型与独立候选比较的结果。
- `verification_method`：可复现验证方法。

`acceptance` 是 Reliability Floor；`quality_contract` 是 Distinctive Ceiling。二者不能合并成一串模糊
“高质量要求”，否则完成与卓越都无法诚实判定。

### 2.1 Capability Graph Gate

Capability Graph 在 Vision 与 Intent Map 之间展开：`outcome`、`concern`、`capability`、`risk`、`evidence` 节点及其关系。它不是执行 DAG；未知、调研和分叉留在 Graph，只有边界清楚、可独立验收的结果才进入 Intent。

- 所有高影响节点必须路由为 `expand`、`brief`、`intent`、`defer`、`exclude` 或 `covered_by`，不能停留在 `open`。
- 每个高影响 `outcome` 必须以 `validated_by` 连接到一个有验证计划的 `evidence` 节点。该计划至少声明：结果在何处被观察（`target`）、怎么复现（`procedure`）、什么算通过（`pass_criteria`）、留下什么证据（`artifact`）和由哪个 Intent 产出它。`artifact` 必须是当前版本内 `verifications/` 或 `08_ASSET_LIBRARY/files/` 下真实存在的普通文件；接口可用、文件存在于版本外或 URL 可访问都不能替代目标宿主、用户界面、外部接收方或交付物中的实际可观察结果。
- 每个当前 Intent 必须由至少一个 Graph 节点的 `intent_refs` 回链；Graph 是这份关联的唯一真相源，避免双写漂移。
- 需要专业方法、外部知识、研究或即将进入当前 Intent 的能力节点，才使用 `.loom/vN/07_CAPABILITY_BRIEFS/<node-id>.md` 写项目化 Brief。
- `loom capability coverage` 是 Architect 完成图谱后的门；`loom capability compile <id>` 是 Forge 的只读编译入口。Forge 发现新的缺口必须回流 Architect，不能把猜测静默变成实现范围。

## 3. 状态与 revision

状态：

```text
pending → in_progress → completed
                     ↘ blocked
completed → needs_review → in_progress
```

- 语义、契约、依赖或引用变化时递增 `revision`。
- 纯状态变化不递增。
- 只有当前 revision 的最新记录为 `passed` 才能 completed。
- 连续三轮 `deviated` 升级为 blocked。
- 旧版缺失 revision 兼容为 1。

## 4. Context Pack

`loom activate <role> --intent <id>` 生成：

1. Execution Envelope
2. Active Objective
3. Hard Invariants
4. Success Contracts
5. Project Judgment
6. Expertise Inputs（含当前 Intent 编译得到的 Capability Graph 节点与 Brief）
7. Working Facts
8. Role Contract / Output / Reflow / Stop

这是一种结构化注意力控制，不是内存擦除。宿主 system/developer/user 指令优先；旧会话事实与磁盘冲突时，
以当前项目事实为准并报告冲突。

## 5. Select

```bash
loom intent next
loom intent update <id> --status in_progress
```

只选择 pending、所有依赖 completed、未弃用的 Intent。一次 Forge 作用域只包含一个当前 Intent。
进入选择前，Graph coverage 必须没有未路由的高影响节点、无计划能力节点和未映射 Intent。

## 6. Expertise Compiler

Forge 在实现前形成临时 Expertise Pack：

- **Domain**：领域机制、失败边界和项目事实。
- **Taste**：什么区分普通、可靠和出众。
- **Author**：这次提出什么可反驳的创作命题，选择什么并拒绝什么。
- **Critic**：最可能出现的平庸方案、自我欺骗与反例。
- **Verifier**：如何观察、比较和复现。

这五项是认知功能，不是必须创建五个角色或五份文档。

Capability Graph 先提供当前 Intent 相关的项目事实、风险、约束和 Capability Brief；Expertise Compiler 再按 Brief 的获取计划加载真实技能、工具或资料。它不把整张图或历史会话当成当前任务上下文。

`quality_strategy=atelier` 时运行 Identity Compiler：将项目判断编译为可执行的 Authorial
Stance，而不是模仿名人的 Persona。Forge 在 `.loom/vN/09_ATELIER/<intent-id>.json`
保存唯一 Atelier Record；普通 Intent 不创建该文件。

### 2.2 Graph Change Proposal Gate

新用户要求是 `outcome` 或 `constraint` 候选；论文、资料与运行发现是带 provenance 的 `capability`、`risk` 或 `evidence` 候选。它们先写入 `.loom/vN/07_GRAPH_PROPOSALS/CGP-*.json`，必须记录来源、观察时间、具体证据、为什么现在需要处理。Proposal 不是正式 Graph，Forge/Keeper 不得借它静默扩大当前 Intent。

Architect 必须把每个 proposal 判定为：已覆盖、Graph 更新、Intent 变更、acceptance 变更、Minor、Major 或拒绝；关闭时必须提交与决策相符的结构化 resolution，CLI 会从决策时磁盘基线验证 Graph / Intent / acceptance / 决策记录的真实变化或现有有效覆盖，不能以任意 implementation_ref 文本关闭。`constraint` 若决定为 Graph 更新，必须进入正式 Graph 的 `constraints` 字段并回链受影响节点。`covered_by` 必须显式指向另一个已覆盖、非 `covered_by` 路由的节点，并同时保留同目标的关系。`loom guide` 与 `loom doctor` 对未闭合 proposal 回流 Architect。

Author 的自我更正不得绕过该门：局部命题、机制、媒介语法或候选选择变化写入 Atelier
Record `corrections[]` 并递增 `stance_revision`；只有新的用户结果、约束、能力缺口、风险
或项目证据才提交 Graph proposal。Architect 裁决并修订磁盘真相源后，Capability compile
把新输入交回 Author。Author 不得裁决自己的 proposal，也不得修改考纲后自证通过。

### 2.3 Asset Library Protocol

若项目使用图片、音频、视频、模型或其他交付素材，`.loom/vN/08_ASSET_LIBRARY/manifest.json` 与同目录 `files/` 是版本化的一等真相源。每条资产必须有内容派生稳定 ID、kind、中文/其他标签、来源/作者/许可、SHA-256、库内相对路径、status 与 approval。`loom asset import` 只接受明确的本地普通文件、复制后校验哈希，并拒绝路径逃逸、重复字节和未批准/缺少许可元数据。

素材字节能下载不等于素材可呈现；远程 URL 不是呈现证据。资产若用于 Capability Graph 的 evidence，资产 `evidence_refs` 与 evidence 节点 `asset_refs` 必须双向一致，Keeper 仍需在目标宿主验证实际呈现。

技能、工具和资料必须经历：

```text
Discover → Load → Translate → Use
```

只看到名字不算拥有能力；真正使用时要说明它改变了哪条判断、候选或验证方法。

## 7. Quality Arena

### Direct Path

当正确方案明显、质量契约不要求比较、探索不会增加实质价值时，直接实现并验证。

### Arena Path

当目标要求“更好、出众、惊艳”或存在关键质量选择时：

1. **Baseline**：记录改动前可观察状态。
2. **Candidates**：生成少量机制不同的方案。
3. **Compare**：对照完成契约、质量契约、Doctrine、成本与风险。
4. **Realize**：实现最强候选。
5. **Observe**：检查真实界面、运行结果、性能或用户信号。
6. **Adjust**：根据新证据修正。
7. **Self-check**：Forge 先排除明显失败，再交 Keeper。

候选不强制落盘，不设置固定数量。没有候选胜过基线时，保留原方案或回流契约。

### Atelier Path

当 `quality_strategy=atelier` 时，Arena 增加明确作者命题与落盘证据：

1. 编译 Authorial Stance 并冻结修改前基线。
2. 定义质量差异轴，独立形成机制不同的媒介原型。
3. 候选先过 Reliability Floor，再匿名比较或保留基线。
4. 每个候选绑定 `stance_revision`；Stance 改变后重新资格检查或归档旧候选。
5. 选择证据、主要代价和 corrections 写入唯一 Atelier Record，再进入完整实现。

## 8. Independent Quality Proof

Keeper 在独立任务中只加载当前 revision、真实产物、契约、Doctrine 和必要验证工具。不要加载 Forge 的
隐藏推理或 Expertise Pack，以避免共享偏见。

基础维度：

- `intent_fidelity`
- `philosophy_consistency`
- `baseline_compliance`
- `acceptance_achievement`

若 `continuity_required` 为 true，额外增加：

- `preservation_achievement`

有 `quality_contract` 时增加：

- `quality_achievement`

每个维度格式：

```json
{
  "verdict": "passed",
  "evidence": "对照了什么、在哪里观察到、如何复现"
}
```

质量契约声明相对提升时，`quality_achievement` 还必须提供 `quality_proof_ref`，其指向的证据至少包含：

- 改动前 Baseline。
- 精确质量主张与最小有意义差异。
- 候选依赖的不同机制。
- 选择证据。
- 回归与稳定性证据。
- 代价、限制和保留风险。

若比较依赖主观模型评分，至少使用顺序交换或同等的偏差检查；高风险主观质量保留
`pending_human`。不得把单次 LLM 偏好包装成客观事实。

## 9. Write and Close

完整记录：

```bash
loom verify write --json-file verification.json
```

快捷记录：

```bash
loom verify pass <id> \
  --summary "<具体证据>" \
  --reproduction-command "<命令>" \
  --quality-proof "<ref>"
```

没有质量契约时省略 `--quality-proof`。CLI 自动绑定当前 revision 并追加历史。

```bash
loom intent done <id>
```

如果完成契约通过但质量契约未通过，可以诚实记录完成证据，但不能写整体 passed 或宣称提升；
回流 Arena、修订质量契约，或由用户接受当前边界。

### 9.1 Goal 对齐与状态守恒

当前 Intent 是一次 Codex goal 的可闭合单元，而不是一句“完成了”的主观声明。只有以下门同时通过，goal
才应完成、Intent 才能 `done`：

1. **结果**：完成契约中的本轮结果成立。
2. **守恒**：若启用 `continuity_required`，旧状态 → 本轮操作 → 新状态的序列证明未发生未授权丢失。
3. **证据**：验证可复现，且记录属于当前 revision。
4. **品质**：仅在存在 `quality_contract` 时，Quality Proof 证明达到所声明水准。

Codex 的 goal/status 用于驱动循环与恢复工作，不是替代上述证据的通行证。对状态型 Intent，默认语义是保留或合并；
删除、替换、重置和清空必须在 acceptance 中显式授权。

## 10. Reflow

| 发现 | 回流 |
|---|---|
| 长期价值或质量观缺失 | Weaver |
| 产品目标、非目标或 narrative 错误 | Visionary |
| 系统边界、依赖、契约不可成立 | Architect |
| 图谱分支遗漏、能力缺口或高影响节点未路由 | Architect 更新 Capability Graph |
| 专业能力、候选或实现不足 | Forge |
| 证据不足、验证偏差或需人类感知 | Keeper |

回流只修改问题拥有者的权威文件，并评估受影响 Intent。不要为了让当前实现通过而降低契约。

## 11. 收敛

一趟结束时：

- 全部当前 Intent completed 且没有 `needs_review` → 收敛。
- 有 deviated → 修正并重验。
- 修改影响其他 Intent → 标记 needs_review。
- 三趟后仍持续产生 needs_review → 视为系统性问题，回流 Architect 或创建新版本。

## 12. 演进

- Patch 不改变 Intent 语义；验证后记录 `06_CHANGELOG.json`。
- Minor 使用 draft：`intent add|revise` → scoped Visionary/Architect → `intent finalize`。
- Major 在 Doctrine、北极星或主要架构边界变化时 `version new`。
- 跨版本承接通过 `lineage.predecessors` 显式声明；旧版本 passed 不转移到新版本。

## 13. 停止条件

当以下条件同时满足时停止：

- 当前目标真实完成。
- Reliability Floor 有可复现证据。
- 如声明质量提升，Distinctive Ceiling 有 Quality Proof。
- 没有未处理的高影响回流。
- 继续探索不会实质提高结果或降低风险。
