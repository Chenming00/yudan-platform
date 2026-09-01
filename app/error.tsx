"use client";

import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg items-center px-4">
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>页面暂时无法加载</AlertTitle>
        <AlertDescription className="space-y-4">
          <p>请稍后重试。如果问题持续出现，可将请求编号提供给管理员。</p>
          <Button onClick={reset} size="sm" variant="outline">
            重新加载
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}

