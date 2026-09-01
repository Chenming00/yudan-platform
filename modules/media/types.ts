import type { ActionContext } from "@/lib/types/platform";

export interface UploadIntent {
  objectKey: string;
  uploadUrl: string;
  expiresAt: string;
}

export interface MediaStorage {
  createUploadIntent(
    context: ActionContext,
    input: { contentType: string; size: number; visibility: "PRIVATE" | "PUBLIC" },
  ): Promise<UploadIntent>;
  confirmUpload(context: ActionContext, objectKey: string): Promise<void>;
  createDownloadUrl(
    context: ActionContext,
    objectKey: string,
  ): Promise<{ url: string; expiresAt: string }>;
  deleteObject(context: ActionContext, objectKey: string): Promise<void>;
}

