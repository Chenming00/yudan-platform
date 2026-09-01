# Supabase Auth 与邀请注册契约

## 身份提供方

第一版只启用 Supabase Auth 的 GitHub OAuth。GitHub OAuth App 的 callback URL 指向 Supabase：

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

本地 Supabase 环境使用：

```text
http://localhost:54321/auth/v1/callback
```

应用调用 OAuth 时，将 `redirectTo` 指向平台自身的 `/auth/callback`。该地址必须加入 Supabase Redirect URLs 允许列表；回调 Route Handler 使用 PKCE code 换取会话。

## 邀请注册流程

```text
/invite/<token>
  → 服务端验证邀请码
  → 写入 HttpOnly、SameSite=Lax、短时签名邀请 Cookie
  → 发起 GitHub OAuth
  → /auth/callback 换取 Supabase Session
  → 使用 auth.getUser() 获取已验证身份
  → 数据库事务内消费邀请码并创建 AppUser / HouseholdMember
  → 清除邀请 Cookie
```

约束：

- 没有 `app_users` 记录的新身份必须持有有效邀请码；
- 已有且状态正常的用户再次登录不需要邀请码；
- 邀请只保存安全哈希，不保存可再次使用的明文；
- 邀请消费与用户、家庭成员创建必须在同一数据库事务内；
- 登录回调不得从查询参数接受角色、家庭或管理员标识；
- 授权不得读取用户可修改的 `user_metadata`；
- `SUPABASE_SECRET_KEY` 只能在服务端使用，不能带 `NEXT_PUBLIC_` 前缀。

## 超级管理员引导

认证成功后，从 Supabase 的可信身份结果读取已验证邮箱，执行 `trim().toLowerCase()`，再与 `SUPER_ADMIN_EMAIL` 的标准化结果比较。匹配 `william.chen@utah.edu` 时，服务端在事务内幂等授予 `SUPER_ADMIN`。

客户端显示的 GitHub 邮箱、昵称和头像都不能用于提权。生产环境首次引导完成后仍保留同样的幂等检查，但每次授予和角色变化都写入审计日志。

## 会话与权限

- Server Component 优先用 Supabase 服务端客户端读取会话；
- 敏感写操作使用 `auth.getUser()` 或等价的服务端可信校验；
- 所有业务查询同时检查 `userId`、`householdId` 与权限码；
- Supabase RLS 作为纵深防御，不能只写 `TO authenticated` 而缺少家庭成员条件；
- 权限数据放在平台数据库或可信 `app_metadata`，不放在 `user_metadata`；
- 停用用户时主动撤销会话，并在敏感操作中检查平台用户状态。

