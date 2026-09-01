import type { ActionContext, IsoDateTime } from "@/lib/types/platform";

export type MediaVisibility = "PRIVATE" | "PUBLIC";
export type MediaStatus = "PENDING" | "READY" | "DELETE_PENDING" | "DELETED";
export type MediaEntityType = "TRANSACTION" | "CARE_RECORD" | "WARDROBE_ITEM" | "PRODUCT" | "BABY_PROFILE";

export interface CreateUploadIntentInput {
  fileName: string;
  contentType: string;
  byteSize: number;
  visibility?: MediaVisibility;
  checksumSha256?: string;
}

export interface UploadIntent {
  assetId: string;
  objectKey: string;
  uploadUrl: string;
  method: "PUT";
  headers: { "Content-Type": string };
  expiresAt: IsoDateTime;
}

export interface StoredObjectInspection {
  contentType: string | null;
  byteSize: number;
  etag: string | null;
  firstBytes: Uint8Array;
}

export interface ObjectStorage {
  createUploadUrl(input: { bucket: string; objectKey: string; contentType: string; byteSize: number; expiresInSeconds: number }): Promise<string>;
  inspectObject(bucket: string, objectKey: string): Promise<StoredObjectInspection>;
  copyObject(sourceBucket: string, destinationBucket: string, objectKey: string): Promise<void>;
  createDownloadUrl(bucket: string, objectKey: string, expiresInSeconds: number): Promise<string>;
  deleteObject(bucket: string, objectKey: string): Promise<void>;
}

export interface MediaAssetView {
  id: string;
  objectKey: string;
  visibility: MediaVisibility;
  status: MediaStatus;
  originalName: string | null;
  mimeType: string;
  byteSize: string;
  checksumSha256: string | null;
  width: number | null;
  height: number | null;
  createdAt: IsoDateTime;
}

export interface MediaService {
  createUploadIntent(context: ActionContext, input: CreateUploadIntentInput): Promise<UploadIntent>;
  confirmUpload(context: ActionContext, assetId: string): Promise<MediaAssetView>;
  createDownloadUrl(context: ActionContext, assetId: string): Promise<{ url: string; expiresAt: IsoDateTime }>;
  linkMedia(context: ActionContext, input: { assetId: string; entityType: MediaEntityType; entityId: string; purpose?: string; sortOrder?: number }): Promise<void>;
  unlinkMedia(context: ActionContext, linkId: string): Promise<void>;
  listMediaForEntity(context: ActionContext, entityType: MediaEntityType, entityId: string): Promise<MediaAssetView[]>;
  deleteMedia(context: ActionContext, assetId: string): Promise<void>;
}

