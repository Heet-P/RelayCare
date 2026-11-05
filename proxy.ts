import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every page request. Authorization is NOT done
 * here (Next.js: proxy is for optimistic checks only); every page and route re-checks access.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Skip static assets and webhook/job endpoints (machine callers have no session).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/jobs|.*\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
