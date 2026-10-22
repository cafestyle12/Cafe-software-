"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, siteUrl, supabaseRequest } from "@/lib/supabase/auth";

function validLabel(value: string, max = 40) {
  return value.trim().length >= 1 && value.trim().length <= max;
}

async function requireOwnerSession() {
  const user = await getCurrentUser();
  const meta = user?.app_metadata;
  if (!user || meta?.cafeos_account_type !== "restaurant_owner" || meta.account_status !== "active" || meta.must_change_password) redirect("/login");
  return user;
}

export async function createCafeTableAction(formData: FormData) {
  await requireOwnerSession();
  const tenantId = String(formData.get("tenant_id") ?? "");
  const branchId = String(formData.get("branch_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const zoneId = String(formData.get("zone_id") ?? "").trim() || null;
  const capacity = Number(formData.get("capacity") ?? 2);
  const shape = String(formData.get("shape") ?? "round");
  if (!tenantId || !branchId || !validLabel(label) || !Number.isInteger(capacity) || capacity < 1 || capacity > 100 || !["round","square","rectangle","booth"].includes(shape)) {
    redirect("/app/floor-plan?error=Check%20the%20table%20details");
  }
  const branch = await supabaseRequest<Array<{id:string;tenant_id:string;status:string}>>(
    `/rest/v1/branches?select=id,tenant_id,status&id=eq.${encodeURIComponent(branchId)}&tenant_id=eq.${encodeURIComponent(tenantId)}&status=eq.active&limit=1`
  );
  if (branch.error || !branch.data?.length) redirect("/app/floor-plan?error=Branch%20is%20unavailable%20or%20you%20do%20not%20have%20access");
  const result = await supabaseRequest("/rest/v1/cafe_tables", {
    method:"POST", headers:{Prefer:"return=minimal"},
    body:JSON.stringify({tenant_id:tenantId,branch_id:branchId,zone_id:zoneId,label,capacity,shape,width:shape==="rectangle"?140:90,height:shape==="rectangle"?80:90,x:40,y:40,status:"active"})
  });
  if(result.error) redirect("/app/floor-plan?error="+encodeURIComponent(result.error.includes("unique") ? "That table label already exists in this branch." : result.error));
  revalidatePath("/app/floor-plan");
  redirect("/app/floor-plan?created=1");
}

export async function updateCafeTableAction(formData: FormData) {
  await requireOwnerSession();
  const tenantId=String(formData.get("tenant_id")??"");
  const branchId=String(formData.get("branch_id")??"");
  const tableId=String(formData.get("table_id")??"");
  const label=String(formData.get("label")??"").trim();
  const capacity=Number(formData.get("capacity")??0);
  const zoneId=String(formData.get("zone_id")??"").trim()||null;
  const shape=String(formData.get("shape")??"");
  if(!tenantId||!branchId||!tableId||!validLabel(label)||!Number.isInteger(capacity)||capacity<1||capacity>100||!["round","square","rectangle","booth"].includes(shape)) redirect("/app/floor-plan?error=Invalid%20table%20details");
  const result=await supabaseRequest(`/rest/v1/cafe_tables?id=eq.${encodeURIComponent(tableId)}&tenant_id=eq.${encodeURIComponent(tenantId)}&branch_id=eq.${encodeURIComponent(branchId)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({label,capacity,zone_id:zoneId,shape,width:shape==="rectangle"?140:90,height:shape==="rectangle"?80:90,updated_at:new Date().toISOString()})});
  if(result.error) redirect("/app/floor-plan?error="+encodeURIComponent(result.error.includes("unique")?"That table label already exists in this branch.":result.error));
  revalidatePath("/app/floor-plan");
  redirect("/app/floor-plan?updated=1");
}

export async function createSeatingZoneAction(formData: FormData) {
  await requireOwnerSession();
  const tenantId=String(formData.get("tenant_id")??"");
  const branchId=String(formData.get("branch_id")??"");
  const name=String(formData.get("name")??"").trim();
  if(!tenantId||!branchId||!validLabel(name,80)) redirect("/app/floor-plan?error=Enter%20a%20valid%20zone%20name");
  const branch=await supabaseRequest<Array<{id:string}>>(`/rest/v1/branches?select=id&id=eq.${encodeURIComponent(branchId)}&tenant_id=eq.${encodeURIComponent(tenantId)}&status=eq.active&limit=1`);
  if(branch.error||!branch.data?.length) redirect("/app/floor-plan?error=Branch%20access%20denied");
  const result=await supabaseRequest("/rest/v1/seating_zones",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({tenant_id:tenantId,branch_id:branchId,name,status:"active"})});
  if(result.error) redirect("/app/floor-plan?error="+encodeURIComponent(result.error.includes("unique")?"That zone already exists.":result.error));
  revalidatePath("/app/floor-plan");
  redirect("/app/floor-plan?zoneCreated=1");
}

export async function deactivateCafeTableAction(formData: FormData) {
  await requireOwnerSession();
  const tenantId=String(formData.get("tenant_id")??"");
  const branchId=String(formData.get("branch_id")??"");
  const tableId=String(formData.get("table_id")??"");
  if(!tenantId||!branchId||!tableId) redirect("/app/floor-plan?error=Missing%20table%20details");
  const result=await supabaseRequest("/rest/v1/rpc/deactivate_cafe_table",{method:"POST",body:JSON.stringify({p_tenant_id:tenantId,p_branch_id:branchId,p_table_id:tableId})});
  if(result.error) {
    const message=result.error.includes("active_table_session")?"This table has an active customer session. Wait for it to expire before deactivation.":result.error.includes("permission_denied")?"Workspace access denied.":"Could not deactivate table.";
    redirect("/app/floor-plan?error="+encodeURIComponent(message));
  }
  revalidatePath("/app/floor-plan"); redirect("/app/floor-plan?tableDeactivated=1");
}

export async function updateSeatingZoneAction(formData: FormData) {
  const user=await requireOwnerSession();
  const tenantId=String(formData.get("tenant_id")??"");
  const branchId=String(formData.get("branch_id")??"");
  const zoneId=String(formData.get("zone_id")??"");
  const name=String(formData.get("name")??"").trim();
  if(!tenantId||!branchId||!zoneId||!validLabel(name,80)) redirect("/app/floor-plan?error=Enter%20a%20valid%20zone%20name");
  const membership=await supabaseRequest<Array<{id:string}>>(`/rest/v1/memberships?select=id&tenant_id=eq.${encodeURIComponent(tenantId)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&limit=1`);
  if(membership.error||!membership.data?.length) redirect("/app/floor-plan?error=Workspace%20access%20denied");
  const result=await supabaseRequest(`/rest/v1/seating_zones?id=eq.${encodeURIComponent(zoneId)}&tenant_id=eq.${encodeURIComponent(tenantId)}&branch_id=eq.${encodeURIComponent(branchId)}&status=eq.active`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({name,updated_at:new Date().toISOString()})});
  if(result.error) redirect("/app/floor-plan?error="+encodeURIComponent(result.error.includes("unique")?"That zone name already exists.":"Could not update zone."));
  revalidatePath("/app/floor-plan"); redirect("/app/floor-plan?zoneUpdated=1");
}

export async function deactivateSeatingZoneAction(formData: FormData) {
  await requireOwnerSession();
  const tenantId=String(formData.get("tenant_id")??"");
  const branchId=String(formData.get("branch_id")??"");
  const zoneId=String(formData.get("zone_id")??"");
  if(!tenantId||!branchId||!zoneId) redirect("/app/floor-plan?error=Missing%20zone%20details");
  const result=await supabaseRequest("/rest/v1/rpc/deactivate_seating_zone",{method:"POST",body:JSON.stringify({p_tenant_id:tenantId,p_branch_id:branchId,p_zone_id:zoneId})});
  if(result.error) {
    const message=result.error.includes("zone_has_active_tables")?"Move or deactivate active tables in this zone first.":result.error.includes("permission_denied")?"Workspace access denied.":"Could not deactivate zone.";
    redirect("/app/floor-plan?error="+encodeURIComponent(message));
  }
  revalidatePath("/app/floor-plan"); redirect("/app/floor-plan?zoneDeactivated=1");
}

export type BatchQrItem = { tableId: string; tableLabel: string; url: string };
export type BatchQrState = { error?: string; items?: BatchQrItem[] };

export async function issueTableQrBatchAction(_previous: BatchQrState, formData: FormData): Promise<BatchQrState> {
  await requireOwnerSession();
  const tenantId=String(formData.get("tenant_id")??"");
  const branchId=String(formData.get("branch_id")??"");
  const tableIds=[...new Set(formData.getAll("table_id").map(v=>String(v)).filter(Boolean))];
  if(!tenantId||!branchId||tableIds.length<1||tableIds.length>50||tableIds.some(id=>!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) return {error:"Select between 1 and 50 valid tables."};
  const baseUrl=siteUrl();
  if(!baseUrl) return {error:"The site URL is not configured. No QR credentials were issued."};
  const inFilter=tableIds.map(id=>encodeURIComponent(id)).join(",");
  const tables=await supabaseRequest<Array<{id:string;label:string;status:string}>>(`/rest/v1/cafe_tables?select=id,label,status&tenant_id=eq.${encodeURIComponent(tenantId)}&branch_id=eq.${encodeURIComponent(branchId)}&id=in.(${inFilter})&status=eq.active`);
  if(tables.error||tables.data?.length!==tableIds.length) return {error:"One or more selected tables are unavailable."};
  const tokens=tables.data.map(table=>({tableId:table.id,tableLabel:table.label,token:randomBytes(32).toString("base64url")}));
  const result=await supabaseRequest<number>("/rest/v1/rpc/issue_table_qr_batch",{method:"POST",body:JSON.stringify({p_tenant_id:tenantId,p_branch_id:branchId,p_items:tokens.map(t=>({table_id:t.tableId,token_hash:createHash("sha256").update(t.token).digest("hex")}))})});
  if(result.error) {
    const message=result.error.includes("active_qr_exists")?"At least one selected table already has an active QR. Revoke it first, then retry the batch.":result.error.includes("permission_denied")?"Workspace access denied.":"The QR batch could not be issued. No partial batch was saved.";
    return {error:message};
  }
  revalidatePath("/app/floor-plan");
  return {items:tokens.map(t=>({tableId:t.tableId,tableLabel:t.tableLabel,url:baseUrl+"/t/"+t.token}))};
}

export type IssueQrState = { error?: string; url?: string; tableLabel?: string };

export async function issueTableQrAction(_previous: IssueQrState, formData: FormData): Promise<IssueQrState> {
  const user=await requireOwnerSession();
  const tenantId=String(formData.get("tenant_id")??"");
  const branchId=String(formData.get("branch_id")??"");
  const tableId=String(formData.get("table_id")??"");
  if(!tenantId||!branchId||!tableId) return {error:"Missing table details."};
  const table=await supabaseRequest<Array<{id:string;label:string;status:string}>>(`/rest/v1/cafe_tables?select=id,label,status&id=eq.${encodeURIComponent(tableId)}&tenant_id=eq.${encodeURIComponent(tenantId)}&branch_id=eq.${encodeURIComponent(branchId)}&status=eq.active&limit=1`);
  if(table.error||!table.data?.length) return {error:"Table access denied."};
  const baseUrl=siteUrl();
  if(!baseUrl) return {error:"NEXT_PUBLIC_SITE_URL is not configured. No QR credential was issued."};
  const token=randomBytes(32).toString("base64url");
  const tokenHash=createHash("sha256").update(token).digest("hex");
  const created=await supabaseRequest("/rest/v1/table_qr_credentials",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({tenant_id:tenantId,branch_id:branchId,table_id:tableId,token_hash:tokenHash,created_by:user.id,status:"active"})});
  if(created.error) return {error:"Could not create QR. Check permissions and migration status."};
  revalidatePath("/app/floor-plan");
  return {url:baseUrl+"/t/"+token,tableLabel:table.data[0].label};
}

export async function revokeTableQrAction(formData: FormData) {
  await requireOwnerSession();
  const tenantId=String(formData.get("tenant_id")??"");
  const branchId=String(formData.get("branch_id")??"");
  const credentialId=String(formData.get("credential_id")??"");
  if(!tenantId||!branchId||!credentialId) redirect("/app/floor-plan?error=Missing%20QR%20details");
  const result=await supabaseRequest("/rest/v1/rpc/revoke_table_qr",{method:"POST",body:JSON.stringify({p_tenant_id:tenantId,p_branch_id:branchId,p_credential_id:credentialId})});
  if(result.error) redirect("/app/floor-plan?error=Could%20not%20revoke%20QR%20or%20its%20active%20sessions");
  revalidatePath("/app/floor-plan");
  redirect("/app/floor-plan?qrRevoked=1");
}
