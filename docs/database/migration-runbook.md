# 历史数据库迁移执行手册

## 已确认基线

目标 `yudan-wupin` 当前保留：34 个产品、49 条库存条目、89 条库存日志、2 个产品组、24 条产品组明细和 8 条 Prisma Migration。

来源 `YUDAN` 当前包含：

- 113 条支出，总额 `27977.86 CNY`；
- 2 条用户仪表盘资料，生日相同，迁移为 1 个宝宝档案；
- 20 条成长记录，覆盖 19 个日期；同一天的两次不同测量全部保留；
- 46 条疫苗目录和 4 条接种记录。

两个项目各有 2 个已确认 Auth 用户。超级管理员邮箱在来源和目标中都已存在，目标账号当前带 GitHub Identity。迁移不复制整个 `auth` schema：直接为目标账号建立 `app_users`/超级管理员角色，并通过受控流程设置邮箱密码；来源独有账号如需进入新平台，使用邀请码注册。目标已有 Identity 和用户 UUID 均保留。

| 旧分类 | 新模块 |
| --- | --- |
| 医疗健康 | `CHILD_CARE` |
| 喂养用品、护理清洁 | `CONSUMABLES` |
| 衣物穿戴 | `WARDROBE` |
| 大件用品、购物消费、其他、未知 | `OTHER` |

历史健康记录不会自动生成支出；库存价格不会自动生成账本记录，以免重复记账。

## 执行顺序

1. 在 Supabase 确认备份或时间点恢复可用，并暂停两个旧应用的写入。
2. 将 `main` 部署到 Preview，运行 `npm run db:migrate:deploy`，再运行 `npm run db:seed`。
3. 在 Supabase Auth Hooks 中启用 `private.before_user_created`。
4. 对目标 `auth.users` 中已存在的超级管理员执行幂等引导，创建 `app_users` 和角色；确认 `TARGET_HOUSEHOLD_ID` 和 `TARGET_ACTOR_USER_ID`。
5. 临时配置 `LEGACY_YUDAN_DATABASE_URL` 和 `LEGACY_PANTRY_DATABASE_URL` 为只读连接；后者指向保留的 `yudan-wupin`。另配置 `DIRECT_URL`、`TARGET_HOUSEHOLD_ID`、`TARGET_ACTOR_USER_ID` 和 `TARGET_BABY_NAME`，真实值不得写入仓库。
6. 执行 `npm run migration:yudan:dry-run`。脚本以 `BEGIN READ ONLY` 读取两个来源，并生成 `artifacts/migration/yudan-dry-run.json`；逐月金额使用精确十进制计算，不使用表行数估算。
7. 核对报告中所有检查均为 `PASS`，并确认 `safeToApply=true`。当前生产库尚未应用平台 Schema 时，此项必然为 `false`，不得绕过。
8. 确认备份或 PITR 后设置 `MIGRATION_BACKUP_CONFIRMED=YES` 和 `MIGRATION_TARGET_CONFIRM=yudan-wupin`。
9. 在维护窗口执行 `npm run migration:yudan:apply`。脚本使用单个目标事务、事务级咨询锁和 5 秒锁等待；提交前再次核对交易数量、收入、支出、宝宝映射、成长、疫苗记录和疫苗目录，任一步失败都会整体回滚。
10. 保存 `artifacts/migration/yudan-apply.json`，再人工核对数量、逐月收入/支出、库存逐产品数量、成长记录和接种记录。
11. 旧站改为只读，观察一周后再决定是否下线；不删除旧数据库。

## 当前云端 Gate（2026-09-01）

- `yudan-wupin` 仍只有 6 张旧库存表，平台 Schema 尚未应用；
- 旧库存精确基线为 34 个产品、49 条库存条目、89 条日志、2 个组、24 条组明细；
- `YUDAN` 精确基线为 113 条支出、`27977.86 CNY`，分布在 5 个月；
- Supabase Auth 的泄露密码保护尚未启用；
- Vercel 尚无 `yudan-platform` 项目。

这些 Gate 未完成前只允许 dry-run，不执行生产写入或域名切流。

## 幂等与冲突处理

- `legacy_import_maps` 记录来源项目、表、旧 ID、新 ID 和来源哈希。
- 重复执行会跳过已导入行。
- 已导入来源的内容或来源行被删除时，哈希预检会停止执行，不静默保留不一致结果。
- 若目标 ID 已存在但没有映射，脚本立即失败，不覆盖目标记录。
- 两个旧账号的健康记录只因生日一致而映射到同一宝宝档案；若发现多个生日，脚本停止并要求显式映射。
