import "server-only";

import { notFound } from "next/navigation";

export function isReviewFixtureEnabled(): boolean {
  return (
    process.env.APP_DEMO_MODE === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

export function requireReviewFixture(): void {
  if (!isReviewFixtureEnabled()) {
    notFound();
  }
}
