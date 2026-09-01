import { ReceiptText } from "lucide-react";

import { ModulePlaceholder } from "@/components/modules/module-placeholder";

export default function LedgerPage() {
  return (
    <ModulePlaceholder
      description="平台唯一的财务事实来源，汇总收入、支出、退款和跨模块拆分。"
      features={["全部账目", "收支统计", "分类与账户"]}
      icon={ReceiptText}
      primaryAction="新增账目"
      title="家庭账本"
    />
  );
}

