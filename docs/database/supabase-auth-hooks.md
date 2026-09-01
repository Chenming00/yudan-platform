# Supabase Auth 数据库钩子

注册默认使用邮箱和密码；GitHub 只作为已注册用户可选绑定的 Identity，不是注册前提。

## 注册链路

1. 服务端校验邀请码哈希、有效期、目标邮箱和家庭角色。
2. 服务端创建短时一次性的 `registration_intents`，只把不透明 token 放入 signup metadata。
3. Supabase `Before User Created` 调用 `private.before_user_created(event jsonb)`；缺少有效 intent 的直接 signup 被拒绝。
4. `auth.users` 插入后，`private.handle_new_auth_user()` 在同一事务中创建 `app_users` 和 `household_members`，并消费 intent 与 invitation。
5. 密码哈希始终只存在 Supabase 管理的 `auth` schema。

Migration 会创建函数和触发器。`Before User Created` 仍需在 Supabase Dashboard 的 Authentication → Hooks 中选择 Postgres Hook `private.before_user_created`。启用后分别测试无邀请码、过期邀请码、邮箱不匹配、有效邀请码和重复使用。

超级管理员首次引导可创建 `created_by_user_id = null` 的系统邀请码；服务端必须额外校验 `SUPER_ADMIN_EMAIL`。普通邀请码必须记录创建人。
