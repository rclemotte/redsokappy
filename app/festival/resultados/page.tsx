"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";

// Página PÚBLICA de resultados del Festival: perfil demográfico, con selector
// de grupo (registrados / ingresaron / ambos). Solo números agregados.
// Link: /festival/resultados

type KV = { k: string; n: number };
type Res = {
  segmento: string;
  total: number;
  identificados: number;
  registrados: number;
  ingresaron: number;
  ambos: number;
  por_sexo: KV[];
  por_edad: KV[];
  por_ciudad: KV[];
};

type SegId = "registrados" | "ingresaron" | "ambos";
const SEGS: { id: SegId; label: string; desc: string }[] = [
  { id: "registrados", label: "Se registraron", desc: "personas que se anotaron" },
  { id: "ingresaron", label: "Ingresaron", desc: "personas que entraron al teatro" },
  { id: "ambos", label: "Registraron y participaron", desc: "se anotaron y además ingresaron" },
];

const ROSA = "#f11579";
const AZUL = "#0072B2";
const GRIS = "#c7ccd4";
const fmt = (n: number) => (n ?? 0).toLocaleString("es-PY");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const colorDe = (k: string) => (k === "Sin identificar" ? GRIS : k === "Otras" ? "#9ca3af" : ROSA);

export default function ResultadosFestival() {
  const supabase = useMemo(() => createClient(), []);
  const [seg, setSeg] = useState<SegId>("registrados");
  const [res, setRes] = useState<Res | null>(null);
  const [error, setError] = useState(false);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async (s: SegId) => {
    const { data, error } = await supabase.rpc("fest_resultados", { p_seg: s });
    if (error || !data) setError(true);
    else {
      setRes(data as Res);
      setError(false);
    }
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    cargar(seg);
  }, [seg, cargar]);

  if (cargando && !res) return <p className="text-center text-white pt-10 drop-shadow">Cargando…</p>;

  if (error || !res) {
    return (
      <main className="px-4 pb-10">
        <div className="bg-white/95 rounded-3xl p-6 text-center text-gray-600">
          No pudimos cargar los resultados. Reintentá en un momento.
        </div>
      </main>
    );
  }

  const total = res.total;
  const cuenta: Record<SegId, number> = {
    registrados: res.registrados,
    ingresaron: res.ingresaron,
    ambos: res.ambos,
  };
  const segActual = SEGS.find((s) => s.id === seg)!;
  const get = (arr: KV[], k: string) => arr.find((x) => x.k === k)?.n ?? 0;
  const sexoF = get(res.por_sexo, "Femenino");
  const sexoM = get(res.por_sexo, "Masculino");
  const sexoSI = get(res.por_sexo, "Sin identificar");

  return (
    <main className="px-4 pb-10 space-y-3">
      {/* Encabezado */}
      <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-4">
        <h1 className="text-lg font-extrabold" style={{ color: ROSA }}>
          Perfil de los participantes
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Festival Soka por la Paz · elegí un grupo para ver su perfil
        </p>

        {/* Selector de grupo */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          {SEGS.map((s) => {
            const act = seg === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSeg(s.id)}
                className={`rounded-xl border-2 px-2 py-2 text-center transition ${
                  act ? "border-[#f11579] bg-[#f11579] text-white" : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                <span className="block text-lg font-extrabold leading-none tabular-nums">{fmt(cuenta[s.id])}</span>
                <span className={`block text-[11px] leading-tight mt-1 ${act ? "opacity-95" : "text-gray-500"}`}>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Total del grupo elegido */}
      <section className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-5xl font-extrabold text-gray-900 tabular-nums leading-none">{fmt(total)}</p>
            <p className="text-sm text-gray-600 mt-1">{segActual.desc}</p>
          </div>
          <p className="text-right">
            <span className="block text-2xl font-extrabold tabular-nums" style={{ color: ROSA }}>
              {pct(res.identificados, total)}%
            </span>
            <span className="block text-xs text-gray-500">con perfil identificado</span>
          </p>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-gray-500">
          Los porcentajes de abajo son <b>sobre estas {fmt(total)} personas</b>. De {fmt(total - res.identificados)} no
          tenemos datos: aparecen como <b>“Sin identificar”</b>, así cada sección suma el total del grupo.
        </p>
      </section>

      {/* Sexo */}
      <Tarjeta
        titulo="Por sexo"
        nota="El gris “Sin identificar” suele ser el más grande porque de muchas personas no tenemos el dato. Entre las identificadas, la mayoría son mujeres."
      >
        <div className="grid grid-cols-3 gap-2">
          <Stat valor={fmt(sexoF)} label="Mujeres" sub={`${pct(sexoF, total)}%`} color={ROSA} />
          <Stat valor={fmt(sexoM)} label="Varones" sub={`${pct(sexoM, total)}%`} color={AZUL} />
          <Stat valor={fmt(sexoSI)} label="Sin identificar" sub={`${pct(sexoSI, total)}%`} color="#6b7280" />
        </div>
        {total > 0 && (
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-gray-100">
            <div style={{ width: `${pct(sexoF, total)}%`, background: ROSA }} />
            <div style={{ width: `${pct(sexoM, total)}%`, background: AZUL }} />
            <div style={{ width: `${pct(sexoSI, total)}%`, background: GRIS }} />
          </div>
        )}
      </Tarjeta>

      {/* Edad */}
      {res.por_edad.length > 0 && (
        <Tarjeta
          titulo="Por edad"
          nota="Cada barra es un grupo de edad de las personas identificadas. La barra gris “Sin identificar” son las personas de las que no tenemos la edad."
        >
          <GraficoV data={res.por_edad} unidad="personas" />
        </Tarjeta>
      )}

      {/* Ciudades */}
      {res.por_ciudad.length > 0 && (
        <Tarjeta
          titulo="Ciudades"
          nota="Ciudad de las personas identificadas. “Otras” junta las ciudades con pocos casos y “Sin identificar” son las que no figuran en el padrón."
        >
          <GraficoH data={res.por_ciudad} unidad="personas" />
        </Tarjeta>
      )}

      <p className="text-center text-xs text-white/90 drop-shadow">
        “Sin identificar” = personas que no figuran en el padrón consultado (menores, no afiliados, extranjeros).
      </p>
    </main>
  );
}

function Tarjeta({ titulo, children, nota }: { titulo: string; children: React.ReactNode; nota?: string }) {
  return (
    <section className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">{titulo}</h2>
      {children}
      {nota && <p className="mt-3 text-xs leading-relaxed text-gray-500">{nota}</p>}
    </section>
  );
}

function Stat({ valor, label, sub, color }: { valor: string; label: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 px-3 py-3">
      <p className="text-2xl font-extrabold tabular-nums" style={{ color: color ?? "#111827" }}>{valor}</p>
      <p className="text-xs font-semibold text-gray-700">{label}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

// Barras verticales (edad)
function GraficoV({ data, unidad }: { data: KV[]; unidad: string }) {
  return (
    <div className="h-48 -ml-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#eef0f3" />
          <XAxis dataKey="k" tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} interval={0} />
          <YAxis allowDecimals={false} width={34} tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(241,21,121,0.08)" }}
            formatter={(val: any) => [`${fmt(Number(val))} ${unidad}`, ""]}
            separator=""
            contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
          />
          <Bar dataKey="n" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={colorDe(d.k)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Barras horizontales (ciudades)
function GraficoH({ data, unidad }: { data: KV[]; unidad: string }) {
  return (
    <div style={{ height: Math.max(180, data.length * 30) }} className="-ml-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal={false} stroke="#eef0f3" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="k" width={120} tick={{ fontSize: 11, fill: "#374151" }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(241,21,121,0.08)" }}
            formatter={(val: any) => [`${fmt(Number(val))} ${unidad}`, ""]}
            separator=""
            contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
          />
          <Bar dataKey="n" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={colorDe(d.k)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
