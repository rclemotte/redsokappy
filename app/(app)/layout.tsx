import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { createClient } from "@/lib/supabase/server";
import { miPerfil } from "@/lib/perfil";

export const dynamic = "force-dynamic";

const ROLES: Record<number, string> = {
  1: "Responsable",
  2: "Miembro",
  3: "Administrador",
  4: "Encargado de estadística",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const p = await miPerfil(supabase);

  // Primer ingreso: obligar a cambiar la contraseña.
  if (p?.debeCambiarPassword) redirect("/cambiar-password");

  return (
    <Shell
      nombre={p?.nombre || "Hola"}
      rol={[ROLES[p?.idRol ?? 2] ?? "Miembro", p?.ambito].filter(Boolean).join(" · ")}
      esEditor={!!p && [1, 3].includes(p.idRol)}
      esAdmin={!!p?.esAdmin}
    >
      {children}
    </Shell>
  );
}
