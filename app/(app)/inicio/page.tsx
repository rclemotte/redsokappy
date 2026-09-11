import { createClient } from "@/lib/supabase/server";
import DashboardCharts from "@/components/DashboardCharts";

export const dynamic = "force-dynamic";

function Tarjeta({ titulo, valor, icono }: { titulo: string; valor: number | string; icono: string }) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm">
      <div className="flex items-center gap-1 text-gray-500 text-xs">
        <span>{icono}</span>
        <span>{titulo}</span>
      </div>
      <div className="text-2xl font-bold text-marca mt-1">{valor}</div>
    </div>
  );
}

async function contar(supabase: any, tabla: string, filtro?: (q: any) => any): Promise<number> {
  let q = supabase.from(tabla).select("*", { count: "exact", head: true });
  if (filtro) q = filtro(q);
  const { count } = await q;
  return count ?? 0;
}

export default async function InicioPage() {
  const supabase = createClient();

  const [
    miembros, reuniones, nuevosAmigos, titulares, shakubuku,
    cabildos, distritos, hans,
  ] = await Promise.all([
    contar(supabase, "personas"),
    contar(supabase, "asistencia_c"),
    contar(supabase, "personas", (q) => q.eq("id_estado", 4)),
    contar(supabase, "personas", (q) => q.eq("titular_gohonzo", 1)),
    contar(supabase, "shakubuku"),
    contar(supabase, "cabildo"),
    contar(supabase, "distrito"),
    contar(supabase, "han"),
  ]);

  const { data: division } = await supabase.from("vw_dash_division").select("*");
  const { data: estado } = await supabase.from("vw_dash_estado").select("*");
  const { data: mensual } = await supabase.from("vw_dash_asistencia_mensual").select("*");

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold">Panel general</h1>

      <div className="grid grid-cols-2 gap-3">
        <Tarjeta titulo="Miembros" valor={miembros} icono="👥" />
        <Tarjeta titulo="Reuniones" valor={reuniones} icono="📅" />
        <Tarjeta titulo="Nuevos amigos" valor={nuevosAmigos} icono="🌱" />
        <Tarjeta titulo="Titulares de Gohonzon" valor={titulares} icono="🙏" />
        <Tarjeta titulo="Shakubuku" valor={shakubuku} icono="🤝" />
        <Tarjeta titulo="Hans" valor={hans} icono="🏘️" />
        <Tarjeta titulo="Distritos" valor={distritos} icono="📍" />
        <Tarjeta titulo="Cabildos" valor={cabildos} icono="🏛️" />
      </div>

      <DashboardCharts
        division={division ?? []}
        estado={estado ?? []}
        mensual={mensual ?? []}
      />

      {(!division || division.length === 0) && (
        <p className="text-xs text-gray-400 text-center">
          Si los gráficos están vacíos, ejecutá una vez el archivo <code>supabase/dashboard.sql</code> en Supabase.
        </p>
      )}
    </div>
  );
}
