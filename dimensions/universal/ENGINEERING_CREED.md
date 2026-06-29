# 维度指引：工程哲学

> 所有项目都需要。回答"怎么写代码、什么不做、什么是好代码"。

---

## 触发条件

**必跑**——通用层三个维度之一，所有项目都激活。

---

## 引导问题

1. **什么是好代码？** 不是"能跑的代码"，是"五年后的人能看懂的代码"。具体到这个项目，好代码的标准是什么？
2. **数据流是怎样的？** 单向还是双向？有状态还是无状态？纯函数还是有副作用？为什么这样选？
3. **错误怎么处理？** 静默吞错？抛异常？返回错误码？透传？每种错误类型的处理策略是什么？
4. **依赖策略是什么？** 零依赖？最小依赖？依赖什么、不依赖什么、为什么？
5. **抽象到什么程度？** YAGNI 还是预留扩展？什么时候加抽象，什么时候不加？
6. **测试策略是什么？** 单元测试？集成测试？契约测试？测什么、不测什么、为什么？

---

## 参考源指引

### 通用工程哲学

- **Clean Code** — Robert C. Martin（2008）。核心：函数短小、单一职责、命名清晰。但注意：Martin 的某些主张有争议（函数不超过 20 行等），需要批判性阅读。
- **The Pragmatic Programmer** — Andy Hunt & Dave Thomas（1999/2019 修订）。核心：DRY、正交性、曳光弹、契约式设计。比 Clean Code 更务实。
- **A Philosophy of Software Design** — John Ousterhout（2018）。核心：深模块 vs 浅模块、接口设计、复杂度管理。Ousterhout 和 Martin 在"函数大小"上有分歧——对比阅读。
- **SICP** — Abelson & Sussman（MIT 经典）。核心：抽象、组合、元语言抽象。理论根基。

### 函数式编程哲学

- **Structure and Interpretation of Computer Programs** — 见上。
- **Pure Function-based Architecture** — 搜 "pure function architecture"。核心：纯函数 + 不可变数据 + 副作用隔离。
- **Haskell 设计哲学** — 搜 "Haskell philosophy pure functional"。核心：纯函数、惰性求值、类型系统。

### 系统设计哲学

- **A Philosophy of Software Design** — 见上（深模块部分）。
- **Designing Data-Intensive Applications** — Martin Kleppmann（2017）。核心：数据流、一致性、容错。
- **The Twelve-Factor App** — https://12factor.net/。核心：配置外置、无状态进程、一次性。

### 错误处理哲学

- **Joel Spolsky"Exceptions vs Error Codes"** — 搜 "Joel Spolsky exceptions"。经典争论。
- **Go 的 error-as-value 哲学** — 搜 "Go error handling philosophy"。核心：错误是值，不是控制流。
- **Rust 的 Result/Option** — 搜 "Rust error handling philosophy"。核心：类型系统强制错误处理。

### 测试哲学

- **TDD** — Kent Beck *Test-Driven Development*（2002）。核心：红-绿-重构。
- **Property-based Testing** — 搜 "property based testing philosophy"。核心：测不变量，不测具体案例。
- **The Way of Testivus** — 搜 "testivus testing philosophy"。核心：测试够用就好，不要过度。

---

## 落地要求

织造出的 ENGINEERING_CREED.md 必须包含：

1. **工程北极星**：一句话，工程层面的判断基准
2. **代码原则**：编号（E1, E2...），每条有理由
3. **工程反模式清单**：编号（EAP1, EAP2...），每条有"不做"和"为什么"
4. **灵感来源**：至少 2 个独立源，每个源说明"为什么选它"
5. **底线内化声明**：与 PRODUCT_PHILOSOPHY.md 一致
6. **章节锚点**：每个章节有 `{#english-anchor}` 标识

### 禁止

- 禁止照搬 Clean Code 的条目不加工——必须转译为本项目的具体约束
- 禁止"好代码是可读的"这种废话——必须具体到"什么场景下可读性优先于性能"
- 禁止抽象层和产品层重复——工程哲学聚焦"怎么写"，产品哲学聚焦"为什么存在"
