"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Reunion = {
  id_asistencia: number;
  fecha_asistencia: string | null;
  tipo_evento: string | null;
  han: string | null;
  asistentes: number;
};

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

  const filtrados = useMemo(() => {
    const t = q.trim().toUpperCase();
    if (!t) return items;
    return items.filter((r) =>
      (r.tipo_evento ?? "").toUpperCase().includes(t) ||
      (r.han ?? "").toUpperCase().includes(t) ||
      (r.fecha_asistencia ?? "").includes(t)
    );
  }, [q, items]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          Reuniones <span className="text-sm font-normal text-gray-500">({filtrados.length})</span>
        </h1>
        <Link href="/asistencia/nueva" className="rounded-lg bg-marca text-white text-sm px-3 py-1.5 font-medium">
          + Nueva
        </Link>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por tipo, han o fecha (AAAA-MM-DD)..."
        className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-marca"
      />

      {cargando ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm divide-y">
          {filtrados.map((r) => (
            <Link key={r.id_asistencia} href={`/asistencia/${r.id_asistencia}`} className="flex items-center justify-between p-3 active:bg-gray-50">
              <div>
                <div className="text-sm font-medium">{r.tipo_evento ?? "Reunión"}</div>
                <div className="text-xs text-gray-500">
                  {r.fecha_asistencia ? new Date(r.fecha_asistencia).toLocaleDateString("es-PY") : ""}
                  {r.han ? ` · ${r.han}` : ""}
                </div>
              </div>
              <span className="text-sm font-semibold text-marca">{r.asistentes} 👤</span>
            </Link>
          ))}
          {filtrados.length === 0 && <div className="p-3 text-sm text-gray-500">Sin reuniones.</div>}
        </div>
      )}
    </div>
  );
}
