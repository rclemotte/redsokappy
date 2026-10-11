"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { fechaLarga } from "@/lib/festival";

// Panel PÚBLICO de indicadores del Festival (solo números agregados, sin datos personales).
// Se actualiza solo cada 10 segundos. Link: /festival/panel

type Est = {
  id_evento: number;
  nombre: string;
  fecha: string | null;
  hora: string | null;
  lugar: string | null;
  cupo: number | null;
  registrados: number;
  reg_miembros: number;
  reg_no_miembros: number;
  reg_staff: number;
  ingresados: number;
  ing_con_registro: number;
  ing_sin_registro: number;
  ing_staff: number;
  por_dia: { dia: string; n: number }[];
  por_intervalo: { t: string; n: number }[];
};

const ROSA = "#f11579";
const CADA_MS = 10000;
const fmt = (n: number) => n.toLocaleString("es-PY");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default function PanelFestival() {
  const supabase = useMemo(() => createClient(), []);
  const [eventos, setEventos] = useState<Est[]>([]);
  const [actualizado, setActualizado] = useState<Date | null>(null);
  const [error, setError] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [sel, setSel] = useState<number | "todas">("todas");

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc("fest_estadisticas");
    if (error || !data) {
      setError(true);
    } else {
      const d = data as { eventos: Est[] };
      setEventos(d.eventos ?? []);
      setActualizado(new Date());
      setError(false);
    }
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    cargar();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") cargar();
    }, CADA_MS);
    const vis = () => document.visibilityState === "visible" && cargar();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [cargar]);

  // Vista "Ambas funciones" = suma
  const vista: Est | null = useMemo(() => {
    if (eventos.length === 0) return null;
    if (sel !== "todas") return eventos.find((e) => e.id_evento === sel) ?? null;
    const suma = (k: keyof Est) => eventos.reduce((a, e) => a + Number(e[k] ?? 0), 0);
    const merge = <K extends "dia" | "t">(arrs: { [P in K]: string }[][], key: K) => {
      const m = new Map<string, number>();
      arrs.flat().forEach((x: any) => m.set(x[key], (m.get(x[key]) ?? 0) + Number(x.n)));
      return Array.from(m.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, n]) => ({ [key]: k, n })) as any[];
    };
    const sinCupo = eventos.some((e) => e.cupo == null);
    return {
      id_evento: 0,
      nombre: "Ambas funciones",
      fecha: eventos[0].fecha,
      hora: null,
      lugar: eventos[0].lugar,
      cupo: sinCupo ? null : suma("cupo"),
      registrados: suma("registrados"),
      reg_miembros: suma("reg_miembros"),
      reg_no_miembros: suma("reg_no_miembros"),
      // El staff está registrado en todas las funciones: son las mismas personas
      reg_staff: Math.max(...eventos.map((e) => Number(e.reg_staff ?? 0))),
      ingresados: suma("ingresados"),
      ing_con_registro: suma("ing_con_registro"),
      ing_sin_registro: suma("ing_sin_registro"),
      ing_staff: suma("ing_staff"),
      por_dia: merge(eventos.map((e) => e.por_dia as any), "dia"),
      por_intervalo: merge(eventos.map((e) => e.por_intervalo as any), "t"),
    };
  }, [eventos, sel]);

  if (cargando) return <p className="text-center text-white pt-10 drop-shadow">Cargando…</p>;

  return (
    <main className="px-4 pb-10 space-y-3">
      <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-extrabold" style={{ color: ROSA }}>
            Festival en números
          </h1>
          <span className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 text-xs ${error ? "text-red-600" : "text-gray-500"}`}>
            <span className={`h-2 w-2 rounded-full ${error ? "bg-red-500" : "bg-green-500 animate-pulse"}`} />
            {error ? "Sin conexión, reintentando…" : `En vivo · ${actualizado?.toLocaleTimeString("es-PY", { hour12: false }) ?? ""}`}
          </span>
        </div>

        {/* Selector de función */}
        <div className="grid gap-2 mt-3" style={{ gridTemplateColumns: `repeat(${eventos.length + 1}, minmax(0, 1fr))` }}>
          {[...eventos.map((e) => ({ id: e.id_evento as number | "todas", l: e.nombre, h: e.hora })), { id: "todas" as const, l: "Ambas", h: null }].map(
            (o) => {
              const act = sel === o.id;
              return (
                <button
                  key={String(o.id)}
                  onClick={() => setSel(o.id)}
                  className={`rounded-xl border-2 px-2 py-2 text-center text-sm transition ${
                    act ? "border-[#f11579] bg-[#f11579] text-white" : "border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  <span className="block font-bold leading-tight">{o.l}</span>
                  {o.h && <span className={`block text-xs ${act ? "opacity-90" : "text-gray-500"}`}>{fechaLarga(null, o.h)}</span>}
                </button>
              );
            }
          )}
        </div>
      </div>

      {!vista ? (
        <div className="bg-white/95 rounded-3xl p-6 text-center text-gray-600">Todavía no hay funciones activas.</div>
      ) : vista.ingresados > 0 ? (
        <>
          <Ingreso v={vista} />
          <Registro v={vista} />
        </>
      ) : (
        <>
          <Registro v={vista} />
          <Ingreso v={vista} />
        </>
      )}

      <p className="text-center text-xs text-white/90 drop-shadow">
        Se actualiza solo cada 10 segundos.
        {" "}El comité / staff no ocupa butaca: se cuenta aparte.
      </p>
    </main>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">{titulo}</h2>
      {children}
    </section>
  );
}

function Stat({ valor, label, sub }: { valor: string; label: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 px-3 py-3">
      <p className="text-2xl font-extrabold text-gray-900 tabular-nums">{valor}</p>
      <p className="text-xs font-semibold text-gray-700">{label}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function Barra({ valor, total }: { valor: number; total: number }) {
  return (
    <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct(valor, total)}%`, background: ROSA }} />
    </div>
  );
}

function Registro({ v }: { v: Est }) {
  const libres = v.cupo != null ? Math.max(v.cupo - v.registrados, 0) : null;
  const dias = v.por_dia.map((d) => ({
    ...d,
    label: new Date(d.dia + "T12:00:00").toLocaleDateString("es-PY", { day: "numeric", month: "short" }),
  }));
  return (
    <Tarjeta titulo="Registro previo">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-5xl font-extrabold text-gray-900 tabular-nums leading-none">{fmt(v.registrados)}</p>
          <p className="text-sm text-gray-600 mt-1">personas del público registradas{v.cupo != null ? ` de ${fmt(v.cupo)} butacas` : ""}</p>
        </div>
        {v.cupo != null && (
          <p className="text-right">
            <span className="block text-2xl font-extrabold tabular-nums" style={{ color: ROSA }}>
              {pct(v.registrados, v.cupo)}%
            </span>
            <span className="block text-xs text-gray-500">del cupo</span>
          </p>
        )}
      </div>
      {v.cupo != null && (
        <div className="mt-3">
          <Barra valor={v.registrados} total={v.cupo} />
          <p className="text-xs text-gray-600 mt-1">
            {libres === 0 ? <b>Cupo completo</b> : <>Quedan <b>{fmt(libres!)}</b> lugares</>}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mt-4">
        <Stat valor={fmt(v.reg_miembros)} label="Miembros" sub={`${pct(v.reg_miembros, v.registrados)}% del público`} />
        <Stat valor={fmt(v.reg_no_miembros)} label="No miembros" sub={`${pct(v.reg_no_miembros, v.registrados)}% del público`} />
      </div>
      <Staff n={v.reg_staff} texto="registrados del comité / staff" />

      {dias.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-semibold text-gray-700 mb-1">Registros por día</p>
          <Grafico data={dias} x="label" unidad="registros" />
        </div>
      )}
    </Tarjeta>
  );
}

function Ingreso({ v }: { v: Est }) {
  const libres = v.cupo != null ? Math.max(v.cupo - v.ingresados, 0) : null;
  return (
    <Tarjeta titulo="Ingreso al teatro">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-5xl font-extrabold text-gray-900 tabular-nums leading-none">{fmt(v.ingresados)}</p>
          <p className="text-sm text-gray-600 mt-1">personas del público ingresaron{v.cupo != null ? ` de ${fmt(v.cupo)} butacas` : ""}</p>
        </div>
        {v.cupo != null && (
          <p className="text-right">
            <span className="block text-2xl font-extrabold tabular-nums" style={{ color: ROSA }}>
              {fmt(libres!)}
            </span>
            <span className="block text-xs text-gray-500">lugares libres en sala</span>
          </p>
        )}
      </div>
      {v.cupo != null && (
        <div className="mt-3">
          <Barra valor={v.ingresados} total={v.cupo} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mt-4">
        <Stat valor={fmt(v.ing_con_registro)} label="Con registro" sub="acceso prioritario" />
        <Stat valor={fmt(v.ing_sin_registro)} label="Sin registro" sub="en espera" />
        <Stat
          valor={`${pct(v.ing_con_registro, v.registrados)}%`}
          label="Asistencia"
          sub={`${fmt(v.ing_con_registro)} de ${fmt(v.registrados)} registrados`}
        />
      </div>
      <Staff n={v.ing_staff} texto="del comité / staff ingresaron" />

      {v.por_intervalo.length > 0 ? (
        <div className="mt-5">
          <p className="text-sm font-semibold text-gray-700 mb-1">Ingresos cada 10 minutos</p>
          <Grafico data={v.por_intervalo} x="t" unidad="ingresos" />
        </div>
      ) : (
        <p className="text-sm text-gray-500 mt-4">El día del festival acá se va a ver el ingreso de las personas en tiempo real.</p>
      )}
    </Tarjeta>
  );
}

function Grafico({ data, x, unidad }: { data: any[]; x: string; unidad: string }) {
  return (
    <div className="h-44 -ml-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="#eef0f3" />
          <XAxis dataKey={x} tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
          <YAxis allowDecimals={false} width={34} tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(241,21,121,0.08)" }}
            formatter={(val: any) => [`${fmt(Number(val))} ${unidad}`, ""]}
            separator=""
            contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
          />
          <Bar dataKey="n" fill={ROSA} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Comité / staff: siempre aparte, porque no ocupa butaca
function Staff({ n, texto }: { n: number; texto: string }) {
  return (
    <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-gray-300 px-3 py-2">
      <p className="text-sm text-gray-700">
        <b className="tabular-nums">{fmt(n)}</b> {texto}
      </p>
      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">no ocupan butaca</span>
    </div>
  );
}
