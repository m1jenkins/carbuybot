import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import type { Database } from "@/lib/supabase/database.types";

const CUSTOMER_PATHS = ["/onboarding", "/portal"] as const;

function isCustomerPath(pathname: string): boolean {
  return CUSTOMER_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function configuredSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && key ? { url, key } : null;
}

function copySessionHeaders(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(header);
    if (value) {
      target.headers.set(header, value);
    }
  }
  return target;
}

export async function proxy(request: NextRequest) {
  const configuration = configuredSupabase();
  if (!configuration) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    configuration.url,
    configuration.key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, cacheHeaders) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(cacheHeaders).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  if (
    isCustomerPath(request.nextUrl.pathname) &&
    (error || !data?.claims?.sub)
  ) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    signInUrl.search = "";
    signInUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return copySessionHeaders(response, NextResponse.redirect(signInUrl));
  }

  return response;
}

export const config = {
  matcher: ["/onboarding/:path*", "/portal/:path*"],
};
