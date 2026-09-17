import { AuthShell } from "@/components/auth/auth-shell";
import { ResetForm } from "./reset-form";

// Nouveau mot de passe depuis un lien (jeton dans l'adresse, valable une heure).
export default async function ReinitialiserPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  return (
    <AuthShell title="Nouveau mot de passe" subtitle="Dix caractères au moins.">
      {!token || error ? <p className="text-sm text-danger" data-testid="reset-invalid">Ce lien n&apos;est plus valable. Demandez-en un nouveau depuis « Mot de passe oublié ».</p> : <ResetForm token={token} />}
    </AuthShell>
  );
}
