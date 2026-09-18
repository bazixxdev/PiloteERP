import { redirect } from "next/navigation";

// Lot 3 du 19/09 (retour de Gaël) : la file des validations par niveau n'existe plus comme page — les validations se traitent
// dans « Mes demandes », onglet « Qu'on me fait », avec leur niveau. Les bons pour accord restent sous /validations/[id].
export default function ValidationsPage() {
  redirect("/demandes");
}
