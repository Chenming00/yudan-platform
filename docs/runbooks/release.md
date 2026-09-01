# 平台发布与回滚手册

## 不可跳过的 Gate

1. Supabase Preview 分支或独立测试项目已就绪，且不包含生产数据；
2. Preview 使用独立数据库、R2 Bucket、Token 和 OAuth Redirect URL；
3. `Database migration` 工作流先在 `database-preview` 环境通过；
4. Vercel Preview 的 `/api/health?mode=ready` 返回 `200`；
5. Preview 浏览器 E2E、数据库权限测试和 Supabase Security Advisor 通过；
6. 生产备份或 PITR 恢复点经过验证；
7. GitHub `production` 与 `database-production` Environment 配置人工审批；
8. 只有上述 Gate 全部通过，才允许 Promote 或生产 Migration。

## GitHub Environment

在 GitHub 仓库设置中创建：

- `database-preview`：只保存 Preview 的 `DATABASE_URL`、`DIRECT_URL`；
- `database-production`：保存生产数据库连接，启用人工审批；
- `production`：保存 `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`，启用人工审批；
- 仓库 Secret：如启用 Vercel Deployment Protection，保存 `VERCEL_AUTOMATION_BYPASS_SECRET`，仅用于自动化测试请求头。

不要把 Secret 放在仓库变量、命令参数、构建输出或报告 Artifact 中。GitHub Secret 的值虽然会自动遮盖，应用日志仍不得主动打印环境变量对象。

## 两阶段发布

### 1. 数据库

先运行 `Database migration`，目标选 Preview。它只应用仓库中已提交的 Migration，并执行数据库权限 Gate。Preview 的 `gate_confirmed` 必须输入 `ISOLATED`。生产运行必须输入：

```text
gate_confirmed = YES
target_confirm = yudan-wupin
```

Migration 必须向后兼容；Vercel Build 和应用冷启动都不能执行 Migration。

### 2. 应用

Vercel Git Integration 创建 Preview 后，运行 `Verify and promote deployment`，输入完整 Preview URL。第一次保持 `promote_to_production=false`。验证通过且生产数据库 Gate 完成后，再对同一个 Preview URL运行并选择 Promote，确保上线的是已经验证过的同一构建产物。

## 环境隔离

每个 Vercel 环境都运行：

```text
npm run deployment:check -- --target=preview
npm run deployment:check -- --target=production
```

Preview 必须设置 `DEPLOYMENT_DATABASE_SCOPE=preview`、`R2_ENVIRONMENT_SCOPE=preview`，并连接非生产 Supabase Project Ref 和非生产 Bucket。生产必须设置两个 scope 为 `production`。

## 观察与回滚

发布后检查：健康接口、Vercel Runtime Errors、Supabase Auth/Postgres 日志、旧 API 兼容路由错误率、R2 清理 Cron。出现以下任一情况立即回滚：

- 登录/邀请码注册失败；
- 跨家庭读取或写入；
- 账本与库存组合事务不一致；
- 5xx 持续出现；
- R2 私有对象可匿名访问。

应用回滚使用 Vercel 回滚或把上一已知良好 Deployment 重新 Promote。数据库不自动向后回滚；保持兼容 Schema并使用前向修复。涉及数据损坏时停止写入，按备份恢复手册处理。
