import "server-only";

import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { AppError } from "@/lib/errors/app-error";
import type { ObjectStorage } from "@/modules/media/types";

export interface R2Configuration {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  privateBucket: string;
  publicBucket?: string;
  publicBaseUrl?: string;
}

export function getR2Configuration(): R2Configuration {
  const configuration = {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    privateBucket: process.env.R2_PRIVATE_BUCKET,
    publicBucket: process.env.R2_PUBLIC_BUCKET,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, ""),
  };
  if (!configuration.accountId || !configuration.accessKeyId || !configuration.secretAccessKey || !configuration.privateBucket) {
    throw new AppError("INTERNAL_ERROR", "Cloudflare R2 尚未完成服务端配置。" );
  }
  return configuration as R2Configuration;
}

export class R2ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly configuration: R2Configuration = getR2Configuration()) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${configuration.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: configuration.accessKeyId, secretAccessKey: configuration.secretAccessKey },
    });
  }

  createUploadUrl(input: { bucket: string; objectKey: string; contentType: string; byteSize: number; expiresInSeconds: number }) {
    return getSignedUrl(this.client, new PutObjectCommand({
      Bucket: input.bucket,
      Key: input.objectKey,
      ContentType: input.contentType,
      ContentLength: input.byteSize,
    }), { expiresIn: input.expiresInSeconds });
  }

  async inspectObject(bucket: string, objectKey: string) {
    const [head, sample] = await Promise.all([
      this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey })),
      this.client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey, Range: "bytes=0-31" })),
    ]);
    const firstBytes = sample.Body ? await sample.Body.transformToByteArray() : new Uint8Array();
    return {
      contentType: head.ContentType ?? null,
      byteSize: head.ContentLength ?? 0,
      etag: head.ETag?.replace(/^"|"$/g, "") ?? null,
      firstBytes,
    };
  }

  createDownloadUrl(bucket: string, objectKey: string, expiresInSeconds: number) {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: bucket, Key: objectKey }), { expiresIn: expiresInSeconds });
  }

  async copyObject(sourceBucket: string, destinationBucket: string, objectKey: string) {
    await this.client.send(new CopyObjectCommand({ Bucket: destinationBucket, Key: objectKey, CopySource: `${sourceBucket}/${objectKey}` }));
  }

  async deleteObject(bucket: string, objectKey: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
  }
}

let sharedStorage: R2ObjectStorage | undefined;
export function getObjectStorage() {
  sharedStorage ??= new R2ObjectStorage();
  return sharedStorage;
}
