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
 if(!tenantId||!branchId||name.length<2||name.length>120||code.length<2||code.length>24||!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)||city.length>100||state.length>100||(pin&&!/^[0-9A-Za-z -]{3,12}$/.test(pin))) redirect("/app/branches?error=Invalid%20branch%20details");
 const member=await supabaseRequest<Array<{id:string}>>(`/rest/v1/memberships?select=id&tenant_id=eq.${encodeURIComponent(tenantId)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&limit=1`);
 if(member.error||!member.data?.length) redirect("/app/branches?error=Workspace%20access%20denied");
 const r=await supabaseRequest(`/rest/v1/branches?id=eq.${encodeURIComponent(branchId)}&tenant_id=eq.${encodeURIComponent(tenantId)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({name,branch_code:code,timezone,address:{city,state,pin_code:pin,country:"India"},updated_at:new Date().toISOString()})});
 if(r.error) redirect("/app/branches?error="+encodeURIComponent(r.error.includes("unique")?"Branch code already exists.": "Could not update branch."));
 revalidatePath("/app/branches"); redirect("/app/branches?updated=1");
}

export async function deactivateBranchAction(formData:FormData) {
 const user=await requireOwner();
 const tenantId=String(formData.get("tenant_id")??"");
 const branchId=String(formData.get("branch_id")??"");
 if(!tenantId||!branchId) redirect("/app/branches?error=Missing%20branch");
 const member=await supabaseRequest<Array<{id:string}>>(`/rest/v1/memberships?select=id&tenant_id=eq.${encodeURIComponent(tenantId)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&limit=1`);
 if(member.error||!member.data?.length) redirect("/app/branches?error=Workspace%20access%20denied");
 const deps=await supabaseRequest<Array<{id:string}>>(`/rest/v1/table_sessions?select=id&tenant_id=eq.${encodeURIComponent(tenantId)}&branch_id=eq.${encodeURIComponent(branchId)}&status=eq.active&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`);
 if(deps.data?.length) redirect("/app/branches?error=This%20branch%20has%20an%20active%20table%20session.%20Resolve%20it%20before%20deactivation.");
 const r=await supabaseRequest(`/rest/v1/branches?id=eq.${encodeURIComponent(branchId)}&tenant_id=eq.${encodeURIComponent(tenantId)}&status=eq.active`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"inactive",updated_at:new Date().toISOString()})});
 if(r.error) redirect("/app/branches?error=Could%20not%20deactivate%20branch.");
 const qr=await supabaseRequest(`/rest/v1/table_qr_credentials?tenant_id=eq.${encodeURIComponent(tenantId)}&branch_id=eq.${encodeURIComponent(branchId)}&status=eq.active`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"revoked",revoked_at:new Date().toISOString()})});
 if(qr.error) redirect("/app/branches?error=Branch%20was%20deactivated%20but%20QR%20revocation%20needs%20administrator%20review.");
 revalidatePath("/app/branches"); revalidatePath("/app/floor-plan"); redirect("/app/branches?deactivated=1");
}
