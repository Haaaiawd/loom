# Changelog

## 1.1.0 — 2026-07-30

### Added

- Capability Graph、Capability Brief 与 coverage/compile 命令，将项目问题面、能力缺口、
  风险和证据显式回链到 Intent。
- provenance-backed Capability Graph Proposal 工作流，由 Architect 裁决新发现对 Graph、
  Intent、acceptance 或版本边界的影响。
- 版本化 Asset Library，校验来源、作者、许可、本地哈希、批准状态与 evidence 双向引用。
- Authorship System：第五种认知职能 Author、Identity Compiler、可选 Atelier Path，以及
  `loom atelier init|get|validate`。
- Atelier Record 的 `intent_revision`、`stance_revision`、候选、修正、基线与选择证据校验。
- Keeper/Quality Proof 的 Atelier 闭合门；`doctor`、`guide` 与 `intent done` 可识别缺失、
  过期或未绑定的创作证据。

### Compatibility

- 旧 Intent 缺少 `quality_strategy` 时等价于 `adaptive`，不会创建 Atelier Record。
- Atelier 是按需深路径，不增加角色、Intent 状态或验证维度。
- 旧项目缺少 Capability Graph 时保留兼容诊断，可在后续架构修订中迁移。
