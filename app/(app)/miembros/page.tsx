"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, UserPlus, ChevronRight, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, BadgeEstado, BotonCabecera, Cabecera, Cargando, Vacio } from "@/components/ui";
import Combobox from "@/components/Combobox";
import { ESTADOS, ORDEN_ESTADOS, normalizar, traerTodo, type Estado, type PersonaTookan } from "@/lib/tookan";

type Filtro = "TODOS" | Estado | "BAJA";
const PAGINA = 80;

function MiembrosInner() {
  const supabase = createClient();
  const params = useSearchParams();
  const [items, setItems] = useState<PersonaTookan[]>([]);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>((params.get("estado") as Filtro) || "TODOS");
  const [cabildo, setCabildo] = useState("");
  const [mostrar, setMostrar] = useState(PAGINA);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await traerTodo<PersonaTookan>((d, h) =>
          supabase
            .from("vw_personas_tookan")
            .select("id_persona, nombre, nombre_completo, division, estado, activo, motivo_baja, han, distrito, cabildo, cargos_vigentes, gohonzon")
            .order("nombre", { ascending: true })
            .range(d, h)
        );
        setItems(data);
      } catch (e: any) {
        setError(e?.message ?? "No se pudo cargar la lista.");
      }
      setCargando(false);
    })();
  }, []); // eslint-disable-line

  useEffect(() => setMostrar(PAGINA), [q, filtro, cabildo]);

  const cabildos = useMemo(
    () => Array.from(new Set(items.map((p) => p.cabildo).filter(Boolean) as string[])).sort().map((c) => ({ value: c, label: c })),
    [items]
  );

  const base = useMemo(() => (cabildo ? items.filter((p) => p.cabildo === cabildo) : items), [items, cabildo]);

  const conteo = useMemo(() => {
    const c: Record<string, number> = { TODOS: 0, BAJA: 0 };
    for (const p of base) {
      if (!p.activo) c.BAJA++;
      else {
        c.TODOS++;
        if (p.estado) c[p.estado] = (c[p.estado] ?? 0) + 1;
      }
    }
    return c;
  }, [base]);

  const filtrados = useMemo(() => {
    const t = normalizar(q.trim());
    return base.filter((p) => {
      if (filtro === "BAJA" ? p.activo : !p.activo) return false;
      if (filtro !== "TODOS" && filtro !== "BAJA" && p.estado !== filtro) return false;
      if (!t) return true;
      return normalizar(`${p.nombre_completo} ${p.han ?? ""} ${p.distrito ?? ""}`).includes(t);
    });
  }, [base, q, filtro]);

  const chips: { k: Filtro; label: string }[] = [
    { k: "TODOS", label: "Todos" },
    ...ORDEN_ESTADOS.map((e) => ({ k: e as Filtro, label: ESTADOS[e].corto === "Activo" ? "Activos" : ESTADOS[e].corto === "Inactivo" ? "Inactivos" : ESTADOS[e].label })),
    { k: "BAJA", label: "Bajas" },
  ];

  return (
    <div>
      <Cabecera
        titulo="Personas"
        subtitulo={cargando ? "Cargando…" : `${conteo.TODOS.toLocaleString("es-PY")} personas${cabildo ? ` en ${cabildo}` : ""}`}
        accion={
          <BotonCabecera href="/miembros/nuevo" label="Nueva persona">
            <UserPlus size={22} strokeWidth={2.5} />
          </BotonCabecera>
        }
      >
        <label className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 text-tinta shadow-flotante">
          <Search size={20} className="text-marca" strokeWidth={2.5} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o han…"
            className="w-full bg-transparent text-[15px] font-semibold outline-none placeholder:text-tinta-tenue"
          />
        </label>
      </Cabecera>

      <div className="space-y-4">
        <div className="sin-scroll -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
          {chips.map((c) => (
            <button key={c.k} onClick={() => setFiltro(c.k)} className={`chip ${filtro === c.k ? "chip-on" : ""}`}>
              {c.label} <span className={filtro === c.k ? "text-white/80" : "text-tinta-tenue"}>{(conteo[c.k] ?? 0).toLocaleString("es-PY")}</span>
            </button>
          ))}
        </div>

        {cabildos.length > 1 && (
          <div className="lg:max-w-xs">
            <Combobox value={cabildo} onChange={setCabildo} options={cabildos} placeholder="Todos los cabildos" />
          </div>
        )}

        {cargando ? (
          <Cargando />
        ) : error ? (
          <Vacio icono={<Users size={30} />} titulo="No se pudo cargar" texto={error} />
        ) : filtrados.length === 0 ? (
          <Vacio icono={<Search size={30} />} titulo="Sin resultados" texto="Probá con otro nombre o cambiá el filtro." />
        ) : (
          <>
            <div className="card divide-y divide-linea overflow-hidden lg:grid lg:grid-cols-2 lg:divide-y-0">
              {filtrados.slice(0, mostrar).map((p) => (
                <Link
                  key={p.id_persona}
                  href={`/miembros/${p.id_persona}`}
                  className="flex items-center gap-3 p-3.5 transition active:bg-marca-50 lg:border-b lg:border-linea lg:hover:bg-marca-50/50"
                >
                  <Avatar nombre={p.nombre_completo} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{p.nombre_completo}</div>
                    <div className="truncate text-[13px] font-semibold text-tinta-suave">
                      {[p.han ? `Han ${p.han}` : p.cabildo, p.division].filter(Boolean).join(" · ") || "Sin han"}
                    </div>
                  </div>
                  <BadgeEstado estado={p.activo ? p.estado : null} />
                  <ChevronRight size={18} className="hidden text-tinta-tenue sm:block" />
                </Link>
              ))}
            </div>
            {filtrados.length > mostrar && (
              <button onClick={() => setMostrar((m) => m + PAGINA * 2)} className="btn-borde w-full">
                Ver más ({(filtrados.length - mostrar).toLocaleString("es-PY")} restantes)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function MiembrosPage() {
  return (
    <Suspense fallback={<Cargando />}>
      <MiembrosInner />
    </Suspense>
  );
}
