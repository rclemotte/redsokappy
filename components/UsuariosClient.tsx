"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus, ChevronDown, Check, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Combobox, { type ComboOption } from "@/components/Combobox";
import { Avatar, Cabecera, Cargando } from "@/components/ui";
import { normalizar, traerTodo } from "@/lib/tookan";

type Perfil = {
  id: string;
  cedula: string | null;
  debe_cambiar_password: boolean | null;
  id_persona: number | null;
  id_rol: number | null;
  id_region: number | null;
  id_cabildo: number | null;
  id_distrito: number | null;
  id_han: number | null;
  personas: { nombre: string } | null;
};
type Est = { id_han: number; han: string; id_distrito: number; distrito: string; id_cabildo: number; cabildo: string; id_region: number; region: string };
type Nivel = "NACIONAL" | "REGION" | "CABILDO" | "DISTRITO" | "HAN";

const ROLES = [
  { id: 2, label: "Miembro", desc: "Solo mira" },
  { id: 4, label: "Encargado de estadística", desc: "Carga y corrige datos" },
  { id: 1, label: "Responsable", desc: "Carga, corrige y crea usuarios" },
  { id: 3, label: "Administrador", desc: "Coordinación General: todo" },
];
const NIVELES: { v: Nivel; l: string }[] = [
  { v: "HAN", l: "Han" },
  { v: "DISTRITO", l: "Distrito" },
  { v: "CABILDO", l: "Cabildo" },
  { v: "REGION", l: "Región" },
  { v: "NACIONAL", l: "Toda la SGPy" },
];

function nivelDe(p: Perfil): Nivel | null {
  if (p.id_han) return "HAN";
  if (p.id_distrito) return "DISTRITO";
  if (p.id_cabildo) return "CABILDO";
  if (p.id_region) return "REGION";
  return null;
}

export default function UsuariosClient({ esAdmin = false }: { esAdmin?: boolean }) {
  const supabase = createClient();

  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [personas, setPersonas] = useState<{ id_persona: number; nombre: string }[]>([]);
  const [est, setEst] = useState<Est[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [abrirNuevo, setAbrirNuevo] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);

  const [idPersona, setIdPersona] = useState("");
  const [cedula, setCedula] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function cargar() {
    const [pf, pe, es] = await Promise.all([
      supabase
        .from("perfiles")
        .select("id, cedula, debe_cambiar_password, id_persona, id_rol, id_region, id_cabildo, id_distrito, id_han, personas(nombre)")
        .order("cedula"),
      traerTodo<any>((d, h) => supabase.from("personas").select("id_persona, nombre").eq("activo", true).order("nombre").range(d, h)).catch(() => []),
      supabase.from("vw_estructura").select("*"),
    ]);
    setPerfiles((pf.data as any) ?? []);
    setPersonas(pe);
    setEst((es.data as Est[]) ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []); // eslint-disable-line

  const nombreAmbito = useMemo(() => {
    const m = { r: new Map<number, string>(), c: new Map<number, string>(), d: new Map<number, string>(), h: new Map<number, string>() };
    for (const e of est) {
      m.r.set(e.id_region, e.region);
      m.c.set(e.id_cabildo, e.cabildo);
      m.d.set(e.id_distrito, `${e.distrito} · ${e.cabildo}`);
      m.h.set(e.id_han, `${e.han} · ${e.cabildo}`);
    }
    return (p: Perfil) =>
      p.id_han ? `Han ${m.h.get(p.id_han) ?? ""}` :
      p.id_distrito ? `Distrito ${m.d.get(p.id_distrito) ?? ""}` :
      p.id_cabildo ? `Cabildo ${m.c.get(p.id_cabildo) ?? ""}` :
      p.id_region ? `Región ${m.r.get(p.id_region) ?? ""}` :
      p.id_rol === 3 ? "Toda la SGPy" : null;
  }, [est]);

  const personasSinUsuario: ComboOption[] = useMemo(() => {
    const con = new Set(perfiles.map((p) => p.id_persona).filter(Boolean));
    return personas.filter((p) => !con.has(p.id_persona)).map((p) => ({ value: String(p.id_persona), label: p.nombre }));
  }, [personas, perfiles]);

  const filtrados = useMemo(() => {
    const t = normalizar(q.trim());
    if (!t) return perfiles;
    return perfiles.filter((p) => normalizar(`${p.personas?.nombre ?? ""} ${p.cedula ?? ""}`).includes(t));
  }, [q, perfiles]);

  const sinAmbito = perfiles.filter((p) => p.id_rol !== 3 && !nivelDe(p)).length;

  async function crear() {
    setErr(null);
    setMsg(null);
    if (!idPersona) return setErr("Elegí a la persona.");
    if (cedula.trim().length < 6) return setErr("La cédula debe tener al menos 6 caracteres.");
    setGuardando(true);
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_persona: Number(idPersona), cedula: cedula.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error ?? "No se pudo crear el usuario.");
        setGuardando(false);
        return;
      }
      setMsg(`Usuario creado ✓ Ingresa con la cédula ${data.cedula} (la contraseña inicial es la misma cédula). Queda como Miembro: ve solo su ficha y su participación.`);
      setIdPersona("");
      setCedula("");
      setAbrirNuevo(false);
      await cargar();
    } catch {
      setErr("No se pudo conectar. Reintentá.");
    }
    setGuardando(false);
  }

  return (
    <div>
      <Cabecera
        titulo="Usuarios"
        subtitulo={cargando ? "Cargando…" : `${perfiles.length} usuarios${sinAmbito ? ` · ${sinAmbito} solo con su ficha` : ""}`}
        accion={
          <button
            onClick={() => { setAbrirNuevo((v) => !v); setErr(null); setMsg(null); }}
            aria-label="Nuevo usuario"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-marca shadow-flotante transition active:scale-95"
          >
            <UserPlus size={22} strokeWidth={2.5} />
          </button>
        }
      >
        <label className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 text-tinta shadow-flotante">
          <Search size={20} className="text-marca" strokeWidth={2.5} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o cédula…" className="w-full bg-transparent text-[15px] font-semibold outline-none placeholder:text-tinta-tenue" />
        </label>
      </Cabecera>

      <div className="space-y-4">
        {abrirNuevo && (
          <section className="card space-y-4 p-5">
            <h2 className="subtitulo">Nuevo usuario</h2>
            <label className="block">
              <span className="etiqueta">Persona</span>
              <Combobox value={idPersona} onChange={setIdPersona} options={personasSinUsuario} placeholder="Buscar persona…" />
            </label>
            <label className="block">
              <span className="etiqueta">Cédula (será su usuario)</span>
              <input className="campo" value={cedula} inputMode="numeric" autoCapitalize="none" onChange={(e) => setCedula(e.target.value)} placeholder="Número de cédula" />
            </label>
            <p className="rounded-2xl bg-marca-50 px-4 py-3 text-sm font-semibold text-tinta-suave">
              La contraseña inicial es la misma cédula y la cambia en su primer ingreso. Empieza como <b>Miembro</b> y ve solo su ficha y su participación;
              {esAdmin ? " después le asignás el rol y el ámbito." : " la Coordinación le asigna el rol y el ámbito."}
            </p>
            {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{err}</p>}
            <button onClick={crear} disabled={guardando} className="btn-sol w-full">{guardando ? "Creando…" : "Crear usuario"}</button>
          </section>
        )}

        {msg && <p className="rounded-2xl bg-estado-activoBg px-4 py-3 text-sm font-bold text-estado-activo">{msg}</p>}

        {cargando ? (
          <Cargando />
        ) : (
          <div className="card divide-y divide-linea overflow-hidden">
            {filtrados.map((p) => {
              const amb = nombreAmbito(p);
              const rol = ROLES.find((r) => r.id === Number(p.id_rol))?.label ?? "Miembro";
              const open = abierto === p.id;
              return (
                <div key={p.id}>
                  <button
                    type="button"
                    disabled={!esAdmin}
                    onClick={() => setAbierto(open ? null : p.id)}
                    className="flex w-full items-center gap-3 p-3.5 text-left transition active:bg-marca-50 disabled:active:bg-transparent"
                  >
                    <Avatar nombre={p.personas?.nombre ?? p.cedula ?? "?"} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{p.personas?.nombre ?? "(sin persona vinculada)"}</div>
                      <div className="truncate text-[13px] font-semibold text-tinta-suave">{rol} · {p.cedula ?? "—"}</div>
                      <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-extrabold ${amb ? "bg-marca-50 text-marca" : "bg-estado-amigoBg text-estado-amigo"}`}>
                        <MapPin size={12} strokeWidth={2.8} /> {amb ?? "Solo su ficha"}
                      </div>
                    </div>
                    {p.debe_cambiar_password && <span className="rounded-full bg-estado-nuevoBg px-2.5 py-1 text-xs font-extrabold text-estado-nuevo">Clave inicial</span>}
                    {esAdmin && <ChevronDown size={18} className={`text-tinta-tenue transition ${open ? "rotate-180" : ""}`} />}
                  </button>
                  {open && <EditarAcceso perfil={p} est={est} onListo={() => { setAbierto(null); cargar(); }} />}
                </div>
              );
            })}
            {filtrados.length === 0 && <div className="p-4 text-sm font-semibold text-tinta-suave">No hay usuarios.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function EditarAcceso({ perfil, est, onListo }: { perfil: Perfil; est: Est[]; onListo: () => void }) {
  const supabase = createClient();
  const [rol, setRol] = useState<number>(Number(perfil.id_rol ?? 2));
  const [nivel, setNivel] = useState<Nivel>(nivelDe(perfil) ?? (perfil.id_rol === 3 ? "NACIONAL" : "HAN"));
  const [unidad, setUnidad] = useState<string>(
    String(perfil.id_han ?? perfil.id_distrito ?? perfil.id_cabildo ?? perfil.id_region ?? "")
  );
  const [err, setErr] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const opciones: ComboOption[] = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of est) {
      if (nivel === "HAN") m.set(String(e.id_han), `${e.han} · ${e.distrito} · ${e.cabildo}`);
      if (nivel === "DISTRITO") m.set(String(e.id_distrito), `${e.distrito} · ${e.cabildo}`);
      if (nivel === "CABILDO") m.set(String(e.id_cabildo), `${e.cabildo} · ${e.region}`);
      if (nivel === "REGION") m.set(String(e.id_region), e.region);
    }
    return Array.from(m.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [est, nivel]);

  async function guardar() {
    setErr(null);
    if (nivel === "NACIONAL" && rol !== 3) return setErr("Toda la SGPy es solo para el rol Administrador.");
    if (nivel !== "NACIONAL" && !unidad) return setErr("Elegí a qué " + NIVELES.find((n) => n.v === nivel)!.l.toLowerCase() + " corresponde.");
    setGuardando(true);
    const u = nivel === "NACIONAL" ? null : Number(unidad);
    const { error } = await supabase
      .from("perfiles")
      .update({
        id_rol: rol,
        id_region: nivel === "REGION" ? u : null,
        id_cabildo: nivel === "CABILDO" ? u : null,
        id_distrito: nivel === "DISTRITO" ? u : null,
        id_han: nivel === "HAN" ? u : null,
      })
      .eq("id", perfil.id);
    setGuardando(false);
    if (error) return setErr(error.message);
    onListo();
  }

  return (
    <div className="space-y-4 border-t border-linea bg-crema/60 px-4 pb-4 pt-3">
      <div>
        <span className="etiqueta">Rol</span>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { setRol(r.id); if (r.id === 3) setNivel("NACIONAL"); else if (nivel === "NACIONAL") setNivel("HAN"); }}
              className={`rounded-2xl border-2 px-3 py-2.5 text-left transition ${rol === r.id ? "border-marca bg-white" : "border-linea bg-white/70"}`}
            >
              <div className={`text-sm font-extrabold ${rol === r.id ? "text-marca" : "text-tinta"}`}>{r.label}</div>
              <div className="text-xs font-semibold text-tinta-suave">{r.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="etiqueta">Qué puede ver</span>
        <div className="sin-scroll flex gap-2 overflow-x-auto pb-1">
          {NIVELES.filter((n) => n.v !== "NACIONAL" || rol === 3).map((n) => (
            <button key={n.v} type="button" onClick={() => { setNivel(n.v); setUnidad(""); }} className={`chip ${nivel === n.v ? "chip-on" : ""}`}>{n.l}</button>
          ))}
        </div>
        {nivel !== "NACIONAL" && (
          <div className="mt-2">
            <Combobox value={unidad} onChange={setUnidad} options={opciones} placeholder={`Buscar ${NIVELES.find((n) => n.v === nivel)!.l.toLowerCase()}…`} />
          </div>
        )}
      </div>
      {err && <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700">{err}</p>}
      <button onClick={guardar} disabled={guardando} className="btn-sol w-full py-3">
        <Check size={20} strokeWidth={3} /> {guardando ? "Guardando…" : "Guardar acceso"}
      </button>
    </div>
  );
}
