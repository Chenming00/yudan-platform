"use client";

import { CheckCircle2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MediaAssetView, MediaVisibility, UploadIntent } from "@/modules/media/types";

type ApiResult<T> = { success: true; data: T } | { success: false; error: { message: string } };

async function sha256(file: File) {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function MediaUploader({ visibility = "PRIVATE", onUploaded }: { visibility?: MediaVisibility; onUploaded?: (asset: MediaAssetView) => void | Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>();

  async function upload() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setStatus("uploading");
    setMessage("正在准备安全上传…");
    try {
      const intentResponse = await fetch("/api/media/upload-intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, byteSize: file.size, visibility, checksumSha256: await sha256(file) }),
      });
      const intentBody = await intentResponse.json() as ApiResult<UploadIntent>;
      if (!intentBody.success) throw new Error(intentBody.error.message);
      setMessage("正在直接上传到 Cloudflare R2…");
      const uploadResponse = await fetch(intentBody.data.uploadUrl, { method: "PUT", headers: intentBody.data.headers, body: file });
      if (!uploadResponse.ok) throw new Error("文件上传失败，请检查 R2 CORS 配置后重试。");
      setMessage("正在验证文件…");
      const confirmResponse = await fetch(`/api/media/${intentBody.data.assetId}/confirm`, { method: "POST" });
      const confirmBody = await confirmResponse.json() as ApiResult<MediaAssetView>;
      if (!confirmBody.success) throw new Error(confirmBody.error.message);
      setStatus("done");
      setMessage("文件已安全保存。");
      await onUploaded?.(confirmBody.data);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "上传失败，请稍后重试。");
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2"><Label htmlFor="media-file">选择图片或 PDF</Label><Input accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" disabled={status === "uploading"} id="media-file" ref={inputRef} type="file" /></div>
      <Button disabled={status === "uploading"} onClick={upload} type="button"><UploadCloud />{status === "uploading" ? "上传中…" : "上传文件"}</Button>
      {message ? <Alert variant={status === "error" ? "destructive" : "default"}>{status === "done" ? <CheckCircle2 /> : null}<AlertTitle>{status === "error" ? "上传未完成" : status === "done" ? "上传成功" : "上传进度"}</AlertTitle><AlertDescription>{message}</AlertDescription></Alert> : null}
    </div>
  );
}
