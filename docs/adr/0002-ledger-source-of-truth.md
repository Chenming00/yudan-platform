# ADR-002：账本是财务事实的唯一来源

- 状态：已接受
- 日期：2026-09-01

## 决策

`Transaction` 表示真实发生的一次付款、收入或退款；`TransactionAllocation` 表示这笔钱在儿童保健、衣柜、消耗品或其他分类中的用途。业务模块只保存业务事实和 Allocation 引用，不复制一份可参与总账统计的金额。

一笔 Transaction 可以拥有多个 Allocation，但必须满足：

```text
Transaction.amount = SUM(TransactionAllocation.amount)
```

所有金额在数据库中使用 Decimal，在 API 中使用十进制字符串。退款创建新的反向财务记录；正式账目不通过无痕物理删除修正。

## 结果

- 总开支只聚合 Transaction，不会因跨模块关联而重复计算；
- 模块支出按 Allocation 聚合；
- 组合记账必须通过应用编排服务和数据库事务；
- 消耗品出库只改变库存，不产生第二次支出。

