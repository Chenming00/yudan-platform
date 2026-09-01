import { AppShell } from "@/components/layout/app-shell";
import { requirePlatformActor } from "@/lib/auth/session";

export default async function PlatformLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const actor = await requirePlatformActor();
  return <AppShell actor={actor}>{children}</AppShell>;
}

