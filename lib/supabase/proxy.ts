import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isUntrustedMutationRequest } from "@/lib/api/request-security";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

const publicRoutes = ["/login", "/register", "/forgot-password", "/reset-password", "/auth"];

function isPublicRoute(pathname: string) {
  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function updateSession(request: NextRequest) {
  if (isUntrustedMutationRequest(request)) {
    return NextResponse.json(
      { success: false, error: { code: "PERMISSION_DENIED", message: "跨来源写请求已被拒绝。" } },
      { status: 403 },
    );
  }

  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Keep this immediately after client creation so refresh cookies stay in sync.
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims && !isPublicRoute(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
