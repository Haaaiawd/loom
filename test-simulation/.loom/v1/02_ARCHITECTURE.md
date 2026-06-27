# MiniTodo — Architecture

> 系统结构设计。基于 ENGINEERING_CREED + DECISION_RUBRIC。

<!--
  本文件由 Architect 产出。
  基于 01_VISION.md 的意图设计系统结构。
-->

---

## System Boundary

MiniTodo 是一个单体应用，前后端一体。不拆微服务——项目规模不需要，过度拆分违反 ENGINEERING_CREED 的"禁止过度抽象"。

```
MiniTodo/
├── src/
│   ├── auth/          — 认证模块（INT-001）
│   ├── todo/          — 待办 CRUD 模块（INT-002, INT-003）
│   ├── storage/       — 持久化层
│   └── ui/            — UI 渲染层
├── config/            — 配置文件（B2: 配置与代码分离）
└── .loom/             — LOOM 文档（只读，Forge 不可改）
```

---

## Module Responsibilities

| 模块 | 职责 | 依赖 |
|---|---|---|
| auth | 用户注册、登录、会话管理 | storage |
| todo | 待办的创建、查询、完成 | storage, auth |
| storage | 数据持久化（本地文件/SQLite） | - |
| ui | 渲染列表、输入框、状态反馈 | todo, auth |

---

## Tech Stack Decision

- **运行时**：Node.js（CLI 应用 + 本地 HTTP 服务）
- **存储**：本地 JSON 文件（小规模够用，不需要数据库）
- **认证**：用户名+密码，bcrypt 哈希，JWT 会话

理由：最小依赖原则（ENGINEERING_CREED#decision-principles）。不引入数据库、不引入框架，用标准库 + 最少依赖。

---

## Interface Contracts

### Auth API
- `POST /register` — `{ username, password }` → `{ token }` | `{ error }`
- `POST /login` — `{ username, password }` → `{ token }` | `{ error }`
- `GET /me` — `Authorization: Bearer <token>` → `{ username }` | `{ error }`

### Todo API
- `POST /todos` — `{ content }` + Auth → `{ id, content, created_at, completed }`
- `GET /todos` — Auth → `[{ id, content, created_at, completed }]`
- `PATCH /todos/:id` — `{ completed }` + Auth → `{ id, content, created_at, completed }`

---

## Intent Map Overview

3 个 Intent，DAG 结构：

```
INT-001 (认证) ←── INT-002 (创建待办)
              ←── INT-003 (列表展示)
```

INT-002 和 INT-003 都依赖 INT-001（需要认证才能操作待办）。
INT-002 和 INT-003 之间无依赖（可并行，但验证仍逐个进行）。

详细 Intent Map 见 04_INTENT_MAP.json，验证契约见 05_VERIFICATION.md。
