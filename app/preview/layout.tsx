import type { Metadata } from "next";
import type { ReactNode } from "react";

import { requireReviewFixture } from "@/lib/preview/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PreviewLayout({ children }: { children: ReactNode }) {
  requireReviewFixture();
  return children;
}
