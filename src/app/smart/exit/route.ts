import { NextResponse } from "next/server";
import { clearSession } from "@/lib/smart/session";

/** Leaves SMART mode (POST, so a link cannot do it). */
export async function POST(request: Request) {
  await clearSession();
  return NextResponse.redirect(new URL("/sign-in", request.url), 303);
}
