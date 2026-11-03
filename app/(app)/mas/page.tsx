import { createClient } from "@/lib/supabase/server";
import MasClient from "@/components/MasClient";

export const dynamic = "force-dynamic";

export default async function MasPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let idRol = 2;
  let nombre = "";
  if (user) {
    const { data: perfil } = await supabase.from("perfiles").select("id_rol, personas(nombre)").eq("id", user.id).single();
    idRol = Number(perfil?.id_rol ?? 2);
    nombre = (perfil as any)?.personas?.nombre ?? user.email?.split("@")[0] ?? "";
  }
  return <MasClient nombre={nombre} esEditor={[1, 3].includes(idRol)} esAdmin={idRol === 3} />;
}
