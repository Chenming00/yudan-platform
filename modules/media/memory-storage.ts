import { AppError } from "@/lib/errors/app-error";
import type { ObjectStorage, StoredObjectInspection } from "@/modules/media/types";

export class InMemoryMediaStorage implements ObjectStorage {
  private readonly objects = new Map<string, StoredObjectInspection>();
  readonly deletedKeys: string[] = [];

  private key(bucket: string, objectKey: string) {
    return `${bucket}/${objectKey}`;
  }

  seedObject(bucket: string, objectKey: string, object: StoredObjectInspection) {
    this.objects.set(this.key(bucket, objectKey), object);
  }

  async createUploadUrl(input: { bucket: string; objectKey: string; contentType: string; byteSize: number; expiresInSeconds: number }) {
    return `memory://upload/${encodeURIComponent(this.key(input.bucket, input.objectKey))}?type=${encodeURIComponent(input.contentType)}&size=${input.byteSize}&expires=${input.expiresInSeconds}`;
  }

  async inspectObject(bucket: string, objectKey: string) {
    const object = this.objects.get(this.key(bucket, objectKey));
    if (!object) throw new AppError("RESOURCE_NOT_FOUND", "测试对象不存在。" );
    return object;
  }

  async createDownloadUrl(bucket: string, objectKey: string, expiresInSeconds: number) {
    if (!this.objects.has(this.key(bucket, objectKey))) throw new AppError("RESOURCE_NOT_FOUND", "测试对象不存在。" );
    return `memory://download/${encodeURIComponent(this.key(bucket, objectKey))}?expires=${expiresInSeconds}`;
  }

  async copyObject(sourceBucket: string, destinationBucket: string, objectKey: string) {
    const object = await this.inspectObject(sourceBucket, objectKey);
    this.objects.set(this.key(destinationBucket, objectKey), object);
  }

  async deleteObject(bucket: string, objectKey: string) {
    this.objects.delete(this.key(bucket, objectKey));
    this.deletedKeys.push(this.key(bucket, objectKey));
  }
}
