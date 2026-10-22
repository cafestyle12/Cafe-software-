import { notFound } from "next/navigation";
import { TableSessionInitializer } from "@/app/t/[token]/table-session-initializer";

type PublicQrResult={restaurant_name:string|null;branch_name:string|null;table_label:string|null;table_capacity:number|null;session_status:string};
export default async function PublicTablePage({params}:{params:Promise<{token:string}>}) {
 const {token}=await params;
 if(!/^[A-Za-z0-9_-]{40,200}$/.test(token)) notFound();
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,"");
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key) return <main className="mx-auto max-w-lg p-8"><h1 className="text-2xl font-semibold">CafeOS</h1><p className="mt-4">Table access is temporarily unavailable. Please ask the restaurant team for assistance.</p></main>;
 const response=await fetch(url+"/rest/v1/rpc/resolve_table_qr",{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify({p_token:token}),cache:"no-store"});
 if(!response.ok) return <main className="mx-auto max-w-lg p-8"><h1 className="text-2xl font-semibold">QR unavailable</h1><p className="mt-3">This table QR is invalid or disabled. Please ask the restaurant team for a current code.</p></main>;
 const rows=await response.json() as PublicQrResult[];
 const result=Array.isArray(rows)?rows[0]:undefined;
 if(!result?.table_label||result.session_status!=="valid") return <main className="mx-auto max-w-lg p-8"><h1 className="text-2xl font-semibold">QR unavailable</h1><p className="mt-3">This table QR is invalid or disabled. Please ask the restaurant team for a current code.</p></main>;
 return <main className="mx-auto min-h-screen max-w-lg px-6 py-16"><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">Welcome</p><h1 className="mt-4 text-3xl font-semibold">{result.restaurant_name}</h1><p className="mt-2 text-[var(--muted)]">{result.branch_name}</p><section className="mt-8 rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">You scanned the QR for</p><h2 className="mt-2 text-2xl font-semibold">Table {result.table_label}</h2><p className="mt-2 text-sm">{result.table_capacity} seats</p><p className="mt-5 text-sm text-[var(--muted)]">This is a secure table identification page. Ordering and payments are not enabled in this phase.</p><TableSessionInitializer token={token}/></section></main>;
}
