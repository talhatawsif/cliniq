# SMART on FHIR launch

ClinIQ can be launched from the [SMART App Launcher](https://launch.smarthealthit.org) and then shows the launch
patient's chart from the sandbox's FHIR server. This is **SMART mode**: read-only, no writes of any kind.

## How it works

1. `GET /smart/launch` reads `iss` (and `launch` for an EHR launch). Only `https://launch.smarthealthit.org` is accepted as
   issuer. It fetches `.well-known/smart-configuration` (the endpoints must be on the same host), stores a one-use
   `state` and PKCE verifier in an encrypted httpOnly cookie, and redirects to the authorisation endpoint with
   `response_type=code`, `aud`, `state`, `code_challenge` (S256) and the scopes
   `openid fhirUser launch launch/patient patient/*.rs` (`patient/*.read` if the server does not advertise SMART v2).
2. `GET /smart/callback` checks `state`, exchanges the code with the verifier, and stores the access token, issuer and patient
   id in an AES-256-GCM sealed httpOnly cookie (`smart_session`, key from `SESSION_SECRET`). The token never reaches the
   browser's JavaScript or any page or RSC payload.
3. While the cookie is valid, `fhirFetch` reads from the launching server with that token, `src/proxy.ts` answers every
   non-GET request (except `/smart/*` and the CDS Hooks service) with `403 smart-read-only`, `fhirPost` refuses to run, and
   only the launch patient's chart is reachable. `/patients` redirects to it. A banner says so, with an exit button.

Settings: `SMART_CLIENT_ID` (the sandbox accepts any value; `cliniq`) and `SESSION_SECRET` (32+ random characters).
`SMART_REDIRECT_URI` is optional; by default the callback is on the same origin as the launch.

## Try it

- **Standalone:** open `https://cliniq-inky-ten.vercel.app/smart/launch`, log in as any practitioner, pick a patient, approve.
- **EHR launch:** open https://launch.smarthealthit.org, set the App Launch URL to
  `https://cliniq-inky-ten.vercel.app/smart/launch`, pick a patient and provider, and press Launch.

## Tests

- Unit (`src/lib/smart/smart.test.ts`): PKCE (RFC 7636 example), `state` mismatch, issuer allowlist, discovery host check,
  scope choice, sealed cookies (tamper, wrong secret, wrong purpose).
- Against the real sandbox, `npm run e2e:smart`: EHR launch and standalone launch open the chart; the token is not in the
  page; every write endpoint returns 403 `smart-read-only`; a wrong `state` is refused; another issuer is refused.

Screenshots: `docs/ui/screens/m12/`.

## Limits

No refresh token (the session ends when the token expires, about an hour), no `user/*` scopes, one launch patient per session,
and only the sandbox is an allowed issuer. SMART mode does not write audit rows under a user id (agent `smart-launch`).
