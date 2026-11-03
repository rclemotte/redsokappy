import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ROLES: Record<number, string> = {
  1: "Responsable",
  2: "Miembro",
  3: "Administrador",
  4: "Encargado de estadística",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let esEditor = false;
  let esAdmin = false;
  let nombre = "Hola";
  let rol = "";
  if (user) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("id_rol, debe_cambiar_password, personas(nombre)")
      .eq("id", user.id)
      .single();

    // Primer ingreso: obligar a cambiar la contraseña.
    if (perfil?.debe_cambiar_password) {
      redirect("/cambiar-password");
    }
    const idRol = Number(perfil?.id_rol);
    esEditor = [1, 3].includes(idRol);
    esAdmin = idRol === 3;
    rol = ROLES[idRol] ?? "Miembro";
    nombre = (perfil as any)?.personas?.nombre ?? user.email?.split("@")[0] ?? "Hola";
  }

  return (
    <Shell nombre={nombre} rol={rol} esEditor={esEditor} esAdmin={esAdmin}>
      {children}
    </Shell>
  );
}
