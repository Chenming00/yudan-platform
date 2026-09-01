import { z } from "zod";

export const uploadIntentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(128),
  byteSize: z.number().int().positive(),
  visibility: z.enum(["PRIVATE", "PUBLIC"]).default("PRIVATE"),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
});
export const mediaLinkSchema = z.object({
  assetId: z.uuid(),
  entityType: z.enum(["TRANSACTION", "CARE_RECORD", "WARDROBE_ITEM", "PRODUCT", "BABY_PROFILE"]),
  entityId: z.string().trim().min(1).max(200),
  purpose: z.string().trim().min(1).max(64).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});
