import Link from "next/link";
import type { ReactNode } from "react";

import { ReviewFixtureNotice } from "./review-fixture-notice";

type AdminReviewShellProps = {
  children: ReactNode;
  surface: string;
};

export function AdminReviewShell({
  children,
  surface,
}: AdminReviewShellProps) {
  return (
    <>
      <ReviewFixtureNotice surface={surface} />
      <div className="admin-shell">
        <a className="skip" href="#admin-main">
          Skip to admin content
        </a>
        <header className="admin-header">
          <div className="wrap admin-header__inner">
            <Link
              className="admin-brand"
              href="/preview/admin"
              aria-label="CarBuyerBots admin queue"
            >
              CarBuyerBots
            </Link>
            <span className="admin-role">Admin console</span>
            <button
              className="portal-signout"
              type="button"
              disabled
              title="Sign out is unavailable in the local review fixture"
            >
              Sign out
            </button>
          </div>
        </header>
        {children}
      </div>
    </>
  );
}
