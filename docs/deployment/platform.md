# Supabase + Vercel + Cloudflare 部署基线

## 服务分工

| 服务 | 职责 |
|---|---|
| Vercel | Next.js 页面、Server Actions、Route Handlers、Preview 与生产发布 |
| Supabase | PostgreSQL、邮箱密码 Auth、可选 GitHub Identity、会话与 RLS |
| Cloudflare | R2 图片/附件存储与 CDN 分发 |

生产主站为 `https://cyz.ykn.cm`；公开 R2 资源域名为 `https://cf-cyz.ykn.cm`。所有 HTTP 请求应重定向到 HTTPS。

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

仓库提供两个互相独立的人工工作流：`Database migration` 负责受保护的数据库环境，`Verify and promote deployment` 负责 Preview E2E 和同一构建产物 Promote。详细操作见 `docs/runbooks/release.md`。

截至 2026-09-01，Vercel 中仍只有两个旧项目，尚未创建 `yudan-platform`。目标项目创建后再绑定 `cyz.ykn.cm`；在目标 Schema、环境变量和 Preview 验证通过前，不切换生产域名。

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

环境隔离标记 `DEPLOYMENT_DATABASE_SCOPE`、`R2_ENVIRONMENT_SCOPE` 和生产项目标识 `PRODUCTION_SUPABASE_PROJECT_REF` 不属于 Secret，但必须按 Preview / Production 分别配置。`npm run deployment:check` 会拒绝 Preview 连接生产 Supabase 或生产 R2 Bucket。

生产非敏感值固定为：

```text
NEXT_PUBLIC_APP_URL=https://cyz.ykn.cm
R2_PRIVATE_BUCKET=cyz-private
R2_PUBLIC_BUCKET=cyz-public
R2_PUBLIC_BASE_URL=https://cf-cyz.ykn.cm
```

Vercel、Supabase、可选 GitHub Provider 和 Cloudflare 的真实密钥只配置在服务控制台；`.env.example` 只保存变量名和非敏感本地默认值。

## Auth 地址与邮件

邮箱密码注册需要配置：

- Supabase Site URL → 正式 Vercel 域名；
- Redirect URLs → 本地、受信任 Preview 和正式的确认邮箱、找回密码回调；
- 生产环境 Custom SMTP、发件域名与邮件速率限制；
- Before User Created Hook → 数据库邀请码校验函数。

应用端认证配置与 `yudan-wupin` 上线顺序详见 `docs/auth/README.md`。数据库 Migration 和 Hook 尚未经过备份 Gate 前，不得直接应用到目标生产项目。

仅在启用可选 GitHub Identity 时额外配置：

- GitHub OAuth App → Supabase Auth callback；
- Supabase Redirect URLs → 对应环境的 `/auth/callback`；
- 禁止接受任意 `next` 或 redirect host，应用回调只允许同源相对路径。

## 发布前检查

- Supabase Migration 与数据库安全检查通过；
- public schema 中可由 Data API 访问的表均启用正确 RLS；
- 邮箱密码邀请码注册、邮箱确认、登录和找回密码均通过；
- 无 RegistrationIntent 的直接 Supabase signup 被 Hook 拒绝；
- 如果启用 GitHub，可选绑定与解绑测试通过；
- Preview 环境不能访问生产 Secret；
- 私有 R2 对象匿名访问失败；
- 生产构建、回滚和数据库恢复流程已演练。
