"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Parametro = {
  clave: string;
  valor_num: number | null;
  valor_fecha: string | null;
  descripcion: string;
  orden: number;
};

type Cargo = { id_cargo: number; cargo: string; orden: number | null; activo: boolean };

// Cómo se muestra cada parámetro
const PARAM: Record<string, { titulo: string; unidad?: string; grupo: string }> = {
  NUEVO_AMIGO_PARTICIPACIONES: { titulo: "Participaciones", unidad: "reuniones", grupo: "Nuevo amigo → Amigo Soka" },
  NUEVO_AMIGO_DIAS: { titulo: "o días desde la primera", unidad: "días", grupo: "Nuevo amigo → Amigo Soka" },
  ACTIVO_MESES: { titulo: "Activo si participó en los últimos", unidad: "meses", grupo: "Miembro activo / inactivo" },
  INICIO_PARTICIPACION: { titulo: "Se registra la participación desde", grupo: "Miembro activo / inactivo" },
};

const inputCls = "rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-marca bg-white";

export default function AdministracionClient() {
  const supabase = createClient();
  const [params, setParams] = useState<Parametro[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [falta, setFalta] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState("");

  async function cargar() {
    const [p, c] = await Promise.all([
      supabase.from("parametros").select("clave, valor_num, valor_fecha, descripcion, orden").order("orden"),
      supabase.from("cargo").select("id_cargo, cargo, orden, activo").order("orden", { nullsFirst: false }).order("cargo"),
    ]);
    if (p.error) setFalta(true);
    setParams((p.data as Parametro[]) ?? []);
    setCargos((c.data as Cargo[]) ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []); // eslint-disable-line

  function avisar(ok: string | null, error: string | null) {
    setMsg(ok);
    setErr(error);
  }

  async function guardarParam(p: Parametro, valor: string) {
    const esFecha = p.clave === "INICIO_PARTICIPACION";
    const cambio: Partial<Parametro> = {};
    if (esFecha) {
      cambio.valor_fecha = valor || null;
    } else {
      const n = Number(valor);
      if (!Number.isInteger(n) || n < 1) {
        avisar(null, "Tiene que ser un número entero mayor a 0.");
        return;
      }
      if (n === p.valor_num) return;
      cambio.valor_num = n;
    }
    const { error } = await supabase.from("parametros").update(cambio).eq("clave", p.clave);
    if (error) return avisar(null, "No se pudo guardar: " + error.message);
    avisar("Guardado ✓ Los estados se recalculan solos.", null);
    cargar();
  }

  async function agregarCargo() {
    const nombre = nuevo.trim();
    if (!nombre) return;
    if (cargos.some((c) => c.cargo.trim().toLowerCase() === nombre.toLowerCase())) {
      return avisar(null, "Ese cargo ya existe.");
    }
    const orden = Math.max(0, ...cargos.map((c) => c.orden ?? 0)) + 1;
    const { error } = await supabase.from("cargo").insert({ cargo: nombre, orden, activo: true });
    if (error) return avisar(null, "No se pudo agregar: " + error.message);
    setNuevo("");
    avisar("Cargo agregado ✓", null);
    cargar();
  }

  async function actualizarCargo(c: Cargo, cambio: Partial<Cargo>) {
    const { error } = await supabase.from("cargo").update(cambio).eq("id_cargo", c.id_cargo);
    if (error) return avisar(null, "No se pudo guardar: " + error.message);
    avisar(null, null);
    cargar();
  }

  async function mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= cargos.length) return;
    const a = cargos[i];
    const b = cargos[j];
    // Reasigna 1..n según el nuevo orden
    const lista = [...cargos];
    lista[i] = b;
    lista[j] = a;
    const updates = lista
      .map((c, k) => ({ c, orden: k + 1 }))
      .filter(({ c, orden }) => c.orden !== orden)
      .map(({ c, orden }) => supabase.from("cargo").update({ orden }).eq("id_cargo", c.id_cargo));
    const res = await Promise.all(updates);
    const e = res.find((r) => r.error);
    if (e?.error) return avisar(null, "No se pudo reordenar: " + e.error.message);
    cargar();
  }

  if (cargando) return <p className="text-sm text-gray-500">Cargando...</p>;

  const grupos = Array.from(new Set(params.map((p) => PARAM[p.clave]?.grupo ?? "Otros")));

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold">Administración</h1>

      {msg && <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">{msg}</p>}
      {err && <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{err}</p>}

      {/* ---------- Parámetros ---------- */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Parámetros de los estados</h2>
        <p className="text-xs text-gray-500">
          Definen cuándo una persona es nuevo amigo, Amigo Soka, miembro activo o inactivo. Al cambiarlos, los estados se
          recalculan solos.
        </p>
        {falta ? (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
            Falta correr el script <b>tookan_02_estados_cargos.sql</b> en Supabase.
          </p>
        ) : (
          grupos.map((g) => (
            <div key={g} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
              <h3 className="text-sm font-semibold text-marca">{g}</h3>
              {params
                .filter((p) => (PARAM[p.clave]?.grupo ?? "Otros") === g)
                .map((p) => {
                  const cfg = PARAM[p.clave];
                  const esFecha = p.clave === "INICIO_PARTICIPACION";
                  return (
                    <label key={p.clave} className="flex items-center justify-between gap-3">
                      <span className="text-sm">
                        {cfg?.titulo ?? p.descripcion}
                        {esFecha && (
                          <span className="block text-xs text-gray-500">
                            Vacío = todavía no se registra. Antes de cumplir el período se usa el estado de la planilla.
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        {esFecha ? (
                          <input
                            type="date"
                            defaultValue={p.valor_fecha ?? ""}
                            onBlur={(e) => guardarParam(p, e.target.value)}
                            className={inputCls}
                          />
                        ) : (
                          <input
                            type="number"
                            min={1}
                            inputMode="numeric"
                            defaultValue={p.valor_num ?? ""}
                            onBlur={(e) => guardarParam(p, e.target.value)}
                            className={inputCls + " w-20 text-right"}
                          />
                        )}
                        {cfg?.unidad && <span className="text-xs text-gray-500 w-16">{cfg.unidad}</span>}
                      </span>
                    </label>
                  );
                })}
            </div>
          ))
        )}
      </section>

      {/* ---------- Cargos ---------- */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Cargos</h2>
        <p className="text-xs text-gray-500">
          Cada cargo se arma con función · nivel · división (ej. <i>Vice responsable · Han · DF</i>). Acá se mantiene la
          lista de funciones. Un cargo que ya no se usa se desactiva: no se borra, para no perder el historial.
        </p>
        <div className="bg-white rounded-xl shadow-sm divide-y">
          {cargos.map((c, i) => (
            <div key={c.id_cargo} className="flex items-center gap-2 p-3">
              <div className="flex flex-col">
                <button onClick={() => mover(i, -1)} disabled={i === 0} className="text-xs text-gray-500 disabled:opacity-30" aria-label="Subir">
                  ▲
                </button>
                <button
                  onClick={() => mover(i, 1)}
                  disabled={i === cargos.length - 1}
                  className="text-xs text-gray-500 disabled:opacity-30"
                  aria-label="Bajar"
                >
                  ▼
                </button>
              </div>
              <input
                defaultValue={c.cargo}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== c.cargo) actualizarCargo(c, { cargo: v });
                }}
                className={`flex-1 min-w-0 rounded-lg px-2 py-1.5 outline-none focus:bg-gray-50 ${c.activo ? "" : "text-gray-400 line-through"}`}
              />
              <button
                onClick={() => actualizarCargo(c, { activo: !c.activo })}
                className={`text-xs rounded-full px-2.5 py-1 font-medium ${
                  c.activo ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {c.activo ? "Activo" : "Inactivo"}
              </button>
            </div>
          ))}
          <div className="flex gap-2 p-3">
            <input
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && agregarCargo()}
              placeholder="Nueva función (ej. Secretario)"
              className={inputCls + " flex-1 min-w-0"}
            />
            <button onClick={agregarCargo} className="rounded-lg bg-marca text-white text-sm px-3 font-medium">
              Agregar
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
