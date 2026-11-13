import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans } from "next/font/google";
import Link from "next/link";
import { signOut } from "@/app/actions";
import { currentUserId } from "@/lib/supabase";
import "./globals.css";

const sans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "ClinIQ", template: "%s · ClinIQ" },
  description: "Clinical coding and interoperability prototype. Synthetic data only.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
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
        {children}
      </body>
    </html>
  );
}
