import { redirect } from "next/navigation";

// Retour de Gaël (18/09) : les financeurs sont une donnée de l'annuaire, pas un écran de pilotage. La liste vit dans
// Organisations (genre Financeur) ; la fiche d'un financeur reste à /financeurs/[id] (historique, contacts, conventions).
export default function FinanceursPage() {
  redirect("/organisations?genre=funder");
}
