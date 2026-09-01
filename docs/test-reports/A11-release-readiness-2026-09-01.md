# A11 发布就绪与安全审查报告

- 审查日期：2026-09-01
- 目标版本：`main` / A10 之后
- 结论：**NO-GO（禁止生产发布）**

代码层 Gate 已通过，但生产 Supabase Schema、Auth 安全设置、数据库集成验证和 Vercel 项目尚未就绪。以下阻断项完成前，不运行历史导入、不创建生产部署、不切换 `cyz.ykn.cm`。

## 自动化结果

| 项目 | 结果 | 证据 |
|---|---|---|
| 单元与安全测试 | PASS | 15 个测试文件、97 条测试全部通过；另有 1 个隔离数据库测试文件因尚无 `TEST_DATABASE_URL` 被跳过 |
| 浏览器 E2E | PASS（公开流程） | Chromium + Pixel 7 共 6 条：未登录重定向、登录、邀请码注册、移动端无横向溢出、无浏览器错误、跨来源写入拒绝 |
| 生产构建 | PASS | `next build --webpack` |
| TypeScript / ESLint / Prisma | PASS | `typecheck`、`lint`、`prisma validate` |
| 依赖漏洞 | PASS | 覆盖 `deepmerge-ts` 8.0.2 后 `npm audit` 为 0 |
| Secret 扫描 | PASS | 当前 Git 文件和全部 Git 历史未发现数据库 URL、Supabase Secret、R2 Secret、AWS Key 或私钥模式 |
| 代码覆盖率 | WARN | statements 14.52%、branches 63.44%、functions 52.76%、lines 14.52%；数据库 Service 尚未在真实测试库执行 |

`@prisma/config 7.10.0` 固定依赖存在递归对象栈耗尽问题的 `deepmerge-ts 7.1.5`，且当前稳定 Prisma 没有上游修复版本。仓库使用 npm override 固定到已修复的 `8.0.2`，完整测试和构建通过；后续 Prisma 升级时应移除 override 并重新审计。

## 安全边界

| Gate | 状态 | 结论 |
|---|---|---|
| 邀请码一次性消费 | PASS（静态） | Auth Trigger 对 intent 和 invitation 使用 `FOR UPDATE`，同一事务消费两者；浏览器角色不能调用 Hook |
| RBAC / API Key Scope | PASS（静态） | 权限码、家庭绑定、到期时间和定时哈希比较均存在 |
| IDOR / 跨家庭 | PASS（静态） | 业务查询、媒体目标和组合记账引用均带 `householdId`；迁移包含成员 RLS |
| CSRF / Origin | PASS | Proxy 拒绝跨来源浏览器写请求；Next.js Server Actions 继续使用内建 Origin/Host 校验 |
| Decimal / 重复记账 | PASS | Decimal 校验、拆分合计、退款锁和幂等键测试通过；100 × 0.01 精确得到 1.00 |
| 库存并发 / 负库存 | PASS（静态） | Serializable、行锁与数据库非负约束存在；真实并发测试仍依赖测试库 |
| R2 私有资源 | PASS（云端 + 代码） | `cyz-private` 无自定义域名，`r2.dev` 已关闭；私有下载使用 5 分钟签名 URL，上传确认校验大小、MIME 和 Magic Bytes |
| OAuth 回调 | PASS（静态） | 回调仅接受安全相对 `next`；未获准账号会清理本地会话 |
| 历史迁移金额 | PASS（来源）/ BLOCKED（目标） | 来源精确为 113 条支出、27977.86 CNY；目标导入尚未运行，不能完成最终对账 |

## 云端检查

### Supabase

- `yudan-wupin` 当前仍是 6 张旧库存表，平台 Migration 尚未应用；
- 旧表已启用 RLS，`anon` / `authenticated` 没有表级权限；当前“RLS 无 Policy”提示不会造成公开访问，但平台上线后必须由正式 Migration 创建成员 Policy；
- `YUDAN` 与 `yudan-wupin` 都未启用泄露密码保护，属于上线阻断项。参考 [Supabase Password Security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)；
- 未确认生产备份或 PITR，因此禁止 `db:migrate:deploy` 和历史导入。

### Cloudflare R2

- `cyz-private`：APAC、无公开自定义域名、`r2.dev` 关闭；
- `cyz-public`：`https://cf-cyz.ykn.cm`，SSL 和所有权 active，最低 TLS 1.2；
- 两桶 CORS 只允许 `https://cyz.ykn.cm` 和本地开发来源；CORS 不替代签名授权。

### Vercel

- 账号内尚无 `yudan-platform` 项目；
- 尚未配置 Preview / Production 环境变量，也未绑定 `cyz.ykn.cm`；
- 因数据库 Gate 未通过，本轮没有创建项目或部署，避免错误连接旧 Schema。

## 发布阻断项

1. 在 Supabase 确认可恢复备份或 PITR，并完成恢复演练记录；
2. 在隔离的 Preview/测试环境应用平台 Migration 和 Seed；
3. 用两个家庭、OWNER / EDITOR / VIEWER / SUPER_ADMIN 测试账号执行真实 RBAC、IDOR、邀请并发、库存并发和组合事务回滚测试；
4. 启用 Supabase 泄露密码保护，并确认最小密码强度；
5. Dry Run 全部 PASS 后执行历史迁移，并核对目标 113 条支出和 27977.86 CNY；
6. 创建 Vercel `yudan-platform`，仅先部署 Preview，配置隔离环境变量并运行完整 E2E；
7. Preview 验收后才能绑定并切换 `cyz.ykn.cm`。

## 回归命令

```text
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run test:e2e
npm audit
npm run db:validate
npm run build
```
