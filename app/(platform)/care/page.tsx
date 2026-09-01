import { Baby } from "lucide-react";

import { ModulePlaceholder } from "@/components/modules/module-placeholder";

export default function CarePage() {
  return (
    <ModulePlaceholder
      description="记录儿保、疫苗、医疗、药品和生长数据，并将付费项目关联到家庭账本。"
      features={["保健时间线", "疫苗计划", "生长趋势"]}
      icon={Baby}
      primaryAction="新增记录"
      title="儿童保健"
    />
  );
}

