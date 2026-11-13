// CORS is open on /cds-services only (CDS Hooks clients run in the browser on other origins).
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};
export const preflight = () => new Response(null, { status: 204, headers: CORS });
