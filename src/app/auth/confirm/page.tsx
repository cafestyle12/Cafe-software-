import { ConfirmationClient } from "./confirmation-client";

type Props = { searchParams: Promise<{ token_hash?: string; token?: string; type?: string; invite_id?: string; error?: string; error_description?: string; code?: string }> };

export default async function ConfirmPage({ searchParams }: Props) {
  const params = await searchParams;
  return <ConfirmationClient tokenHash={params.token_hash ?? params.token ?? ""} initialType={params.type ?? ""} inviteId={params.invite_id ?? ""} initialError={params.error_description ?? params.error ?? (params.code ? "This sign-in link could not be exchanged. Request a fresh link." : "")} />;
}
