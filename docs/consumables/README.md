# 消耗品模块

消耗品模块把旧 Pantry 的产品、库存、入库、出库、盘点、日志和产品组整合到家庭平台，并把采购开支关联到统一账本。用户只管理“产品 + 当前库存”，到期日、来源、成本和扣减顺序由内部库存记录维护。

## 核心规则

- 日常界面不要求批次编号，也不展示内部 StockEntry 编码。
- 使用消耗品时按 FEFO 扣减：先使用到期日最近的可用库存，再使用没有到期日的库存；同日按入库时间排序。
- 已过期库存不计入当前可用库存，也不会被自动出库；盘点仍可校正全部实物库存。
- 采购入库必须关联当前家庭、模块为 `CONSUMABLES`、交易类型为 `EXPENSE` 的 Allocation，采购明细合计必须与 Allocation 金额完全一致。
- 赠送、转入、历史补录和盘点只改变库存，不创建账目；使用/出库也不重复创建支出。
- 出入库写入使用短事务、行锁和 Serializable 隔离，防止并发扣减出现负库存。
- 普通入库和出库可在 30 秒内撤销；采购入库不能单独撤销，应走统一账本退款流程。
- 产品图片通过 Media Service 关联 `PRODUCT`，文件保存在 Cloudflare R2 私有桶，不保存永久公开 URL。
- 所有服务读取和写入都检查模块权限并包含 `householdId`。

## 新接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET/POST | `/api/consumables/products` | 产品清单与创建 |
| GET | `/api/consumables/dashboard` | 库存汇总和补货建议 |
| POST | `/api/consumables/receive` | 赠送、转入和历史补录 |
| POST | `/api/consumables/purchases` | 关联账本的采购入库 |
| POST | `/api/consumables/consume` | 自动 FEFO 出库 |
| POST | `/api/consumables/count` | 实物盘点 |
| POST | `/api/consumables/undo` | 30 秒内撤销普通出入库 |
| GET | `/api/consumables/logs` | 库存操作日志 |
| GET/POST | `/api/consumables/groups` | 产品组 |
| POST | `/api/media/links` | 把私有图片关联到产品 |

## 旧 Pantry 兼容

保留 `/api/products`、`/api/dashboard`、`/api/inbound`、`/api/consume`、`/api/undo`、`/api/batches`、`/api/logs`、`/api/locations`、`/api/sources` 和 `/api/product-groups` 等兼容入口。旧 Agent 可使用平台 API Credential；原 Pantry 单段 API Key 需要导入或轮换为平台的 `prefix.secret` 凭据。

旧 `/api/inbound` 没有账本 Allocation，因此兼容入口统一按 `HISTORICAL` 非采购入库处理，不伪造支出。需要形成采购开支时，应使用新采购接口或网页表单关联账本。

## 数据库与上线

A08 复用保留的 `yudan-wupin` 中既有产品、`inventory_batches`、库存日志、采购与产品组结构，没有新增破坏性迁移，也没有直接修改生产数据库。应用通过服务端 Prisma 访问 Supabase PostgreSQL；继承表继续启用 RLS，并撤销 `anon`/`authenticated` 的 Data API 表权限。正式迁移历史数据前仍需先做备份、dry-run、数量与金额对账，再执行 apply。
