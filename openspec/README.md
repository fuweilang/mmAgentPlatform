# OpenSpec（本地交接）

给新开的 AI 窗口用，不是完整 PRD。

## 新窗口先读

1. `docs/ARCHITECTURE.md`
2. `AGENTS.md`
3. `openspec/changes/platform-admin-console/`（当前要做：猛犸总后台 `/admin`）
4. `openspec/changes/agent-runtime-ux-hardening/`（已落地交接；控制台 IA 见其中 `specs/enterprise-console/`）

## 约定

- 改完功能：在对应 change 的 `tasks.md` 打勾，必要时补 `specs/`。
- 新开一条大功能：新建 `openspec/changes/<name>/`（proposal + tasks + specs）。
- 不要回放旧聊天；以本目录 + 代码为准。
