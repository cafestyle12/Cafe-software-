import { redirect } from "next/navigation";

export default function DisabledAuthenticationRoute() {
  redirect("/login?notice=Public%20signup%20and%20email-based%20password%20recovery%20are%20disabled.%20Contact%20the%20CafeOS%20platform%20administrator%20for%20account%20provisioning%20or%20reset");
}
