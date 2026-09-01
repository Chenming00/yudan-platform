import { AppError } from "@/lib/errors/app-error";

export const allowedMediaTypes = {
  "image/jpeg": { extension: "jpg", signatures: [[0xff, 0xd8, 0xff]], maxBytes: 15 * 1024 * 1024 },
  "image/png": { extension: "png", signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]], maxBytes: 15 * 1024 * 1024 },
  "image/webp": { extension: "webp", signatures: [[0x52, 0x49, 0x46, 0x46]], maxBytes: 15 * 1024 * 1024 },
  "image/gif": { extension: "gif", signatures: [[0x47, 0x49, 0x46, 0x38]], maxBytes: 15 * 1024 * 1024 },
  "application/pdf": { extension: "pdf", signatures: [[0x25, 0x50, 0x44, 0x46]], maxBytes: 25 * 1024 * 1024 },
} as const;

export type AllowedMediaType = keyof typeof allowedMediaTypes;

export function validateUploadInput(input: { fileName: string; contentType: string; byteSize: number; checksumSha256?: string }) {
  const contentType = input.contentType.toLowerCase() as AllowedMediaType;
  const rule = allowedMediaTypes[contentType];
  if (!rule) throw new AppError("VALIDATION_FAILED", "仅支持 JPEG、PNG、WebP、GIF 图片和 PDF 文件。" );
  if (!Number.isSafeInteger(input.byteSize) || input.byteSize <= 0 || input.byteSize > rule.maxBytes) throw new AppError("VALIDATION_FAILED", `文件大小必须在 1 字节到 ${Math.floor(rule.maxBytes / 1024 / 1024)} MB 之间。`);
  const fileName = input.fileName.trim().slice(0, 255);
  const lowerName = fileName.toLowerCase();
  if (!fileName || !lowerName.endsWith(`.${rule.extension}`) && !(contentType === "image/jpeg" && lowerName.endsWith(".jpeg"))) throw new AppError("VALIDATION_FAILED", "文件扩展名与内容类型不匹配。" );
  if (input.checksumSha256 && !/^[a-f0-9]{64}$/i.test(input.checksumSha256)) throw new AppError("VALIDATION_FAILED", "SHA-256 校验值格式不正确。" );
  return { fileName, contentType, byteSize: input.byteSize, extension: rule.extension, checksumSha256: input.checksumSha256?.toLowerCase() };
}

export function hasValidMagicBytes(contentType: AllowedMediaType, bytes: Uint8Array) {
  if (contentType === "image/webp") {
    return bytes.length >= 12 && [0x52, 0x49, 0x46, 0x46].every((value, index) => bytes[index] === value) && [0x57, 0x45, 0x42, 0x50].every((value, index) => bytes[index + 8] === value);
  }
  return allowedMediaTypes[contentType].signatures.some((signature) => signature.every((value, index) => bytes[index] === value));
}
