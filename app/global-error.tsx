"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="zh-CN">
      <body className="grid min-h-svh place-items-center bg-background p-6 text-foreground">
        <main className="max-w-md text-center">
          <p className="text-sm font-medium text-destructive">系统错误</p>
          <h1 className="mt-2 font-heading text-2xl font-semibold">鱼蛋家庭暂时无法打开</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            数据没有被删除。请重新加载页面，或稍后再试。
          </p>
          <Button className="mt-5" onClick={reset}>
            重新加载
          </Button>
        </main>
      </body>
    </html>
  );
}

