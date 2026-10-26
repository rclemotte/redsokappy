import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdministracionClient from "@/components/AdministracionClient";

export const dynamic = "force-dynamic";

// Solo ADMINISTRADOR (Coordinación General): parámetros y lista de cargos.
export default async function AdministracionPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let esAdmin = false;
  if (user) {
    const { data: perfil } = await supabase.from("perfiles").select("id_rol").eq("id", user.id).single();
    esAdmin = Number(perfil?.id_rol) === 3;
  }
  if (!esAdmin) redirect("/inicio");

  return <AdministracionClient />;
}
