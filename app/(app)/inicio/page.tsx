import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function Tarjeta({ titulo, valor }: { titulo: string; valor: number | string }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="text-2xl font-bold text-marca">{valor}</div>
      <div className="text-sm text-gray-500">{titulo}</div>
    </div>
  );
}

export default async function InicioPage() {
  const supabase = createClient();

  const { count: totalMiembros } = await supabase
    .from("personas")
    .select("*", { count: "exact", head: true });

  const { count: totalEventos } = await supabase
    .from("asistencia_c")
    .select("*", { count: "exact", head: true });

  const { data: proximos } = await supabase
    .from("vw_asistencia_por_evento")
    .select("fecha_asistencia, tipo_evento, han, asistentes")
    .order("fecha_asistencia", { ascending: false })
    .limit(8);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Inicio</h1>

      <div className="grid grid-cols-2 gap-3">
        <Tarjeta titulo="Miembros" valor={totalMiembros ?? 0} />
        <Tarjeta titulo="Reuniones" valor={totalEventos ?? 0} />
      </div>

      <section>
        <h2 className="text-sm font-semibold text-gray-600 mb-2">
          Últimas reuniones
        </h2>
        <div className="bg-white rounded-xl shadow-sm divide-y">
          {(proximos ?? []).map((e, i) => (
            <div key={i} className="p-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{e.tipo_evento}</div>
                <div className="text-xs text-gray-500">
                  {e.fecha_asistencia
                    ? new Date(e.fecha_asistencia).toLocaleDateString("es-PY")
                    : ""}
                  {e.han ? ` · ${e.han}` : ""}
                </div>
              </div>
              <span className="text-sm font-semibold text-marca">
                {e.asistentes} 👤
              </span>
            </div>
          ))}
          {(!proximos || proximos.length === 0) && (
            <div className="p-3 text-sm text-gray-500">Sin reuniones cargadas aún.</div>
          )}
        </div>
      </section>
    </div>
  );
}
