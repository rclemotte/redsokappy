import { redirect } from "next/navigation";

// La raíz simplemente manda al inicio; el middleware decide si hay que loguear.
export default function Home() {
  redirect("/inicio");
}
