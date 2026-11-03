"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Download, ChartColumnBig } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Cabecera, Vacio } from "@/components/ui";
import { DIVISIONES, ESTADOS, ORDEN_DIVISIONES, ORDEN_ESTADOS, type ResumenHan } from "@/lib/tookan";

type Nivel = "SGPY" | "REGION" | "CABILDO" | "DISTRITO";
type Tot = {
  personas: number; activos: number; inactivos: number; amigos: number; nuevos: number; gohonzon: number;
  ds: number; df: number; djm: number; djf: number; ge: number; hanes: number;
};
type Unidad = Tot & { id: number; nombre: string };

const HIJO: Record<Nivel, { campo: keyof ResumenHan; nombre: keyof ResumenHan; etiqueta: string; singular: string; param: string }> = {
  SGPY: { campo: "id_region", nombre: "region", etiqueta: "Regiones", singular: "Región", param: "region" },
  REGION: { campo: "id_cabildo", nombre: "cabildo", etiqueta: "Cabildos", singular: "Cabildo", param: "cabildo" },
  CABILDO: { campo: "id_distrito", nombre: "distrito", etiqueta: "Distritos", singular: "Distrito", param: "distrito" },
  DISTRITO: { campo: "id_han", nombre: "han", etiqueta: "Hanes", singular: "Han", param: "" },
};

function sumar(filas: ResumenHan[]): Tot {
  const t: Tot = { personas: 0, activos: 0, inactivos: 0, amigos: 0, nuevos: 0, gohonzon: 0, ds: 0, df: 0, djm: 0, djf: 0, ge: 0, hanes: filas.length };
  for (const r of filas) {
    t.personas += +r.personas || 0;
    t.activos += +r.miembros_activos || 0;
    t.inactivos += +r.miembros_inactivos || 0;
    t.amigos += +r.amigos_soka || 0;
    t.nuevos += +r.nuevos_amigos || 0;
    t.gohonzon += +r.con_gohonzon || 0;
    t.ds += +r.ds || 0; t.df += +r.df || 0; t.djm += +r.djm || 0; t.djf += +r.djf || 0; t.ge += +r.ge || 0;
  }
  return t;
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const n = (x: number) => x.toLocaleString("es-PY");

// Barra apilada por estado
function BarraEstados({ t, alta = false }: { t: Tot; alta?: boolean }) {
  const partes = [
    { k: "MIEMBRO_ACTIVO", v: t.activos },
    { k: "MIEMBRO_INACTIVO", v: t.inactivos },
    { k: "AMIGO_SOKA", v: t.amigos },
    { k: "NUEVO_AMIGO", v: t.nuevos },
  ] as const;
  const total = t.personas || 1;
  return (
    <div className={`flex overflow-hidden rounded-full bg-marca-50 ${alta ? "h-5" : "h-2.5"}`}>
      {partes.map((p) => (
        <div key={p.k} title={`${ESTADOS[p.k].label}: ${n(p.v)}`} style={{ width: `${(p.v / total) * 100}%`, background: ESTADOS[p.k].hex }} />
      ))}
    </div>
  );
}

export default function EstadisticasClient() {
  const supabase = createClient();
  const router = useRouter();
  const sp = useSearchParams();
  const [filas, setFilas] = useState<ResumenHan[]>([]);
  const [mensual, setMensual] = useState<{ mes: string; asistentes: number }[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const [r, m] = await Promise.all([
        supabase.from("vw_tookan_resumen_han").select("*"),
        supabase.from("vw_dash_asistencia_mensual").select("*"),
      ]);
      setFilas((r.data as ResumenHan[]) ?? []);
      setMensual(((m.data as any[]) ?? []).map((x) => ({ mes: x.mes, asistentes: Number(x.asistentes) || 0 })));
      setCargando(false);
    })();
  }, []); // eslint-disable-line

  const region = Number(sp.get("region")) || null;
  const cabildo = Number(sp.get("cabildo")) || null;
  const distrito = Number(sp.get("distrito")) || null;
  const nivel: Nivel = distrito ? "DISTRITO" : cabildo ? "CABILDO" : region ? "REGION" : "SGPY";

  const actuales = useMemo(
    () =>
      filas.filter(
        (r) =>
          (!region || r.id_region === region) && (!cabildo || r.id_cabildo === cabildo) && (!distrito || r.id_distrito === distrito)
      ),
    [filas, region, cabildo, distrito]
  );
  const tot = useMemo(() => sumar(actuales), [actuales]);

  const hijos: Unidad[] = useMemo(() => {
    const h = HIJO[nivel];
    const m = new Map<number, ResumenHan[]>();
    for (const r of actuales) {
      const k = Number(r[h.campo]);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return Array.from(m.entries())
      .map(([id, rs]) => ({ id, nombre: String(rs[0][h.nombre]), ...sumar(rs) }))
      .sort((a, b) => b.personas - a.personas);
  }, [actuales, nivel]);

  const muestra = actuales[0];
  const titulo =
    nivel === "SGPY" ? "Toda la SGPy" : nivel === "REGION" ? `Región ${muestra?.region ?? ""}` : nivel === "CABILDO" ? `Cabildo ${muestra?.cabildo ?? ""}` : `Distrito ${muestra?.distrito ?? ""}`;

  const migas = [
    { label: "SGPy", href: "/estadisticas" },
    ...(region && muestra ? [{ label: muestra.region, href: `/estadisticas?region=${region}` }] : []),
    ...(cabildo && muestra ? [{ label: muestra.cabildo, href: `/estadisticas?region=${region}&cabildo=${cabildo}` }] : []),
    ...(distrito && muestra ? [{ label: muestra.distrito, href: "" }] : []),
  ];

  function hrefHijo(id: number) {
    const h = HIJO[nivel];
    if (!h.param) return "";
    const q = new URLSearchParams();
    if (region) q.set("region", String(region));
    if (cabildo) q.set("cabildo", String(cabildo));
    if (distrito) q.set("distrito", String(distrito));
    q.set(h.param, String(id));
    return `/estadisticas?${q.toString()}`;
  }

  async function descargar() {
    const XLSX = await import("xlsx");
    const filasX = hijos.map((u) => ({
      [HIJO[nivel].singular]: u.nombre,
      Personas: u.personas, "Miembros activos": u.activos, "Miembros inactivos": u.inactivos,
      "Amigos Soka": u.amigos, "Nuevos amigos": u.nuevos, "Con Gohonzon": u.gohonzon,
      DS: u.ds, DF: u.df, DJM: u.djm, DJF: u.djf, GE: u.ge, Hanes: u.hanes,
    }));
    const ws = XLSX.utils.json_to_sheet(filasX);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estadisticas");
    XLSX.writeFile(wb, `tookan_${titulo.replace(/\s+/g, "_")}.xlsx`);
  }

  const divs = ORDEN_DIVISIONES.map((d) => ({ d, v: tot[d.toLowerCase() as keyof Tot] as number }));
  const maxDiv = Math.max(1, ...divs.map((x) => x.v));
  const meses = mensual.slice(-12);
  const maxMes = Math.max(1, ...meses.map((m) => m.asistentes));

  return (
    <div>
      <Cabecera titulo="Estadísticas" subtitulo={titulo}>
        <nav className="sin-scroll -mx-1 flex items-center gap-1 overflow-x-auto px-1 text-sm font-bold">
          {migas.map((m, i) => (
            <span key={i} className="flex shrink-0 items-center gap-1">
              {i > 0 && <ChevronRight size={14} className="text-white/60" />}
              {m.href && i < migas.length - 1 ? (
                <Link href={m.href} className="rounded-full bg-white/20 px-3 py-1 backdrop-blur-sm">{m.label}</Link>
              ) : (
                <span className="rounded-full bg-white px-3 py-1 text-marca">{m.label}</span>
              )}
            </span>
          ))}
        </nav>
      </Cabecera>

      {cargando ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="card h-24 animate-pulse" />)}</div>
          <div className="card h-48 animate-pulse" />
        </div>
      ) : filas.length === 0 ? (
        <Vacio icono={<ChartColumnBig size={30} />} titulo="Todavía no hay datos" texto="Cuando se carguen las planillas del Tookan, acá vas a ver los totales por región, cabildo, distrito y han." />
      ) : (
        <div className="space-y-5">
          {/* ---------- Números ---------- */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="card p-4">
              <div className="font-display text-[2rem] font-extrabold leading-none">{n(tot.personas)}</div>
              <div className="mt-1.5 text-[13px] font-bold text-tinta-suave">Personas · {tot.hanes} hanes</div>
            </div>
            <div className="card p-4">
              <div className="font-display text-[2rem] font-extrabold leading-none text-estado-activo">{pct(tot.activos, tot.activos + tot.inactivos)}%</div>
              <div className="mt-1.5 text-[13px] font-bold text-tinta-suave">De los miembros, activos</div>
            </div>
            <div className="card p-4">
              <div className="font-display text-[2rem] font-extrabold leading-none text-estado-amigo">{n(tot.amigos + tot.nuevos)}</div>
              <div className="mt-1.5 text-[13px] font-bold text-tinta-suave">Amigos</div>
            </div>
            <div className="card p-4">
              <div className="font-display text-[2rem] font-extrabold leading-none text-marca">{n(tot.gohonzon)}</div>
              <div className="mt-1.5 text-[13px] font-bold text-tinta-suave">Con Gohonzon</div>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* ---------- Estados ---------- */}
            <section className="card p-5">
              <h2 className="subtitulo">Estado de las personas</h2>
              <div className="mt-4"><BarraEstados t={tot} alta /></div>
              <div className="mt-4 space-y-2.5">
                {ORDEN_ESTADOS.map((e) => {
                  const v = e === "MIEMBRO_ACTIVO" ? tot.activos : e === "MIEMBRO_INACTIVO" ? tot.inactivos : e === "AMIGO_SOKA" ? tot.amigos : tot.nuevos;
                  return (
                    <div key={e} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-bold text-tinta-suave">
                        <span className="h-3 w-3 rounded-full" style={{ background: ESTADOS[e].hex }} />
                        {ESTADOS[e].label}
                      </span>
                      <span className="font-extrabold">{n(v)} <span className="ml-1 text-sm font-bold text-tinta-tenue">{pct(v, tot.personas)}%</span></span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ---------- Divisiones ---------- */}
            <section className="card p-5">
              <h2 className="subtitulo">Por división</h2>
              <div className="mt-4 space-y-3">
                {divs.map(({ d, v }) => (
                  <div key={d}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-bold text-tinta-suave">{DIVISIONES[d].label}</span>
                      <span className="font-extrabold">{n(v)}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-marca-50">
                      <div className="h-full rounded-full" style={{ width: `${(v / maxDiv) * 100}%`, background: DIVISIONES[d].hex }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* ---------- Unidades de abajo ---------- */}
          <section>
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="subtitulo">{HIJO[nivel].etiqueta} <span className="text-tinta-tenue">{hijos.length}</span></h2>
              <button onClick={descargar} className="btn-chico bg-white text-marca shadow-suave">
                <Download size={16} strokeWidth={2.6} /> Excel
              </button>
            </div>

            {/* Celular: tarjetas */}
            <div className="space-y-2.5 lg:hidden">
              {hijos.map((u) => {
                const href = hrefHijo(u.id);
                const cuerpo = (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-display text-lg font-bold">{u.nombre}</div>
                        <div className="text-[13px] font-semibold text-tinta-suave">
                          {n(u.personas)} personas · {pct(u.activos, u.activos + u.inactivos)}% activos
                        </div>
                      </div>
                      {href && <ChevronRight className="shrink-0 text-tinta-tenue" size={20} />}
                    </div>
                    <div className="mt-3"><BarraEstados t={u} /></div>
                  </>
                );
                return href ? (
                  <Link key={u.id} href={href} className="card block p-4 transition active:scale-[0.99]">{cuerpo}</Link>
                ) : (
                  <div key={u.id} className="card p-4">{cuerpo}</div>
                );
              })}
            </div>

            {/* Compu: tabla */}
            <div className="card hidden overflow-hidden lg:block">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-linea text-left text-xs font-extrabold uppercase tracking-wide text-tinta-tenue">
                    <th className="px-5 py-3">{HIJO[nivel].singular}</th>
                    <th className="px-3 py-3 text-right">Personas</th>
                    <th className="px-3 py-3 text-right">Activos</th>
                    <th className="px-3 py-3 text-right">Inactivos</th>
                    <th className="px-3 py-3 text-right">Amigos</th>
                    <th className="px-3 py-3 text-right">Gohonzon</th>
                    {ORDEN_DIVISIONES.map((d) => <th key={d} className="px-2 py-3 text-right">{d}</th>)}
                    <th className="w-44 px-5 py-3">Estados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {hijos.map((u) => {
                    const href = hrefHijo(u.id);
                    return (
                      <tr key={u.id} onClick={() => href && router.push(href)} className={href ? "cursor-pointer hover:bg-marca-50/60" : ""}>
                        <td className="px-5 py-3 font-bold">{u.nombre}</td>
                        <td className="px-3 py-3 text-right font-extrabold">{n(u.personas)}</td>
                        <td className="px-3 py-3 text-right text-estado-activo">{n(u.activos)}</td>
                        <td className="px-3 py-3 text-right text-tinta-suave">{n(u.inactivos)}</td>
                        <td className="px-3 py-3 text-right text-estado-amigo">{n(u.amigos + u.nuevos)}</td>
                        <td className="px-3 py-3 text-right">{n(u.gohonzon)}</td>
                        {ORDEN_DIVISIONES.map((d) => <td key={d} className="px-2 py-3 text-right text-tinta-suave">{n(u[d.toLowerCase() as keyof Tot] as number)}</td>)}
                        <td className="px-5 py-3"><BarraEstados t={u} /></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-linea bg-crema font-extrabold">
                    <td className="px-5 py-3">Total</td>
                    <td className="px-3 py-3 text-right">{n(tot.personas)}</td>
                    <td className="px-3 py-3 text-right">{n(tot.activos)}</td>
                    <td className="px-3 py-3 text-right">{n(tot.inactivos)}</td>
                    <td className="px-3 py-3 text-right">{n(tot.amigos + tot.nuevos)}</td>
                    <td className="px-3 py-3 text-right">{n(tot.gohonzon)}</td>
                    {ORDEN_DIVISIONES.map((d) => <td key={d} className="px-2 py-3 text-right">{n(tot[d.toLowerCase() as keyof Tot] as number)}</td>)}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* ---------- Participación (total SGPy) ---------- */}
          {nivel === "SGPY" && (
            <section className="card p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="subtitulo">Participación por mes</h2>
                <span className="text-xs font-bold text-tinta-tenue">personas en reuniones</span>
              </div>
              {meses.length === 0 ? (
                <p className="mt-3 text-sm font-semibold text-tinta-suave">Todavía no hay reuniones registradas. El registro de participación empieza en marzo.</p>
              ) : (
                <div className="mt-4 flex h-40 items-end gap-2">
                  {meses.map((m, i) => (
                    <div key={m.mes} className="flex h-full flex-1 flex-col items-center gap-1">
                      <span className="text-[11px] font-extrabold text-tinta-suave">{m.asistentes}</span>
                      <div className="flex w-full flex-1 items-end">
                        <div className={`w-full rounded-lg ${i === meses.length - 1 ? "bg-sol" : "bg-marca-100"}`} style={{ height: `${Math.max(5, (m.asistentes / maxMes) * 100)}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-tinta-tenue">{m.mes.slice(5)}/{m.mes.slice(2, 4)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
