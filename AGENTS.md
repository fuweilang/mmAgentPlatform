# agentPlatform

猛犸智能体产品线在本目录。**换模型先读 `docs/ARCHITECTURE.md`，再读本文件，进行中的改动读 `openspec/`。不要回放旧聊天。**

说话用中文、简短；引用代码用 `path:line`。不擅自 commit/push、不扩大范围。

## 产品 vs 上游

| 路径 | 角色 |
|---|---|
| `apps/` `packages/` `infra/` `scripts/` | **猛犸中台**（NestJS + Vue3 + gateway） |
| `Octop/` | 上游运行时，白标「猛犸AI」。只改必要 UI/SSO 胶水 |
| `coze-studio/` | 无关，别往里写中台代码 |
| PeecAI（`Documents/code/PeecAI`） | 独立仓库，不迁库 |

Octop 细则：`Octop/AGENTS.md`、`docs/CODE-MAP-octop.md`。冲突以代码为准。

## 怎么跑

网页：浏览器只开 **http://127.0.0.1:5201**。客户端：`pnpm dev:desktop`（须网关和 Octop 已起）。

```
pnpm dev:api        # :3100 中台 API
pnpm dev:web        # :5202 Vue
pnpm dev:gateway    # :5201 入口
pnpm dev:octop      # :8088 Octop
pnpm dev:agent      # :5203 Octop dashboard
pnpm dev:desktop    # 猛犸智能体
```

| URL | 含义 |
|---|---|
| `/login` | 统一登录 |
| `/agent/chat` | 智能体（默认首页） |
| `/console/` | 企业控制台（旧 `/middle/` 会跳过来） |

改网关或 Vite 后必须重启对应 Tab。不要用 `pnpm dev` 一把起（不好看报错）。

## 改代码落点

- 登录/租户/成员：`apps/backend` `apps/frontend`
- 网关路由/端口：`scripts/dev-gateway.mjs`、`package.json` 的 `dev:*`
- Agent 白标文案：**只改 i18n value**，尽量不改 key。`dashboard/src/locales/{en,zh}.json`
- 禁止手改 `Octop/src/octop/dashboard/`（构建产物）
- Octop 测试：`uv run pytest`；commit 会跑 `make all`（若装了 hooks）

## Octop 本地定制（勿 revert）

品牌 Octop→猛犸AI、SSO 跳 `/login`、boot 蓝圈无 logo、侧栏「和ai对话」。  
i18n：有的 key 已叫 `common.copyErrorFor猛犸AI` 等，`t()` 必须对得上，否则露裸 key。

## 硬约束

- 上游不 force push、不改 CI/发布
- 定制小 diff，方便 rebase
- 检索/会话必须带 `tenant_id`（KB 做的时候）
- 客户本机文件：只通过客户端工作区；首次写盘说清范围，禁止默认扫全盘
