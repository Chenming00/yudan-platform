"use client";

import { useRouter } from "next/navigation";

import { MediaUploader } from "@/components/media/media-uploader";
import type { MediaAssetView } from "@/modules/media/types";

export function ProductImageUploader({ productCode }: { productCode: string }) {
  const router = useRouter();
  async function link(asset: MediaAssetView) {
    const response = await fetch("/api/media/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: asset.id, entityType: "PRODUCT", entityId: productCode, purpose: "photo" }),
    });
    if (!response.ok) throw new Error("图片已上传，但关联产品失败。");
    router.refresh();
  }
  return <MediaUploader onUploaded={link} visibility="PRIVATE" />;
}
