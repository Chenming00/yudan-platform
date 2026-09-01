# Supabase Auth 与邀请码注册契约

## 认证方式

第一版默认使用邮箱和密码注册、登录。Supabase Auth 负责安全哈希密码、会话、邮件确认和密码重置，身份记录保存在 Supabase PostgreSQL 的 `auth.users`、`auth.identities` 等 Auth schema 表中。

平台自己的 `app_users`、`household_members`、`invitations`、`registration_intents`、角色和权限保存在业务 schema。业务表只引用 `auth.users.id`，不得保存密码、密码哈希或可用于登录的凭据。

GitHub OAuth 是可选登录方式：

- 注册不要求 GitHub 账号；
- 用户可只使用邮箱和密码；
- 后续可以为同一账号绑定 GitHub identity；
- GitHub 登录不能绕过邀请码、用户状态或权限检查；
- 第一版可以先交付邮箱密码，GitHub 绑定排在其后。

## 邀请码注册流程

```text
/register
  → 输入邮箱、密码、邀请码
  → Server Action 校验格式、限流和邀请码
  → 创建短时、一次性 RegistrationIntent
  → 服务端调用 Supabase Auth signUp(email, password)
  → Before User Created Hook 再次校验 RegistrationIntent 与邮箱
  → Supabase 在 auth.users 中创建身份并安全保存密码哈希
  → 数据库触发器创建 AppUser / HouseholdMember
  → 原子消费 RegistrationIntent 与 Invitation
  → 按配置发送确认邮件并建立会话
```

邀请码原文只在用户提交时出现。服务端通过哈希匹配 `invitations.token_hash`，再生成不含角色和家庭信息的一次性 RegistrationIntent。传给 Supabase Auth 的 metadata 只能放 RegistrationIntent 的不透明标识，不能放邀请码明文，也不能把 metadata 当作授权事实。

## 为什么需要数据库 Hook

只在前端或 Server Action 中检查邀请码仍不足以关闭公开注册，因为攻击者可以直接调用 Supabase `/signup`。必须配置 `Before User Created` Auth Hook：

- 缺少 RegistrationIntent：拒绝创建用户；
- Intent 不存在、过期或已使用：拒绝；
- Intent 邮箱与待创建用户邮箱不一致：拒绝；
- 邀请已撤销、过期或用尽：拒绝；
- 只有全部条件满足才允许写入 `auth.users`。

Hook 使用 `security invoker` 和最小权限授权给 `supabase_auth_admin`；撤销 `anon`、`authenticated` 和 `public` 的执行权限。不得为解决权限错误随意使用 `security definer`。

## 登录流程

```text
/login
  → 邮箱 + 密码
  → supabase.auth.signInWithPassword()
  → 服务端读取可信 Session / User
  → 检查 app_users.status = ACTIVE
  → 加载家庭成员关系与权限
  → 进入平台
```

已注册用户登录不需要邀请码。停用用户即使密码正确也不能进入业务页面，并应撤销现有会话。

## 邮件与密码

- 生产环境默认要求验证邮箱；
- 注册确认、找回密码和敏感账户变更使用自定义 SMTP；
- 登录、注册、找回密码和邀请码验证都必须限流并配置 CAPTCHA/攻击防护；
- 密码策略由 Supabase Auth 配置，业务代码不自行哈希或比较密码；
- 找回密码响应不得泄露邮箱是否已经注册；
- 日志、审计、错误和分析事件不得包含密码或邀请码明文。

## 超级管理员引导

邮箱确认或首次可信登录后，从 Supabase Auth 的可信用户记录读取已验证邮箱，执行 `trim().toLowerCase()`，再与 `SUPER_ADMIN_EMAIL` 比较。匹配 `william.chen@utah.edu` 时，服务端幂等授予 `SUPER_ADMIN`。

超级管理员不要求绑定 GitHub。客户端提交的邮箱、`user_metadata`、昵称和头像都不能用于提权；授权必须以 `auth.users.id` 和平台数据库角色为准。

## GitHub 可选绑定

如果启用 GitHub OAuth，GitHub OAuth App callback 指向 Supabase：

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

OAuth 回调只允许配置的本地、Preview 和正式域名。系统必须执行身份冲突处理，不能仅凭相同的未验证邮箱自动合并账户。GitHub identity 的绑定和解绑属于敏感操作，需要重新认证并写入审计日志。

## 会话与权限

- Server Component 优先用 Supabase 服务端客户端读取会话；
- 敏感写操作使用 `auth.getUser()` 或等价的服务端可信校验；
- 所有业务查询同时检查 `userId`、`householdId` 与权限码；
- RLS 作为纵深防御，不能只写 `TO authenticated` 而缺少家庭成员条件；
- 权限数据放在平台数据库或可信 `app_metadata`，不放在 `user_metadata`；
- `SUPABASE_SECRET_KEY` 只在服务端使用，不能带 `NEXT_PUBLIC_` 前缀。

