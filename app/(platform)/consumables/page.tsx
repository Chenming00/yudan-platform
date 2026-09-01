import { Boxes } from "lucide-react";

import { ModulePlaceholder } from "@/components/modules/module-placeholder";

export default function ConsumablesPage() {
  return (
    <ModulePlaceholder
      description="普通用户只管理当前库存；系统内部用入库记录维护到期日、成本和自动出库顺序。"
      features={["当前库存", "采购入库", "补货提醒"]}
      icon={Boxes}
      primaryAction="采购入库"
      title="消耗品"
    />
  );
}

