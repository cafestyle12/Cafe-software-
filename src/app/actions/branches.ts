"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, supabaseRequest } from "@/lib/supabase/auth";

export async function createBranchAction(formData: FormData) {
  const user=await getCurrentUser();
  const meta=user?.app_metadata;
  if(!user||meta?.cafeos_account_type!=="restaurant_owner"||meta.account_status!=="active"||meta.must_change_password) redirect("/login");
  const tenantId=String(formData.get("tenant_id")??"");
  const name=String(formData.get("name")??"").trim();
  const branchCode=String(formData.get("branch_code")??"").trim().toUpperCase();
  const timezone=String(formData.get("timezone")??"Asia/Kolkata");
  const city=String(formData.get("city")??"").trim();
  const state=String(formData.get("state")??"").trim();
  const pin=String(formData.get("pin_code")??"").trim();
  const contactPhone=String(formData.get("contact_phone")??"").trim();
  const openingHours=String(formData.get("opening_hours")??"").trim();
  if(!tenantId||!["Asia/Kolkata","Asia/Dubai","Europe/London","America/New_York"].includes(timezone)||name.length<2||name.length>120||branchCode.length<2||branchCode.length>24||!/^[A-Z0-9][A-Z0-9_-]*$/.test(branchCode)||city.length>100||state.length>100||contactPhone.length>32||openingHours.length>300|| (pin&&!/^[0-9A-Za-z -]{3,12}$/.test(pin))) redirect("/app/branches?error=Enter%20valid%20branch%20details");
  const membership=await supabaseRequest<Array<{id:string}>>(`/rest/v1/memberships?select=id&tenant_id=eq.${encodeURIComponent(tenantId)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&limit=1`);
  if(membership.error||!membership.data?.length) redirect("/app/branches?error=Workspace%20access%20denied");
  const result=await supabaseRequest("/rest/v1/branches",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({tenant_id:tenantId,name,branch_code:branchCode,timezone,status:"active",address:{city,state,pin_code:pin,country:"India"},contact_phone:contactPhone||null,opening_hours:openingHours?{notes:openingHours}:{}})});
  if(result.error) redirect("/app/branches?error="+encodeURIComponent(result.error.includes("unique")?"Branch name or code already exists in this restaurant.":result.error));
  revalidatePath("/app/branches"); revalidatePath("/app");
  redirect("/app/branches?created=1");
}
