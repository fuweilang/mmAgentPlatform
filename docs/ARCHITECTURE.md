# 猛犸智能体 · 架构决策（v0.3）

> 换模型先读本文件 + 根目录 `AGENTS.md`。改决策只改这里，不要回放聊天。

## 一句话

企业产品 = **云上 Octop（运行时）+ 浏览器**。中台（NestJS + Vue3）管登录/租户/成员；Octop 只跑 Agent。文件上传下载。本机读写客户磁盘不做。

## 已拍板

| 项 | 决策 |
|---|---|
| 给谁用 | 企业客户（财务/法律），不是猛犸内部运营后台 |
| 中台 | NestJS + Prisma → PG `mammoth_core`；Vue3 + Element Plus |
| 向量 | 中台 pgvector；不用 MySQL 做向量 |
| 用户 | 中台 IdP（手机号 Cookie `mammothai_access_token`） |
| 登录 URL | **`/login`**（`apps/frontend` 路由）。不是 `/middle/login`、不是 `/agent/login` |
| SSO | 登一次：中台 Cookie + Octop OIDC 换 JWT。退出两边都清 |
| 默认首页 | `/agent/chat`。中台从智能体里点进去 |
| 知识库 | 只放中台（下一轮）。关掉 Octop 自带 KB |
| 租户 | 一企业多 Agent；共享一个 Octop 实例；用 `tenant_id` 逻辑隔离 |
| PeecAI | 不迁 MySQL；身份单向同步（未做） |
| 交付 | 云 Octop + 浏览器。客户不装 Octop |
| 客户本机磁盘 | 不做 |
| 仓库 | 根目录新 git；`Octop/` gitignore 上游；`coze-studio/` 无关 |

## 本地 5 个 Tab（不要 `pnpm dev` 一把跑）

浏览器只开 **http://\<host\>:5201**

| 命令 | 端口 | 作用 |
|---|---|---|
| `pnpm dev:api` | 3100 | 中台 Nest |
| `pnpm dev:web` | 5202 | Vue（`/login` + `/middle`） |
| `pnpm dev:gateway` | **5201** | 统一入口 |
| `pnpm dev:octop` | 8088 | Octop 后端 |
| `pnpm dev:agent` | 5203 | Octop dashboard |

网关：`/login` `/middle` → 5202；`/middle/api` → 3100；`/agent` → 5203；`/api` → 8088。`/` → `/agent/chat`。`/middle/login` → `/login`。

## 目录

```
agentPlatform/
├── apps/backend/     NestJS
├── apps/frontend/    Vue3：/login 登录，/middle 中台
├── packages/shared/
├── infra/            docker-compose PG
├── Octop/            上游，白标猛犸AI；别大改结构
├── scripts/dev-gateway.mjs
└── docs/ARCHITECTURE.md
```

## 库

同一 PG 实例、不同 database：`mammoth_core`（Prisma）/ Octop 自带库。禁止跨库 JOIN。

Octop SQLite 的 `users` / `user_role` / `user_sso_identities` = 运行时影子用户（OIDC 映射），**不是产品账号**。产品账号只在中台。

## 中台表

已建：`user` / `tenant` / `org_tree` / `org_member` / `audit_log`

未建：`agent_ref`、`kb*`、`conversation`/`message`、`usage_event`、`quota`

## 明确不做（v0）

改造 Octop 前端当产品壳；给 Octop 加 `tenant_id`；PeecAI 迁 PG；N 个 Octop 容器；中台回写 PeecAI；客户端原生读写客户盘；云 Agent 遥控客户电脑；换成 Hermes/Pi/Codex 形态。

## 当前进度

- 登录 + 租户 + 成员可用
- 统一 `/login` + Cookie SSO（刚接上，需 5 Tab 一起开着验）
- Agent 刷新 loading 已改蓝圈、无 Octop logo
- KB / 对话落中台 / 企微：未做

## 还没拍（v0 不做）

代理商能否用 Agent；引用高亮；小程序审核；独立实例；PeecAI 先同步哪几张表。
