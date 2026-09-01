import { ReceiptText } from "lucide-react";

import { ModulePlaceholder } from "@/components/modules/module-placeholder";

export default function NewLedgerEntryPage() {
  return (
    <ModulePlaceholder
      description="一次付款可以拆分到儿童保健、衣柜、消耗品和其他分类，并在一个事务中保存。"
      features={["付款信息", "用途拆分", "业务记录"]}
      icon={ReceiptText}
      primaryAction="保存账目"
      title="新增账目"
    />
  );
}

