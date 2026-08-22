import { normalizeEmail } from "../domain/engagement";

import { createAdminClient } from "./admin";
import { createServerClient } from "./server";

export async function claimPaidEngagements(
  userId: string,
  verifiedEmail: string,
): Promise<number> {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("An authenticated user is required to claim engagements");
  }
  if (!user.email || !user.email_confirmed_at) {
    throw new Error("A verified email is required to claim engagements");
  }

  const authEmail = normalizeEmail(user.email);
  const requestedEmail = normalizeEmail(verifiedEmail);

  if (user.id !== userId || authEmail !== requestedEmail) {
    throw new Error("Claim identity does not match the authenticated user");
  }

  const admin = createAdminClient();
  const { data: claimedCount, error: claimError } = await admin.rpc(
    "claim_paid_engagements",
    {
      p_user_id: user.id,
      p_verified_email: authEmail,
    },
  );

  if (claimError) {
    throw new Error(claimError.message);
  }

  return claimedCount;
}
