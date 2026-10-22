"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, supabaseRequest } from "@/lib/supabase/auth";

type Position={id:string;x:number;y:number;width:number;height:number;rotation:number};
export type SaveFloorPlanState={error?:string;success?:string;version?:number};

export async function saveFloorPlanAction(_previous:SaveFloorPlanState,formData:FormData):Promise<SaveFloorPlanState>{
 const user=await getCurrentUser(); const meta=user?.app_metadata;
 if(!user||meta?.cafeos_account_type!=="restaurant_owner"||meta.account_status!=="active"||meta.must_change_password) return {error:"Sign in again to save the floor plan."};
 const tenantId=String(formData.get("tenant_id")??"");
 const branchId=String(formData.get("branch_id")??"");
 const expectedVersion=Number(formData.get("version"));
 let positions:Position[];
 try { positions=JSON.parse(String(formData.get("positions")??"[]")) as Position[]; } catch { return {error:"Floor plan data is invalid."}; }
 if(!tenantId||!branchId||!Number.isInteger(expectedVersion)||expectedVersion<1||!Array.isArray(positions)||positions.length>200) return {error:"Floor plan data is invalid."};
 const seen=new Set<string>();
 for(const p of positions){
  if(!p||typeof p.id!=="string"||seen.has(p.id)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.width)||!Number.isFinite(p.height)||!Number.isInteger(p.rotation)||p.x<0||p.x>10000||p.y<0||p.y>10000||p.width<30||p.width>500||p.height<30||p.height>500||p.rotation<0||p.rotation>359) return {error:"One or more table positions are invalid."};
  seen.add(p.id);
 }
 const result=await supabaseRequest<number>("/rest/v1/rpc/save_cafeos_floor_plan",{method:"POST",body:JSON.stringify({p_tenant_id:tenantId,p_branch_id:branchId,p_expected_version:expectedVersion,p_positions:positions})});
 if(result.error) return {error:result.error.includes("layout_conflict")||result.status===409?"Someone else saved a newer layout. Reload before editing again.":"Could not save layout. Check branch permissions and try again."};
 revalidatePath("/app/floor-plan");
 return {success:"Floor plan saved.",version:typeof result.data==="number"?result.data:expectedVersion+1};
}
