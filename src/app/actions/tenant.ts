"use server";

import { redirect } from "next/navigation";

export async function createTenantAction() {
  redirect("/app?error=Restaurant%20accounts%20are%20provisioned%20by%20the%20CafeOS%20platform%20administrator");
}
