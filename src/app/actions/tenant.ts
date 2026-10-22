"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, supabaseRequest } from "@/lib/supabase/auth";
import { normalizeTenantSlug } from "@/lib/tenant";

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createTenantAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const name = formValue(formData, "tenant_name");
  const branchName = formValue(formData, "branch_name");
  const requestedSlug = formValue(formData, "tenant_slug");
  const slug = normalizeTenantSlug(requestedSlug || name);

  if (name.length < 2 || name.length > 120 || branchName.length < 2 || branchName.length > 120 || slug.length < 2) {
    redirect("/onboarding?error=Enter%20a%20valid%20workspace%20name%2C%20slug%2C%20and%20first%20branch");
  }

  const result = await supabaseRequest<string>("/rest/v1/rpc/create_tenant_with_branch", {
    method: "POST",
    body: JSON.stringify({ tenant_name: name, tenant_slug: slug, branch_name: branchName }),
  });
  if (result.error || !result.data) {
    const message = result.error?.toLowerCase().includes("duplicate key") || result.error?.toLowerCase().includes("unique")
      ? "That workspace URL is already taken. Choose another slug."
      : "Workspace setup could not be completed. Check the details and try again.";
    redirect(`/onboarding?error=${encodeURIComponent(message)}`);
  }
  redirect("/app?created=1");
}
