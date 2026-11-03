import { Suspense } from "react";
import EstadisticasClient from "@/components/EstadisticasClient";
import { createClient } from "@/lib/supabase/server";
import { miPerfil } from "@/lib/perfil";

export const dynamic = "force-dynamic";

export default async function EstadisticasPage() {
  const yo = await miPerfil(createClient());
  return (
    <Suspense>
      <EstadisticasClient ambito={yo?.esAdmin ? null : yo?.ambito ?? null} />
    </Suspense>
  );
}
