type Claims = { email?: string; aal?: string; app_metadata?: object };

/**
 * Who may use the app: the shared demo account (password only), or a staff account (app_metadata.role "staff",
 * set only with the service key) after an authenticator code. Any other signed-in user is refused, so open
 * sign-ups on the Supabase project give nothing.
 */
export function access(claims: Claims, demoEmail: string | undefined): "allow" | "mfa" | "deny" {
  if (demoEmail && claims.email === demoEmail) return "allow";
  if ((claims.app_metadata as { role?: unknown } | undefined)?.role !== "staff") return "deny";
  return claims.aal === "aal2" ? "allow" : "mfa";
}
