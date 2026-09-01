# 认证、邀请码与权限运行手册

## 已实现能力

- Supabase SSR Cookie 会话与 Next.js 16 `proxy.ts` 刷新；
- 邮箱密码登录、退出、邀请码注册、邮箱确认、找回与更新密码；
- GitHub 已绑定账号登录，以及登录后可选的 GitHub Identity 绑定；
- 邀请码只保存 SHA-256 哈希，RegistrationIntent 十分钟有效且一次性使用；
- 数据库 Before User Created Hook 阻止绕过应用的公开 signup；
- `william.chen@utah.edu` 使用 Supabase 已验证邮箱做幂等 `SUPER_ADMIN` 引导；
- `SUPER_ADMIN`、`OWNER`、`EDITOR`、`VIEWER` 服务端 RBAC；
- `household_id` 数据范围、短时权限缓存与角色变化主动失效；
- 邀请创建/撤销、成员角色、成员状态、平台账号停用与审计；
- API Key secret 常量时间校验、家庭范围和 scope 校验。

## 必需环境变量

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
DATABASE_URL
DIRECT_URL
SUPER_ADMIN_EMAIL
```

浏览器只接收 publishable key。`SUPABASE_SECRET_KEY` 预留给后续需要 Auth Admin API 的服务端管理流程，不得带 `NEXT_PUBLIC_` 前缀。

## yudan-wupin 上线顺序

1. 为 `yudan-wupin` 创建可恢复备份并确认 PITR/恢复方式；
2. 使用 `DIRECT_URL` 执行已提交 Prisma Migration，再执行 Seed；
3. 在 Supabase Authentication → Hooks 启用 Postgres Hook `private.before_user_created`；
4. 在 Authentication → URL Configuration 设置正式 Site URL，并只加入可信的本地、Preview 和生产 Redirect URL；
5. 开启邮箱确认，配置密码策略、Auth Rate Limits 和 CAPTCHA/Cloudflare Turnstile；
6. 配置生产 Custom SMTP，并测试确认邮件和密码重置邮件；
7. 如果启用 GitHub，配置 Provider，并在设置中启用 Manual Identity Linking；
8. 用 William 的已有目标 Auth 账号登录。该账号当前已有 GitHub Identity，可先用 GitHub 登录，也可通过“忘记密码”给现有 OAuth 账号添加邮箱密码；
9. 首次可信登录会为同一 `auth.users.id` 幂等创建平台用户、`SUPER_ADMIN` 和家庭 `OWNER`，不会复制或替换 Auth 用户；
10. 完成下方验收后再连接 Vercel Production。

## 回调地址

应用统一使用：

```text
https://<app-domain>/auth/callback
```

Supabase 邮件模板既可以使用 PKCE `code`，也可以使用 `token_hash` 与 `type`；应用回调同时支持两种格式。所有 `next` 参数只接受同源相对路径，防止开放重定向。

GitHub OAuth App 的 provider callback 仍指向 Supabase：

```text
https://bmrkjsomdbypqoaidsck.supabase.co/auth/v1/callback
```

## 安全验收

- 无 RegistrationIntent 直接请求 Supabase signup 必须被 Hook 拒绝；
- 有效邀请成功，过期、撤销、邮箱不匹配和重复使用均失败；
- 邀请明文不出现在数据库、日志或审计数据；
- 未确认邮箱、停用平台账号和暂停家庭成员不能获得对应访问；
- VIEWER 写操作、EDITOR 成员管理、跨家庭查询和 OWNER 授予全局角色必须失败；
- 角色变化后权限缓存立即失效；
- 找回密码始终返回相同结果，不泄露邮箱是否存在；
- GitHub 新身份不能绕过邀请 Hook 创建平台账号；
- `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build` 全部通过。

## 限流说明

应用提供 `RateLimiter` 抽象和本地/单实例内存实现，Supabase Auth 自身限流必须同时开启。Vercel 多实例生产环境需要把该实现替换为共享的原子计数后端；在此之前，不能把内存限流视为唯一攻击防护。
