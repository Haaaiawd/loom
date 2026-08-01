## Intent Loop 与 Quality Engine

每个 Intent 独立运行，直到当前 revision 被证据闭合。

```text
Select → Compile Expertise → Explore/Direct → Realize
→ Self-check → Independent Proof → Close/Reflow
```

## 1. 选择与锁定

```bash
loom intent next
loom intent update <id> --status in_progress
loom activate forge --intent <id>
```

Context Pack 只注入当前角色和当前 Intent 的相关事实，但不会、也无法清除宿主会话的旧记忆。
Forge 必须以磁盘事实和当前 Pack 为准，发现冲突时报告。

## 2. Expertise Compiler

Forge 先形成任务级 Expertise Pack：

- 专业问题与任务类型。
- 卓越判断标准和反模式。
- 项目事实、硬约束与可变空间。
- 已实际加载的技能、资料、工具及其用途。
- Critic 视角与验证方法。

Pack 是任务级认知配置，不写成新的长期规范。高影响 capability 默认进入 External Acquisition Gate；若明确选择 `adaptive`，也必须写明为何此处不启用外部获取。Pack
必须落盘到 `10_EXPERTISE_PACKS/<intent-id>.json`：Search Plan 可由 AI 派生，但 Capsule 内容
必须来自实际打开的外部来源，并写出判断门、失败模式和验证信号。明显的机械任务可以保持
`adaptive`；高质量任务必须足以解释为什么某个专业手法适合这个项目。

## 3. Quality Arena

完成目标明确且不存在实质质量选择时，走直接路径。

当 `quality_contract` 要求相对提升时：

1. 记录修改前 Baseline。
2. 产生少量机制不同的候选。
3. 按完成契约、质量契约、Doctrine 和实际成本比较。
4. 实现最优候选并观察真实产物。
5. 不胜过基线就保留原方案或回流契约，不强改。

## 4. Quality Proof

```bash
loom activate keeper --intent <id>
loom verify contract <id>
```

Keeper 独立检查基础四维；有质量契约时增加第五维：

```json
{
  "intent_id": "INT-001",
  "verdict": "passed",
  "timestamp": "2026-07-28T12:00:00.000Z",
  "summary": "具体、可定位、可复现的判定摘要",
  "verification_provenance": {
    "verified_by": "keeper thread 或人类复核标识",
    "context": "independent_thread"
  },
  "reproduction_command": "npm test",
  "dimensions": {
    "intent_fidelity": {
      "verdict": "passed",
      "evidence": "对照 narrative 的用户结果，真实产物保持了目标与非目标"
    },
    "philosophy_consistency": {
      "verdict": "passed",
      "evidence": "对照引用原则与反模式，关键取舍和例外均有项目依据"
    },
    "baseline_compliance": {
      "verdict": "passed",
      "evidence": "B1-B5 与项目底线逐项检查，未发现失守"
    },
    "acceptance_achievement": {
      "verdict": "passed",
      "evidence": "完成契约的可观察行为均已复现"
    },
    "quality_achievement": {
      "verdict": "passed",
      "evidence": "相对修改前基线，目标信号达到契约阈值且回归保持稳定",
      "quality_proof_ref": "artifacts/quality-proof.md#INT-001"
    }
  }
}
```

快捷写入 `passed` 时，也必须声明这一来源：

```bash
loom verify pass INT-001 --summary "..." \
  --verified-by "keeper-run-123" \
  --verification-context independent_thread
```

若 Intent 声明 `continuity_required: true`，Keeper 还必须写入并通过：

```json
"preservation_achievement": {
  "verdict": "passed",
  "evidence": "复现旧状态 → 本轮操作 → 新状态；列出保留的旧值、完成状态或可见行为。"
}
```

这不是第二份契约：具体保留规则和操作序列仍写在 `acceptance`。通过快捷命令闭合时，必须显式提供
`--preservation-evidence "..."`。

存在 `quality_contract` 时强制 `quality_achievement`；只有声明相对提升时才需要
`quality_proof_ref`。Quality Proof 至少说明基线、主张、候选机制、选择证据、稳定性和代价。

## 5. 判定与回流

| verdict | 动作 |
|---|---|
| `passed` | `loom intent done <id>` |
| `deviated` | 回到真正的问题拥有者，修正后重验 |
| `blocked` | 标记阻塞并报告缺失条件 |
| `pending_human` | 只在确需人类感知或授权时使用 |

完成通过但质量未通过时，结果可以保留为可靠完成，但不得声称质量提升；由用户决定继续 Arena、
降低或修订质量契约，还是接受当前结果。

Intent 语义变化必须递增 revision；任何完成态 Intent 回流也会递增验证 epoch。旧 revision 或旧 epoch 的 passed 记录都不会闭合当前 Intent；修订 Intent 时必须完整分类全部直接和传递下游，已完成下游会一并回流复验。

## 6. Goal 与闭环

把当前 Intent 视为一次 Codex goal 的可闭合单元。goal 只能在“结果、适用时的状态守恒、可复现证据、按需的质量证明”同时成立后完成；
goal/status 不能替代 Keeper 验证。状态型任务默认保留或合并旧内容，删除和覆盖必须在 acceptance 中显式授权。
