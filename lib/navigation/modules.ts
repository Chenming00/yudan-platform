export const platformModules = [
  {
    key: "dashboard",
    label: "总览",
    href: "/",
    description: "家庭开支和重要提醒",
  },
  {
    key: "ledger",
    label: "账本",
    href: "/ledger",
    description: "全部收入、支出和退款",
  },
  {
    key: "care",
    label: "儿童保健",
    href: "/care",
    description: "儿保、疫苗和成长记录",
  },
  {
    key: "wardrobe",
    label: "衣柜",
    href: "/wardrobe",
    description: "衣物、尺码和购衣开支",
  },
  {
    key: "consumables",
    label: "消耗品",
    href: "/consumables",
    description: "库存、采购和补货提醒",
  },
  {
    key: "blog",
    label: "成长日志",
    href: "/blog",
    description: "记录家庭生活和成长片段",
  },
  {
    key: "settings",
    label: "设置",
    href: "/settings",
    description: "成员、权限和系统设置",
  },
] as const;

export type PlatformModuleKey = (typeof platformModules)[number]["key"];

