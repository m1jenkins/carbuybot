import "server-only";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";

const adminRoleSchema = z.enum(["admin", "operator"]);

export type AdminIdentity = {
  id: string;
  role: z.infer<typeof adminRoleSchema>;
};

export function hasSupabaseConfiguration(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
}

export async function requireAdmin(): Promise<AdminIdentity> {
  if (!hasSupabaseConfiguration()) {
    throw new Error("Admin access is not configured.");
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/sign-in?next=%2Fadmin");
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  const role = adminRoleSchema.safeParse(assignment?.role);

  if (assignmentError || !role.success) {
    notFound();
  }

  return {
    id: user.id,
    role: role.data,
  };
}
