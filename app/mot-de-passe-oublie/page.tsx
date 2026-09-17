import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotForm } from "./forgot-form";

// Mot de passe oublié : la demande dépose un lien dans la boîte d'envoi ; sans mail branché (prototype), l'administration le remet.
export default function MotDePasseOubliePage() {
  return (
    <AuthShell title="Mot de passe oublié" subtitle="Indiquez votre adresse : un lien pour choisir un nouveau mot de passe est préparé.">
      <ForgotForm />
    </AuthShell>
  );
}
