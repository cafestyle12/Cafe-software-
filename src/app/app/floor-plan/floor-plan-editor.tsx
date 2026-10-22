"use client";

import { useActionState, useMemo, useState } from "react";
import { saveFloorPlanAction, type SaveFloorPlanState } from "@/app/actions/floor-plan-layout";

type TableItem={id:string;label:string;capacity:number;shape:string;x:number;y:number;width:number;height:number;rotation:number;status:string};
const initial:SaveFloorPlanState={};

export function FloorPlanEditor({tenantId,branchId,version,tables}:{tenantId:string;branchId:string;version:number;tables:TableItem[]}) {
 const [positions,setPositions]=useState(()=>tables.filter(t=>t.status==="active").map(t=>({id:t.id,x:Number(t.x),y:Number(t.y),width:Number(t.width),height:Number(t.height),rotation:Number(t.rotation)})));
 const [dragging,setDragging]=useState<string|null>(null);
 const [state,action,pending]=useActionState(saveFloorPlanAction,initial);
 const [notice,setNotice]=useState("");
 const positionById=useMemo(()=>new Map(positions.map(p=>[p.id,p])),[positions]);
 function update(id:string,patch:Partial<{x:number;y:number;width:number;height:number;rotation:number}>) {setPositions(old=>old.map(p=>p.id===id?{...p,...patch}:p));}
 function pointerMove(e:React.PointerEvent<HTMLDivElement>,id:string){
  if(dragging!==id)return;
  const rect=e.currentTarget.getBoundingClientRect();
  const logicalX=Math.round(Math.max(0,Math.min(940,((e.clientX-rect.left)/rect.width)*1000-30)));
  const logicalY=Math.round(Math.max(0,Math.min(640,((e.clientY-rect.top)/rect.height)*700-30)));
  update(id,{x:logicalX,y:logicalY});
 }
 return <section className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
  <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Interactive floor plan</h2><p className="mt-1 text-xs text-[var(--muted)]">Drag tables to move. Use Rotate and arrow keys for accessible positioning.</p></div><span className="text-xs text-[var(--muted)]">Layout version {state.version??version}</span></div>
  {state.error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
  {(state.success||notice)&&<p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{state.success||notice}</p>}
  <form action={action} className="mt-4">
   <input type="hidden" name="tenant_id" value={tenantId}/><input type="hidden" name="branch_id" value={branchId}/><input type="hidden" name="version" value={state.version??version}/><input type="hidden" name="positions" value={JSON.stringify(positions)}/>
   <div className="relative mx-auto touch-pan-y overflow-hidden rounded-xl border border-dashed border-[var(--border)] bg-[linear-gradient(to_right,#e9e9e2_1px,transparent_1px),linear-gradient(to_bottom,#e9e9e2_1px,transparent_1px)]" style={{aspectRatio:"10 / 7",backgroundSize:"5% 7.142%"}}>
    <div className="absolute inset-0" onPointerMove={e=>{if(dragging)pointerMove(e,dragging)}} onPointerUp={()=>setDragging(null)} onPointerCancel={()=>setDragging(null)}>
     {tables.filter(t=>t.status!=="inactive").map(t=>{const p=positionById.get(t.id)??{x:t.x,y:t.y,width:t.width,height:t.height,rotation:t.rotation};const width=Math.max(6,Math.min(30,((p.width??t.width)/1000)*100));const height=Math.max(7,Math.min(30,((p.height??t.height)/700)*100));return <div key={t.id} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);setDragging(t.id)}} onPointerUp={()=>setDragging(null)} role="group" aria-label={"Table "+t.label} tabIndex={0} onKeyDown={e=>{const delta=e.shiftKey?20:5;if(e.key==="ArrowLeft"){e.preventDefault();update(t.id,{x:Math.max(0,p.x-delta)})}if(e.key==="ArrowRight"){e.preventDefault();update(t.id,{x:Math.min(940,p.x+delta)})}if(e.key==="ArrowUp"){e.preventDefault();update(t.id,{y:Math.max(0,p.y-delta)})}if(e.key==="ArrowDown"){e.preventDefault();update(t.id,{y:Math.min(640,p.y+delta)})}}} className={"absolute grid cursor-grab touch-none select-none place-items-center border-2 border-[var(--accent)] bg-[#e8efe6] text-center shadow-sm active:cursor-grabbing "+(t.shape==="round"?"rounded-full":t.shape==="booth"?"rounded-2xl":"rounded-lg")} style={{left:(p.x/1000)*100+"%",top:(p.y/700)*100+"%",width:width+"%",height:height+"%",transform:"rotate("+p.rotation+"deg)"}}><span className="text-[10px] font-bold sm:text-xs">{t.label}</span><span className="text-[8px] sm:text-[10px]">{t.capacity} seats</span></div>})}
    </div>
   </div>
   <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{tables.filter(t=>t.status!=="inactive").map(t=><div key={t.id} className="flex flex-wrap items-center gap-1 rounded-lg border border-[var(--border)] p-2"><span className="mr-1 text-xs font-semibold">{t.label}</span><button type="button" onClick={()=>update(t.id,{rotation:((positionById.get(t.id)?.rotation??0)+15)%360})} className="rounded border px-2 py-1 text-xs">Rotate</button><button type="button" onClick={()=>update(t.id,{width:Math.min(300,(positionById.get(t.id)?.width??t.width)+10)})} className="rounded border px-2 py-1 text-xs">W+</button><button type="button" onClick={()=>update(t.id,{width:Math.max(30,(positionById.get(t.id)?.width??t.width)-10)})} className="rounded border px-2 py-1 text-xs">W−</button><button type="button" onClick={()=>update(t.id,{height:Math.min(210,(positionById.get(t.id)?.height??t.height)+10)})} className="rounded border px-2 py-1 text-xs">H+</button><button type="button" onClick={()=>update(t.id,{height:Math.max(30,(positionById.get(t.id)?.height??t.height)-10)})} className="rounded border px-2 py-1 text-xs">H−</button></div>)}</div>
   <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={()=>{setPositions(tables.filter(t=>t.status==="active").map(t=>({id:t.id,x:Number(t.x),y:Number(t.y),width:Number(t.width),height:Number(t.height),rotation:Number(t.rotation)})));setNotice("Unsaved changes discarded.");}} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold">Discard edits</button><button disabled={pending} className="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending?"Saving…":"Save floor plan"}</button></div>
  </form>
 </section>;
}
