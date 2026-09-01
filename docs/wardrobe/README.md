# 儿童衣柜模块

衣柜模块管理衣物、尺码、季节、使用状态、购买、赠送、出售和私有图片。金额只保存在统一账本中，衣柜通过 Allocation 建立业务关联。

## 业务规则

- 购买：必须关联一笔当前家庭、模块为 `WARDROBE`、交易类型为 `EXPENSE` 的 Allocation。
- 赠送：直接创建衣物，不创建账本支出。
- 退款：由账本对原支出创建退款，衣柜购买记录和衣物继续保留。
- 出售：状态变为 `SOLD` 时必须关联一笔 `WARDROBE`、交易类型为 `INCOME` 的 Allocation。
- 状态：`ACTIVE` 和 `STORED` 可互相切换，也可进入 `DONATED`、`SOLD` 或 `DISCARDED`；后三者是终态。
- 图片：通过 Media Service 关联 `WARDROBE_ITEM`，固定使用 Cloudflare R2 私有资源，不保存公开 URL。
- 权限：读取要求 `wardrobe.read`，写入和状态变更要求 `wardrobe.write`，所有查询包含 `householdId`。

## 接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/wardrobe/items` | 衣物清单 |
| POST | `/api/wardrobe/items` | 批量登记赠送衣物 |
| PATCH | `/api/wardrobe/items/:id/status` | 状态流转及出售收入关联 |
| GET | `/api/wardrobe/purchases` | 购买记录 |
| POST | `/api/wardrobe/purchases` | 创建购买并批量生成衣物 |
| POST | `/api/media/links` | 把私有图片关联到衣物 |

创建账目与衣柜购买的一次性组合操作由 A09 编排层完成。当前接口支持先创建账本 Allocation，再创建购买记录。
