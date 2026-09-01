# Migration 回滚说明

## 发布前

- 必须确认 Supabase 备份或 PITR 恢复点。
- 必须保存 dry-run 报告和迁移前只读统计。
- 不在 Vercel Build 阶段自动迁移生产数据库；迁移由单独受控步骤执行。

## 应用回滚

如果新应用有问题，立即把 Vercel Production 回滚到旧部署，并让旧库存/账本站保持只读或恢复写入。因为迁移不删除旧库，业务可以先恢复服务再排查。

## 数据导入回滚

`YUDAN` 导入可依据 `legacy_import_maps` 在一个事务中按顺序删除 `vaccine_records`、`growth_records`、`transaction_allocations`、`transactions`、无其他引用的迁移分类/宝宝档案，最后删除映射。正式删除前必须生成待删除数量和金额报告并与迁移报告一致。疫苗目录是共享参考数据，默认不随导入回滚删除。

## Schema 回滚

平台 Migration 是对 `yudan-wupin` 的兼容性增量升级：旧库存表和旧列仍存在。产生新平台数据后不反向删除 Schema；应回滚应用并提交新的前向修复 Migration。只有从备份整体恢复数据库时，才回到升级前 Schema。

旧 `purchase_price` 和 `unit_price` 从浮点数转换为 Decimal。反向改回浮点数会重新引入精度风险，因此不提供自动反向 SQL。
