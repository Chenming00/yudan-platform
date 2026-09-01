# 数据库底座

统一平台保留 Supabase 项目 `yudan-wupin` 作为目标数据库。原库存表不删除、不改名，Prisma 层将 `inventory_batches` 表解释为 `StockEntry`（库存条目）；`batch_code` 只作为历史兼容键保留，新 UI 不要求用户管理批次。

## 数据来源

| 来源 | 处理方式 |
| --- | --- |
| `yudan-baby-pantry` / `yudan-wupin` | 原地升级，完整继承 8 条 Prisma Migration 和现有库存数据 |
| `Yudan-log` / `YUDAN` | 通过可重复执行的导入脚本迁入 `yudan-wupin` |

## 关键规则

- Supabase Auth 是账号和密码哈希的唯一来源，`app_users` 只保存平台资料与状态。
- 每个主要业务表都有 `household_id`；服务端 RBAC 与数据库 RLS 共同隔离家庭数据。
- 一次真实收支只保存一条 `transactions`；模块归属保存在 `transaction_allocations`。
- 金额使用 `numeric/Decimal`，不再使用浮点数。
- 旧数据导入由 `legacy_import_maps` 保证幂等，不按备注猜测业务对象。
- Cloudflare R2 保存图片对象，数据库仅保存 `media_assets` 元数据和 `media_links` 关联。

相关文档：[ERD](./erd.md)、[迁移执行手册](./migration-runbook.md)、[回滚说明](./migration-rollback.md)、[认证数据库钩子](./supabase-auth-hooks.md)。
