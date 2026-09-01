# 跨模块组合记账

A09 编排层负责“一次付款、多种用途、只统计一次”。账本保存付款事实，Allocation 解释用途，儿童保健、衣柜和消耗品记录解释每项开支的业务内容。

## 原子保存

`ExpenseOrchestrator` 在同一个 Serializable Prisma 事务中依次创建：

1. 幂等记录；
2. 一条 `Transaction`；
3. 一到二十条 `TransactionAllocation`；
4. Allocation 对应的 `CareRecord`、`WardrobePurchase`/衣物、`ConsumablePurchase`/采购明细/StockEntry/库存日志；
5. 审计日志与幂等响应。

任意分类、宝宝、产品、业务明细、金额或数据库约束失败时，整个事务回滚，不会留下孤立账目、采购或库存。事务内不调用外部服务，锁持有时间保持最短。

## 金额规则

- Transaction 总金额必须等于全部 Allocation 合计。
- 消耗品采购行金额必须等于对应 `CONSUMABLES` Allocation。
- 一条非 `OTHER` Allocation 必须带匹配模块的业务明细。
- 家庭总览按 Transaction 统计付款总额，按 Allocation 统计模块占比，因此“京东 ¥520 = 消耗品 ¥300 + 衣柜 ¥150 + 儿童保健 ¥70”只会产生 ¥520 总支出。
- 退款创建新的 `REFUND` Transaction，不删除原保健、衣物或采购档案；模块净支出按退款 Allocation 扣减。

## 幂等与并发

- 网页首次打开时生成请求幂等键，API 调用方必须显式提供 `idempotencyKey`。
- 同一家庭、同一 scope、同一 key、同一请求会返回首次结果，不重复写入。
- 同一 key 对应不同请求会返回 `IDEMPOTENCY_CONFLICT`。
- 编排事务遇到可重试的写冲突最多重试三次。
- 退款事务先锁定原支出，再计算总额和每个模块/分类的剩余可退金额。

## 页面与接口

- `/ledger/new/composite`：组合记账页面。
- `POST /api/orchestration/expenses`：原子创建组合支出。
- `POST /api/orchestration/refunds`：幂等创建退款。
- `GET /api/dashboard/overview?month=YYYY-MM`：家庭总览、模块净支出、库存提醒和最近事件。

所有入口都重新验证登录、家庭成员身份、模块权限和输入；浏览器传入的家庭 ID 不会被信任。

## Supabase 上线边界

A09 复用 `yudan-wupin` 既有 Transaction、Allocation 和 IdempotencyKey 结构，没有新增 Prisma Migration，也没有直接改动生产数据库。服务端 Prisma 执行编排事务；表级 RLS 与撤销 `anon`/`authenticated` Data API 权限继续作为纵深保护。
