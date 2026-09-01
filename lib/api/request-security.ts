const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function isUntrustedMutationRequest(request: Pick<Request, "method" | "url" | "headers">) {
  if (safeMethods.has(request.method.toUpperCase())) return false;

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") return true;

  const origin = request.headers.get("origin");
  if (!origin) return false; // Non-browser API clients authenticate with scoped credentials.

  const trustedOrigins = new Set([new URL(request.url).origin]);
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (configuredAppUrl) {
    try {
      trustedOrigins.add(new URL(configuredAppUrl).origin);
    } catch {
      // Environment validation reports malformed URLs; do not trust them here.
    }
  }

  return !trustedOrigins.has(origin);
}
