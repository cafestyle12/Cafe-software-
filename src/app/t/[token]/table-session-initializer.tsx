"use client";

import { useState } from "react";

export function TableSessionInitializer({ token }: { token: string }) {
 const [state,setState]=useState<"idle"|"loading"|"ready"|"error">("idle");
 const [message,setMessage]=useState("");
 async function initialize(){
  setState("loading");setMessage("");
  try {
   const keyName="cafeos-table-idem:"+token.slice(0,12);
   let idempotencyKey=sessionStorage.getItem(keyName);
   if(!idempotencyKey){idempotencyKey=crypto.randomUUID().replace(/-/g,"");sessionStorage.setItem(keyName,idempotencyKey);}
   const response=await fetch("/api/public/table-session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,idempotencyKey})});
   const result=await response.json() as {sessionToken?:string|null;expiresAt?:string;tableLabel?:string;branchName?:string;error?:string};
   if(!response.ok)throw new Error(result.error??"Table session could not be started.");
   if(result.sessionToken)sessionStorage.setItem("cafeos-table-session:"+token.slice(0,12),result.sessionToken);
   setState("ready");
   setMessage(result.sessionToken?"Secure table session started. It expires in four hours.":"An existing table session is already active for this scan.");
  } catch(e) {setState("error");setMessage(e instanceof Error?e.message:"Table session could not be started.");}
 }
 return <section className="mt-5 rounded-xl border border-[var(--border)] p-4">
  <h3 className="font-semibold">Prepare table session</h3>
  <p className="mt-1 text-sm text-[var(--muted)]">This does not place an order or authorize payment.</p>
  {state==="idle"&&<button onClick={initialize} className="mt-3 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">Continue securely</button>}
  {state==="loading"&&<p role="status" className="mt-3 text-sm">Starting secure session…</p>}
  {message&&<p role={state==="error"?"alert":"status"} className="mt-3 text-sm">{message}</p>}
  {(state==="error"||state==="ready")&&<button onClick={initialize} className="mt-3 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Retry / refresh session</button>}
 </section>;
}
