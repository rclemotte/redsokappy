"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Persona = {
  id_persona: number;
  nombre: string;
  division: string | null;
  id_estado: number | null;
  han: { nombre: string } | null;
  estados: { descripcion: string } | null;
};

export default function MiembrosPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Persona[]>([]);
  const [q, setQ] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("personas")
        .select("id_persona, nombre, division, id_estado, han(nombre), estados(descripcion)")
        .order("nombre", { ascending: true });
      setItems((data as any) ?? []);
      setCargando(false);
    })();
  }, []); // eslint-disable-line

  const filtrados = useMemo(() => {
    const t = q.trim().toUpperCase();
    if (!t) return items;
    return items.filter((m) => m.nombre?.toUpperCase().includes(t));
  }, [q, items]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          Miembros <span className="text-sm font-normal text-gray-500">({filtrados.length})</span>
        </h1>
        <Link href="/miembros/nuevo" className="rounded-lg bg-marca text-white text-sm px-3 py-1.5 font-medium">
          + Nuevo
        </Link>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre..."
        className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-marca"
      />

      {cargando ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm divide-y">
          {filtrados.map((m) => (
            <Link
              key={m.id_persona}
              href={`/miembros/${m.id_persona}`}
              className="flex items-center justify-between p-3 active:bg-gray-50"
            >
              <div>
                <div className="text-sm font-medium">{m.nombre}</div>
                <div className="text-xs text-gray-500">
                  {m.division ?? "—"}
                  {m.han?.nombre ? ` · Han ${m.han.nombre}` : ""}
                  {m.estados?.descripcion ? ` · ${m.estados.descripcion}` : ""}
                </div>
              </div>
              <span className="text-gray-300">›</span>
            </Link>
          ))}
          {filtrados.length === 0 && <div className="p-3 text-sm text-gray-500">Sin resultados.</div>}
        </div>
      )}
    </div>
  );
}
