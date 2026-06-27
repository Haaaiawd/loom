# INT-001 Implementation Summary

> Forge 实现摘要（模拟）。实际代码未写，此文件记录实现决策。

## 实现内容

- `src/auth/register.js` — 用户注册，bcrypt 哈希密码
- `src/auth/login.js` — 用户登录，验证后签发 JWT
- `src/auth/session.js` — 会话管理，JWT 验证中间件
- `src/storage/users.js` — 用户数据持久化到本地 JSON

## 关键决策

- 密码使用 bcrypt 哈希，不存明文（B2: 禁止硬编码 + 安全）
- JWT secret 从环境变量读取（B2: 配置与代码分离）
- 用户数据存储在 `data/users.json`（本地持久化）

## 接口契约

- `POST /register` → `{ username, password }` → `{ token }` | `{ error: "用户名已存在" }`
- `POST /login` → `{ username, password }` → `{ token }` | `{ error: "凭证错误" }`
- `GET /me` → `Authorization: Bearer <token>` → `{ username }` | `{ error: "未认证" }`
