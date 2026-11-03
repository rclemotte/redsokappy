"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, CalendarCheck, Search, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BotonCabecera, Cabecera, Cargando, Vacio } from "@/components/ui";
import { normalizar } from "@/lib/tookan";

type Reunion = {
  id_asistencia: number;
  fecha_asistencia: string | null;
  tipo_evento: string | null;
  han: string | null;
  asistentes: number;
};

function mesDe(f: string | null) {
  if (!f) return "Sin fecha";
  const d = new Date(String(f).slice(0, 10) + "T12:00:00");
  const t = d.toLocaleDateString("es-PY", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function AsistenciaPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Reunion[]>([]);
  const [q, setQ] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("vw_asistencia_por_evento")
        .select("*")
        .order("fecha_asistencia", { ascending: false })
        .limit(1000);
      setItems((data as any) ?? []);
      setCargando(false);
    })();
  }, []); // eslint-disable-line

  const grupos = useMemo(() => {
    const t = normalizar(q.trim());
    const f = items.filter((r) => !t || normalizar(`${r.tipo_evento ?? ""} ${r.han ?? ""} ${mesDe(r.fecha_asistencia)}`).includes(t));
    const m = new Map<string, Reunion[]>();
    for (const r of f) {
      const k = mesDe(r.fecha_asistencia);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return Array.from(m.entries());
  }, [q, items]);

  return (
    <div>
      <Cabecera
        titulo="Participación"
        subtitulo="Reuniones de Han y actividades"
        accion={
          <BotonCabecera href="/asistencia/nueva" label="Registrar reunión">
            <CalendarPlus size={22} strokeWidth={2.5} />
          </BotonCabecera>
        }
      >
        <label className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 text-tinta shadow-flotante">
          <Search size={20} className="text-marca" strokeWidth={2.5} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por han, tipo o mes…"
            className="w-full bg-transparent text-[15px] font-semibold outline-none placeholder:text-tinta-tenue"
          />
        </label>
      </Cabecera>

      {cargando ? (
        <Cargando />
      ) : grupos.length === 0 ? (
        <Vacio
          icono={<CalendarCheck size={30} />}
          titulo={q ? "Sin resultados" : "Todavía no hay reuniones"}
          texto={q ? "Probá con otra búsqueda." : "Registrá la primera reunión: se marca quién vino en un minuto."}
        >
          {!q && <Link href="/asistencia/nueva" className="btn-sol">Registrar reunión</Link>}
        </Vacio>
      ) : (
        <div className="space-y-5">
          {grupos.map(([mes, rs]) => (
            <section key={mes}>
              <h2 className="mb-2 px-1 font-display text-base font-bold text-tinta-suave">{mes}</h2>
              <div className="card divide-y divide-linea overflow-hidden">
                {rs.map((r) => {
                  const d = r.fecha_asistencia ? new Date(String(r.fecha_asistencia).slice(0, 10) + "T12:00:00") : null;
                  return (
                    <Link key={r.id_asistencia} href={`/asistencia/${r.id_asistencia}`} className="flex items-center gap-3 p-3.5 transition active:bg-marca-50">
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-sol-suave leading-none text-marca">
                        <span className="font-display text-lg font-extrabold">{d ? d.getDate() : "–"}</span>
                        <span className="text-[10px] font-extrabold uppercase">{d ? d.toLocaleDateString("es-PY", { weekday: "short" }).replace(".", "") : ""}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold">{r.tipo_evento ?? "Reunión"}</div>
                        <div className="truncate text-[13px] font-semibold text-tinta-suave">{r.han ? `Han ${r.han}` : "Sin han"}</div>
                      </div>
                      <span className="rounded-full bg-marca-50 px-3 py-1 text-sm font-extrabold text-marca">{r.asistentes}</span>
                      <ChevronRight size={18} className="text-tinta-tenue" />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
