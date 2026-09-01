import { Shirt } from "lucide-react";

import { ModulePlaceholder } from "@/components/modules/module-placeholder";

export default function WardrobePage() {
  return (
    <ModulePlaceholder
      description="管理衣物、尺码、季节和使用状态，购衣支出通过 Allocation 回到账本。"
      features={["衣物列表", "尺码提醒", "购衣统计"]}
      icon={Shirt}
      primaryAction="添加衣物"
      title="儿童衣柜"
    />
  );
}

