import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function CustomerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );

  if (!configured) {
    return (
      <main className="setup-state">
        <div>
          <span className="label">Setup required</span>
          <h1 className="d2">Customer access is not configured yet.</h1>
          <p className="lede">
            Add the Supabase project URL and publishable key to enable secure
            customer routes.
          </p>
          <Link className="btn btn--ink" href="/">
            Return home
          </Link>
        </div>
      </main>
    );
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/sign-in");
  }

  return children;
}
