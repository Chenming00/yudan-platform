import { Bell, ChevronDown, Plus } from "lucide-react";
import Link from "next/link";

import { PlatformNav } from "@/components/navigation/platform-nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-svh bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-sidebar lg:flex lg:flex-col">
        <div className="flex h-18 items-center gap-3 border-b px-5">
          <div className="grid size-9 place-items-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
            鱼
          </div>
          <div>
            <p className="font-heading text-sm font-semibold">鱼蛋家庭</p>
            <p className="text-xs text-muted-foreground">开支与成长管理</p>
          </div>
        </div>
        <PlatformNav />
        <div className="mt-auto border-t p-4">
          <p className="text-xs leading-5 text-muted-foreground">
            Supabase 数据库与登录
            <br />
            Cloudflare 私有资源
          </p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="grid size-8 place-items-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
              鱼
            </div>
            <span className="font-heading text-sm font-semibold">鱼蛋家庭</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button asChild className="hidden sm:inline-flex">
              <Link href="/ledger/new">
                <Plus data-icon="inline-start" />
                记一笔
              </Link>
            </Button>
            <Button aria-label="查看提醒" size="icon" variant="ghost">
              <Bell />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button aria-label="打开用户菜单" className="gap-2" variant="ghost">
                  <Avatar className="size-6">
                    <AvatarFallback>WC</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-xs sm:inline">家庭管理员</span>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p>家庭管理员</p>
                  <p className="font-normal text-muted-foreground">登录后显示账户信息</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">账户与权限</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
          {children}
        </main>
      </div>

      <PlatformNav mobile />
    </div>
  );
}

