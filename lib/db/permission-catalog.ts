export const permissions = [
  ["platform.admin", "平台管理"],
  ["household.read", "查看家庭"],
  ["household.manage", "管理家庭"],
  ["members.manage", "管理成员"],
  ["invitations.manage", "管理邀请码"],
  ["ledger.read", "查看账本"],
  ["ledger.write", "编辑账本"],
  ["care.read", "查看儿童保健"],
  ["care.write", "编辑儿童保健"],
  ["wardrobe.read", "查看衣柜"],
  ["wardrobe.write", "编辑衣柜"],
  ["consumables.read", "查看消耗品"],
  ["consumables.write", "编辑消耗品"],
  ["media.read", "查看资源"],
  ["media.write", "管理资源"],
  ["audit.read", "查看审计日志"],
  ["api_credentials.manage", "管理 API 凭证"],
] as const;

const readPermissions = permissions
  .map(([code]) => code)
  .filter((code) => code.endsWith(".read"));

const editorPermissions = permissions
  .map(([code]) => code)
  .filter(
    (code) =>
      code.endsWith(".read") ||
      ["ledger.write", "care.write", "wardrobe.write", "consumables.write", "media.write"].includes(code),
  );

export const roles = [
  {
    code: "SUPER_ADMIN",
    name: "超级管理员",
    scope: "GLOBAL" as const,
    permissions: permissions.map(([code]) => code),
  },
  {
    code: "OWNER",
    name: "家庭所有者",
    scope: "HOUSEHOLD" as const,
    permissions: permissions
      .map(([code]) => code)
      .filter((code) => code !== "platform.admin"),
  },
  {
    code: "EDITOR",
    name: "家庭编辑者",
    scope: "HOUSEHOLD" as const,
    permissions: editorPermissions,
  },
  {
    code: "VIEWER",
    name: "家庭查看者",
    scope: "HOUSEHOLD" as const,
    permissions: readPermissions,
  },
] as const;
