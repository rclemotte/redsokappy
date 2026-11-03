"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Combobox from "@/components/Combobox";
import { Cabecera } from "@/components/ui";
import { DIVISIONES, MOTIVOS_BAJA, ORDEN_DIVISIONES, traerTodo } from "@/lib/tookan";

type Opt = { value: string; label: string };

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4 p-5">
      <h2 className="subtitulo">{titulo}</h2>
      {children}
    </section>
  );
}

function Campo({ label, ayuda, children }: { label: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="etiqueta">{label}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs font-semibold text-tinta-tenue">{ayuda}</span>}
    </label>
  );
}

// Sí / No grande, fácil de tocar
function SiNo({ label, valor, onChange, ayuda }: { label: string; valor: boolean; onChange: (v: boolean) => void; ayuda?: string }) {
  return (
    <div>
      <span className="etiqueta">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className={`rounded-2xl border-2 py-3 font-extrabold transition ${
              valor === v ? "border-marca bg-marca text-white" : "border-linea bg-white text-tinta-suave"
            }`}
          >
            {v ? "Sí" : "No"}
          </button>
        ))}
      </div>
      {ayuda && <span className="mt-1 block text-xs font-semibold text-tinta-tenue">{ayuda}</span>}
    </div>
  );
}

export default function MemberForm({ id }: { id?: number }) {
  const supabase = createClient();
  const router = useRouter();
  const editar = typeof id === "number";

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [hanes, setHanes] = useState<Opt[]>([]);
  const [personas, setPersonas] = useState<Opt[]>([]);

  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [telefono, setTelefono] = useState("");
  const [nacimiento, setNacimiento] = useState("");
  const [division, setDivision] = useState("");
  const [idHan, setIdHan] = useState("");
  const [membresia, setMembresia] = useState(false);
  const [gohonzon, setGohonzon] = useState(false);
  const [rec1, setRec1] = useState("");
  const [rec2, setRec2] = useState("");
  const [activo, setActivo] = useState(true);
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    (async () => {
      const [h, p] = await Promise.all([
        supabase.from("vw_estructura").select("id_han, han, distrito, cabildo").order("cabildo").order("han"),
        traerTodo<any>((d, hh) => supabase.from("personas").select("id_persona, nombre").eq("activo", true).order("nombre").range(d, hh)).catch(() => []),
      ]);
      setHanes((h.data ?? []).map((x: any) => ({ value: String(x.id_han), label: `${x.han} · ${x.distrito} · ${x.cabildo}` })));
      setPersonas(p.map((x: any) => ({ value: String(x.id_persona), label: x.nombre })));

      if (editar) {
        const { data: per } = await supabase.from("personas").select("*").eq("id_persona", id).single();
        if (per) {
          setNombre([per.nombre, per.apellido].filter(Boolean).join(" "));
          setCedula(per.cedula ?? "");
          setTelefono(per.telefono ?? "");
          setNacimiento(per.fecha_nacimiento ? String(per.fecha_nacimiento).slice(0, 10) : "");
          setDivision(per.division ?? "");
          setIdHan(per.id_han != null ? String(per.id_han) : "");
          setMembresia(!!per.membresia);
          setGohonzon(per.titular_gohonzo === 1);
          setActivo(per.activo !== false);
          setMotivo(per.motivo_baja ?? "");
          setObs(per.observacion ?? "");
        }
        const { data: sk } = await supabase.from("shakubuku").select("id_shakubuku_de, orden").eq("id_shakubuku_para", id);
        for (const s of sk ?? []) {
          if (s.orden === 1) setRec1(String(s.id_shakubuku_de));
          if (s.orden === 2) setRec2(String(s.id_shakubuku_de));
        }
      }
      setCargando(false);
    })();
  }, []); // eslint-disable-line

  const otras = useMemo(() => personas.filter((o) => o.value !== String(id)), [personas, id]);

  async function guardarRecomendador(personaId: number, orden: 1 | 2, valor: string) {
    const { data: ex } = await supabase.from("shakubuku").select("id_shakubuku, id_shakubuku_de").eq("id_shakubuku_para", personaId).eq("orden", orden);
    const actual = ex?.[0];
    if (!valor) {
      if (actual) await supabase.from("shakubuku").update({ orden: null }).eq("id_shakubuku", actual.id_shakubuku);
      return;
    }
    const de = Number(valor);
    if (actual?.id_shakubuku_de === de) return;
    if (actual) await supabase.from("shakubuku").update({ orden: null }).eq("id_shakubuku", actual.id_shakubuku);
    // ¿Ya existe el vínculo (por ejemplo, cargado al registrar asistencia)?
    const { data: mismo } = await supabase.from("shakubuku").select("id_shakubuku").eq("id_shakubuku_para", personaId).eq("id_shakubuku_de", de);
    if (mismo?.length) {
      await supabase.from("shakubuku").update({ orden }).eq("id_shakubuku", mismo[0].id_shakubuku);
    } else {
      await supabase.from("shakubuku").insert({
        id_shakubuku_de: de, id_shakubuku_para: personaId, orden,
        membresia: membresia ? 1 : 0, gohonzon: gohonzon ? 1 : 0,
      });
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!nombre.trim()) return setErr("Escribí el nombre y apellido.");
    if (!division) return setErr("Elegí la división.");
    const ced = cedula.replace(/\D/g, "");
    if (ced && (ced.length < 4 || ced.length > 10)) return setErr("La cédula tiene que tener entre 4 y 10 números.");
    if (!activo && !motivo) return setErr("Elegí el motivo de la baja.");
    if (rec1 && rec1 === rec2) return setErr("El Recomendador 1 y el 2 no pueden ser la misma persona.");
    setGuardando(true);

    const payload: any = {
      nombre: nombre.trim().replace(/\s+/g, " "),
      cedula: ced || null,
      telefono: telefono.trim() || null,
      fecha_nacimiento: nacimiento || null,
      division,
      id_han: idHan ? Number(idHan) : null,
      membresia: membresia || gohonzon,
      titular_gohonzo: gohonzon ? 1 : 0,
      activo,
      motivo_baja: activo ? null : motivo,
      observacion: obs.trim() || null,
    };
    if (editar) payload.apellido = null; // el nombre completo queda en un solo campo

    let personaId = id;
    if (editar) {
      const { error } = await supabase.from("personas").update(payload).eq("id_persona", id);
      if (error) { setErr(traducir(error.message)); setGuardando(false); return; }
    } else {
      const { data, error } = await supabase.from("personas").insert(payload).select("id_persona").single();
      if (error) { setErr(traducir(error.message)); setGuardando(false); return; }
      personaId = data.id_persona;
    }
    if (personaId) {
      await guardarRecomendador(personaId, 1, rec1);
      await guardarRecomendador(personaId, 2, rec2);
    }
    router.push(`/miembros/${personaId}`);
    router.refresh();
  }

  if (cargando) {
    return (
      <div>
        <Cabecera titulo={editar ? "Editar ficha" : "Nueva persona"} volver />
        <div className="card h-64 animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <Cabecera
        titulo={editar ? "Editar ficha" : "Nueva persona"}
        subtitulo={editar ? nombre : "Miembro o amigo que se suma"}
        volver
      />

      <form onSubmit={guardar} className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
        <div className="space-y-4">
          <Seccion titulo="Datos personales">
            <Campo label="Nombre y apellido *">
              <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Cédula">
                <input className="campo" inputMode="numeric" value={cedula} onChange={(e) => setCedula(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Solo números" />
              </Campo>
              <Campo label="Teléfono">
                <input className="campo" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="0981 123456" />
              </Campo>
            </div>
            <Campo label="Fecha de nacimiento">
              <input type="date" className="campo" value={nacimiento} onChange={(e) => setNacimiento(e.target.value)} />
            </Campo>
          </Seccion>

          <Seccion titulo="En la organización">
            <Campo label="Han">
              <Combobox value={idHan} onChange={setIdHan} options={hanes} placeholder="Buscar han…" />
            </Campo>
            <div>
              <span className="etiqueta">División *</span>
              <div className="grid grid-cols-5 gap-2">
                {ORDEN_DIVISIONES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    title={DIVISIONES[d].label}
                    onClick={() => setDivision(d)}
                    className={`rounded-2xl border-2 py-3 text-sm font-extrabold transition ${
                      division === d ? "border-transparent text-white" : "border-linea bg-white text-tinta-suave"
                    }`}
                    style={division === d ? { background: DIVISIONES[d].hex } : undefined}
                  >
                    {d}
                  </button>
                ))}
              </div>
              {division && <span className="mt-1 block text-xs font-semibold text-tinta-tenue">{DIVISIONES[division]?.label}</span>}
            </div>
          </Seccion>
        </div>

        <div className="space-y-4">
          <Seccion titulo="Práctica">
            <div className="grid grid-cols-2 gap-3">
              <SiNo label="Membresía" valor={membresia || gohonzon} onChange={setMembresia} />
              <SiNo label="Gohonzon" valor={gohonzon} onChange={(v) => { setGohonzon(v); if (v) setMembresia(true); }} />
            </div>
            <p className="rounded-2xl bg-marca-50 px-4 py-3 text-sm font-semibold text-tinta-suave">
              El estado (nuevo amigo, Amigo Soka, miembro activo o inactivo) lo calcula la app según la membresía y la participación.
            </p>
            <Campo label="Recomendador 1" ayuda="Quién le hizo shakubuku">
              <Combobox value={rec1} onChange={setRec1} options={otras} placeholder="Buscar persona…" />
            </Campo>
            <Campo label="Recomendador 2">
              <Combobox value={rec2} onChange={setRec2} options={otras} placeholder="Buscar persona…" />
            </Campo>
          </Seccion>

          <Seccion titulo="Situación">
            <SiNo label="¿Sigue en el Tookan?" valor={activo} onChange={setActivo} ayuda={activo ? undefined : "Las bajas no aparecen en las listas ni en las estadísticas."} />
            {!activo && (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(MOTIVOS_BAJA).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMotivo(k)}
                    className={`rounded-2xl border-2 px-3 py-2.5 text-left text-sm font-bold transition ${
                      motivo === k ? "border-marca bg-marca-50 text-marca" : "border-linea bg-white text-tinta-suave"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
            <Campo label="Observación">
              <textarea className="campo min-h-[96px]" value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} />
            </Campo>
          </Seccion>

          {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{err}</p>}
          <button disabled={guardando} className="btn-sol w-full py-4 text-lg">
            <Check size={22} strokeWidth={3} />
            {guardando ? "Guardando…" : editar ? "Guardar cambios" : "Crear persona"}
          </button>
        </div>
      </form>
    </div>
  );
}

function traducir(m: string) {
  const t = m?.toLowerCase() ?? "";
  if (t.includes("row-level security")) return "No tenés permiso para guardar cambios. Pedí acceso de editor a la Coordinación.";
  if (t.includes("ux_personas_cedula") || (t.includes("duplicate") && t.includes("cedula"))) return "Ya hay otra persona con esa cédula.";
  return m;
}
