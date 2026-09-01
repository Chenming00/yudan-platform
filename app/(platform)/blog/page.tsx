import { BookHeart } from "lucide-react";

import { ModulePlaceholder } from "@/components/modules/module-placeholder";

export default function BlogPage() {
  return (
    <ModulePlaceholder
      description="保存成长片段、家庭生活和可分享的内容，与私有健康记录保持边界。"
      features={["成长片段", "家庭相册", "公开分享"]}
      icon={BookHeart}
      primaryAction="写一篇"
      title="成长日志"
    />
  );
}

