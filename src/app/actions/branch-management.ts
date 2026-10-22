"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, supabaseRequest } from "@/lib/supabase/auth";

async function requireOwner() {
  const user=await getCurrentUser(); const meta=user?.app_metadata;
  if(!user||meta?.cafeos_account_type!=="restaurant_owner"||meta.account_status!=="active"||meta.must_change_password) redirect("/login");
  return user;
}

export async function updateBranchAction(formData:FormData) {
 const user=await requireOwner();
 const tenantId=String(formData.get("tenant_id")??"");
 const branchId=String(formData.get("branch_id")??"");
 const name=String(formData.get("name")??"").trim();
 const code=String(formData.get("branch_code")??"").trim().toUpperCase();
 const timezone=String(formData.get("timezone")??"Asia/Kolkata");
 const city=String(formData.get("city")??"").trim();
 const state=String(formData.get("state")??"").trim();
 const pin=String(formData.get("pin_code")??"").trim();
 const contactPhone=String(formData.get("contact_phone")??"").trim();
 const openingHours=String(formData.get("opening_hours")??"").trim();
 if(!tenantId||!branchId||!["Asia/Kolkata","Asia/Dubai","Europe/London","America/New_York"].includes(timezone)||name.length<2||name.length>120||code.length<2||code.length>24||!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)||city.length>100||state.length>100||contactPhone.length>32||openingHours.length>300||(pin&&!/^[0-9A-Za-z -]{3,12}$/.test(pin))) redirect("/app/branches?error=Invalid%20branch%20details");
 const member=await supabaseRequest<Array<{id:string}>>(`/rest/v1/memberships?select=id&tenant_id=eq.${encodeURIComponent(tenantId)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&limit=1`);
 if(member.error||!member.data?.length) redirect("/app/branches?error=Workspace%20access%20denied");
 const r=await supabaseRequest(`/rest/v1/branches?id=eq.${encodeURIComponent(branchId)}&tenant_id=eq.${encodeURIComponent(tenantId)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({name,branch_code:code,timezone,address:{city,state,pin_code:pin,country:"India"},contact_phone:contactPhone||null,opening_hours:openingHours?{notes:openingHours}:{},updated_at:new Date().toISOString()})});
 if(r.error) redirect("/app/branches?error="+encodeURIComponent(r.error.includes("unique")?"Branch code already exists.": "Could not update branch."));
 revalidatePath("/app/branches"); redirect("/app/branches?updated=1");
}

export async function deactivateBranchAction(formData:FormData) {
 await requireOwner();
 const tenantId=String(formData.get("tenant_id")??"");
 const branchId=String(formData.get("branch_id")??"");
 if(!tenantId||!branchId) redirect("/app/branches?error=Missing%20branch");
 const result=await supabaseRequest("/rest/v1/rpc/deactivate_cafe_branch",{method:"POST",body:JSON.stringify({p_tenant_id:tenantId,p_branch_id:branchId})});
 if(result.error) {
  const message=result.error.includes("active_table_session")?"This branch has an active table session. Wait for it to expire before deactivation.":result.error.includes("permission_denied")?"Workspace access denied.":"Could not deactivate branch.";
  redirect("/app/branches?error="+encodeURIComponent(message));
 }
 revalidatePath("/app/branches"); revalidatePath("/app/floor-plan"); redirect("/app/branches?deactivated=1");
}

export async function updateRestaurantProfileAction(formData:FormData) {
 const user=await requireOwner();
 const tenantId=String(formData.get("tenant_id")??"");
 const name=String(formData.get("name")??"").trim();
 const phone=String(formData.get("contact_phone")??"").trim();
 const city=String(formData.get("city")??"").trim();
 const state=String(formData.get("state")??"").trim();
 const pin=String(formData.get("pin_code")??"").trim();
 const timezone=String(formData.get("default_timezone")??"Asia/Kolkata");
 if(!tenantId||name.length<2||name.length>120||phone.length>32||city.length>100||state.length>100||(pin&&!/^[0-9A-Za-z -]{3,12}$/.test(pin))||!["Asia/Kolkata","Asia/Dubai","Europe/London","America/New_York"].includes(timezone)) redirect("/app/branches?error=Invalid%20restaurant%20profile");
 const member=await supabaseRequest<Array<{id:string}>>(`/rest/v1/memberships?select=id&tenant_id=eq.${encodeURIComponent(tenantId)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&limit=1`);
 if(member.error||!member.data?.length) redirect("/app/branches?error=Workspace%20access%20denied");
 const r=await supabaseRequest(`/rest/v1/tenants?id=eq.${encodeURIComponent(tenantId)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({name,contact_phone:phone||null,address:{city,state,pin_code:pin,country:"India"},default_timezone:timezone,updated_at:new Date().toISOString()})});
 if(r.error) redirect("/app/branches?error=Could%20not%20update%20restaurant%20profile");
 revalidatePath("/app"); revalidatePath("/app/branches"); redirect("/app/branches?profileUpdated=1");
}
