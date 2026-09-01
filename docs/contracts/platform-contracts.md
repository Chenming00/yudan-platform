# 平台公共契约

本文件是 A01-A09 的共享边界。变更公共类型或接口时，需要在 PR 中说明影响模块并获得对应负责人确认。

## 标识、金额和时间

- ID：服务端生成 UUID 字符串，客户端不得从业务含义推导 ID；
- 金额：内部使用 Decimal，HTTP/JSON 使用两位或更多精度的十进制字符串，例如 `"123.45"`；
- 业务日期：`YYYY-MM-DD`；
- 时间戳：ISO 8601 UTC，展示时区默认为 `Asia/Shanghai`；
- 数据库时间列使用 `timestamptz` 语义。

## 调用上下文

```ts
export interface ActionContext {
  userId: string;
  householdId: string;
  requestId: string;
  idempotencyKey?: string;
}
```

Service 不从客户端参数中接受可信角色。调用者身份和家庭范围必须由服务端会话解析。

## API 响应

```ts
type ApiSuccess<T> = {
  success: true;
  data: T;
  requestId: string;
};

type ApiFailure = {
  success: false;
  error: { code: ErrorCode; message: string; details?: unknown };
  requestId: string;
};
```

标准错误码：`AUTH_REQUIRED`、`REGISTRATION_INVITE_REQUIRED`、`INVITATION_INVALID`、`PERMISSION_DENIED`、`RESOURCE_NOT_FOUND`、`VALIDATION_FAILED`、`CONFLICT`、`IDEMPOTENCY_CONFLICT`、`INTERNAL_ERROR`。

## 分页

列表接口使用不透明游标：

```ts
interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
```

默认 20 条，最大 100 条；稳定排序至少包含时间与 ID 两个字段。游标实现细节不得暴露为客户端业务逻辑。

## 模块边界

- 每个模块只从 `modules/<module>/index.ts` 导出公共类型和 Service；
- Repository、数据库模型映射和内部校验器不跨模块导入；
- 跨模块用例放在 `application/`；
- 页面读取默认使用 Server Component 调用查询 Service；
- 页面写入使用 Server Action，外部系统使用 Route Handler；
- 写操作接收 `ActionContext`，敏感操作记录审计事件。

## 审计事件

事件名采用 `<domain>.<resource>.<action>`：

```text
auth.invitation.created
auth.invitation.consumed
permissions.member.role_changed
ledger.transaction.created
ledger.transaction.refunded
media.asset.upload_confirmed
inventory.stock.consumed
```

审计载荷保存操作者、家庭、目标资源、请求 ID、结果和必要的差异摘要；不得保存邀请码明文、访问令牌或私有文件签名地址。

## Schema 变更请求

```markdown
## Schema Change Request

- 请求 Agent：
- 所属任务：
- 模块与业务原因：
- 新增或修改模型：
- 字段、类型、可空性和默认值：
- 唯一约束、索引和外键删除策略：
- 历史数据回填：
- 回滚方式：
- 对其他模块的影响：
```

