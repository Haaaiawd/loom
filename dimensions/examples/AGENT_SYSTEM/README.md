# 参考案例：Agent 系统

> **这不是预设维度清单——是参考案例。**
> Weaver 按 PART_DECOMPOSITION.md 自行拆解，本文件提供搜索起点。
> 如果拆解出的部分和这里不同，以 Weaver 的拆解为准。

---

## Agent 系统通常拆解出的实现部分

### 系统架构
- **职责**：编排 vs 控制、进程边界、IPC 机制、状态管理
- **搜索起点**：
  - "agent orchestration architecture" — LangChain / AutoGPT / CrewAI / Devin 架构
  - "agent system design patterns" — planner / executor / critic 模式
  - "multi-agent coordination" — 多 Agent 协作的通信协议
  - "event-driven agent architecture"
  - ROS (Robot Operating System) 的架构哲学——Agent 系统的先驱

### 工具调用哲学
- **职责**：委托边界、失控收回、工具描述怎么写、工具选择策略
- **搜索起点**：
  - "OpenAI function calling design" — function calling 的原始设计
  - "MCP Model Context Protocol" — Anthropic 的工具协议
  - "tool description writing best practices"
  - "agent tool selection strategy"
  - "when not to give agent a tool" — 委托边界

### 上下文管理
- **职责**：上下文窗口管理、压缩策略、记忆持久化、信息保留优先级
- **搜索起点**：
  - "LLM context window management"
  - "conversation summarization strategies"
  - "agent memory architecture" — 短期 / 长期 / 工作记忆
  - "what to keep what to compress" — 信息保留优先级
  - "retrieval augmented generation design" — RAG 作为上下文管理

### 提示词工程
- **职责**：角色激活、约束注入、系统提示词结构、上下文组装
- **搜索起点**：
  - "system prompt design philosophy"
  - "role activation prompt engineering"
  - "constraint injection techniques"
  - "prompt template design patterns"
  - "chain of thought vs direct answer" — 推理策略选择

### 验证哲学
- **职责**：怎么信、怎么验、自动化 vs 人类、验证维度设计
- **搜索起点**：
  - "AI agent verification methods"
  - "human-in-the-loop design" — 什么时候需要人类
  - "automated verification vs manual review"
  - "trust but verify agent outputs"
  - "multi-dimensional verification" — 不只看功能，看意图忠实度

### 失败与恢复
- **职责**：崩溃恢复、状态一致性、回滚策略、降级方案
- **搜索起点**：
  - "agent failure recovery patterns"
  - "state checkpoint design"
  - "graceful degradation agent"
  - "idempotent agent operations" — 幂等性设计
  - "circuit breaker pattern" — 熔断机制

---

## 搜索时的关键提醒

1. **Agent 系统是实践驱动领域**——知识在工程博客、开源项目、会议演讲里，不在学术论文里
2. **看真实系统的架构文档**——LangChain / AutoGPT / CrewAI 的 README 和 design docs
3. **关注失败案例**——Agent 系统的哲学往往从"它怎么失败了"中提炼
4. **区分 hype 和 practice**——很多 Agent 框架的博客是营销文案，看代码和 issue tracker 才是真实状态
