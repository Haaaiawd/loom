# 维度指引：协作哲学

> 所有项目都需要。回答"怎么决策、怎么处理冲突、谁说了算"。
> 产出融入 DECISION_RUBRIC.md 或独立文档。

---

## 触发条件

**必跑**——通用层三个维度之一，所有项目都激活。

---

## 引导问题

1. **谁做决策？** 单人决策？共识决策？权威决策？不同类型的决策（技术选型、接口变更、架构调整）分别由谁拍板？
2. **冲突怎么处理？** 两个人对同一个设计有不同意见，怎么解决？投票？权威？数据驱动？
3. **变更怎么管理？** 谁能发起变更？变更需要什么审批？变更的影响怎么评估？
4. **代码审查的标准是什么？** 审查看什么——风格？逻辑？架构？安全？审查不通过怎么办？
5. **文档和代码的关系？** 文档先行？代码先行？同步更新？文档过时了怎么办？

---

## 参考源指引

### 决策哲学

- **Amazon"Disagree and Commit"** — Jeff Bezos 的股东信。搜 "Amazon disagree and commit"。核心：分歧可以，但定了就全力执行。
- **Google"Design Docs"** — 搜 "Google design doc culture"。核心：设计先行、文档驱动决策、异议记录在文档里。
- **RFC 文化** — Rust/IETF 的 RFC 流程。搜 "Rust RFC process"。核心：提案-评审-决策的显式流程。

### 代码审查哲学

- **Linux Kernel Review 文化** — Linus Torvalds 的 review 风格（有争议，批判性阅读）。搜 "Linux kernel code review philosophy"。
- **Google Code Review Guidelines** — 搜 "Google code review guide"。核心：事实 > 偏好、 kindness + technical rigor。
- **Conventional Comments** — https://conventionalcomments.org/。核心：评论带标签（praise/nitpick/question/issue）。

### 冲突处理

- **Crucial Conversations** — Patterson 等（2011）。核心：安全氛围、事实先行、共同目标。
- **Nonviolent Communication (NVC)** — Marshall Rosenberg。核心：观察-感受-需要-请求。适用于团队冲突。

### 文档哲学

- **Docs as Code** — 搜 "docs as code philosophy"。核心：文档和代码同生命周期、同审查流程。
- **The Bitter Lesson of Documentation** — 搜 "documentation bitter lesson"。核心：文档过时比没有文档更危险。

### ADR（架构决策记录）

- **Michael Nygard"Documenting Architecture Decisions"** — 原文：https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions。ADR 的原始定义。
- **ADR GitHub Organization** — https://adr.github.io/。ADR 的变体和实践。

---

## 落地要求

织造出的协作哲学融入 DECISION_RUBRIC.md 或独立文档，必须包含：

1. **决策权限矩阵**：哪些决策由谁做（单人/共识/权威）
2. **冲突处理规则**：分歧升级路径、仲裁机制
3. **变更管理流程**：变更发起、审批、影响评估
4. **代码审查标准**：审查看什么、不通过怎么办
5. **维度冲突取舍规则**：当产品哲学和工程哲学冲突时，谁优先？什么条件下可以覆盖？
6. **灵感来源**：至少 2 个独立源，每个源说明"为什么选它"

### DECISION_RUBRIC.md 的特殊要求

- 维度冲突的取舍规则（如"性能 vs 体验冲突时，体验优先"）
- 取舍规则的适用条件（什么时候规则生效）
- 例外条件（什么时候规则可以被覆盖）
- 覆盖规则需要什么（如"需要用户显式批准"）

### 禁止

- 禁止"共识决策"这种没有操作性的规则——必须说明"共识达不成怎么办"
- 禁止冲突处理只有"讨论解决"——必须有升级路径和仲裁机制
- 禁止维度冲突取舍规则没有例外条件——所有规则都应有可覆盖的场景
