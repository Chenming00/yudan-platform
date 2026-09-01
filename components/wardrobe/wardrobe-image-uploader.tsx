"use client";

import { useRouter } from "next/navigation";

import { MediaUploader } from "@/components/media/media-uploader";
import type { MediaAssetView } from "@/modules/media/types";

export function WardrobeImageUploader({ itemId }: { itemId: string }) {
  const router = useRouter();
  async function link(asset: MediaAssetView) {
    const response = await fetch("/api/media/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: asset.id, entityType: "WARDROBE_ITEM", entityId: itemId, purpose: "photo" }),
    });
    if (!response.ok) throw new Error("图片已上传，但关联衣物失败。");
    router.refresh();
  }
  return <MediaUploader onUploaded={link} visibility="PRIVATE" />;
}
