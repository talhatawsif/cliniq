import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans } from "next/font/google";
import Link from "next/link";
import { signOut } from "@/app/actions";
import { smartSession } from "@/lib/smart/session";
import { currentUserId } from "@/lib/supabase";
import "./globals.css";

const sans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "ClinIQ", template: "%s · ClinIQ" },
  description: "Clinical coding and interoperability prototype. Synthetic data only.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const smart = await smartSession();
  const signedIn = Boolean(await currentUserId());
  return (
    <html lang="en-AU" className={`${sans.variable} ${mono.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-4 border-b border-line bg-surface px-4 xl:px-6">
          <Link href="/patients" className="font-semibold text-fg no-underline">
            ClinIQ
          </Link>
          <form action="/patients" role="search" className="flex-1">
            <label htmlFor="q" className="sr-only">
              Search patients by name or IHI
            </label>
            <input
              id="q"
              name="q"
              type="search"
              placeholder="Search patients: name or IHI"
              className="h-8 w-full max-w-md rounded border border-line-strong bg-surface px-2 text-fg placeholder:text-muted"
            />
          </form>
          <span className="text-xs text-muted">Demo · synthetic data</span>
          {signedIn && (
            <>
              <Link href="/pipeline" className="text-[13px]">
                Pipeline
              </Link>
              <Link href="/review" className="text-[13px]">
                Review
              </Link>
              <Link href="/hl7" className="text-[13px]">
                HL7
              </Link>
              <Link href="/audit" className="text-[13px]">
                Audit
              </Link>
              <form action={signOut}>
                <button type="submit" className="text-[13px] underline">
                  Sign out
                </button>
              </form>
            </>
          )}
        </header>
        {smart && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-x-4 border-b border-line bg-sunken px-4 py-1 text-[13px] xl:px-6"
            data-testid="smart-banner"
          >
            <span>
              <strong>SMART mode, read-only.</strong> Showing data from {new URL(smart.iss).host}. Writing,
              review, HL7 and the pipeline are disabled.
            </span>
            <form action="/smart/exit" method="post">
              <button type="submit" className="underline">
                Exit SMART mode
              </button>
            </form>
          </div>
        )}
        {children}
        <footer className="border-t border-line px-4 py-3 text-xs text-muted xl:px-6">
          Synthetic data only; not a medical device. SNOMED CT® is a registered trademark of SNOMED
          International. SNOMED CT-AU is published by the Australian Digital Health Agency and accessed
          through the CSIRO Ontoserver test endpoint. ICD-10-AM mapping needs an IHACPA licence and is not
          included.
        </footer>
      </body>
    </html>
  );
}
