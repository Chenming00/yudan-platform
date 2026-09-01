# 统一账本实现说明

账本是平台唯一的财务事实来源。儿童保健、衣柜、消耗品和其他模块只能创建或关联 `TransactionAllocation`，不能各自再保存一份开支金额。

## 核心规则

- `Transaction.amount` 与全部有效 `TransactionAllocation.amount` 的合计必须完全一致；
- 金额在数据库和服务层使用 `Decimal`，JSON API 使用两位小数字符串；
- `EXPENSE`、`INCOME` 是普通录入类型，`REFUND` 只能通过退款服务创建；
- 退款是一条独立交易，通过 `refund_of_transaction_id` 关联原支出，不修改原始交易；
- 累计退款不能超过原支出，各用途的累计退款也不能超过原拆分金额；
- 创建退款时锁定原支出行，避免并发退款超额；
- 有有效退款的原支出不可编辑或删除；撤销退款采用软删除；
- 所有查询同时限定授权上下文中的 `household_id`；
- 写入、修改、退款和删除都记录审计日志。

## 模块

| 代码 | 用户界面 | 用途 |
|---|---|---|
| `CHILD_CARE` | 儿童保健 | 儿保、就诊、药品、保健品等 |
| `WARDROBE` | 衣柜 | 衣物购买等 |
| `CONSUMABLES` | 消耗品 | 尿布、清洁、喂养用品等采购 |
| `OTHER` | 其他 | 家庭日常、收入和暂未归类记录 |

## 服务与接口

业务模块只从 `modules/ledger/index.ts` 使用 `LedgerService`。页面和 Route Handler 不直接访问 Prisma。

- `GET/POST /api/ledger/transactions`
- `GET/PATCH/DELETE /api/ledger/transactions/:id`
- `POST /api/ledger/transactions/:id/refund`
- `GET /api/ledger/summary?month=YYYY-MM`
- `GET/POST /api/transactions`：原 `Yudan-log` 字段兼容入口

统一接口返回 `{ success, data, requestId }`；金额字段保持字符串。列表按 `transaction_at DESC, id ASC` 使用不透明游标分页。

## 数据库发布

迁移 `20260901170000_ledger_refund_relation` 增加退款自关联、索引和形状约束。目标仍是现有 `yudan-wupin` Supabase 数据库。正式执行前必须先备份、确认恢复能力并在非生产环境演练；不得使用 `prisma db push` 修改生产库。
