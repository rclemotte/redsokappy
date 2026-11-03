"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Phone, HeartHandshake, Award, CalendarCheck, Plus, X, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, BadgeEstado, Cabecera, Decoracion, Vacio } from "@/components/ui";
import Combobox from "@/components/Combobox";
import { DIVISIONES, MOTIVOS_BAJA, fechaCorta, type PersonaTookan } from "@/lib/tookan";

type Cargo = { id_persona_cargo: number; cargo_texto: string; fecha_asuncion: string | null };
type Part = { id_asistencia: number; fecha: string; tipo: string | null; han: string | null; visita: boolean };

const NIVELES = [
  { v: "HAN", l: "Han" },
  { v: "DISTRITO", l: "Distrito" },
  { v: "CABILDO", l: "Cabildo" },
  { v: "REGION", l: "Región" },
  { v: "NACIONAL", l: "Nacional" },
];

function Dato({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="text-sm font-bold text-tinta-suave">{label}</span>
      <span className="text-right font-bold">{valor || <span className="text-tinta-tenue">—</span>}</span>
    </div>
  );
}

export default function FichaPersona({ id }: { id: number }) {
  const supabase = createClient();
  const [p, setP] = useState<PersonaTookan | null>(null);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [recomendados, setRecomendados] = useState<{ id: number; nombre: string }[]>([]);
  const [recomendadores, setRecomendadores] = useState<{ id: number; nombre: string; orden: number | null }[]>([]);
  const [puedeEditar, setPuedeEditar] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [agregando, setAgregando] = useState(false);

  async function cargarCargos() {
    const { data } = await supabase.from("vw_cargos_vigentes").select("id_persona_cargo, cargo_texto, fecha_asuncion").eq("id_persona", id).order("orden");
    setCargos((data as Cargo[]) ?? []);
  }

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const [per, perfil, ad, sk1, sk2] = await Promise.all([
        supabase.from("vw_personas_tookan").select("*").eq("id_persona", id).single(),
        auth.user ? supabase.from("perfiles").select("id_rol").eq("id", auth.user.id).single() : Promise.resolve({ data: null }),
        supabase.rpc("participacion_persona", { p_id: id }),
        supabase.from("shakubuku").select("id_shakubuku_para, membresia, gohonzon, personas!shakubuku_id_shakubuku_para_fkey(nombre)").eq("id_shakubuku_de", id),
        supabase.from("shakubuku").select("id_shakubuku_de, orden, personas!shakubuku_id_shakubuku_de_fkey(nombre)").eq("id_shakubuku_para", id),
      ]);
      setP((per.data as PersonaTookan) ?? null);
      setPuedeEditar([1, 3, 4].includes(Number((perfil as any).data?.id_rol)));
      const lista: Part[] = ((ad.data as any[]) ?? [])
        .map((r) => ({
          id_asistencia: r.id_asistencia,
          fecha: r.fecha,
          tipo: r.tipo ?? null,
          han: r.han ?? null,
          visita: per.data?.id_han != null && r.id_han != null && r.id_han !== per.data.id_han,
        }))
        .filter((x) => x.fecha)
        .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
      setParts(lista);
      setRecomendados(((sk1.data as any[]) ?? []).filter((s) => s.membresia === 1 || s.gohonzon === 1).map((s) => ({ id: s.id_shakubuku_para, nombre: s.personas?.nombre ?? "Persona de otro cabildo" })));
      setRecomendadores(((sk2.data as any[]) ?? []).filter((s) => s.orden).map((s) => ({ id: s.id_shakubuku_de, nombre: s.personas?.nombre ?? "Persona de otro cabildo", orden: s.orden })));
      await cargarCargos();
      setCargando(false);
    })();
  }, []); // eslint-disable-line

  if (cargando) {
    return (
      <div>
        <Cabecera titulo="Ficha" volver="/miembros" />
        <div className="space-y-4">
          <div className="card h-40 animate-pulse" />
          <div className="card h-56 animate-pulse" />
        </div>
      </div>
    );
  }
  if (!p) {
    return (
      <div>
        <Cabecera titulo="Ficha" volver="/miembros" />
        <Vacio icono={<X size={30} />} titulo="No encontramos a esta persona" />
      </div>
    );
  }

  const tel = (p.telefono ?? "").replace(/\D/g, "");
  const wa = tel ? (tel.startsWith("0") ? "595" + tel.slice(1) : tel) : "";
  const ultimas = parts.slice(0, 12);
  const tres = new Date();
  tres.setMonth(tres.getMonth() - 3);
  const ultimos3 = parts.filter((x) => new Date(x.fecha) >= tres).length;

  return (
    <div>
      {/* ---------- Encabezado de la ficha ---------- */}
      <header className="relative -mx-4 -mt-4 mb-5 overflow-hidden rounded-b-[2.25rem] bg-sol px-5 pb-6 pt-[calc(env(safe-area-inset-top)+1.25rem)] text-white lg:mx-0 lg:mt-0 lg:rounded-4xl lg:px-8 lg:pt-7">
        <Decoracion />
        <div className="relative">
          <div className="flex items-center justify-between">
            <Link href="/miembros" className="-ml-1 text-sm font-bold text-white/85">‹ Personas</Link>
            {puedeEditar && (
              <Link href={`/miembros/${p.id_persona}/editar`} className="btn-chico bg-white/20 text-white backdrop-blur-sm">
                <Pencil size={15} strokeWidth={2.6} /> Editar
              </Link>
            )}
          </div>
          <div className="mt-4 flex items-center gap-4">
            <div className="rounded-[1.4rem] bg-white p-1 shadow-flotante">
              <Avatar nombre={p.nombre_completo} size={68} />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-[1.7rem] font-extrabold leading-[1.1]">{p.nombre_completo}</h1>
              <p className="mt-0.5 text-[15px] font-semibold text-white/90">
                {p.han ? `Han ${p.han} · ${p.cabildo}` : p.cabildo ?? "Sin han asignado"}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {p.activo ? <BadgeEstado estado={p.estado} className="bg-white" /> : (
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-tinta">Baja · {MOTIVOS_BAJA[p.motivo_baja ?? ""] ?? "sin motivo"}</span>
            )}
            {p.gohonzon && <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-extrabold">Gohonzon ✓</span>}
            {!p.gohonzon && p.membresia && <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-extrabold">Membresía ✓</span>}
            {p.division && <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-extrabold">{p.division}</span>}
          </div>
          {wa && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a href={`tel:${p.telefono}`} className="btn rounded-2xl bg-white/20 py-2.5 text-white backdrop-blur-sm"><Phone size={18} /> Llamar</a>
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="btn rounded-2xl bg-white py-2.5 text-marca"><MessageCircle size={18} /> WhatsApp</a>
            </div>
          )}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <div className="space-y-4">
          {/* ---------- Datos ---------- */}
          <section className="card px-5 py-2">
            <div className="divide-y divide-linea">
              <Dato label="División" valor={p.division ? DIVISIONES[p.division]?.label ?? p.division : null} />
              <Dato label="Han" valor={p.han} />
              <Dato label="Distrito" valor={p.distrito} />
              <Dato label="Cabildo" valor={p.cabildo} />
              <Dato label="Cédula" valor={p.cedula} />
              <Dato label="Teléfono" valor={p.telefono} />
              {p.fecha_nacimiento && <Dato label="Nacimiento" valor={fechaCorta(p.fecha_nacimiento)} />}
              {p.observacion && <Dato label="Observación" valor={<span className="font-semibold text-tinta-suave">{p.observacion}</span>} />}
            </div>
          </section>

          {/* ---------- Cargos ---------- */}
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="subtitulo flex items-center gap-2"><Award size={20} className="text-marca" /> Cargos</h2>
              {puedeEditar && p.han && !agregando && (
                <button onClick={() => setAgregando(true)} className="btn-chico bg-marca-50 text-marca"><Plus size={16} strokeWidth={3} /> Agregar</button>
              )}
            </div>
            <div className="mt-3 space-y-2">
              {cargos.map((c) => (
                <div key={c.id_persona_cargo} className="flex items-center justify-between gap-3 rounded-2xl bg-crema px-4 py-3">
                  <div>
                    <div className="font-bold">{c.cargo_texto}</div>
                    {c.fecha_asuncion && <div className="text-xs font-semibold text-tinta-suave">Desde {fechaCorta(c.fecha_asuncion)}</div>}
                  </div>
                  {puedeEditar && (
                    <button
                      aria-label="Terminar cargo"
                      onClick={async () => {
                        if (!confirm(`¿Terminar el cargo "${c.cargo_texto}"? Queda en el historial.`)) return;
                        await supabase.from("persona_cargo").update({ fecha_fin: new Date().toISOString().slice(0, 10) }).eq("id_persona_cargo", c.id_persona_cargo);
                        cargarCargos();
                      }}
                      className="rounded-full p-1.5 text-tinta-tenue hover:bg-white"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              ))}
              {cargos.length === 0 && !agregando && <p className="text-sm font-semibold text-tinta-suave">Sin cargo.</p>}
              {agregando && <NuevoCargo persona={p} onListo={() => { setAgregando(false); cargarCargos(); }} />}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          {/* ---------- Participación ---------- */}
          <section className="card p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="subtitulo flex items-center gap-2"><CalendarCheck size={20} className="text-marca" /> Participación</h2>
              <span className="text-xs font-bold text-tinta-tenue">{ultimos3} en los últimos 3 meses</span>
            </div>
            {ultimas.length === 0 ? (
              <p className="mt-3 text-sm font-semibold text-tinta-suave">Todavía no tiene participación registrada.</p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ultimas.slice().reverse().map((x, i) => (
                    <span key={i} title={fechaCorta(x.fecha)} className={`h-6 w-6 rounded-lg ${x.visita ? "bg-estado-amigo" : "bg-estado-activo"}`} />
                  ))}
                </div>
                <div className="mt-3 divide-y divide-linea">
                  {ultimas.slice(0, 5).map((x, i) => (
                    <Link key={i} href={`/asistencia/${x.id_asistencia}`} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="font-bold">{x.tipo ?? "Reunión"}{x.han ? ` · ${x.han}` : ""}</span>
                      <span className={`font-semibold ${x.visita ? "text-estado-amigo" : "text-tinta-suave"}`}>
                        {x.visita ? "Visita · " : ""}{fechaCorta(x.fecha)}
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* ---------- Shakubuku ---------- */}
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="subtitulo flex items-center gap-2"><HeartHandshake size={20} className="text-marca" /> Shakubuku</h2>
              <span className="font-display text-3xl font-extrabold text-marca">{recomendados.length}</span>
            </div>
            <p className="text-sm font-semibold text-tinta-suave">Personas que recibieron membresía o Gohonzon con su recomendación. Se suma solo.</p>
            {recomendados.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {recomendados.map((r) => (
                  <Link key={r.id} href={`/miembros/${r.id}`} className="rounded-full bg-marca-50 px-3 py-1.5 text-sm font-bold text-marca">{r.nombre}</Link>
                ))}
              </div>
            )}
            {recomendadores.length > 0 && (
              <div className="mt-4 border-t border-linea pt-3 text-sm">
                {recomendadores.sort((a, b) => (a.orden ?? 9) - (b.orden ?? 9)).map((r) => (
                  <div key={r.id} className="flex justify-between py-1">
                    <span className="font-bold text-tinta-suave">Recomendador {r.orden}</span>
                    <Link href={`/miembros/${r.id}`} className="font-bold text-marca">{r.nombre}</Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function NuevoCargo({ persona, onListo }: { persona: PersonaTookan; onListo: () => void }) {
  const supabase = createClient();
  const [funciones, setFunciones] = useState<{ value: string; label: string }[]>([]);
  const [funcion, setFuncion] = useState("");
  const [nivel, setNivel] = useState("HAN");
  const [division, setDivision] = useState(persona.division ?? "");
  const [desde, setDesde] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("cargo").select("id_cargo, cargo").eq("activo", true).order("orden").then(({ data }) =>
      setFunciones((data ?? []).map((c: any) => ({ value: String(c.id_cargo), label: c.cargo })))
    );
  }, []); // eslint-disable-line

  async function guardar() {
    setErr(null);
    if (!funcion) return setErr("Elegí la función.");
    const { data: est } = await supabase.from("vw_estructura").select("id_han, id_distrito, id_cabildo, id_region").eq("id_han", persona.id_han).single();
    if (!est) return setErr("La persona no tiene han asignado.");
    const fila: any = {
      id_persona: persona.id_persona,
      id_cargo: Number(funcion),
      nivel,
      division: division || null,
      fecha_asuncion: desde || null,
      id_han: nivel === "HAN" ? est.id_han : null,
      id_distrito: nivel === "DISTRITO" ? est.id_distrito : null,
      id_cabildo: nivel === "CABILDO" ? est.id_cabildo : null,
      id_region: nivel === "REGION" ? est.id_region : null,
    };
    const { error } = await supabase.from("persona_cargo").insert(fila);
    if (error) return setErr(error.message);
    onListo();
  }

  return (
    <div className="space-y-3 rounded-2xl border-2 border-marca-100 p-4">
      <Combobox value={funcion} onChange={setFuncion} options={funciones} placeholder="Función…" />
      <div className="sin-scroll flex gap-2 overflow-x-auto">
        {NIVELES.map((n) => (
          <button key={n.v} type="button" onClick={() => setNivel(n.v)} className={`chip ${nivel === n.v ? "chip-on" : ""}`}>{n.l}</button>
        ))}
      </div>
      <div className="sin-scroll flex gap-2 overflow-x-auto">
        {[{ v: "", l: "General" }, ...["DS", "DF", "DJM", "DJF", "GE"].map((d) => ({ v: d, l: d }))].map((d) => (
          <button key={d.v} type="button" onClick={() => setDivision(d.v)} className={`chip ${division === d.v ? "chip-on" : ""}`}>{d.l}</button>
        ))}
      </div>
      <label className="block">
        <span className="etiqueta">Asumió el cargo</span>
        <input type="date" className="campo" value={desde} onChange={(e) => setDesde(e.target.value)} />
      </label>
      {err && <p className="text-sm font-bold text-red-600">{err}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onListo} className="btn-borde py-2.5">Cancelar</button>
        <button type="button" onClick={guardar} className="btn-sol py-2.5">Guardar</button>
      </div>
    </div>
  );
}
