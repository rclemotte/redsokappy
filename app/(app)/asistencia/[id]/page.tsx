"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Combobox from "@/components/Combobox";

type Opt = { value: string; label: string };
type Asistente = { id_asistencia_d: number; id_persona: number | null; personas: { nombre: string; division: string | null } | null };

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-marca bg-white";

export default function ReunionDetallePage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const idAs = Number(params.id);

  const [tipos, setTipos] = useState<Opt[]>([]);
  const [hans, setHans] = useState<Opt[]>([]);
  const [personas, setPersonas] = useState<{ id_persona: number; nombre: string }[]>([]);
  const [asistentes, setAsistentes] = useState<Asistente[]>([]);

  const [fecha, setFecha] = useState("");
  const [tipo, setTipo] = useState("");
  const [han, setHan] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  async function cargarAsistentes() {
    const { data } = await supabase
      .from("asistencia_d")
      .select("id_asistencia_d, id_persona, personas:personas!id_persona(nombre, division)")
      .eq("id_asistencia", idAs)
      .order("id_asistencia_d");
    setAsistentes((data as any) ?? []);
  }

  useEffect(() => {
    (async () => {
      const [c, t, h, p] = await Promise.all([
        supabase.from("asistencia_c").select("*").eq("id_asistencia", idAs).single(),
        supabase.from("tipo_evento").select("id_tipo_evento, nombre").order("nombre"),
        supabase.from("han").select("id_han, nombre").order("nombre"),
        supabase.from("personas").select("id_persona, nombre").order("nombre"),
      ]);
      if (c.data) {
        setFecha(c.data.fecha_asistencia ? String(c.data.fecha_asistencia).slice(0, 10) : "");
        setTipo(c.data.id_tipo_evento != null ? String(c.data.id_tipo_evento) : "");
        setHan(c.data.id_han != null ? String(c.data.id_han) : "");
      }
      setTipos((t.data ?? []).map((x: any) => ({ value: String(x.id_tipo_evento), label: x.nombre })));
      setHans((h.data ?? []).map((x: any) => ({ value: String(x.id_han), label: x.nombre })));
      setPersonas((p.data as any) ?? []);
      await cargarAsistentes();
      setCargando(false);
    })();
  }, []); // eslint-disable-line

  const yaIds = useMemo(() => new Set(asistentes.map((a) => a.id_persona)), [asistentes]);
  const candidatos = useMemo(() => {
    const t = q.trim().toUpperCase();
    if (!t) return [];
    return personas.filter((m) => !yaIds.has(m.id_persona) && m.nombre.toUpperCase().includes(t)).slice(0, 8);
  }, [q, personas, yaIds]);

  async function guardarCab() {
    setErr(null); setMsg(null);
    const { error } = await supabase.from("asistencia_c")
      .update({ fecha_asistencia: fecha, id_tipo_evento: tipo ? Number(tipo) : null, id_han: han ? Number(han) : null })
      .eq("id_asistencia", idAs);
    if (error) setErr(traducir(error.message)); else setMsg("Cabecera guardada ✓");
  }

  async function agregar(idp: number) {
    setErr(null);
    const { error } = await supabase.from("asistencia_d").insert({ id_asistencia: idAs, id_persona: idp });
    if (error) { setErr(traducir(error.message)); return; }
    setQ("");
    cargarAsistentes();
  }

  async function quitar(idad: number) {
    await supabase.from("asistencia_d").delete().eq("id_asistencia_d", idad);
    cargarAsistentes();
  }

  if (cargando) return <p className="text-sm text-gray-500">Cargando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="text-gray-500 text-sm">‹ Volver</button>
        <h1 className="text-lg font-semibold">Reunión</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-medium mb-1">Fecha</span>
            <input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Tipo</span>
            <Combobox value={tipo} onChange={setTipo} options={tipos} placeholder="Tipo de evento..." />
          </label>
        </div>
        <label className="block">
          <span className="block text-sm font-medium mb-1">Han</span>
          <Combobox value={han} onChange={setHan} options={hans} placeholder="Han..." />
        </label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        {msg && <p className="text-sm text-green-600">{msg}</p>}
        <button onClick={guardarCab} className="w-full rounded-lg bg-marca text-white py-2 font-medium">Guardar cabecera</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Participantes</h3>
          <span className="text-sm text-marca font-semibold">{asistentes.length}</span>
        </div>

        <input className={inputCls} placeholder="Agregar participante (buscar)..." value={q} onChange={(e) => setQ(e.target.value)} />
        {candidatos.length > 0 && (
          <div className="border rounded-lg divide-y">
            {candidatos.map((c) => (
              <button key={c.id_persona} onClick={() => agregar(c.id_persona)} className="block w-full text-left px-3 py-2 text-sm active:bg-gray-50">
                + {c.nombre}
              </button>
            ))}
          </div>
        )}

        <div className="divide-y">
          {asistentes.map((a) => (
            <div key={a.id_asistencia_d} className="flex items-center justify-between py-2 text-sm">
              <span>{a.personas?.nombre ?? `Persona ${a.id_persona}`} <span className="text-gray-400">{a.personas?.division ?? ""}</span></span>
              <button className="text-red-500 text-xs" onClick={() => quitar(a.id_asistencia_d)}>Quitar</button>
            </div>
          ))}
          {asistentes.length === 0 && <p className="text-sm text-gray-500 py-2">Sin participantes aún.</p>}
        </div>
      </div>
    </div>
  );
}

function traducir(m: string) {
  if (m?.toLowerCase().includes("row-level security"))
    return "No tenés permiso para guardar. Ejecutá supabase/dashboard.sql en Supabase y reintentá.";
  if (m?.toLowerCase().includes("duplicate key"))
    return "Esa persona ya está en la reunión.";
  return m;
}
