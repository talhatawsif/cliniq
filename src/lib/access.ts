type Claims = { email?: string; aal?: string; app_metadata?: object };

const role = (c: Claims) => (c.app_metadata as { role?: unknown } | undefined)?.role;

/** The read-only role: can look at everything, cannot write. Enforced where writes happen (actions and write routes). */
export const readOnly = (c: Claims) => role(c) === "viewer";

/**
 * Who may use the app: the shared demo account (password only), or a staff or viewer account (app_metadata.role,
 * set only with the service key) after an authenticator code. Any other signed-in user is refused, so open
 * sign-ups on the Supabase project give nothing.
 */
export function access(claims: Claims, demoEmail: string | undefined): "allow" | "mfa" | "deny" {
  if (demoEmail && claims.email === demoEmail) return "allow";
  if (!["staff", "viewer"].includes(role(claims) as string)) return "deny";
  return claims.aal === "aal2" ? "allow" : "mfa";
}
