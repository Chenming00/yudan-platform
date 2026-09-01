# Supabase 备份与恢复演练

## 目标

在任何生产 Schema Migration 或历史导入前，证明 `yudan-wupin` 可以恢复。仅看到“已备份”状态不算完成，必须保存一次恢复验证记录。

## 演练步骤

1. 在 Supabase Dashboard 确认当前套餐支持的 Daily Backup 或 PITR 范围；
2. 记录项目 Ref、备份时间、数据库版本、负责人和预期恢复点；
3. 恢复到隔离项目或 Supabase Branch，禁止覆盖在线生产项目；
4. 对恢复库执行只读核对：旧库存 34 个产品、49 条库存、89 条日志、2 个组和 24 条组明细；
5. 运行平台 `prisma migrate deploy` 与 `tests/integration/database-gates.test.ts`；
6. 验证 `anon` / `authenticated` 最小权限、RLS、邀请码事务和超级管理员引导；
7. 记录恢复开始、可连接、校验完成时间，得到实际 RTO；
8. 删除隔离恢复资源前保存不含 Secret 和个人数据的结果摘要。

## 生产事故恢复

1. 立即停止新应用和旧站写入，不删除现有数据库；
2. 保存事故时间线、最后正常事务时间和相关 Request ID；
3. 选择事故前恢复点，先恢复到隔离环境核对；
4. 对比账本金额、库存数量、用户和邀请码状态；
5. 由超级管理员批准后再决定切换恢复库或修复原库；
6. 恢复服务后轮换受影响的数据库、Supabase、R2 和 Cron 凭据。

备份文件或数据库连接串不得上传到 GitHub Actions Artifact、Issue、聊天记录或仓库。
