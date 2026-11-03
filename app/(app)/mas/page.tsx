import { createClient } from "@/lib/supabase/server";
import MasClient from "@/components/MasClient";
import { miPerfil } from "@/lib/perfil";

export const dynamic = "force-dynamic";

export default async function MasPage() {
  const yo = await miPerfil(createClient());
  return (
    <MasClient
      nombre={yo?.nombre ?? ""}
      ambito={yo?.ambito ?? null}
      esEditor={!!yo && [1, 3].includes(yo.idRol)}
      esAdmin={!!yo?.esAdmin}
    />
  );
}
