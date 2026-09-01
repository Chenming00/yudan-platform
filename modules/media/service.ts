import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { authorize } from "@/lib/auth/authorization";
import { getR2Configuration, getObjectStorage, type R2Configuration } from "@/lib/cloudflare/r2";
import { getDatabase } from "@/lib/db/client";
import { AppError } from "@/lib/errors/app-error";
import type { ActionContext } from "@/lib/types/platform";
import type { CreateUploadIntentInput, MediaAssetView, MediaEntityType, ObjectStorage } from "@/modules/media/types";
import { hasValidMagicBytes, type AllowedMediaType, validateUploadInput } from "@/modules/media/validation";

const uploadExpirySeconds = 10 * 60;
const downloadExpirySeconds = 5 * 60;

const mediaSelect = {
  id: true,
  objectKey: true,
  visibility: true,
  status: true,
  originalName: true,
  mimeType: true,
  byteSize: true,
  checksumSha256: true,
  width: true,
  height: true,
  createdAt: true,
} as const;

function serializeMedia(asset: {
  id: string; objectKey: string; visibility: "PRIVATE" | "PUBLIC"; status: "PENDING" | "READY" | "DELETE_PENDING" | "DELETED";
  originalName: string | null; mimeType: string; byteSize: bigint; checksumSha256: string | null; width: number | null; height: number | null; createdAt: Date;
}): MediaAssetView {
  return { ...asset, byteSize: asset.byteSize.toString(), createdAt: asset.createdAt.toISOString() };
}

function objectKeyFor(householdId: string, assetId: string, extension: string, now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `households/${householdId}/${year}/${month}/${assetId}.${extension}`;
}

async function entityExists(db: PrismaClient, householdId: string, entityType: MediaEntityType, entityId: string) {
  if (entityType === "TRANSACTION") return Boolean(await db.transaction.findFirst({ where: { id: entityId, householdId, deletedAt: null }, select: { id: true } }));
  if (entityType === "CARE_RECORD") return Boolean(await db.careRecord.findFirst({ where: { id: entityId, householdId }, select: { id: true } }));
  if (entityType === "WARDROBE_ITEM") return Boolean(await db.wardrobeItem.findFirst({ where: { id: entityId, householdId }, select: { id: true } }));
  if (entityType === "PRODUCT") return Boolean(await db.product.findFirst({ where: { productCode: entityId, householdId }, select: { productCode: true } }));
  return Boolean(await db.babyProfile.findFirst({ where: { id: entityId, householdId }, select: { id: true } }));
}

export function createMediaService(
  storage: ObjectStorage = getObjectStorage(),
  configuration: R2Configuration = getR2Configuration(),
) {
  const db = getDatabase();

  async function createUploadIntent(context: ActionContext, input: CreateUploadIntentInput) {
    await authorize({ context, permission: "media.write" });
    const normalized = validateUploadInput(input);
    const visibility = input.visibility ?? "PRIVATE";
    if (visibility === "PUBLIC" && (!configuration.publicBucket || !configuration.publicBaseUrl)) throw new AppError("VALIDATION_FAILED", "公开资源桶或公开域名尚未配置。" );
    // Even public assets first land in the private bucket and are promoted only after validation.
    const bucket = configuration.privateBucket;
    const assetId = crypto.randomUUID();
    const objectKey = objectKeyFor(context.householdId, assetId, normalized.extension);
    const expiresAt = new Date(Date.now() + uploadExpirySeconds * 1000);
    const uploadUrl = await storage.createUploadUrl({ bucket, objectKey, contentType: normalized.contentType, byteSize: normalized.byteSize, expiresInSeconds: uploadExpirySeconds });

    await db.$transaction(async (tx) => {
      await tx.mediaAsset.create({ data: {
        id: assetId,
        householdId: context.householdId,
        uploadedByUserId: context.userId,
        objectKey,
        bucket,
        visibility,
        status: "PENDING",
        originalName: normalized.fileName,
        mimeType: normalized.contentType,
        byteSize: BigInt(normalized.byteSize),
        checksumSha256: normalized.checksumSha256,
        uploadExpiresAt: expiresAt,
      } });
      await writeAuditLog(tx, { action: "media.upload.requested", entityType: "MediaAsset", entityId: assetId, actorUserId: context.userId, householdId: context.householdId, requestId: context.requestId, afterData: { visibility, mimeType: normalized.contentType, byteSize: normalized.byteSize } });
    });
    return { assetId, objectKey, uploadUrl, method: "PUT" as const, headers: { "Content-Type": normalized.contentType }, expiresAt: expiresAt.toISOString() };
  }

  async function confirmUpload(context: ActionContext, assetId: string) {
    await authorize({ context, permission: "media.write", resourceId: assetId });
    const asset = await db.mediaAsset.findFirst({ where: { id: assetId, householdId: context.householdId, deletedAt: null } });
    if (!asset) throw new AppError("RESOURCE_NOT_FOUND", "资源不存在。" );
    if (asset.status === "READY") return serializeMedia(asset);
    if (asset.status !== "PENDING") throw new AppError("CONFLICT", "资源当前状态不可确认。" );
    if (!asset.uploadExpiresAt || asset.uploadExpiresAt < new Date()) throw new AppError("CONFLICT", "上传凭证已过期，请重新选择文件。" );
    const inspection = await storage.inspectObject(asset.bucket, asset.objectKey);
    if (inspection.byteSize !== Number(asset.byteSize)) throw new AppError("VALIDATION_FAILED", "R2 中的文件大小与上传申请不一致。" );
    if (inspection.contentType?.toLowerCase() !== asset.mimeType.toLowerCase()) throw new AppError("VALIDATION_FAILED", "R2 中的文件类型与上传申请不一致。" );
    if (!hasValidMagicBytes(asset.mimeType as AllowedMediaType, inspection.firstBytes)) throw new AppError("VALIDATION_FAILED", "文件内容与声明的类型不一致。" );
    let readyBucket = asset.bucket;
    if (asset.visibility === "PUBLIC") {
      if (!configuration.publicBucket) throw new AppError("INTERNAL_ERROR", "公开资源桶尚未配置。" );
      await storage.copyObject(asset.bucket, configuration.publicBucket, asset.objectKey);
      readyBucket = configuration.publicBucket;
    }

    try {
      const confirmed = await db.$transaction(async (tx) => {
        const updated = await tx.mediaAsset.update({ where: { id: asset.id }, data: { status: "READY", bucket: readyBucket, confirmedAt: new Date(), etag: inspection.etag }, select: mediaSelect });
        await writeAuditLog(tx, { action: "media.upload.confirmed", entityType: "MediaAsset", entityId: asset.id, actorUserId: context.userId, householdId: context.householdId, requestId: context.requestId, afterData: { etag: inspection.etag } });
        return serializeMedia(updated);
      });
      if (readyBucket !== asset.bucket) {
        try { await storage.deleteObject(asset.bucket, asset.objectKey); } catch { /* A private duplicate is safe and can be cleaned operationally. */ }
      }
      return confirmed;
    } catch (error) {
      if (readyBucket !== asset.bucket) {
        try { await storage.deleteObject(readyBucket, asset.objectKey); } catch { /* Preserve the database failure as the primary error. */ }
      }
      throw error;
    }
  }

  async function createDownloadUrl(context: ActionContext, assetId: string) {
    await authorize({ context, permission: "media.read", resourceId: assetId });
    const asset = await db.mediaAsset.findFirst({ where: { id: assetId, householdId: context.householdId, status: "READY", deletedAt: null }, select: { bucket: true, objectKey: true, visibility: true } });
    if (!asset) throw new AppError("RESOURCE_NOT_FOUND", "资源不存在或尚未完成上传。" );
    const expiresAt = new Date(Date.now() + downloadExpirySeconds * 1000);
    if (asset.visibility === "PUBLIC") {
      if (!configuration.publicBaseUrl) throw new AppError("INTERNAL_ERROR", "公开资源域名尚未配置。" );
      return { url: `${configuration.publicBaseUrl}/${asset.objectKey.split("/").map(encodeURIComponent).join("/")}`, expiresAt: expiresAt.toISOString() };
    }
    return { url: await storage.createDownloadUrl(asset.bucket, asset.objectKey, downloadExpirySeconds), expiresAt: expiresAt.toISOString() };
  }

  async function linkMedia(context: ActionContext, input: { assetId: string; entityType: MediaEntityType; entityId: string; purpose?: string; sortOrder?: number }) {
    await authorize({ context, permission: "media.write", resourceId: input.assetId });
    const [asset, targetExists] = await Promise.all([
      db.mediaAsset.findFirst({ where: { id: input.assetId, householdId: context.householdId, status: "READY", deletedAt: null }, select: { id: true } }),
      entityExists(db, context.householdId, input.entityType, input.entityId),
    ]);
    if (!asset || !targetExists) throw new AppError("RESOURCE_NOT_FOUND", "资源或关联目标不存在。" );
    const purpose = input.purpose?.trim() || "gallery";
    await db.mediaLink.upsert({
      where: { mediaAssetId_entityType_entityId_purpose: { mediaAssetId: input.assetId, entityType: input.entityType, entityId: input.entityId, purpose } },
      create: { householdId: context.householdId, mediaAssetId: input.assetId, entityType: input.entityType, entityId: input.entityId, purpose, sortOrder: input.sortOrder ?? 0 },
      update: { sortOrder: input.sortOrder ?? 0 },
    });
  }

  async function unlinkMedia(context: ActionContext, linkId: string) {
    await authorize({ context, permission: "media.write", resourceId: linkId });
    const result = await db.mediaLink.deleteMany({ where: { id: linkId, householdId: context.householdId } });
    if (!result.count) throw new AppError("RESOURCE_NOT_FOUND", "资源关联不存在。" );
  }

  async function listMediaForEntity(context: ActionContext, entityType: MediaEntityType, entityId: string) {
    await authorize({ context, permission: "media.read", resourceId: entityId });
    const links = await db.mediaLink.findMany({ where: { householdId: context.householdId, entityType, entityId, mediaAsset: { status: "READY", deletedAt: null } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { mediaAsset: { select: mediaSelect } } });
    return links.map((link) => serializeMedia(link.mediaAsset));
  }

  async function finishPhysicalDeletion(assetId: string, bucket: string, objectKey: string) {
    try {
      await storage.deleteObject(bucket, objectKey);
      await db.mediaAsset.update({ where: { id: assetId }, data: { status: "DELETED", deletionError: null, deletionAttempts: { increment: 1 } } });
    } catch (error) {
      await db.mediaAsset.update({ where: { id: assetId }, data: { deletionAttempts: { increment: 1 }, deletionError: error instanceof Error ? error.message.slice(0, 1_000) : "R2 delete failed" } });
    }
  }

  async function deleteMedia(context: ActionContext, assetId: string) {
    await authorize({ context, permission: "media.write", resourceId: assetId });
    const asset = await db.$transaction(async (tx) => {
      const existing = await tx.mediaAsset.findFirst({ where: { id: assetId, householdId: context.householdId, deletedAt: null }, select: { id: true, bucket: true, objectKey: true } });
      if (!existing) throw new AppError("RESOURCE_NOT_FOUND", "资源不存在。" );
      await tx.mediaAsset.update({ where: { id: assetId }, data: { status: "DELETE_PENDING", deletedAt: new Date() } });
      await writeAuditLog(tx, { action: "media.deleted", entityType: "MediaAsset", entityId: assetId, actorUserId: context.userId, householdId: context.householdId, requestId: context.requestId });
      return existing;
    });
    await finishPhysicalDeletion(asset.id, asset.bucket, asset.objectKey);
  }

  async function cleanupMedia(context: ActionContext, limit = 50) {
    await authorize({ context, permission: "media.write" });
    const stale = await db.mediaAsset.findMany({
      where: { householdId: context.householdId, OR: [{ status: "DELETE_PENDING" }, { status: "PENDING", uploadExpiresAt: { lt: new Date() } }] },
      orderBy: { createdAt: "asc" }, take: Math.min(Math.max(limit, 1), 100), select: { id: true, bucket: true, objectKey: true, status: true },
    });
    for (const asset of stale) {
      if (asset.status === "PENDING") await db.mediaAsset.update({ where: { id: asset.id }, data: { status: "DELETE_PENDING", deletedAt: new Date() } });
      await finishPhysicalDeletion(asset.id, asset.bucket, asset.objectKey);
    }
    return { processed: stale.length };
  }

  async function cleanupAllMedia(limit = 100) {
    const stale = await db.mediaAsset.findMany({
      where: { OR: [{ status: "DELETE_PENDING" }, { status: "PENDING", uploadExpiresAt: { lt: new Date() } }] },
      orderBy: { createdAt: "asc" }, take: Math.min(Math.max(limit, 1), 200), select: { id: true, bucket: true, objectKey: true, status: true },
    });
    for (const asset of stale) {
      if (asset.status === "PENDING") await db.mediaAsset.update({ where: { id: asset.id }, data: { status: "DELETE_PENDING", deletedAt: new Date() } });
      await finishPhysicalDeletion(asset.id, asset.bucket, asset.objectKey);
    }
    return { processed: stale.length };
  }

  return { createUploadIntent, confirmUpload, createDownloadUrl, linkMedia, unlinkMedia, listMediaForEntity, deleteMedia, cleanupMedia, cleanupAllMedia };
}

let defaultService: ReturnType<typeof createMediaService> | undefined;
function getDefaultService() {
  defaultService ??= createMediaService();
  return defaultService;
}

export const createUploadIntent: ReturnType<typeof createMediaService>["createUploadIntent"] = (...args) => getDefaultService().createUploadIntent(...args);
export const confirmUpload: ReturnType<typeof createMediaService>["confirmUpload"] = (...args) => getDefaultService().confirmUpload(...args);
export const createDownloadUrl: ReturnType<typeof createMediaService>["createDownloadUrl"] = (...args) => getDefaultService().createDownloadUrl(...args);
export const linkMedia: ReturnType<typeof createMediaService>["linkMedia"] = (...args) => getDefaultService().linkMedia(...args);
export const unlinkMedia: ReturnType<typeof createMediaService>["unlinkMedia"] = (...args) => getDefaultService().unlinkMedia(...args);
export const listMediaForEntity: ReturnType<typeof createMediaService>["listMediaForEntity"] = (...args) => getDefaultService().listMediaForEntity(...args);
export const deleteMedia: ReturnType<typeof createMediaService>["deleteMedia"] = (...args) => getDefaultService().deleteMedia(...args);
export const cleanupMedia: ReturnType<typeof createMediaService>["cleanupMedia"] = (...args) => getDefaultService().cleanupMedia(...args);
export const cleanupAllMedia: ReturnType<typeof createMediaService>["cleanupAllMedia"] = (...args) => getDefaultService().cleanupAllMedia(...args);
export const mediaService = { createUploadIntent, confirmUpload, createDownloadUrl, linkMedia, unlinkMedia, listMediaForEntity, deleteMedia, cleanupMedia, cleanupAllMedia };
