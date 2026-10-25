"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Val = {
  id_valoracion: number;
  id_evento: number;
  eventos: number[] | null;
  general: number;
  organizacion: number | null;
  presentaciones: number | null;
  comodidad: number | null;
  medio?: string | null;
  medio_otro?: string | null;
  comentario: string | null;
  nombre: string | null;
  creado_en: string;
};
type Ev = { id_evento: number; nombre: string };

const AREAS = [
  { k: "organizacion", l: "Organización" },
  { k: "presentaciones", l: "Presentaciones" },
  { k: "comodidad", l: "Comodidad del lugar" },
] as const;
const corto = (n: string) => n.split("—").pop()!.trim();
const MEDIOS: Record<string, string> = {
  REDES: "Redes sociales",
  AMIGO: "Me invitó un amigo/a",
  MIEMBRO: "Soy miembro",
  OTRO: "Otros",
};
const prom = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmt1 = (n: number) => n.toLocaleString("es-PY", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function ValoracionesClient() {
  const supabase = useMemo(() => createClient(), []);
  const [vals, setVals] = useState<Val[]>([]);
  const [eventos, setEventos] = useState<Ev[]>([]);
  const [sel, setSel] = useState<number | "todas">("todas");
  const [soloComentarios, setSoloComentarios] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [actualizado, setActualizado] = useState<Date | null>(null);
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(async () => {
    const { data: evs } = await supabase.from("fest_evento").select("id_evento, nombre").order("id_evento");
    setEventos((evs as Ev[]) ?? []);
    const todas: Val[] = [];
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await supabase
        .from("fest_valoracion")
        .select("*")
        .order("creado_en", { ascending: false })
        .range(desde, desde + 999);
      if (error) break;
      todas.push(...((data as Val[]) ?? []));
      if (!data || data.length < 1000) break;
    }
    setVals(todas);
    setActualizado(new Date());
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, [cargar]);

  const nombreEv = useMemo(() => new Map(eventos.map((e) => [e.id_evento, corto(e.nombre)])), [eventos]);
  const funcs = (v: Val) => (v.eventos?.length ? v.eventos : [v.id_evento]);
  const etiquetaFunc = (v: Val) =>
    funcs(v).length > 1 ? "Ambas" : nombreEv.get(funcs(v)[0]) ?? String(funcs(v)[0]);
  const vista = sel === "todas" ? vals : vals.filter((v) => funcs(v).includes(sel));
  const general = prom(vista.map((v) => v.general));
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: vista.filter((v) => v.general === n).length }));
  const satisfechos = vista.length ? Math.round((vista.filter((v) => v.general >= 4).length / vista.length) * 100) : 0;
  const comentarios = vista.filter((v) => !soloComentarios || (v.comentario ?? "").trim());

  async function borrar(v: Val) {
    if (!confirm("¿Borrar esta respuesta? (por ejemplo, si es spam)")) return;
    await supabase.from("fest_valoracion").delete().eq("id_valoracion", v.id_valoracion);
    cargar();
  }

  async function exportar() {
    const XLSX = await import("xlsx");
    const filas = vals.map((v) => ({
      Funcion: etiquetaFunc(v),
      General: v.general,
      Organizacion: v.organizacion ?? "",
      Presentaciones: v.presentaciones ?? "",
      Comodidad: v.comodidad ?? "",
      "Se entero por": v.medio ? MEDIOS[v.medio] ?? v.medio : "",
      "Otro medio": v.medio_otro ?? "",
      Comentario: v.comentario ?? "",
      Nombre: v.nombre ?? "",
      Fecha: new Date(v.creado_en).toLocaleString("es-PY", { timeZone: "America/Asuncion", hour12: false }),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filas);
    ws["!cols"] = [12, 8, 12, 14, 11, 60, 20, 18].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, "Valoraciones");
    XLSX.writeFile(wb, `valoraciones_festival_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function copiarLink() {
    const url = `${window.location.origin}/festival/valoracion`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      window.prompt("Copiá el link:", url);
    }
  }

  if (cargando) return <p className="text-gray-500">Cargando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Link href="/eventos" className="text-xs text-marca">← Eventos</Link>
          <h1 className="text-xl font-bold">Valoraciones del Festival</h1>
        </div>
        <span className="text-xs text-gray-400 text-right">
          Se actualiza solo
          <br />
          {actualizado?.toLocaleTimeString("es-PY", { hour12: false })}
        </span>
      </div>

      {/* Filtro por función */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${eventos.length + 1}, minmax(0,1fr))` }}>
        {[{ id: "todas" as const, l: "Todas" }, ...eventos.map((e) => ({ id: e.id_evento, l: corto(e.nombre) }))].map((o) => (
          <button
            key={String(o.id)}
            onClick={() => setSel(o.id)}
            className={`rounded-lg border-2 py-2 text-sm font-semibold ${
              sel === o.id ? "border-marca bg-marca text-white" : "border-gray-200 bg-white text-gray-700"
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>

      {vista.length === 0 ? (
        <div className="bg-white rounded-xl p-6 text-center text-gray-500 shadow-sm">Todavía no hay respuestas.</div>
      ) : (
        <>
          {/* Resumen */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500">Calificación general</p>
                <p className="text-4xl font-extrabold tabular-nums">
                  {fmt1(general)} <span className="text-2xl text-amber-400">★</span>
                </p>
                <p className="text-xs text-gray-500">{vista.length} respuestas</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-extrabold text-green-700 tabular-nums">{satisfechos}%</p>
                <p className="text-xs text-gray-500">puso 4 o 5 estrellas</p>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              {dist.map((d) => (
                <div key={d.n} className="flex items-center gap-2 text-xs">
                  <span className="w-6 text-gray-600 tabular-nums">{d.n}★</span>
                  <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${vista.length ? (d.c / vista.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-gray-600 tabular-nums">{d.c}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Medio por el que se enteró */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-2">¿Por qué medio se enteraron?</p>
            {(() => {
              const conDato = vista.filter((v) => v.medio);
              if (!conDato.length) return <p className="text-sm text-gray-400">Sin datos todavía.</p>;
              const otros = conDato.filter((v) => v.medio === "OTRO" && v.medio_otro).map((v) => v.medio_otro!);
              return (
                <>
                  {Object.entries(MEDIOS).map(([k, l]) => {
                    const c = conDato.filter((v) => v.medio === k).length;
                    const pct = Math.round((c / conDato.length) * 100);
                    return (
                      <div key={k} className="flex items-center gap-2 text-xs py-1">
                        <span className="w-36 text-gray-700">{l}</span>
                        <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-marca" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-14 text-right text-gray-600 tabular-nums">
                          {c} · {pct}%
                        </span>
                      </div>
                    );
                  })}
                  <p className="text-xs text-gray-400 mt-1">{conDato.length} respondieron esta pregunta</p>
                  {otros.length > 0 && (
                    <p className="text-xs text-gray-600 mt-2">
                      <b>Otros:</b> {otros.join(" · ")}
                    </p>
                  )}
                </>
              );
            })()}
          </div>

          {/* Áreas */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-2">Por área (respuestas opcionales)</p>
            {AREAS.map((a) => {
              const xs = vista.map((v) => v[a.k]).filter((x): x is number => x != null);
              return (
                <div key={a.k} className="flex items-center justify-between py-1.5 text-sm border-b last:border-0">
                  <span>{a.l}</span>
                  <span className="tabular-nums">
                    {xs.length ? (
                      <>
                        <b>{fmt1(prom(xs))}</b> <span className="text-amber-400">★</span>{" "}
                        <span className="text-xs text-gray-400">({xs.length})</span>
                      </>
                    ) : (
                      <span className="text-gray-400">sin datos</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Acciones */}
      <div className="bg-white rounded-xl p-4 shadow-sm space-y-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span>Link público de valoración (para el QR)</span>
          <button onClick={copiarLink} className="text-marca font-semibold">
            {copiado ? "¡Copiado!" : "Copiar"}
          </button>
        </div>
        <button onClick={exportar} className="w-full rounded-lg border border-marca text-marca py-2 font-medium">
          Exportar Excel
        </button>
      </div>

      {/* Comentarios */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex items-center justify-between p-3 border-b">
          <p className="font-semibold text-sm">Respuestas ({comentarios.length})</p>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={soloComentarios} onChange={(e) => setSoloComentarios(e.target.checked)} />
            Solo con comentario
          </label>
        </div>
        <ul className="divide-y max-h-[70vh] overflow-auto">
          {comentarios.map((v) => (
            <li key={v.id_valoracion} className="p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-amber-400 tracking-tight">
                  {"★".repeat(v.general)}
                  <span className="text-gray-200">{"★".repeat(5 - v.general)}</span>
                </span>
                <span className="text-xs text-gray-400">
                  {etiquetaFunc(v)} ·{" "}
                  {new Date(v.creado_en).toLocaleString("es-PY", {
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
                  })}
                </span>
              </div>
              {v.comentario && <p className="mt-1 text-gray-800 whitespace-pre-line">{v.comentario}</p>}
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500">
                  {v.nombre ? `— ${v.nombre}` : "Anónimo"}
                  {AREAS.filter((a) => v[a.k]).map((a) => ` · ${a.l}: ${v[a.k]}★`).join("")}
                </span>
                <button onClick={() => borrar(v)} className="text-xs text-red-400">
                  Borrar
                </button>
              </div>
            </li>
          ))}
          {comentarios.length === 0 && <li className="p-6 text-center text-sm text-gray-400">Sin respuestas todavía.</li>}
        </ul>
      </div>
    </div>
  );
}
