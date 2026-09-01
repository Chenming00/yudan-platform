export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="grid min-h-svh place-items-center bg-muted/40 px-4 py-10">
      {children}
    </main>
  );
}
