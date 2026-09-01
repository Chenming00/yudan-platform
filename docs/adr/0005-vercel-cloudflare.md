# ADR-005：Vercel 运行应用，Cloudflare 承载资源

- 状态：已接受
- 日期：2026-09-01

## 决策

第一版 Next.js 主应用部署到 Vercel；认证和数据库使用 Supabase；图片与附件使用 Cloudflare R2/CDN。

Vercel 提供 Next.js App Router、Server Actions、Route Handlers 和 Preview Deployment 的直接运行环境。Cloudflare 专注资源上传与分发，避免大文件经过 Vercel 函数转发。

## 可迁移性

- 业务逻辑不调用 Vercel 专有 API；
- 数据访问集中在 Repository；
- 文件存储经 `MediaStorage` 抽象；
- 环境配置集中读取；
- 关键流程由端到端测试覆盖。

只有在成本、延迟或 Cloudflare 原生能力形成明确收益，并且 Next.js、Prisma、OAuth、R2 与测试均通过 Workers 预发布验证后，才评估迁移完整应用。

