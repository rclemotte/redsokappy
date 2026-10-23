import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ValoracionesClient from "@/components/ValoracionesClient";

export const dynamic = "force-dynamic";

// Resultados de la valoración del Festival: solo editores.
export default async function ValoracionesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let esEditor = false;
  if (user) {
    const { data: perfil } = await supabase.from("perfiles").select("id_rol").eq("id", user.id).single();
    esEditor = perfil ? [1, 3, 4].includes(Number(perfil.id_rol)) : false;
  }
  if (!esEditor) redirect("/inicio");
  return <ValoracionesClient />;
}
