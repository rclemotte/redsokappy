import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UsuariosClient from "@/components/UsuariosClient";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Solo editores (Responsable/Administrador) pueden gestionar usuarios.
  let esEditor = false;
  if (user) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("id_rol")
      .eq("id", user.id)
      .single();
    esEditor = perfil ? [1, 3].includes(Number(perfil.id_rol)) : false;
  }
  if (!esEditor) redirect("/inicio");

  return <UsuariosClient />;
}
