# 参考案例：CLI 工具

> **这不是预设维度清单——是参考案例。**
> Weaver 按 PART_DECOMPOSITION.md 自行拆解，本文件提供搜索起点。
> 如果拆解出的部分和这里不同，以 Weaver 的拆解为准。

---

## CLI 工具通常拆解出的实现部分

### CLI 交互设计
- **职责**：参数解析、--help、--version、用法提示、子命令组织
- **搜索起点**：
  - "POSIX utility argument syntax conventions" — POSIX 标准
  - "GNU program argument syntax" — GNU Coding Standards
  - clap (Rust) / cobra (Go) / commander.js 的设计文档
  - ripgrep / fd / bat 的 --help 输出（看真实工具怎么做）
  - "CLI subcommand design patterns"

### CLI 输出美学
- **职责**：成功反馈格式、颜色策略、表格/列表排版、Rule of Silence 的正确理解
- **搜索起点**：
  - "Unix Rule of Silence original text" — Eric Raymond TAoUP
  - "CLI color output best practices" — 什么时候用颜色、什么时候不用
  - bat / exa / delta 的输出设计（现代 CLI 美学范本）
  - "terminal table formatting libraries" — cli-table3, prettytable
  - "no color movement" — NO_COLOR 环境变量约定

### CLI 错误呈现
- **职责**：错误结构、修复建议、退出码语义、上下文信息
- **搜索起点**：
  - "CLI error message design best practices"
  - Rust 编译器错误信息设计 — "Rust compiler error messages design"
  - Elm 编译器错误信息 — "Elm compiler error messages"
  - "exit code conventions" — BSD sysexits.h, Linux exit codes
  - "error message actionable" — 错误信息要带修复建议

### 转换/处理引擎（如果是转换类工具）
- **职责**：核心逻辑、纯函数设计、子集 vs 全集策略
- **搜索起点**：
  - 取决于具体领域（Markdown 解析 / JSON 处理 / 文件转换）
  - "pure function design benefits"
  - "subset vs superset API design"

### 产物设计（如果产出文件）
- **职责**：产物格式、自包含性、可预测性
- **搜索起点**：
  - "self-contained output design"
  - "deterministic output" — 可预测输出的重要性
  - "reproducible builds philosophy" — 可复现构建哲学

---

## 搜索时的关键提醒

1. **不要只搜"哲学"**——实践领域的知识在工具和标准里，搜 "best practices" / "design conventions" / 具体工具名
2. **看真实工具的输出**——`rg --help` / `fd --help` / `bat --help` 本身就是好实践的样本
3. **读标准文档**——POSIX / GNU Coding Standards 是 CLI 设计的学术根基
4. **对比不同工具的做法**——ripgrep vs grep、bat vs cat、fd vs find，差异里藏着设计决策
