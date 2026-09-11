"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Opt = { value: string; label: string };
type Persona = { id_persona: number; nombre: string; division: string | null };

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-marca bg-white";

export default function NuevaReunionPage() {
  const supabase = createClient();
  const router = useRouter();

  const [tipos, setTipos] = useState<Opt[]>([]);
  const [hans, setHans] = useState<Opt[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [tipo, setTipo] = useState("");
  const [han, setHan] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const [t, h, p] = await Promise.all([
        supabase.from("tipo_evento").select("id_tipo_evento, nombre").order("nombre"),
        supabase.from("han").select("id_han, nombre").order("nombre"),
        supabase.from("personas").select("id_persona, nombre, division").order("nombre"),
      ]);
      setTipos((t.data ?? []).map((x: any) => ({ value: String(x.id_tipo_evento), label: x.nombre })));
      setHans((h.data ?? []).map((x: any) => ({ value: String(x.id_han), label: x.nombre })));
      setPersonas((p.data as any) ?? []);
      setCargando(false);
    })();
  }, []); // eslint-disable-line

  const filtrados = useMemo(() => {
    const t = q.trim().toUpperCase();
    if (!t) return personas;
    return personas.filter((m) => m.nombre.toUpperCase().includes(t));
  }, [q, personas]);

  function toggle(idp: number) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(idp)) n.delete(idp); else n.add(idp);
      return n;
    });
  }

  async function guardar() {
    setErr(null);
    if (!tipo) { setErr("Elegí el tipo de evento."); return; }
    if (sel.size === 0) { setErr("Seleccioná al menos un participante."); return; }
    setGuardando(true);

    const { data: cab, error: e1 } = await supabase
      .from("asistencia_c")
      .insert({ id_tipo_evento: Number(tipo), fecha_asistencia: fecha, id_han: han ? Number(han) : null })
      .select("id_asistencia").single();
    if (e1) { setErr(traducir(e1.message)); setGuardando(false); return; }

    const idAs = cab.id_asistencia;
    const filas = Array.from(sel).map((idp) => ({ id_asistencia: idAs, id_persona: idp }));
    const { error: e2 } = await supabase.from("asistencia_d").insert(filas);
    if (e2) { setErr(traducir(e2.message)); setGuardando(false); return; }

    router.push(`/asistencia/${idAs}`);
  }

  if (cargando) return <p className="text-sm text-gray-500">Cargando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="text-gray-500 text-sm">‹ Volver</button>
        <h1 className="text-lg font-semibold">Nueva reunión</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-medium mb-1">Fecha</span>
            <input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Tipo de evento *</span>
            <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">—</option>
              {tipos.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="block text-sm font-medium mb-1">Han (opcional)</span>
          <select className={inputCls} value={han} onChange={(e) => setHan(e.target.value)}>
            <option value="">—</option>
            {hans.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Participantes</h3>
          <span className="text-sm text-marca font-semibold">{sel.size} seleccionados</span>
        </div>
        <input className={inputCls} placeholder="Buscar persona..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-80 overflow-y-auto divide-y">
          {filtrados.map((m) => (
            <label key={m.id_persona} className="flex items-center gap-3 py-2 text-sm">
              <input type="checkbox" checked={sel.has(m.id_persona)} onChange={() => toggle(m.id_persona)} />
              <span>{m.nombre} <span className="text-gray-400">{m.division ?? ""}</span></span>
            </label>
          ))}
        </div>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <button
        disabled={guardando}
        onClick={guardar}
        className="w-full rounded-lg bg-marca text-white py-3 font-medium disabled:opacity-60"
      >
        {guardando ? "Guardando..." : "Guardar reunión"}
      </button>
    </div>
  );
}

function traducir(m: string) {
  if (m?.toLowerCase().includes("row-level security"))
    return "No tenés permiso para guardar. Ejecutá supabase/dashboard.sql en Supabase y reintentá.";
  if (m?.toLowerCase().includes("duplicate key"))
    return "Hay un participante repetido en esta reunión.";
  return m;
}
