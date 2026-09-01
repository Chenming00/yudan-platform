# Supabase + Vercel + Cloudflare 部署基线

## 服务分工

| 服务 | 职责 |
|---|---|
| Vercel | Next.js 页面、Server Actions、Route Handlers、Preview 与生产发布 |
| Supabase | PostgreSQL、GitHub Auth、会话与 RLS 纵深防御 |
| Cloudflare | R2 图片/附件存储与 CDN 分发 |

## 数据库连接

- `DATABASE_URL`：Vercel 运行时使用 Supavisor transaction mode（通常为 6543），适合短生命周期 Serverless 连接；
- `DIRECT_URL`：Migration、`pg_dump`、恢复和管理任务使用 Supabase direct connection；
- transaction mode 不支持 prepared statements，Prisma 连接参数必须按当前 Prisma 与 Supabase 官方指南配置；
- Migration 不在应用请求或每次冷启动中执行；
- Preview 与 Production 使用独立环境变量，生产数据库不得暴露给未受信任的 Preview 分支。

## Vercel Git 工作流

```text
功能分支 push
  → GitHub PR
  → Vercel Preview
  → lint / typecheck / test / build
  → Preview E2E
  → 合并 main
  → Production Deployment
```

数据库变更使用两阶段发布：先运行向后兼容 Migration 并验证，再提升已验证的应用构建。出现应用问题时回滚 Vercel Deployment；数据库变更使用预先写好的兼容或回退步骤，不能假定应用回滚会自动回滚数据库。

## 环境变量范围

浏览器可见：

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

仅服务端：

- `SUPABASE_SECRET_KEY`
- `DATABASE_URL`
- `DIRECT_URL`
- `SUPER_ADMIN_EMAIL`
- 所有 R2 凭据与 Bucket 名称

Vercel、Supabase、GitHub 和 Cloudflare 的真实密钥只配置在服务控制台；`.env.example` 只保存变量名和非敏感本地默认值。

## OAuth 地址

需要同时配置：

- GitHub OAuth App → Supabase Auth callback；
- Supabase Site URL → 正式 Vercel 域名；
- Supabase Redirect URLs → 本地、受信任 Preview 模式和正式 `/auth/callback`；
- 禁止接受任意 `next` 或 redirect host，应用回调只允许同源相对路径。

## 发布前检查

- Supabase Migration 与数据库安全检查通过；
- public schema 中可由 Data API 访问的表均启用正确 RLS；
- GitHub 登录、邀请码注册、已注册用户再次登录均通过；
- Preview 环境不能访问生产 Secret；
- 私有 R2 对象匿名访问失败；
- 生产构建、回滚和数据库恢复流程已演练。

