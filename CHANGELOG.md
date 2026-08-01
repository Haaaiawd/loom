# Changelog

## 1.3.1 — 2026-08-01

### Fixed

- Capability Graph 1.3 新增前置 **Impact Gate**：每个具体 capability 都必须说明影响的用户结果、错判代价、外部知识是否会改变决定与理由。若代价不可逆或外部知识会改变设计/验证，CLI 强制标为 high，并只允许 `external_required`，防止 Agent 通过写成 medium/low 或 `adaptive` 跳过检索。
- Architect 初判后必须让新的 Agent thread / 子代理通过 `loom activate impact-reviewer` 独立逐项审查；high capability 必须至少占具体 capability 的 30%（向上取整，至少一个），防止整张图谱被大量普通节点稀释。
- `guide` 与 `doctor` 会将缺失或试图绕过 Impact Gate 的图谱明确指回 Architect，而非让其继续进入 Intent 阶段。
- Coverage 现在区分“已设计可观察验证入口”与“已完成 Intent 的证据产物已落盘”：规划阶段不再被要求伪造 artifact，完成后缺文件仍是高优先级缺口。

### Compatibility

- Graph 1.0–1.2 保持可读；新建模板使用 1.3。迁移既有图谱时应由 Architect 补 Impact Gate，不由 Forge 静默改写。

## 1.3.0 — 2026-08-01

### Added

- Capability Graph 1.2 引入 `lens_contract` 与 `capability_domains`：Architect 必须审视用户旅程、交互与可访问性、视觉与信息表达、内容与沟通、系统与数据、横切质量与风险；再按项目事实声明 UI/UX、3D 光影、网络安全、心理学、生物学等会改变方案或验证方法的专业领域。两者都必须回链具体 Graph 节点。
- `loom capability graph`、coverage 与 Forge/Keeper Context Pack 现在暴露与当前 Intent 相关的透镜和专业领域，避免图谱只在磁盘上存在。
- 新增 `templates/CAPABILITY_GRAPH_EXAMPLE.json`，展示共享 capability、横切 risk/evidence 与 Lens Contract，而非把 Intent 一一镜像成能力节点。
- `loom atlas` 取代并移除 Preview：CLI 先编译当前版本的架构与决策资料模型，再以 command-assembled Composer Pack 生成必交付的 `loom-atlas.html`。Atlas 固定呈现原则、结构、能力图谱、关键决策与审查入口，不承载项目进度或验证历史。
- Intent 全部闭合后，`guide` 与 `doctor` 将缺少、过期或结构不完整的 Atlas 视为高优先级交付缺口。

### Compatibility

- 既有 Graph 1.0/1.1 保持可读；新 Graph 1.2 缺失 Lens Contract 或 Capability Domain Contract 时，coverage/doctor 会明确阻断并引导 Architect 补全。既有项目迁移应先走 Capability Graph Proposal，不由 Forge 静默改写。
- `loom preview` 及 `loom-preview.html` 不再是 LOOM 功能或合格交付物；迁移到 `loom atlas --regen`。

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
