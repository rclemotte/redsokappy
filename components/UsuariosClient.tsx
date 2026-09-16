"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Combobox, { type ComboOption } from "@/components/Combobox";

type Perfil = {
  id: string;
  cedula: string | null;
  debe_cambiar_password: boolean | null;
  id_persona: number | null;
  personas: { nombre: string } | null;
  rol: { rol: string } | null;
};

export default function UsuariosClient() {
  const supabase = createClient();

  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [personas, setPersonas] = useState<{ id_persona: number; nombre: string }[]>([]);
  const [cargando, setCargando] = useState(true);

  const [q, setQ] = useState("");
  const [abrirNuevo, setAbrirNuevo] = useState(false);

  // form
  const [idPersona, setIdPersona] = useState("");
  const [cedula, setCedula] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function cargar() {
    const [pf, pe] = await Promise.all([
      supabase
        .from("perfiles")
        .select("id, cedula, debe_cambiar_password, id_persona, personas(nombre), rol(rol)")
        .order("cedula"),
      supabase.from("personas").select("id_persona, nombre").order("nombre"),
    ]);
    setPerfiles((pf.data as any) ?? []);
    setPersonas((pe.data as any) ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []); // eslint-disable-line

  // Miembros que todavía NO tienen usuario (para el combo de alta)
  const personasSinUsuario: ComboOption[] = useMemo(() => {
    const conUsuario = new Set(perfiles.map((p) => p.id_persona).filter(Boolean));
    return personas
      .filter((p) => !conUsuario.has(p.id_persona))
      .map((p) => ({ value: String(p.id_persona), label: p.nombre }));
  }, [personas, perfiles]);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return perfiles;
    return perfiles.filter(
      (p) =>
        (p.personas?.nombre ?? "").toLowerCase().includes(t) ||
        (p.cedula ?? "").toLowerCase().includes(t)
    );
  }, [q, perfiles]);

  async function crear() {
    setErr(null);
    setMsg(null);
    if (!idPersona) {
      setErr("Elegí un miembro.");
      return;
    }
    if (cedula.trim().length < 6) {
      setErr("La cédula debe tener al menos 6 caracteres.");
      return;
    }
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
      setMsg(`Usuario creado ✓ — ingresa con la cédula ${data.cedula} (contraseña: la misma cédula).`);
      setIdPersona("");
      setCedula("");
      setAbrirNuevo(false);
      await cargar();
    } catch {
      setErr("No se pudo conectar. Reintentá.");
    }
    setGuardando(false);
  }

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-marca bg-white";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          Usuarios <span className="text-sm font-normal text-gray-500">({filtrados.length})</span>
        </h1>
        <button
          onClick={() => {
            setAbrirNuevo((v) => !v);
            setErr(null);
            setMsg(null);
          }}
          className="rounded-lg bg-marca text-white text-sm px-3 py-1.5 font-medium"
        >
          {abrirNuevo ? "Cerrar" : "+ Nuevo"}
        </button>
      </div>

      {abrirNuevo && (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-semibold">Nuevo usuario</h3>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Miembro</span>
            <Combobox
              value={idPersona}
              onChange={setIdPersona}
              options={personasSinUsuario}
              placeholder="Buscar miembro..."
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Cédula (será el usuario)</span>
            <input
              className={inputCls}
              value={cedula}
              inputMode="numeric"
              autoCapitalize="none"
              onChange={(e) => setCedula(e.target.value)}
              placeholder="Número de cédula"
            />
          </label>
          <p className="text-xs text-gray-500">
            La contraseña inicial será la misma cédula. En su primer ingreso, la persona deberá cambiarla. Rol: Miembro (solo lectura).
          </p>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            onClick={crear}
            disabled={guardando}
            className="w-full rounded-lg bg-marca text-white py-2 font-medium disabled:opacity-60"
          >
            {guardando ? "Creando..." : "Crear usuario"}
          </button>
        </div>
      )}

      {msg && <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">{msg}</p>}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre o cédula..."
        className={inputCls}
      />

      {cargando ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm divide-y">
          {filtrados.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-3">
              <div>
                <div className="text-sm font-medium">
                  {p.personas?.nombre ?? "(sin miembro)"}
                </div>
                <div className="text-xs text-gray-500">
                  Usuario: {p.cedula ?? "—"} · {p.rol?.rol ?? "Miembro"}
                </div>
              </div>
              {p.debe_cambiar_password ? (
                <span className="text-xs text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                  clave sin cambiar
                </span>
              ) : (
                <span className="text-xs text-gray-400">activo</span>
              )}
            </div>
          ))}
          {filtrados.length === 0 && (
            <div className="p-3 text-sm text-gray-500">Todavía no hay usuarios.</div>
          )}
        </div>
      )}
    </div>
  );
}
