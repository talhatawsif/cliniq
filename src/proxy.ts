import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { access } from "@/lib/access";
import { open } from "@/lib/smart/seal";

// Public: the landing page, sign-in, about, CDS Hooks, health. Everything else needs a session.
const PUBLIC = ["/sign-in", "/about", "/cds-services", "/api/health", "/smart"];
const isPublic = (path: string) => path === "/" || PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));

const dev = process.env.NODE_ENV === "development";
// Scripts need this request's nonce (Next adds it to its own scripts); styles still allow inline (Tailwind/Next).
const policy = (nonce: string) =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = policy(nonce);
  // Built when called, so it carries any cookies Supabase refreshed on this request.
  const next = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return NextResponse.next({ request: { headers } });
  };
  const response = await handle(request, next);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

async function handle(request: NextRequest, next: () => NextResponse) {
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

  if (isPublic(pathname)) return next();

  // In SMART mode the launching patient's chart is the whole app: no demo sign-in needed for it.
  if (inSmartMode && smart) {
    if (pathname === `/patient/${smart.patient}` || pathname.startsWith(`/patient/${smart.patient}/`))
      return next();
    if (pathname === "/" || pathname === "/patients")
      return NextResponse.redirect(new URL(`/patient/${smart.patient}`, request.url));
  }

  // The HL7 endpoint also accepts an integration key; the route checks it.
  if (
    (pathname === "/api/hl7v2" || pathname === "/api/care-gaps/sweep") &&
    request.headers.has("x-api-key")
  ) {
    return next();
  }

  // A fresh clone without Supabase keys: say so instead of crashing every page.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    if (pathname.startsWith("/api/"))
      return Response.json({ error: "Sign-in is not configured" }, { status: 503 });
    return NextResponse.redirect(new URL("/sign-in?error=config", request.url));
  }

  let response = next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = next();
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data } = await supabase.auth.getClaims(); // refreshes an expired session
  if (data?.claims) {
    const verdict = access(data.claims, process.env.DEMO_CLINICIAN_EMAIL);
    if (verdict === "allow" || (verdict === "mfa" && pathname === "/mfa")) return response;
    if (pathname.startsWith("/api/"))
      return Response.json(
        { error: verdict === "mfa" ? "Authenticator code required" : "Not authorised" },
        { status: 403 },
      );
    return NextResponse.redirect(new URL(verdict === "mfa" ? "/mfa" : "/sign-in?error=denied", request.url));
  }

  if (pathname.startsWith("/api/")) return Response.json({ error: "Sign in required" }, { status: 401 });
  return NextResponse.redirect(new URL("/sign-in", request.url));
}

export const config = { matcher: ["/((?!_next/static|_next/image|icon.svg).*)"] };
