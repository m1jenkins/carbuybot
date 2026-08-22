import { NextResponse } from "next/server";

import {
  normalizeRequestedEngagementId,
  selectCustomerEngagement,
} from "@/lib/domain/engagement-selection";
import { claimPaidEngagements } from "@/lib/supabase/claim";
import { createServerClient } from "@/lib/supabase/server";

function hasSupabaseConfiguration(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
}

function safeInternalDestination(
  requestUrl: URL,
  requested: string | null,
): string {
  if (
    !requested ||
    !requested.startsWith("/") ||
    requested.startsWith("//") ||
    requested.includes("\\")
  ) {
    return "/onboarding";
  }

  try {
    const destination = new URL(requested, requestUrl.origin);
    if (destination.origin !== requestUrl.origin) {
      return "/onboarding";
    }
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/onboarding";
  }
}

function signInRedirect(
  requestUrl: URL,
  error: "auth" | "setup",
  next: string,
) {
  const destination = new URL("/sign-in", requestUrl.origin);
  destination.searchParams.set("error", error);
  destination.searchParams.set("next", next);
  return NextResponse.redirect(destination);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = safeInternalDestination(
    requestUrl,
    requestUrl.searchParams.get("next"),
  );

  if (!hasSupabaseConfiguration()) {
    return signInRedirect(requestUrl, "setup", next);
  }

  const code = requestUrl.searchParams.get("code");
  if (!code) {
    return signInRedirect(requestUrl, "auth", next);
  }

  try {
    const supabase = await createServerClient();
    const flowId = requestUrl.searchParams.get("sb_flow_id");
    const { error: exchangeError } = flowId
      ? await supabase.auth.exchangeCodeForSession(code, { flowId })
      : await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return signInRedirect(requestUrl, "auth", next);
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (
      userError ||
      !user?.email ||
      !user.email_confirmed_at
    ) {
      return signInRedirect(requestUrl, "auth", next);
    }

    await claimPaidEngagements(user.id, user.email);

    const { data: engagements, error: engagementError } = await supabase
      .from("engagements")
      .select("created_at, id, payment_status, workflow_status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (engagementError) {
      return signInRedirect(requestUrl, "auth", next);
    }

    const requestedDestination = new URL(next, requestUrl.origin);
    const requestedEngagementId = normalizeRequestedEngagementId(
      requestedDestination.searchParams.get("engagement") ?? undefined,
    );
    const engagement = selectCustomerEngagement(
      engagements ?? [],
      requestedEngagementId,
    );
    if (!engagement) {
      if (
        requestedDestination.pathname === "/portal" &&
        requestedDestination.searchParams.get("payment") === "processing"
      ) {
        return NextResponse.redirect(
          new URL("/portal?payment=processing", requestUrl.origin),
        );
      }
      return NextResponse.redirect(new URL("/portal", requestUrl.origin));
    }

    const editable =
      engagement.payment_status === "paid" &&
      (engagement.workflow_status === "awaiting_brief" ||
        engagement.workflow_status === "brief_submitted");
    const route = editable ? "/onboarding" : "/portal";
    const destination = new URL(route, requestUrl.origin);
    destination.searchParams.set("engagement", engagement.id);
    return NextResponse.redirect(destination);
  } catch {
    return signInRedirect(requestUrl, "auth", next);
  }
}
