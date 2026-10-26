"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";

// Página PÚBLICA de resultados del Festival: perfil demográfico de los
// asistentes (solo números agregados, sin datos personales).
// Cada desglose incluye "Sin identificar" para que sume el total.
// Link: /festival/resultados

type KV = { k: string; n: number };
type Res = {
  total: number;
  identificados: number;
  registrados: number;
  ingresaron: number;
  por_sexo: KV[];
  por_edad: KV[];
  por_ciudad: KV[];
};

const ROSA = "#f11579";
const AZUL = "#0072B2";
const GRIS = "#c7ccd4";
const fmt = (n: number) => (n ?? 0).toLocaleString("es-PY");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const colorDe = (k: string) => (k === "Sin identificar" ? GRIS : k === "Otras" ? "#9ca3af" : ROSA);

export default function ResultadosFestival() {
  const supabase = useMemo(() => createClient(), []);
  const [res, setRes] = useState<Res | null>(null);
  const [error, setError] = useState(false);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc("fest_resultados");
    if (error || !data) setError(true);
    else {
      setRes(data as Res);
      setError(false);
    }
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando) return <p className="text-center text-white pt-10 drop-shadow">Cargando…</p>;

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
  const get = (arr: KV[], k: string) => arr.find((x) => x.k === k)?.n ?? 0;
  const sexoF = get(res.por_sexo, "Femenino");
  const sexoM = get(res.por_sexo, "Masculino");
  const sexoSI = get(res.por_sexo, "Sin identificar");

  return (
    <main className="px-4 pb-10 space-y-3">
      {/* Encabezado */}
      <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-4">
        <h1 className="text-lg font-extrabold" style={{ color: ROSA }}>
          Perfil de los asistentes
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Festival Soka por la Paz · quiénes nos acompañaron
        </p>
      </div>

      {/* Totales */}
      <section className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-5xl font-extrabold text-gray-900 tabular-nums leading-none">{fmt(total)}</p>
            <p className="text-sm text-gray-600 mt-1">asistentes en total</p>
          </div>
          <p className="text-right">
            <span className="block text-2xl font-extrabold tabular-nums" style={{ color: ROSA }}>
              {pct(res.identificados, total)}%
            </span>
            <span className="block text-xs text-gray-500">con perfil identificado</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Stat valor={fmt(res.registrados)} label="Registrados" />
          <Stat valor={fmt(res.ingresaron)} label="Ingresaron al teatro" />
        </div>
      </section>

      {/* Sexo */}
      <Tarjeta titulo="Por sexo">
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
        <Tarjeta titulo="Por edad">
          <GraficoV data={res.por_edad} unidad="personas" />
        </Tarjeta>
      )}

      {/* Ciudades */}
      {res.por_ciudad.length > 0 && (
        <Tarjeta titulo="De dónde vinieron">
          <GraficoH data={res.por_ciudad} unidad="personas" />
        </Tarjeta>
      )}

      <p className="text-center text-xs text-white/90 drop-shadow">
        "Sin identificar" = asistentes que no figuran en el padrón consultado (menores, no afiliados, extranjeros).
        El resto del perfil se basa en los {fmt(res.identificados)} identificados.
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
