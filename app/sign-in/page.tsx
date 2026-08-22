import Link from "next/link";
import type { Metadata } from "next";

import { MagicLinkForm } from "@/components/auth/magic-link-form";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type SignInPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    next?: string | string[];
  }>;
};

function safeDestination(value: string | string[] | undefined): string {
  const requested = Array.isArray(value) ? value[0] : value;
  if (
    !requested ||
    !requested.startsWith("/") ||
    requested.startsWith("//") ||
    requested.includes("\\")
  ) {
    return "/onboarding";
  }
  return requested;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );

  return (
    <main className="result-page">
      <div className="result-shell">
        <Link className="result-brand" href="/">
          CarBuyerBots
        </Link>
        <section className="result-copy" aria-labelledby="sign-in-title">
          <span className="label">Secure customer access</span>
          <h1 className="d2" id="sign-in-title">
            Sign in with your email.
          </h1>
          {!configured ? (
            <>
              <p className="lede">
                Customer access is not configured yet. Add the Supabase project
                URL and publishable key to enable secure sign-in.
              </p>
              <Link className="btn btn--light" href="/">
                Return home
              </Link>
            </>
          ) : (
            <>
              <p className="lede">
                We will email you a one-time link. Use the same verified email
                address from checkout.
              </p>
              {error === "auth" && (
                <p className="fstat err" role="alert">
                  That sign-in link is missing, expired, or could not be
                  verified. Request a new one below.
                </p>
              )}
              <MagicLinkForm destination={safeDestination(params.next)} />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
