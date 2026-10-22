import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const ownOrigin = request.nextUrl.origin;
  if (origin && origin !== ownOrigin) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
  let body: { token?: unknown; idempotencyKey?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const token = typeof body.token === "string" ? body.token : "";
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(token) || !/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)) {
    return NextResponse.json({ error: "Invalid table access request." }, { status: 400 });
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) return NextResponse.json({ error: "Table session service is not configured." }, { status: 503 });
  const response = await fetch(supabaseUrl + "/rest/v1/rpc/initialize_table_session", {
    method: "POST",
    headers: { apikey: publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ p_qr_token: token, p_idempotency_key: idempotencyKey }),
    cache: "no-store",
  });
  if (!response.ok) return NextResponse.json({ error: "This QR is invalid, disabled or expired." }, { status: 404 });
  const rows = await response.json() as Array<{ session_token: string | null; expires_at: string; table_label: string; branch_name: string }>;
  const result = rows[0];
  if (!result) return NextResponse.json({ error: "Unable to initialize table session." }, { status: 503 });
  return NextResponse.json({ sessionToken: result.session_token, expiresAt: result.expires_at, tableLabel: result.table_label, branchName: result.branch_name }, {
    headers: { "Cache-Control": "no-store, private", "Vary": "Origin" },
  });
}
