import { Home } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6 text-center">
      <div>
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="mt-2 font-heading text-2xl font-semibold">没有找到这个页面</h1>
        <p className="mt-2 text-sm text-muted-foreground">它可能已被移动，或者地址输入有误。</p>
        <Button asChild className="mt-5">
          <Link href="/">
            <Home data-icon="inline-start" />
            返回家庭总览
          </Link>
        </Button>
      </div>
    </main>
  );
}

