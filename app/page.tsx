import { redirect } from "next/navigation";

export default function Home() {
  // redirect() ajoute lui-même le basePath.
  redirect("/portefeuille");
}
