# 维度指引：产品哲学

> 所有项目都需要。回答"这个产品为什么存在、北极星是什么、什么不能妥协"。

---

## 触发条件

**必跑**——通用层三个维度之一，所有项目都激活。

---

## 引导问题

织造时依次回答：

1. **这个产品为什么存在？** 不是"它能做什么"，是"如果没有它会怎样"。如果答案是"用户会用别的工具"，那这个产品没有存在理由。
2. **北极星是什么？** 一句话。不是愿景陈述，是判断基准——遇到冲突时，拿这句话量一下。
3. **什么不能妥协？** 3-5 条。不是"想要"的，是"没有就不行"的。每条必须有理由——为什么这条不能妥协，妥协了会怎样。
4. **反模式是什么？** 和"做什么"同样重要。每个反模式必须说明"不做"和"为什么不做"。
5. **决策原则是什么？** 当价值冲突时怎么取舍。不是口号，是可执行的判断规则。

---

## 参考源指引

### 实践驱动领域（CLI 工具、开发者工具、基础设施）

- **Unix Philosophy** — Doug McIlroy, 1978。原著：*The UNIX Time-Sharing System*（论文）。延伸：Eric Raymond *The Art of UNIX Programming*（2003）、Mike Gancarz *The UNIX Philosophy*（1995）。不要只引 Wikipedia——读 Raymond 的书，里面有 17 条具体原则。
- **Plan 9 设计原则** — Rob Pike, Ken Thompson。和 Unix Philosophy 有继承也有分歧（"一切皆文件"走得更远）。对比阅读能产生张力。
- **Dieter Rams"好设计十诫"** — 原文在 Vitsoe 官网（https://www.vitsoe.com/eu/about/good-design），不是 Wikipedia 摘要。
- **Stripe API 设计哲学** — Stripe 工程博客。搜 "Stripe API design philosophy"。核心：API 是产品契约、一致性 > 灵活性。
- **Jeff Atwood / Joel Spolsky 的工具哲学** — Stack Overflow / Fog Creek 创始人。搜 "Joel Spolsky software philosophy"。

### 2C 产品领域（面向终端用户）

- **Steve Jobs 产品哲学** — 原著：Walter Isaacson *Steve Jobs*（2011）。核心：减法优先、体验 > 功能。
- **John Maeda"减法法则"** — *The Laws of Simplicity*（2006）。MIT Press 出版。
- **Don Norman"以用户为中心的设计"** — *The Design of Everyday Things*（1988/2013 修订版）。

### 2B / 平台领域

- **Amazon Working Backwards** — 搜 "Amazon working backwards document"。核心：从 PR/FAQ 倒推技术方案。
- **Google Design Docs** — 搜 "Google design doc template"。核心：设计先行、文档驱动。

### 学术建制化领域（如果有理论根基需求）

- **SEP"Philosophy of Technology"** — 斯坦福哲学百科全书条目。搜 "SEP philosophy of technology"。
- **Hubert Dreyfus** — *What Computers Still Can't Do*（技术哲学视角）。

---

## 落地要求

织造出的 PRODUCT_PHILOSOPHY.md 必须包含：

1. **北极星**：一句话，可被 Intent 的 `philosophy_anchors` 引用
2. **不可妥协的价值**：3-5 条，每条有理由
3. **反模式清单**：编号（AP1, AP2...），每条有"不做"和"为什么"
4. **决策原则**：编号（P1, P2...），每条有适用条件和判断标准
5. **灵感来源**：至少 3 个独立源，至少 2 个非 Wikipedia 链接，每个源说明"为什么选它"
6. **底线内化声明**：显式声明已内化 BASELINE
7. **章节锚点**：每个章节有 `{#english-anchor}` 标识

### 禁止

- 禁止只有 Wikipedia 链接——Wikipedia 是常识入口，不是深度源
- 禁止"灵感来源"只有名字没有理由——必须说明萃取/转译关系
- 禁止北极星是口号（如"做最好的工具"）——必须是判断基准
- 禁止反模式没有"为什么"——"不做"和"为什么不做"同样重要
