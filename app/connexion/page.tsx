import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { getCurrentPersonOrNull } from "@/lib/session";
import { LoginForm } from "./login-form";

// Page de connexion (lot F). Déjà connecté : on renvoie à l'outil. `?suite=` ramène à la page demandée avant la redirection.
export default async function ConnexionPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  if (await getCurrentPersonOrNull()) redirect("/portefeuille");
  const next = suite && suite.startsWith("/") && !suite.startsWith("//") ? suite : "/portefeuille";
  return (
    <AuthShell title="Connexion" subtitle="Votre adresse professionnelle et votre mot de passe.">
      <LoginForm next={next} />
    </AuthShell>
  );
}
