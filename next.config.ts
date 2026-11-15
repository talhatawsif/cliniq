import type { NextConfig } from "next";

// The Content-Security-Policy (with a per-request script nonce) is set in src/proxy.ts.
const nextConfig: NextConfig = {
  // The /hl7 page lists sample messages with readdirSync, which the file tracer cannot follow.
  outputFileTracingIncludes: { "/hl7": ["./data/hl7v2/**"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
