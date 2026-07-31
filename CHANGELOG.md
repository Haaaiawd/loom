# Changelog

## 1.2.2 — 2026-07-31

### Fixed

- `guide` 只输出下一步命令、Context Pack 提示与完成校验，不再展示文件输入/输出清单；当下一步是角色激活时，由该命令装配 Context Pack。
- `activate weaver` 直接注入检索方法与哲学维度目录；`activate architect` 在无 Intent 的设计阶段直接注入愿景、当前 Capability Graph、Intent Map 与未闭合 proposal。
- Capability Graph 未闭合或 proposal 待裁决时，`guide` 重新指向可推进工作的 Architect Context Pack，而不是重复运行只读检查。
- `loom intent next` 返回开始该 Intent 和获取 Forge Context Pack 的明确后续命令。

## 1.2.1 — 2026-07-31

### Fixed

- `verify pass` 现在要求声明独立 Keeper 或人类复核来源，并将该来源写入验证记录；普通自检不能再被快捷命令包装成 `passed`。
- 高影响 capability 若选择 `adaptive`，必须留下为何不启用外部获取强门的理由；无理由的 `adaptive` 不再是静默绕过路径。
- Intent 模板不再默认引用不存在的质量契约章节，并增加叙事语义守恒与反例验证的提示。

### Compatibility

- 旧版结构化验证记录仍可读取；新的 passed 记录（包括 `verify write`）必须声明验证来源。旧记录可供历史追溯，但不自动获得独立验证声明。

## 1.2.0 — 2026-07-31

### Added

- External Acquisition Gate：Capability Graph 只声明 `acquisition_mode`，Forge 按当前
  Intent 信号派生 Search Plan，并实际通过 Skill registry、网络、官方文档或研究资料获取信息。
- revision-scoped Expertise Pack 与 `loom expertise init|get|validate`，以来源、检索证据和
  Capability Capsules 形成类似 Skill 的项目化核心信息组，但不复制或内置第三方内容。
- `guide`、Forge/Keeper activation、`verify pass`、`intent done` 与 `doctor` 的外部能力
  获取强门；passed 记录绑定当前 Pack 内容摘要，Keeper 必须独立重开关键来源。

### Compatibility

- 中低影响 capability 默认为 `adaptive`；高影响 capability 未显式豁免时，以及任意 capability
  显式声明 `external_required` 时启用持久化强门。
- `project_only` 保留内部协议与机械任务路径，但必须说明 `acquisition_rationale`。

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
