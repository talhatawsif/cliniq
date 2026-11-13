import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { open } from "@/lib/smart/seal";

// Public: sign-in, about, CDS Hooks, health. Everything else needs a session.
const PUBLIC = ["/sign-in", "/about", "/cds-services", "/api/health", "/smart"];
const isPublic = (path: string) => PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // SMART mode (launched from the sandbox) is read-only: no write of any kind, on any path, while the cookie is valid.
  const secret = process.env.SESSION_SECRET;
  const smart = secret
    ? open<{ patient: string; exp: number }>(request.cookies.get("smart_session")?.value, secret, "session")
    : null;
  const inSmartMode = Boolean(smart && smart.exp > Date.now() / 1000);
  if (
    inSmartMode &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !pathname.startsWith("/smart/") &&
    !pathname.startsWith("/cds-services")
  ) {
    return Response.json(
      { error: "smart-read-only", message: "Writes are disabled in SMART mode." },
      { status: 403 },
    );
  }

  if (isPublic(pathname)) return NextResponse.next();

  // In SMART mode the launching patient's chart is the whole app: no demo sign-in needed for it.
  if (inSmartMode && smart) {
    if (pathname === `/patient/${smart.patient}` || pathname.startsWith(`/patient/${smart.patient}/`))
      return NextResponse.next();
    if (pathname === "/" || pathname === "/patients")
      return NextResponse.redirect(new URL(`/patient/${smart.patient}`, request.url));
  }

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
