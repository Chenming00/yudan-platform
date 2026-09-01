import { Settings } from "lucide-react";

import { ModulePlaceholder } from "@/components/modules/module-placeholder";

export default function SettingsPage() {
  return (
    <ModulePlaceholder
      description="管理家庭成员、角色权限、邀请码、分类、账户和平台集成。"
      features={["成员与角色", "邀请码", "平台集成"]}
      icon={Settings}
      primaryAction="保存设置"
      title="系统设置"
    />
  );
}

