"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Search, Trash2, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Combobox from "@/components/Combobox";
import { Avatar, Cabecera } from "@/components/ui";
import { normalizar, traerTodo } from "@/lib/tookan";

type Opt = { value: string; label: string };
type P = { id_persona: number; nombre: string; division: string | null; id_han: number | null };

export default function ReunionForm({ id }: { id?: number }) {
  const supabase = createClient();
  const router = useRouter();
  const editar = typeof id === "number";

  const [tipos, setTipos] = useState<Opt[]>([]);
  const [hanes, setHanes] = useState<Opt[]>([]);
  const [personas, setPersonas] = useState<P[]>([]);
  const [fecha, setFecha] = useState(new Date().toLocaleDateString("sv-SE", { timeZone: "America/Asuncion" }));
  const [tipo, setTipo] = useState("");
  const [han, setHan] = useState("");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [original, setOriginal] = useState<Map<number, number>>(new Map()); // id_persona → id_asistencia_d
  const [q, setQ] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [t, h, p] = await Promise.all([
        supabase.from("tipo_evento").select("id_tipo_evento, nombre").order("nombre"),
        supabase.from("vw_estructura").select("id_han, han, cabildo").order("cabildo").order("han"),
        traerTodo<P>((d, hh) => supabase.from("personas").select("id_persona, nombre, division, id_han").eq("activo", true).order("nombre").range(d, hh)).catch(() => []),
      ]);
      const ts = (t.data ?? []).map((x: any) => ({ value: String(x.id_tipo_evento), label: x.nombre }));
      setTipos(ts);
      setHanes((h.data ?? []).map((x: any) => ({ value: String(x.id_han), label: `${x.han} · ${x.cabildo}` })));
      setPersonas(p);
      if (!editar) {
        const reunionHan = ts.find((x) => normalizar(x.label).includes("han"));
        if (reunionHan) setTipo(reunionHan.value);
      } else {
        const [c, d] = await Promise.all([
          supabase.from("asistencia_c").select("*").eq("id_asistencia", id).single(),
          supabase.from("asistencia_d").select("id_asistencia_d, id_persona").eq("id_asistencia", id),
        ]);
        if (c.data) {
          setFecha(c.data.fecha_asistencia ? String(c.data.fecha_asistencia).slice(0, 10) : "");
          setTipo(c.data.id_tipo_evento != null ? String(c.data.id_tipo_evento) : "");
          setHan(c.data.id_han != null ? String(c.data.id_han) : "");
        }
        const m = new Map<number, number>();
        for (const r of d.data ?? []) if (r.id_persona != null) m.set(r.id_persona, r.id_asistencia_d);
        setOriginal(m);
        setSel(new Set(m.keys()));
      }
      setCargando(false);
    })();
  }, []); // eslint-disable-line

  const delHan = useMemo(() => (han ? personas.filter((p) => String(p.id_han) === han) : []), [personas, han]);
  const visitas = useMemo(() => personas.filter((p) => sel.has(p.id_persona) && String(p.id_han) !== han), [personas, sel, han]);
  const candidatos = useMemo(() => {
    const t = normalizar(q.trim());
    if (t.length < 2) return [];
    return personas.filter((p) => !sel.has(p.id_persona) && String(p.id_han) !== han && normalizar(p.nombre).includes(t)).slice(0, 8);
  }, [q, personas, sel, han]);
  const presentesHan = delHan.filter((p) => sel.has(p.id_persona)).length;

  function toggle(idp: number) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(idp)) n.delete(idp);
      else n.add(idp);
      return n;
    });
  }

  async function guardar() {
    setErr(null);
    if (!fecha) return setErr("Elegí la fecha.");
    if (!tipo) return setErr("Elegí el tipo de reunión.");
    if (sel.size === 0) return setErr("Marcá al menos una persona.");
    setGuardando(true);
    const cab = { fecha_asistencia: fecha, id_tipo_evento: Number(tipo), id_han: han ? Number(han) : null };
    let idAs = id;
    if (editar) {
      const { error } = await supabase.from("asistencia_c").update(cab).eq("id_asistencia", id);
      if (error) { setErr(traducir(error.message)); setGuardando(false); return; }
      const quitar = Array.from(original.entries()).filter(([p]) => !sel.has(p)).map(([, d]) => d);
      if (quitar.length) await supabase.from("asistencia_d").delete().in("id_asistencia_d", quitar);
      const nuevos = Array.from(sel).filter((p) => !original.has(p));
      if (nuevos.length) {
        const { error: e2 } = await supabase.from("asistencia_d").insert(nuevos.map((p) => ({ id_asistencia: id, id_persona: p })));
        if (e2) { setErr(traducir(e2.message)); setGuardando(false); return; }
      }
    } else {
      const { data, error } = await supabase.from("asistencia_c").insert(cab).select("id_asistencia").single();
      if (error) { setErr(traducir(error.message)); setGuardando(false); return; }
      idAs = data.id_asistencia;
      const { error: e2 } = await supabase.from("asistencia_d").insert(Array.from(sel).map((p) => ({ id_asistencia: idAs, id_persona: p })));
      if (e2) { setErr(traducir(e2.message)); setGuardando(false); return; }
    }
    router.push("/asistencia");
    router.refresh();
  }

  async function borrar() {
    if (!editar || !confirm("¿Borrar esta reunión y su lista de participantes?")) return;
    await supabase.from("asistencia_c").delete().eq("id_asistencia", id);
    router.push("/asistencia");
    router.refresh();
  }

  if (cargando) {
    return (
      <div>
        <Cabecera titulo={editar ? "Reunión" : "Registrar reunión"} volver />
        <div className="card h-64 animate-pulse" />
      </div>
    );
  }

  const Fila = ({ p, visita = false }: { p: P; visita?: boolean }) => {
    const on = sel.has(p.id_persona);
    return (
      <button
        type="button"
        onClick={() => toggle(p.id_persona)}
        className={`flex w-full items-center gap-3 p-3 text-left transition active:scale-[0.99] ${on ? "bg-estado-activoBg/60" : ""}`}
      >
        <Avatar nombre={p.nombre} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{p.nombre}</div>
          <div className={`text-[13px] font-semibold ${visita ? "text-estado-amigo" : "text-tinta-suave"}`}>
            {visita ? "Visita de otro Han" : p.division ?? ""}
          </div>
        </div>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 transition ${
            on ? "border-estado-activo bg-estado-activo text-white" : "border-linea bg-white text-transparent"
          }`}
        >
          <Check size={18} strokeWidth={3.5} />
        </span>
      </button>
    );
  };

  return (
    <div className="pb-24 lg:pb-0">
      <Cabecera titulo={editar ? "Reunión" : "Registrar reunión"} subtitulo="Marcá quién participó" volver />

      <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,380px)_1fr] lg:items-start lg:gap-5 lg:space-y-0">
        <section className="card space-y-4 p-5 lg:sticky lg:top-8">
          <label className="block">
            <span className="etiqueta">Fecha</span>
            <input type="date" className="campo" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <div>
            <span className="etiqueta">Tipo de reunión</span>
            {tipos.length <= 6 ? (
              <div className="flex flex-wrap gap-2">
                {tipos.map((t) => (
                  <button key={t.value} type="button" onClick={() => setTipo(t.value)} className={`chip ${tipo === t.value ? "chip-on" : ""}`}>{t.label}</button>
                ))}
              </div>
            ) : (
              <Combobox value={tipo} onChange={setTipo} options={tipos} placeholder="Tipo de reunión…" />
            )}
          </div>
          <label className="block">
            <span className="etiqueta">Han</span>
            <Combobox value={han} onChange={setHan} options={hanes} placeholder="Buscar han…" />
          </label>
          {editar && (
            <button type="button" onClick={borrar} className="inline-flex items-center gap-1.5 text-sm font-bold text-red-600">
              <Trash2 size={16} /> Borrar reunión
            </button>
          )}
        </section>

        <div className="space-y-4">
          {han && (
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 pb-2 pt-4">
                <h2 className="subtitulo">Del Han <span className="text-tinta-tenue">{presentesHan}/{delHan.length}</span></h2>
                {delHan.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSel((prev) => {
                        const n = new Set(prev);
                        const todos = delHan.every((p) => n.has(p.id_persona));
                        delHan.forEach((p) => (todos ? n.delete(p.id_persona) : n.add(p.id_persona)));
                        return n;
                      })
                    }
                    className="text-sm font-extrabold text-marca"
                  >
                    {delHan.every((p) => sel.has(p.id_persona)) ? "Desmarcar todos" : "Marcar todos"}
                  </button>
                )}
              </div>
              <div className="divide-y divide-linea">
                {delHan.map((p) => <Fila key={p.id_persona} p={p} />)}
                {delHan.length === 0 && <p className="px-5 pb-4 text-sm font-semibold text-tinta-suave">Este han todavía no tiene personas cargadas.</p>}
              </div>
            </section>
          )}

          <section className="card overflow-hidden">
            <div className="px-5 pb-3 pt-4">
              <h2 className="subtitulo flex items-center gap-2"><UserPlus size={20} className="text-marca" /> {han ? "Visitas y otras personas" : "Participantes"}</h2>
              <p className="text-sm font-semibold text-tinta-suave">
                {han ? "La visita cuenta para este Han y la persona sigue en el suyo." : "Elegí el Han arriba para ver su lista, o buscá personas acá."}
              </p>
              <label className="mt-3 flex items-center gap-2.5 rounded-2xl border-2 border-linea px-4 py-2.5 focus-within:border-marca">
                <Search size={18} className="text-marca" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre…" className="w-full bg-transparent font-semibold outline-none placeholder:text-tinta-tenue" />
              </label>
            </div>
            {candidatos.length > 0 && (
              <div className="divide-y divide-linea border-t border-linea bg-crema/60">
                {candidatos.map((p) => (
                  <button key={p.id_persona} type="button" onClick={() => { toggle(p.id_persona); setQ(""); }} className="flex w-full items-center gap-3 px-5 py-2.5 text-left active:bg-marca-50">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-marca text-white">+</span>
                    <span className="font-bold">{p.nombre}</span>
                  </button>
                ))}
              </div>
            )}
            {visitas.length > 0 && <div className="divide-y divide-linea border-t border-linea">{visitas.map((p) => <Fila key={p.id_persona} p={p} visita={!!han} />)}</div>}
          </section>
        </div>
      </div>

      {/* Barra para guardar, siempre a mano */}
      <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.6rem)] z-20 lg:static lg:mt-5 lg:flex lg:justify-end">
        {err && <p className="mb-2 rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 shadow-suave">{err}</p>}
        <button onClick={guardar} disabled={guardando} className="btn-sol w-full py-4 text-lg shadow-flotante lg:w-auto lg:px-10">
          <Check size={22} strokeWidth={3} />
          {guardando ? "Guardando…" : `Guardar · ${sel.size} ${sel.size === 1 ? "presente" : "presentes"}`}
        </button>
      </div>
    </div>
  );
}

function traducir(m: string) {
  const t = m?.toLowerCase() ?? "";
  if (t.includes("row-level security")) return "No tenés permiso para registrar participación. Pedí acceso de editor.";
  if (t.includes("duplicate key")) return "Hay una persona repetida en la lista.";
  return m;
}
