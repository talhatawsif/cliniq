import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Public: sign-in, about, CDS Hooks, health. Everything else needs a session.
const PUBLIC = ["/sign-in", "/about", "/cds-services", "/api/health"];
const isPublic = (path: string) => PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  // The HL7 endpoint also accepts an integration key; the route checks it.
  if (pathname === "/api/hl7v2" && request.headers.has("x-api-key")) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data } = await supabase.auth.getClaims(); // refreshes an expired session
  if (data?.claims) return response;

  if (pathname.startsWith("/api/")) return Response.json({ error: "Sign in required" }, { status: 401 });
  return NextResponse.redirect(new URL("/sign-in", request.url));
}

export const config = { matcher: ["/((?!_next/static|_next/image|icon.svg).*)"] };
