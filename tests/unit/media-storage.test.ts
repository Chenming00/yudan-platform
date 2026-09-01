import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { InMemoryMediaStorage } from "@/modules/media/memory-storage";
import { hasValidMagicBytes, validateUploadInput } from "@/modules/media/validation";

describe("media upload validation", () => {
  it("accepts a bounded JPEG whose extension matches", () => {
    expect(validateUploadInput({ fileName: "baby.JPG", contentType: "image/jpeg", byteSize: 1024 })).toMatchObject({ extension: "jpg", contentType: "image/jpeg" });
  });

  it("rejects executable and mismatched file names", () => {
    expect(() => validateUploadInput({ fileName: "photo.exe", contentType: "image/jpeg", byteSize: 100 })).toThrowError("文件扩展名与内容类型不匹配。");
    expect(() => validateUploadInput({ fileName: "script.js", contentType: "text/javascript", byteSize: 100 })).toThrowError(/仅支持/);
  });

  it("rejects oversized uploads", () => {
    expect(() => validateUploadInput({ fileName: "large.png", contentType: "image/png", byteSize: 16 * 1024 * 1024 })).toThrowError(/15 MB/);
  });

  it("checks real magic bytes including the WEBP marker", () => {
    expect(hasValidMagicBytes("image/png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(hasValidMagicBytes("image/webp", Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe(true);
    expect(hasValidMagicBytes("image/jpeg", Uint8Array.from([0x4d, 0x5a]))).toBe(false);
  });
});

describe("in-memory media storage", () => {
  it("supports upload inspection, private download and deletion without external services", async () => {
    const storage = new InMemoryMediaStorage();
    const object = { contentType: "image/jpeg", byteSize: 3, etag: "etag-1", firstBytes: Uint8Array.from([0xff, 0xd8, 0xff]) };
    storage.seedObject("private", "households/one/file.jpg", object);
    expect(await storage.inspectObject("private", "households/one/file.jpg")).toEqual(object);
    expect(await storage.createDownloadUrl("private", "households/one/file.jpg", 300)).toContain("memory://download/");
    await storage.copyObject("private", "public", "households/one/file.jpg");
    expect(await storage.inspectObject("public", "households/one/file.jpg")).toEqual(object);
    await storage.deleteObject("private", "households/one/file.jpg");
    expect(storage.deletedKeys).toEqual(["private/households/one/file.jpg"]);
  });
});

describe("media lifecycle schema", () => {
  const schema = readFileSync(resolve("prisma/schema.prisma"), "utf8");
  const migration = readFileSync(resolve("prisma/migrations/20260901190000_media_lifecycle/migration.sql"), "utf8");

  it("persists lifecycle state but never a presigned URL", () => {
    expect(schema).toContain("enum MediaStatus");
    expect(schema).toContain("uploadExpiresAt");
    expect(schema).not.toMatch(/uploadUrl|downloadUrl/);
    expect(migration).toContain("media_assets_lifecycle_check");
    expect(migration).toContain("DELETE_PENDING");
  });
});
