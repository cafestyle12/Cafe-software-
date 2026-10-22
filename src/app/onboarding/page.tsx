import { redirect } from "next/navigation";

export default function OnboardingPage() {
  redirect("/app?notice=Restaurant%20workspaces%20are%20created%20by%20the%20CafeOS%20platform%20administrator");
}
