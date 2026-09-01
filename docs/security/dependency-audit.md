# 依赖安全审计

审计日期：2026-09-01。

- Next.js 已从 16.2.9 升级到当前稳定版 16.3.4，消除已公开的 Middleware/Proxy 绕过、Server Action DoS/SSRF 和旧 Sharp/PostCSS 链路问题。
- Prisma 固定在当前稳定版 7.10.0。`npm audit` 仍报告其配置解析依赖 `deepmerge-ts@7.1.5` 的递归对象栈耗尽问题；Prisma 稳定版本暂未提供可用修复。
- 该 Prisma 风险位于 CLI/配置合并路径，配置文件来自仓库且不接受 HTTP、注册信息或导入数据作为对象图输入。生产业务请求不会调用配置合并逻辑。
- 不用 Prisma 8 RC 替换稳定版。每次升级数据库依赖时重新运行审计；Prisma 7 稳定修复发布后优先升级并全量回归。

常规命令：`npm audit --omit=dev`。禁止为了清零审计结果直接运行带破坏性升级的 `npm audit fix --force`。
