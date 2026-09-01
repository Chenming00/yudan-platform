"use client";

import {
  Baby,
  BookHeart,
  BookOpenText,
  Boxes,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Shirt,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { platformModules, type PlatformModuleKey } from "@/lib/navigation/modules";
import { cn } from "@/lib/utils";

const iconByModule: Record<PlatformModuleKey, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  ledger: ReceiptText,
  care: Baby,
  wardrobe: Shirt,
  consumables: Boxes,
  blog: BookHeart,
  settings: Settings,
};

const mobileModuleKeys = new Set<PlatformModuleKey>([
  "dashboard",
  "ledger",
  "care",
  "wardrobe",
  "consumables",
]);

export function PlatformNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const items = mobile
    ? platformModules.filter((item) => mobileModuleKeys.has(item.key))
    : platformModules;

  if (mobile) {
    return (
      <nav
        aria-label="主要模块"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur lg:hidden"
      >
        {items.map((item) => {
          const Icon = iconByModule[item.key];
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[0.68rem] text-muted-foreground transition-colors",
                active && "bg-accent text-accent-foreground",
              )}
              href={item.href}
              key={item.key}
            >
              <Icon className="size-4" />
              <span className="truncate">{item.label === "儿童保健" ? "保健" : item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="平台模块" className="flex flex-1 flex-col gap-1 p-3">
      <p className="px-3 pb-2 pt-1 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        家庭空间
      </p>
      {items.map((item) => {
        const Icon = iconByModule[item.key];
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
            )}
            href={item.href}
            key={item.key}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
      <div className="mt-3 rounded-lg border bg-background/50 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium">
          <BookOpenText className="size-3.5" />
          统一账本
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          保健、衣柜和消耗品开支都会回到账本，不重复统计。
        </p>
      </div>
    </nav>
  );
}

