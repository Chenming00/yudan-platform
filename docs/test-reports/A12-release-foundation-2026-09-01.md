# A12 发布底座检查报告

- 日期：2026-09-01
- 提交目标：`main`
- 当前结论：发布工程 PASS，云端 Preview BLOCKED，生产 NO-GO

## 已完成

- CI：lint、typecheck、102 条单元/安全测试、Prisma 校验、依赖审计、生产构建；
- 浏览器：Chromium 与 Pixel 7 共 8 条 E2E；
- 部署安全：Preview/Production 数据库与 R2 隔离校验；
- 运维：`/api/health` 存活检查和 `/api/health?mode=ready` 配置/数据库就绪检查；
- 发布：数据库 Migration 与 Vercel Preview 验证/Promote 分离，生产步骤使用 GitHub Environment 审批；
- Cloudflare：生产私有 Bucket 不公开，公开域名 active，两桶默认 7 天 Multipart Abort Rule 已启用；
- 文档：发布、回滚、备份和恢复演练手册。

## 本轮验证

| 检查 | 结果 |
|---|---|
| TypeScript / ESLint | PASS |
| Vitest | 102 PASS，2 个真实数据库测试 SKIP |
| Playwright | 8 PASS |
| Next.js Production Build | PASS |
| Prisma Validate | PASS |
| npm audit | 0 vulnerabilities |
| GitHub Workflow YAML | PASS |

## 剩余 Gate

1. 确认 Supabase 组织和 Branch 费用，创建无生产数据的 Preview Branch；
2. 创建 Preview 专用 R2 Bucket 和受限 Token；
3. 在 Preview 应用 Migration、Seed，并执行真实 RBAC / IDOR / 并发测试；
4. 创建并连接 Vercel `yudan-platform`，配置 Preview 环境变量和保护绕过 Secret；
5. 完成 Supabase Auth Redirect、泄露密码保护、SMTP 和邀请码 Hook；
6. 完成可恢复备份演练后，才允许生产 Migration、历史导入和域名切换。
