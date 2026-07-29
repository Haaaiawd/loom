## 诊断与恢复

```bash
loom doctor
loom context
```

`doctor` 只检查能够机械判断的系统一致性，不假装用规则替代专业判断。

## 主要诊断

| 类型 | 严重度 | 含义 |
|---|---|---|
| `cycle` | fatal | Intent DAG 有环 |
| `orphan_philosophy_ref` | high | Doctrine 引用不存在 |
| `orphan_dependency` | high | Intent 依赖不存在 |
| `completed_no_record` | high | completed 没有验证记录 |
| `completed_verification_not_passed` | high | 最新记录不能闭合当前 revision |
| `stale_verification` | high | passed 记录早于当前 revision |
| `quality_dimension_missing` | high | 有质量契约，但缺少通过的质量维度 |
| `preservation_dimension_missing` | high | 启用了状态守恒门，但缺少通过的守恒维度 |
| `inspiration_source` | high/medium | Doctrine 证据不可追溯、缺理由或仍是模板 |
| `verification_method_drift` | high | 声明的验证方式与复现证据不一致 |
| `in_progress_no_record` | medium | 工作可能中断 |
| `zombie` | medium | Intent 长时间无活动 |

## Doctrine 证据

```bash
loom philosophy check
```

校验只要求：

- 至少有实际使用的证据条目。
- 每条证据有选择或转译理由。
- 每条证据有 URL、`file://` 或 `local:` 可追溯位置。

不要求固定数量、不排斥 Wikipedia，也不强制来源多样性。来源是否足以支持主张由 Weaver 与审阅者
判断；CLI 只阻止空白、装饰性名字和不可追溯引用。

## Quality Proof

有 `quality_contract` 的 Intent 若写入 `passed`：

- `dimensions.quality_achievement` 必须存在并通过。
- 声明相对提升时，`dimensions.quality_achievement.quality_proof_ref` 指向基线比较与稳定性证据。

快速命令：

```bash
loom verify pass <id> --summary "<证据>" --quality-proof "<ref>"
```

若只达到完成契约，写 `deviated` 或完整验证记录，不要伪造质量通过。

## 恢复

- Forge 中断：检查真实产物后继续，或把 Intent 回退到 `pending`。
- Intent Map 损坏：从 Git 恢复，再运行 `loom intent validate`。
- 验证记录丢失：重新独立验证，不从旧会话记忆补写。
- Preview 过期：`loom preview status` 后使用 `loom preview --regen`。

追溯入口：

```bash
loom intent trace <id>
loom intent reverse-dep <id>
loom intent reverse-ref <anchor>
loom verify history <id>
```
