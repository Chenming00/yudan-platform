# 鱼蛋家庭平台

一个以家庭账本为主线的多模块应用，统一管理儿童保健、衣柜、消耗品和其他开支。

## 当前状态

当前已完成平台工程、A02 数据库底座、A03 认证权限、A04 统一账本、A05 Cloudflare R2 资源层、A06 儿童保健、A07 儿童衣柜、A08 消耗品和 A09 跨模块编排：包括邀请码注册、William 超级管理员、服务端 RBAC、组合付款原子事务、幂等退款、家庭总览、私有资源生命周期，以及保健、衣柜、采购、库存、盘点、补货和旧 Pantry API 兼容。`YUDAN` 到保留的 `yudan-wupin` 数据库使用幂等迁移脚本，生产迁移必须在备份和演练后执行。

## 技术架构

- Next.js 16 + React 19 + TypeScript；
- shadcn/ui + Radix UI + Tailwind CSS；
- Supabase PostgreSQL 与 Supabase Auth（邮箱密码为主，GitHub 可选）；
- Vercel 部署主应用；
- Cloudflare R2 保存图片和附件。

生产域名规划：主站 `https://cyz.ykn.cm`，公开资源 `https://cf-cyz.ykn.cm`；家庭私密资源只通过短时签名地址读取。

## 本地运行

1. 复制 `.env.example` 为 `.env.local`，按需填写本地环境变量；
2. 安装依赖：`npm install`；
3. 启动：`npm run dev`；
4. 打开 `http://localhost:3000`。

工程在没有外部服务密钥时也可以构建；实际数据库、认证和资源操作需要对应环境变量。

## 数据库

```text
npm run db:generate
npm run db:validate
npm run db:migrate:deploy
npm run db:seed
```

统一平台保留 `yudan-wupin` 为目标 Supabase 数据库，不删除现有库存数据。旧账本和健康数据先运行 `npm run migration:yudan:dry-run`，核对后才可使用 `npm run migration:yudan:apply`。详见 `docs/database/`。

## 质量检查

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

端到端测试使用 `npm run test:e2e`，首次运行前需要安装 Playwright 浏览器。

## 文档入口

- `计划.md`：完整产品与架构规划；
- `开发任务计划.md`：工作包、依赖与 Gate；
- `docs/database/`：Schema、ERD、认证钩子、历史数据迁移与回滚；
- `docs/auth/`：登录、邀请码、Auth Hook、GitHub 与生产安全配置；
- `docs/ledger/`：统一账本业务规则、接口与退款约束；
- `docs/care/`：儿童保健业务规则与接口；
- `docs/wardrobe/`：衣柜状态、账本和私有图片规则；
- `docs/consumables/`：消耗品库存、账本关联、撤销和旧 Pantry 兼容；
- `docs/orchestration/`：跨模块原子记账、幂等、退款和家庭总览；
- `docs/security/`：依赖安全审计与已知风险处置；
- `docs/adr/`：架构决策；
- `docs/contracts/`：公共接口与认证契约；
- `docs/deployment/platform.md`：Supabase、Vercel 与 Cloudflare 部署基线。
