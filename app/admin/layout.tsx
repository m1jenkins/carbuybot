import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  hasSupabaseConfiguration,
  requireAdmin,
} from "@/lib/auth/admin";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function signOut() {
  "use server";

  if (!hasSupabaseConfiguration()) {
    redirect("/sign-in");
  }
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!hasSupabaseConfiguration()) {
    return (
      <main className="setup-state">
        <div>
          <span className="label">Setup required</span>
          <h1 className="d2">Admin access is not configured.</h1>
          <p className="lede">
            Add the Supabase project URL and publishable key to enable the
            authenticated operations console.
          </p>
          <Link className="btn btn--ink" href="/">
            Return home
          </Link>
        </div>
      </main>
    );
  }

  const admin = await requireAdmin();

  return (
    <div className="admin-shell">
      <a className="skip" href="#admin-main">
        Skip to admin content
      </a>
      <header className="admin-header">
        <div className="wrap admin-header__inner">
          <Link
            className="admin-brand"
            href="/admin"
            aria-label="CarBuyerBots admin queue"
          >
            CarBuyerBots
          </Link>
          <span className="admin-role">
            {admin.role === "admin" ? "Admin" : "Operator"} console
          </span>
          <form action={signOut}>
            <button className="portal-signout" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
