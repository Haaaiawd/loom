# Atelier

Atelier 是 `quality_strategy=atelier` 的创作深路径。它让 Authorial Stance、基线、候选、
修正和选择证据成为单个版本化记录，不替代 Intent 状态或 Keeper。

## 何时启用

由 Architect 在 Intent 同时声明：

```json
{
  "quality_contract": "相对基线可观察的质量主张与证据方式",
  "quality_strategy": "atelier",
  "creative_scope": "允许改变什么；必须保护什么。"
}
```

普通任务省略该字段或使用 `adaptive`，不会创建 Atelier Record。

## 工作流

```bash
loom activate forge --intent INT-001
loom atelier init INT-001
loom atelier validate INT-001
loom atelier get INT-001
```

记录位于 `.loom/vN/09_ATELIER/INT-001.json`，证据位于
`.loom/vN/09_ATELIER/files/INT-001/`。

每个候选必须绑定 `stance_revision`。Stance 改变后，旧候选要设置 `archived: true`，
或在重新检查后写 `requalified_for_stance_revision`。局部创作修正写入 `corrections[]`；
结构性新发现提交 Capability Graph proposal，由 Architect 裁决。

`loom atelier validate` 只证明记录结构、新鲜度和引用合法，不证明作品优秀。最终质量仍由
新的 Keeper task 依据 Quality Proof 独立判定。
