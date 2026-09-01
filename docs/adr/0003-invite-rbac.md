# ADR-003：邀请码注册与服务端 RBAC

- 状态：已接受
- 日期：2026-09-01

## 决策

平台关闭公开注册。新身份首次进入平台时必须提交有效、未过期、未撤销且未被消费的邀请码；已有平台用户正常登录时不再要求邀请码。

身份系统采用 Supabase Auth。邮箱和密码是默认注册、登录方式，GitHub OAuth 只作为可选的身份绑定，不是注册前提。Supabase Auth 将用户身份和密码哈希保存在 PostgreSQL 的 Auth schema；平台数据库负责邀请码、注册意图、平台用户、家庭成员和权限。

注册必须同时通过 Next.js 服务端校验和 Supabase `Before User Created` Hook 校验。没有有效 RegistrationIntent 的请求不得写入 `auth.users`，从而防止攻击者绕过应用页面直接调用公开注册接口。

`William.chen@utah.edu` 是初始超级管理员标识。系统只在服务端使用 Supabase 已验证并标准化后的邮箱执行幂等引导，不要求绑定 GitHub，也不能信任客户端提交的邮箱或角色。

授权由全局角色、家庭成员角色和权限码共同决定。所有读写入口都必须在服务端调用统一的 `authorize` 能力，并将 `householdId` 纳入查询条件。

## 最低角色

- `SUPER_ADMIN`：平台级管理；
- `OWNER`：家庭空间管理；
- `EDITOR`：业务数据读写；
- `VIEWER`：只读。

邀请创建、邀请消费、角色变更、用户停用、权限拒绝和敏感数据访问写入统一审计日志。
