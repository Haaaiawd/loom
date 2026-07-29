# INTENT LOOP — LOOM Quality Engine Runtime

Intent Loop 将一个产品意图变成可验证结果，并在证据不足时回流到真正负责的层。

```text
Doctrine → Intent → Contract
→ Expertise Compiler → Quality Arena → Quality Proof
→ Close or Reflow
```

## 1. 权威边界

| 内容 | 唯一负责人 |
|---|---|
| 长期价值、卓越标准、反模式 | Weaver |
| 产品目标、非目标、Intent narrative | Visionary |
| 系统边界、Intent DAG、完成/质量契约 | Architect |
| Expertise Pack、候选、实现、自测 | Forge |
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
- `verification_method`：可复现验证方法。

`acceptance` 是 Reliability Floor；`quality_contract` 是 Distinctive Ceiling。二者不能合并成一串模糊
“高质量要求”，否则完成与卓越都无法诚实判定。

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
6. Expertise Inputs
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

## 6. Expertise Compiler

Forge 在实现前形成临时 Expertise Pack：

- **Domain**：领域机制、失败边界和项目事实。
- **Taste**：什么区分普通、可靠和出众。
- **Critic**：最可能出现的平庸方案、自我欺骗与反例。
- **Verifier**：如何观察、比较和复现。

这四项是认知功能，不是必须创建四个角色或四份文档。

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
