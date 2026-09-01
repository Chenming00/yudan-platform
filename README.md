# 鱼蛋家庭平台

一个以家庭账本为主线的多模块应用，统一管理儿童保健、衣柜、消耗品和其他开支。

## 当前状态

当前分支完成 A00/A01 基础阶段：架构契约、Next.js App Router 工程、shadcn/ui 设计系统、模块入口、测试与 CI。业务数据库、邮箱密码登录、邀请码、权限和历史数据迁移按 `开发任务计划.md` 的 Gate 顺序继续实现。

## 技术架构

- Next.js 16 + React 19 + TypeScript；
- shadcn/ui + Radix UI + Tailwind CSS；
- Supabase PostgreSQL 与 Supabase Auth（邮箱密码为主，GitHub 可选）；
- Vercel 部署主应用；
- Cloudflare R2 保存图片和附件。

## 本地运行

1. 复制 `.env.example` 为 `.env.local`，按需填写本地环境变量；
2. 安装依赖：`npm install`；
3. 启动：`npm run dev`；
4. 打开 `http://localhost:3000`。

工程骨架在没有外部服务密钥时也可以构建；涉及认证、数据库和资源的功能在对应 Agent 实现后才会启用。

## 质量检查

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

端到端测试使用 `npm run test:e2e`，首次运行前需要安装 Playwright 浏览器。

## 文档入口

- `计划.md`：完整产品与架构规划；
- `开发任务计划.md`：多 Agent 分工、依赖与 Gate；
- `docs/adr/`：架构决策；
- `docs/contracts/`：公共接口与认证契约；
- `docs/deployment/platform.md`：Supabase、Vercel 与 Cloudflare 部署基线。
