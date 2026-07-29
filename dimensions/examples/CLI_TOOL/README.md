# 参考案例：CLI 工具

> 这份文件提供搜索起点和好实践样本。Weaver 只在相关 Doctrine 问题中使用，
> 拆解出的部分和这里不同时，以 Weaver 的拆解为准。

---

## CLI 工具通常拆解出的实现部分

### 1. CLI 交互设计
**职责**：参数解析、--help、--version、用法提示、子命令组织

**该做什么**：
- 支持 `-h`/`--help` 和 `-V`/`--version`，这是 POSIX/GNU 强制要求（GNU Coding Standards §4.8）
- 无参数运行时显示简洁帮助（clig.dev 原则：描述 + 1-2 个示例 + 常用 flag + 提示 `--help` 看更多）
- `--help` 显示完整帮助：所有 flag、示例、链接到 web 文档
- flag 用 dash-case（`--long-option`），短 flag 用单字母（`-h`），不要发明新语法
- 输入文件用位置参数，输出文件用 `-o`/`--output`（GNU 约定）
- `--` 表示参数结束，后续都当文件名（POSIX Guideline 10）
- `-` 表示 stdin/stdout（POSIX Guideline 13）

**不该做什么**：
- 不要把 `--help` 当文件名处理（md2html 的真实 bug）
- 不要用 camelCase 或 snake_case 命名 flag
- 不要让 flag 顺序影响结果（除非显式声明互斥）
- 不要重载 `-h` 做别的事

**参考实践**：
- **clig.dev** — Command Line Interface Guidelines，社区维护的 CLI 设计规范，覆盖 help/arguments/errors/output/documentation 全维度。https://clig.dev/
- **POSIX Utility Conventions** — Guideline 1-13，CLI 参数语法的学术根基。https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap12.html
- **GNU Coding Standards §4.8** — `--version`/`--help` 强制要求 + long-option 约定。https://www.gnu.org/prep/standards/html_node/Command_002dLine-Interfaces.html
- **clap (Rust)** / **cobra (Go)** / **commander.js** — 主流参数解析库，看它们的默认 help 输出格式
- **ripgrep --help** / **fd --help** / **bat --help** — 现代 CLI 工具的 help 文本样本，结构清晰、示例在前

**搜索起点**：
- "POSIX utility argument syntax conventions"
- "GNU program argument syntax"
- "clap help formatting conventions"
- "CLI subcommand design patterns"

---

### 2. CLI 输出美学
**职责**：成功反馈格式、颜色策略、表格/列表排版、Rule of Silence 的正确理解

**该做什么**：
- **Rule of Silence 的正确理解**：Eric Raymond 原文是 "When a program has nothing surprising to say, say nothing"——意思是"没意外时别废话"，不是"什么都不说"。转换成功对用户是有价值的信息（文件名、大小、位置），该说就说
- 颜色策略遵循三约定（ripgrep/fd/bat 都遵守）：
  - `NO_COLOR` 环境变量设了就禁用颜色（no-color.org，被 ripgrep/fd/bat/npm/cargo/gh/docker 等采纳）
  - `--color auto`（默认）：TTY 时上色，管道时不上色
  - `--color always`/`--color never`：强制开/关
- 进度反馈：长任务显示进度条或 spinner，短任务静默
- 输出结构：文件名在前，匹配内容在后（ripgrep 格式）
- 表格输出用对齐排版，不用 ASCII art

**不该做什么**：
- 不要无脑上色——管道场景颜色码会污染下游工具
- 不要把成功信息写到 stderr（clig.dev：stdout 是数据，stderr 是消息）
- 不要输出时间戳/生成时间（破坏可预测性，违反 Unix 哲学）
- 不要在成功时输出 "Done!" 之类废话——如果用户需要确认，输出有用的信息（文件名、行数、字节数）

**参考实践**：
- **ripgrep 输出设计** — `--color auto` + TTY 检测 + `--colors TYPE:STYLE:VALUE` 细粒度控制。https://github.com/BurntSushi/ripgrep
- **bat 输出设计** — `--style` 组件化（numbers/changes/grid/header-filename 可组合），`--decorations=auto` TTY 检测。https://github.com/sharkdp/bat
- **NO_COLOR 约定** — no-color.org，一个环境变量统一禁色，被整个生态采纳。https://no-color.org/
- **Eric Raymond《The Art of Unix Programming》** — Rule of Silence 原文。https://www.catb.org/esr/writings/taoup/html/
- **clig.dev "Output" 章节** — stdout vs stderr 的语义、信噪比原则。https://clig.dev/#output

**搜索起点**：
- "Unix Rule of Silence original text"
- "CLI color output best practices NO_COLOR"
- "bat exa ripgrep output design"
- "terminal table formatting"

---

### 3. CLI 错误呈现
**职责**：错误结构、修复建议、退出码语义、上下文信息

**该做什么**：
- 错误信息三要素（Azure CLI 规范）：**What**（什么错了）+ **Why**（为什么错）+ **How**（怎么修）
- 退出码语义化（POSIX + agent-cli-guide 扩展）：
  - `0` 成功
  - `1` 一般错误
  - `2` 用法错误（POSIX 约定）
  - `3` 资源不存在 / `4` 权限拒绝 / `5` 冲突已存在（现代扩展，对 Agent 友好）
- 错误写到 stderr，数据写到 stdout（clig.dev 强制）
- 可修复的错误带 `suggested_fix`（Rust 编译器的 `Applicability` 标记：`MachineApplicable` / `MaybeIncorrect`）
- 多个同类错误归组到一个标题下，不要刷屏（clig.dev：信噪比是关键）
- 最重要的信息放最后——用户视线最后停留的位置（clig.dev）

**不该做什么**：
- 不要 dump stack trace 给用户（除非 `--verbose` 或 debug 模式）
- 不要把错误信息写得像公式或编程表达式（Azure CLI 规范）
- 不要在错误信息里加颜色或样式控制（Azure CLI：错误信息要纯文本）
- 不要用 `resource group is missing, please provide` 这种模糊说法——用 `please provide a resource group name by --resource-group`（带具体 flag）
- 不要用 exit code 1 涵盖所有错误——区分用法错误和运行时错误

**参考实践**：
- **Rust 编译器错误设计** — primary span（红）+ secondary span（蓝）+ `help:` 建议 + `Applicability` 标记。RFC 1644。https://rust-lang.github.io/rfcs/1644-default-and-expanded-rustc-errors.html
- **Elm 编译器错误** — "Compiler Errors for Humans"，教育性错误信息范本。https://elm-lang.org/blog/compiler-errors-for-humans
- **Azure CLI 错误处理规范** — What/Why/How 三要素 + actionable message。https://github.com/Azure/azure-cli/blob/dev/doc/error_handling_guidelines.md
- **jmmv.dev "CLI design: Error reporting"** — usage error vs application error 的区分。https://jmmv.dev/2013/08/cli-design-error-reporting.html
- **clig.dev "Errors" 章节** — 把错误变成文档、catch and rewrite for humans。https://clig.dev/#errors
- **agent-cli-guide Principle 6** — 语义化退出码（对 Agent 消费者友好）。https://github.com/Johnixr/agent-cli-guide
- **RFC 9457 Problem Details** — HTTP 错误结构，可移植到 CLI（zircote 博客）。https://zircote.com/blog/2026/04/cli-error-messages-are-a-dual-consumer-problem/

**搜索起点**：
- "CLI error message design best practices"
- "Rust compiler error messages design Applicability"
- "exit code conventions sysexits.h"
- "error message actionable suggested fix"

---

### 4. 转换/处理引擎（如果是转换类工具）
**职责**：核心逻辑、纯函数设计、子集 vs 全集策略、透传 vs 报错

**该做什么**：
- 核心层纯函数——`parse(input): output`，不 IO、不读全局状态、不调 `Date.now()`
- IO 只在 CLI 层，核心层可独立测试、可被其他入口复用
- 子集策略要显式声明——支持什么、不支持什么，文档里写清楚
- 不支持的语法：报错（fail loud）还是透传（pass through）？显式选择，不要意外行为

**不该做什么**：
- 不要在核心层做 IO（破坏纯函数性 + 可测试性）
- 不要用全局可变状态（破坏可预测性）
- 不要"尽量支持"——要么支持要么不支持，模糊地带是 bug 工厂

**参考实践**：
- 取决于具体领域（Markdown 解析 / JSON 处理 / 文件转换）
- "pure function design benefits"
- "subset vs superset API design"

---

### 5. 产物设计（如果产出文件）
**职责**：产物格式、自包含性、可预测性

**该做什么**：
- 产物自包含——不依赖外部 CSS/JS/字体（离线可用、可邮件发送、可存档）
- 输出可预测——相同输入永远相同输出（byte-identical），不嵌时间戳、不嵌随机 ID
- 产物格式稳定——格式是和用户的契约，不能随意变

**不该做什么**：
- 不要在产物里嵌生成时间/版本号（破坏 diff、破坏可复现）
- 不要引用外部资源（CDN CSS、Google Fonts）——产物离线就坏
- 不要输出"漂亮但不可预测"的产物——可预测 > 漂亮

**参考实践**：
- "self-contained output design"
- "deterministic output reproducible builds"
- Reproducible Builds 项目哲学。https://reproducible-builds.org/

---

## 搜索时的关键提醒

1. 实践领域的知识在工具和标准里，搜 "best practices" / "design conventions" / 具体工具名，别只搜"哲学"
2. 看真实工具的输出——`rg --help` / `fd --help` / `bat --help` 本身就是好实践的样本
3. 读标准文档——POSIX / GNU Coding Standards 是 CLI 设计的根基
4. 对比不同工具的做法——ripgrep vs grep、bat vs cat、fd vs find，差异里藏着设计决策
5. 2026 年的新维度：CLI for Agents。CLI 的消费者现在还有 Agent，结构化输出（`--output json`）、语义化退出码、`schema` 命令正在成为新标准（clispec.dev、agent-cli-guide）
