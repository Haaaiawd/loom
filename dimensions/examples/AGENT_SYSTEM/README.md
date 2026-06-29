# 参考案例：Agent 系统

> 这份文件提供搜索起点和好实践样本。Weaver 按 PART_DECOMPOSITION.md 自行拆解，
> 拆解出的部分和这里不同时，以 Weaver 的拆解为准。

---

## Agent 系统通常拆解出的实现部分

### 1. 系统架构
**职责**：编排 vs 控制、进程边界、IPC 机制、状态管理、多 Agent 协调

**该做什么**：
- **编排而非控制**——设计可信赖的编排协议，把精力放在"哪些能力可以委托、边界在哪、失控时如何收回"这三个问题上，不要试图控制每一行执行
- **区分 LLM 层和确定性层**——LLM 推理和可测试执行要分离（2389-research 的四层架构：reasoning / orchestration / tool bus / deterministic adapters）
- **编排模式显式选择**：
  - Sequential（流水线）：agent 链，前一个的输出是后一个的输入
  - Concurrent（并行）：多 agent 同时处理同一任务，结果聚合（Fan-out/Fan-in）
  - Handoff（交接）：triage agent 路由到 specialist，specialist 接管后续交互
  - Agents-as-tools（工具化）：manager agent 调用 specialist 作为工具，自己保留最终回答权
- **状态管理显式化**——agent 状态必须可序列化，非序列化状态破坏恢复能力
- **IPC 机制要考虑进程边界**——子 agent 可能是独立进程，通信协议要显式（不是共享内存）

**不该做什么**：
- 不要让单个 agent 拿所有工具——工具过载导致选择质量下降（Microsoft Azure 架构指南）
- 不要让 LLM 层直接做副作用——副作用必须在确定性层，带幂等键
- 不要用共享可变状态做 agent 间通信——破坏可恢复性
- 不要假设 agent 不会崩——长任务必须有 checkpoint

**参考实践**：
- **Azure Architecture Center — AI Agent Orchestration Patterns** — Sequential / Concurrent / Handoff / Agents-as-tools 四种编排模式 + 选择指南。https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns
- **OpenAI Agents SDK — Multi-Agent Orchestration** — Handoff vs Agents-as-tools 的选择标准、代码编排 vs LLM 编排。https://openai.github.io/openai-agents-python/multi_agent/
- **Microsoft Multi-Agent Reference Architecture** — Orchestrator + Registry + Classifier + MCP Server 的完整参考架构。https://microsoft.github.io/multi-agent-reference-architecture/docs/reference-architecture/Reference-Architecture.html
- **2389-research/building-multiagent-systems** — 四层架构 + 七种协调模式 + 生命周期管理（cascading stop / orphan detection / heartbeat）。https://github.com/2389-research/building-multiagent-systems
- **"Control Plane as a Tool" (arXiv 2505.06817)** — 把控制平面暴露为单个工具接口，封装工具路由逻辑，解决规模化时的工具编排问题。https://arxiv.org/html/2505.06817

**搜索起点**：
- "agent orchestration architecture patterns"
- "multi-agent coordination protocol"
- "LLM agent system design four layer architecture"
- "agent state machine workflow"

---

### 2. 工具调用哲学
**职责**：委托边界、失控收回、工具描述怎么写、工具选择策略、按需加载

**该做什么**：
- **工具描述是给 LLM 看的契约**——schema 要清晰、类型要显式、副作用要声明
- **按需加载工具定义**——不要把所有工具定义一次性塞进 context（MCP 的 code-execution 模式：agent 探索 filesystem 发现工具，按需加载，token 从 150K 降到 2K，节省 98.7%）
- **人类在环作为安全网**——MCP 规范要求：工具调用 SHOULD 有人类在环，能拒绝调用（modelcontextprotocol.io §Tools）
- **工具权限分级**——读操作自动批准，写操作需确认，不可逆操作需显式批准
- **工具结果要过滤**——不要把原始 tool output 直接塞回 context，在执行环境里过滤后再返回模型

**不该做什么**：
- 不要给 agent 没有边界的工具——"能做什么"和"被允许做什么"是两件事
- 不要让工具描述模糊——"处理文件"不行，"读取文件内容，参数：path，返回：string"才行
- 不要把敏感工具和普通工具混在一起不加标记
- 不要假设 LLM 会正确选择工具——工具越多选择质量越下降，要有工具数量上限或分域

**参考实践**：
- **MCP Specification — Tools** — JSON Schema 定义工具、`tools/list` 发现、`tools/call` 调用、人类在环要求。https://modelcontextprotocol.io/specification/2024-11-05/server/tools
- **Anthropic — "Code execution with MCP"** — 把 MCP server 暴露为 code API 而非直接 tool call，agent 按需加载工具定义，token 节省 98.7%。https://www.anthropic.com/engineering/code-execution-with-mcp
- **MCP Architecture Overview** — Tools / Resources / Prompts 三种 primitive，`*/list` 发现 + `*/get` 检索 + `tools/call` 执行。https://modelcontextprotocol.io/docs/learn/architecture
- **2389-research — Schema-first tools** — typed contract 让 sub-agent 发现和验证工具 + permission inheritance + locking + rate limiting。https://github.com/2389-research/building-multiagent-systems

**搜索起点**：
- "MCP Model Context Protocol tool calling"
- "agent tool description writing best practices"
- "tool selection strategy LLM overload"
- "agent tool permission boundary"

---

### 3. 上下文管理
**职责**：上下文窗口管理、压缩策略、记忆持久化、信息保留优先级、预算感知

**该做什么**：
- **主动压缩 vs 被动保留**——agent 应该自主决定何时压缩，别等 context 满了才压缩（Focus Agent：模仿黏菌的探索-retract 策略，主动把关键学习固化到 Knowledge block，剪枝原始历史）
- **压缩什么、保留什么要显式**——文件路径、API 参数、关键决策不能丢；中间错误、冗余输出可以压缩
- **预算感知**——agent 要知道剩余 context headroom，据此决定压缩力度（ContextBudget：把压缩建模为预算约束的序列决策）
- **语义无损压缩 > 截断**——SimpleMem 三阶段：语义结构化压缩 → 在线语义合成 → 意图感知检索规划，F1 提升 26.4%，token 降 30 倍
- **区分短期 / 工作记忆 / 长期记忆**——不同记忆不同生命周期、不同检索策略

**不该做什么**：
- 不要被动保留全部历史——context bloat 导致成本爆炸、延迟增加、推理质量下降（"lost in the middle"）
- 不要用固定规则压缩——"保留最近 N 轮"不够，信息相关性随任务进展动态变化（Acon：压缩指南优化，自然语言空间精炼 compressor prompt）
- 不要压缩后丢失关键细节——一个文件路径丢了整个 workflow 就崩了（Acon 论文指出）
- 不要把记忆和持久化执行混为一谈——session memory 不是 durable execution（Zylos Research）

**参考实践**：
- **Focus Agent (arXiv 2601.07190)** — agent-centric 主动压缩，模仿黏菌策略，6 次自主压缩/任务，token 节省 22.7%，精度不降。https://arxiv.org/html/2601.07190v1
- **SimpleMem (arXiv 2601.02553)** — 语义无损压缩三阶段，F1 +26.4%，token -30x。https://arxiv.org/pdf/2601.02553
- **ContextBudget (arXiv 2604.01664)** — 预算感知上下文管理，把压缩建模为预算约束序列决策。https://arxiv.org/pdf/2604.01664
- **Acon (arXiv 2510.00615)** — Agent Context Optimization，自然语言空间优化压缩指南，model-agnostic。https://arxiv.org/html/2510.00615v3
- **SUPO (ACL 2026)** — summarization-augmented policy optimization，RL 训练时同时优化工具使用和摘要策略。https://aclanthology.org/2026.acl-long.966/

**搜索起点**：
- "LLM context window management compression"
- "agent memory architecture short term long term"
- "context bloat agent performance degradation"
- "what to keep what to compress agent context"

---

### 4. 提示词工程
**职责**：角色激活、约束注入、系统提示词结构、上下文组装、角色边界

**该做什么**：
- **Role-Task-Constraints 三层结构**——系统提示词按这个顺序：Role（做什么类型的工作）→ Task（具体做什么）→ Constraints（不管什么任务都成立的不变式 + 禁忌）。缺任何一层都会 under-specify
- **硬约束放最前和最后**——注意力在开头和结尾最强（attention anchoring），安全约束埋在第七段等于没有
- **稳定 vs 可变分离**——稳定部分（role / 硬约束 / 行为风格）短而紧，可变部分（参考资料 / 示例 / 上下文）动态注入
- **禁忌配正面替代**——LLM 对否定指令系统性表现更差（Truong et al. 2023，降 20-40 分），"不要编辑 vendor/" 要配 "vendor/ 的修改走 PR review 流程"
- **约束作为可组合规则集**——核心 prompt 不变，约束按部署上下文动态注入（constraint injection pattern：scope + priority + content，运行时 resolver 合并）
- **输出契约显式**——格式、长度、schema、要省略什么，都写清楚。被代码消费的输出要求 JSON against schema

**不该做什么**：
- 不要写长 preamble 再放关键指令——注意力衰减，关键约束掉进 attention shadow
- 不要用 "be careful" 这种模糊约束——写成 concrete checkable rules："never run a statement that writes; refuse and explain"
- 不要把 role 和 task 混在一起——role 定义"我是谁"，task 定义"现在做什么"
- 不要假设 LLM 能从 context 推断 role 边界——role 边界要显式声明，否则 prompt injection 能越权

**参考实践**：
- **buecking/incontext — Role-Task-Constraints** — 系统提示词三层结构 + 禁忌配正面替代 + negation 性能下降证据。https://github.com/buecking/incontext/blob/main/docs/patterns/role-task-constraints.md
- **contextpatterns.com — System Prompt Engineering** — Pyramid pattern（关键内容放最前）+ attention anchoring + 稳定/可变分离。https://contextpatterns.com/guides/system-prompt-engineering/
- **llmbestpractices — System Prompt Design Patterns** — 命名块结构（role/capabilities/constraints/output/examples）+ 约束作为 explicit rules + 输出契约。https://llmbestpractices.com/prompt-engineering/system-prompt-design-patterns
- **context-engineering-handbook — Constraint Injection** — 约束作为可组合规则集，运行时按部署上下文动态注入。https://github.com/ypollak2/context-engineering-handbook/blob/main/patterns/construction/constraint-injection.md
- **LessWrong — "A Theory of Prompt Injection"** — role 边界失败机制 + role probes（CoTness / Userness）。https://www.lesswrong.com/posts/d8xDGzCEYE639qqEv/

**搜索起点**：
- "system prompt design patterns role task constraints"
- "prompt engineering constraint injection dynamic"
- "LLM negation performance drop negated instructions"
- "prompt injection role boundary"

---

### 5. 验证哲学
**职责**：怎么信、怎么验、自动化 vs 人类、验证维度设计、信任校准

**该做什么**：
- **验证嵌入执行循环，别做事后评估**——TrustBench：在 agent formulates action 之后、execution 之前做信任验证（pre-execution gate），事后打分来不及阻止错误
- **信任分级 + capability gate**——skill manifest 带显式 verification level，HITL 只对 unverified 触发，verified 的自动放行（否则 HITL 退化为 rubber-stamping）
- **双信号信任评分**——agent stated confidence（经 calibration curve 映射）+ 无 ground-truth 可计算的 metrics 子集，sub-200ms 出结果
- **多维验证**——不只看功能正确性：correctness / informativeness / consistency（TrustBench）；reliability / grounding / attribution / policy-alignment（AEMA 统一框架）
- **HITL 模式选择**：
  - Workflow approval（durable，多步骤，可等数天）——用于合规/安全/高质量审查
  - MCP elicitation（结构化用户输入）——用于工具执行中需要额外信息
- **不可逆操作必须人类确认**——payments / deletions / external communications（Cloudflare HITL patterns）

**不该做什么**：
- 不要用 ROUGE 等 ground-truth overlap 指标评估 agent 推理质量——agentic task 没有确定性 reference（TrustBench 指出）
- 不要让 HITL 对每个调用都触发——operationally untenable，degrades into rubber-stamping
- 不要只做事后评估——reactive assessment 无法阻止执行中的错误
- 不要混淆 capability 和 trustworthiness——能力强的不一定可靠

**参考实践**：
- **TrustBench (arXiv 2603.09157)** — 实时信任验证，pre-execution gate，双信号 sub-200ms 评分，dual-mode（benchmark + toolkit）。https://arxiv.org/abs/2603.09157v1
- **Skills as Verifiable Artifacts (arXiv 2605.00424)** — trust schema + verification level + capability gate + biconditional correctness criterion。https://arxiv.org/html/2605.00424v1
- **AEMA (arXiv 2601.11903)** — 多 agent 可验证评估框架，process-aware + auditable + human oversight。https://arxiv.org/pdf/2601.11903
- **Unified Evaluation & Governance Framework** — ARS/RGC/ACR/PAAS 四指标 + 多层验证 + 治理审计层，hallucination -88%。https://doi.org/10.36227/techrxiv.176799772.28164151/v1
- **Cloudflare Agents — Human-in-the-loop patterns** — Workflow approval vs MCP elicitation + timeout + audit trail。https://developers.cloudflare.com/agents/concepts/human-in-the-loop/

**搜索起点**：
- "AI agent verification trust benchmark"
- "human-in-the-loop pattern agent approval"
- "pre-execution verification agent safety"
- "multi-dimensional agent evaluation"

---

### 6. 失败与恢复
**职责**：崩溃恢复、状态一致性、回滚策略、降级方案、幂等性、熔断

**该做什么**：
- **每个副作用操作当事务边界**——record intent before execution → execute with idempotency wrapper → record durable receipt after success（Zylos Research）
- **checkpoint + idempotent step 是恢复的基础**——checkpoint 让你从最后完成点恢复，idempotent 让你重试不产生重复副作用（AWS Well-Architected Agentic AI Lens）
- **两种恢复方案选一种**：
  - Deterministic replay（Temporal/Inngest 模式）：state = inputs + side-effect log，重放时跳过已 log 的副作用
  - Checkpoint snapshot（LangGraph Cloud 模式）：周期性序列化 plan / working memory / partial outputs / pending tool calls
- **idempotency key 传给每个副作用目标**——没有 idempotency key 的工具不能安全 resume（crash-between-effect-and-log 会产生重复）
- **circuit breaker 防级联失败**——外部 API 连续失败 N 次后临时停止调用，避免浪费 latency 和 token（MightyBot）
- **checkpoint 有 TTL + 显式清理**——不完成的 workflow 最终 aged out，完成的立即回收空间
- **恢复后验证副作用是否真的完成了**——不要假设，查 idempotency key、查 API 状态

**不该做什么**：
- 不要假设 agent 不会崩——长任务一定会崩，问题是什么时候
- 不要用 session memory 当 durable execution——chat history 不能证明哪个 shell 命令跑了、哪封邮件发了（Zylos Research）
- 不要把恢复范围设得太大——"整个 pipeline 从头跑"浪费 token 和时间，scope 到最小可能单元
- 不要在 interrupt 边界前放 mutating 操作——LangGraph 的 interrupt 后 code 可能重跑，approval boundary 要放对位置
- 不要忽略 drifted external state——恢复后外部状态可能变了，要验证

**参考实践**：
- **Agent Resumption Pattern** — deterministic replay vs checkpoint snapshot + idempotency key。https://github.com/agentpatternscatalog/patterns/blob/main/patterns/agent-resumption.md
- **AWS Well-Architected Agentic AI Lens — AGENTREL03-BP03** — checkpoint + idempotent step + TTL lifecycle。https://docs.aws.amazon.com/wellarchitected/latest/agentic-ai-lens/agentrel03-bp03.html
- **MightyBot — Fault-Tolerant AI Agent Pipelines** — idempotency / checkpoint / state machine / circuit breaker / dead letter queue。https://mightybot.ai/blog/fault-tolerant-ai-agent-pipelines/
- **Zylos Research — Durable Execution for AI Agent Runtimes** — execution journal + idempotent tool boundaries + versioned prompts + durable human approvals + recovery tests。https://zylos.ai/research/2026-04-24-durable-execution-agent-runtimes/
- **LangGraph Persistence** — checkpointer 每 superstep 存 graph state，支持 memory / fault recovery / time travel / HITL。https://github.com/langchain-ai/langgraph

**搜索起点**：
- "agent failure recovery checkpoint pattern"
- "durable execution AI agent runtime"
- "idempotent agent operations side effect"
- "circuit breaker pattern agent pipeline"

---

## 搜索时的关键提醒

1. Agent 系统是实践驱动领域——知识在工程博客、开源项目、会议演讲里，传统学术论文里反而少。不过 arXiv 上 2025-2026 年的 agent 专项论文开始多了，值得关注
2. 看真实系统的架构文档——LangChain / AutoGPT / CrewAI / OpenAI Agents SDK / Microsoft Multi-Agent Reference Architecture 的 README 和 design docs
3. 关注失败案例——Agent 系统的哲学往往从"它怎么失败了"中提炼。issue tracker 和 postmortem 是金矿
4. 区分 hype 和 practice——很多 Agent 框架的博客是营销文案，看代码和 issue tracker 才是真实状态
5. 2025-2026 年的关键趋势：
   - MCP 成为工具调用标准
   - 主动上下文压缩取代被动保留
   - pre-execution 验证取代事后评估
   - durable execution + idempotency 成为生产级 agent 的硬要求
   - constraint injection 取代静态 system prompt
