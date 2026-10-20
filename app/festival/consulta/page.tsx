"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  type EventoPublico,
  fechaLarga,
  limpiarCedula,
  limpiarTelefono,
  telefonoValido,
} from "@/lib/festival";

// Consulta PÚBLICA del registro por cédula: ver la función, cambiarla o anular.
// Para cambiar/anular se confirma con el teléfono usado al registrarse.
// Link: /festival/consulta
type Ev = {
  id_evento: number;
  nombre: string;
  fecha: string | null;
  hora: string | null;
  lugar: string | null;
  ingreso?: boolean;
};
type Res = { encontrado: boolean; staff?: boolean; eventos?: Ev[] };
type Accion = { tipo: "cambiar"; destino: EventoPublico } | { tipo: "anular" };
type Hecho = { tipo: "cambiado"; evento: Ev } | { tipo: "anulado" };

const ROSA = "#f11579";

export default function ConsultaFestival() {
  const supabase = createClient();
  const [cedula, setCedula] = useState("");
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Res | null>(null);
  const [otras, setOtras] = useState<EventoPublico[]>([]);

  const [accion, setAccion] = useState<Accion | null>(null);
  const [telefono, setTelefono] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [errAccion, setErrAccion] = useState<string | null>(null);
  const [hecho, setHecho] = useState<Hecho | null>(null);

  async function buscar(ced: string) {
    const [{ data, error }, evs] = await Promise.all([
      supabase.rpc("fest_consultar", { p_cedula: ced }),
      supabase.rpc("fest_eventos_publicos"),
    ]);
    const r = data as ({ ok: boolean; error?: string } & Res) | null;
    if (error || !r) return { error: "No pudimos consultar. Probá de nuevo en un momento." };
    if (!r.ok) return { error: r.error ?? "No pudimos consultar." };
    const todas = ((evs.data as EventoPublico[]) ?? []).map((e) => ({
      ...e,
      registrados: Number(e.registrados),
      ingresados: Number(e.ingresados),
    }));
    return { res: r as Res, todas };
  }

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setRes(null);
    setHecho(null);
    if (cedula.length < 4) return setErr("Ingresá tu número de cédula.");
    setCargando(true);
    const r = await buscar(cedula);
    setCargando(false);
    if ("error" in r) return setErr(r.error ?? null);
    setRes(r.res);
    setOtras(r.todas);
  }

  function abrir(a: Accion) {
    setAccion(a);
    setTelefono("");
    setErrAccion(null);
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!accion) return;
    setErrAccion(null);
    if (!telefonoValido(telefono)) return setErrAccion("Ingresá el teléfono con el que te registraste.");
    setProcesando(true);
    const { data, error } =
      accion.tipo === "cambiar"
        ? await supabase.rpc("fest_cambiar_funcion", {
            p_cedula: cedula,
            p_telefono: telefono,
            p_evento_nuevo: accion.destino.id_evento,
          })
        : await supabase.rpc("fest_anular_registro", { p_cedula: cedula, p_telefono: telefono });
    setProcesando(false);
    const r = data as { ok: boolean; error?: string; evento?: Ev } | null;
    if (error || !r) return setErrAccion("No pudimos hacer el cambio. Probá de nuevo en un momento.");
    if (!r.ok) return setErrAccion(r.error ?? "No pudimos hacer el cambio.");

    setAccion(null);
    if (accion.tipo === "cambiar" && r.evento) {
      setHecho({ tipo: "cambiado", evento: r.evento });
      const nuevo = await buscar(cedula);
      if (!("error" in nuevo)) {
        setRes(nuevo.res);
        setOtras(nuevo.todas);
      }
    } else {
      setHecho({ tipo: "anulado" });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function otra() {
    setRes(null);
    setCedula("");
    setErr(null);
    setAccion(null);
    setHecho(null);
  }

  const input =
    "w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#f11579] focus:border-transparent";
  const btnPrincipal = "w-full rounded-xl text-white font-bold py-4 text-lg shadow-lg disabled:opacity-60";
  const degradado = { background: `linear-gradient(90deg, ${ROSA}, #ff4501)` };

  const actual = res?.eventos?.[0];
  const yaIngreso = !!res?.eventos?.some((ev) => ev.ingreso);
  const destinos = otras.filter((o) => !res?.eventos?.some((ev) => ev.id_evento === o.id_evento));
  const lleno = (o: EventoPublico) => o.cupo != null && o.registrados >= o.cupo;

  return (
    <main className="px-4 pb-10">
      <section className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-5 sm:p-6">
        <h1 className="text-2xl font-extrabold text-center" style={{ color: ROSA }}>
          Consultá tu registro
        </h1>

        {hecho?.tipo === "anulado" ? (
          // ---------- Registro anulado ----------
          <div className="mt-4 text-center">
            <div className="text-5xl mb-2">👋</div>
            <p className="text-lg font-bold text-gray-900">Tu registro fue anulado</p>
            <p className="text-gray-600 mt-1">Liberaste tu lugar. ¡Gracias por avisar!</p>
            <p className="text-gray-600 mt-1">Si cambiás de idea, podés volver a registrarte mientras haya lugar.</p>
            <Link href="/festival" className={btnPrincipal + " mt-5 block"} style={degradado}>
              Registrarme de nuevo
            </Link>
            <button onClick={otra} className="mt-4 font-semibold" style={{ color: ROSA }}>
              Consultar otra cédula
            </button>
          </div>
        ) : !res ? (
          // ---------- Formulario de consulta ----------
          <form onSubmit={consultar} className="space-y-4 mt-4">
            <p className="text-center text-gray-600">
              Ingresá tu número de cédula para ver en qué función te registraste. Desde acá también podés{" "}
              <b>cambiar de función</b> o <b>anular tu registro</b>.
            </p>
            <label className="block">
              <span className="font-semibold">Número de cédula</span>
              <input
                className={input + " mt-1"}
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                placeholder="Ej. 4123456"
                value={cedula}
                onChange={(e) => setCedula(limpiarCedula(e.target.value))}
              />
            </label>
            {err && <p className="text-red-600 text-sm font-medium">{err}</p>}
            <button type="submit" disabled={cargando} className={btnPrincipal} style={degradado}>
              {cargando ? "Consultando…" : "Consultar"}
            </button>
            <p className="text-center">
              <Link href="/festival" className="text-sm font-semibold underline" style={{ color: ROSA }}>
                ← Volver al registro
              </Link>
            </p>
          </form>
        ) : res.encontrado ? (
          // ---------- Registro encontrado ----------
          <div className="mt-4 text-center">
            {hecho?.tipo === "cambiado" && (
              <div className="mb-4 rounded-xl bg-green-50 border border-green-300 px-4 py-3 text-green-800 font-semibold">
                ✅ ¡Listo! Te cambiamos de función.
              </div>
            )}
            {!hecho && <div className="text-5xl mb-2">✅</div>}
            <p className="text-lg font-bold text-gray-900">¡Estás registrado/a!</p>
            {res.staff ? (
              <p className="text-gray-600 mt-1">Tu lugar quedó registrado.</p>
            ) : (
              <>
                <p className="text-gray-600 mt-1">Tu función:</p>
                {res.eventos?.map((ev) => (
                  <div
                    key={ev.id_evento}
                    className="mt-3 rounded-xl bg-[#ffb127]/15 border border-[#ffb127]/50 px-4 py-3 text-left"
                  >
                    <p className="font-semibold">{ev.nombre}</p>
                    {(ev.fecha || ev.hora) && (
                      <p className="text-sm text-[#e03e00] font-medium">📅 {fechaLarga(ev.fecha, ev.hora)}</p>
                    )}
                    {ev.lugar && <p className="text-sm text-gray-600">📍 {ev.lugar}</p>}
                  </div>
                ))}
              </>
            )}
            <p className="text-sm text-gray-600 mt-4">
              Indica tu <b>número de cédula</b> en la entrada. Las personas registradas previamente tienen{" "}
              <b>acceso prioritario</b>.
            </p>

            {/* ---------- Cambiar / anular ---------- */}
            {!res.staff && actual && !yaIngreso && (
              <div className="mt-5 border-t border-dashed pt-5 text-left">
                {!accion ? (
                  <>
                    <p className="font-semibold text-gray-900 text-center">¿Necesitás hacer un cambio?</p>
                    <div className="mt-3 space-y-2">
                      {destinos.map((d) => (
                        <button
                          key={d.id_evento}
                          disabled={lleno(d)}
                          onClick={() => abrir({ tipo: "cambiar", destino: d })}
                          className="w-full rounded-xl border-2 border-[#f11579] px-4 py-3 text-left disabled:opacity-50 disabled:border-gray-200"
                        >
                          <span className="block font-semibold" style={{ color: lleno(d) ? undefined : ROSA }}>
                            🔄 Cambiarme a {d.nombre}
                          </span>
                          <span className="block text-sm text-gray-600">
                            {lleno(d) ? "Cupo completo" : fechaLarga(d.fecha, d.hora)}
                          </span>
                        </button>
                      ))}
                      <button
                        onClick={() => abrir({ tipo: "anular" })}
                        className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-left text-gray-700"
                      >
                        <span className="block font-semibold">✖️ Anular mi registro</span>
                        <span className="block text-sm text-gray-500">Si no vas a poder ir, liberás tu lugar para otra persona.</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <form onSubmit={confirmar} className="space-y-3">
                    <p className="font-semibold text-gray-900">
                      {accion.tipo === "cambiar"
                        ? `Vas a cambiarte a ${accion.destino.nombre}.`
                        : "Vas a anular tu registro y liberar tu lugar."}
                    </p>
                    <label className="block">
                      <span className="text-sm text-gray-700">
                        Para confirmar, escribí el <b>teléfono con el que te registraste</b>:
                      </span>
                      <input
                        className={input + " mt-1"}
                        type="tel"
                        inputMode="tel"
                        autoFocus
                        placeholder="Ej. 0981 123456"
                        value={telefono}
                        onChange={(e) => setTelefono(limpiarTelefono(e.target.value))}
                      />
                    </label>
                    {errAccion && <p className="text-red-600 text-sm font-medium">{errAccion}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAccion(null)}
                        className="rounded-xl border-2 border-gray-200 py-3 font-semibold text-gray-700"
                      >
                        Volver
                      </button>
                      <button
                        type="submit"
                        disabled={procesando}
                        className={`rounded-xl py-3 font-bold text-white disabled:opacity-60 ${
                          accion.tipo === "anular" ? "bg-gray-800" : ""
                        }`}
                        style={accion.tipo === "cambiar" ? degradado : undefined}
                      >
                        {procesando ? "Procesando…" : accion.tipo === "cambiar" ? "Confirmar cambio" : "Anular registro"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            <button onClick={otra} className="mt-5 font-semibold" style={{ color: ROSA }}>
              Consultar otra cédula
            </button>
          </div>
        ) : (
          // ---------- No encontrado ----------
          <div className="mt-4 text-center">
            <div className="text-5xl mb-2">🔍</div>
            <p className="text-lg font-bold text-gray-900">No encontramos un registro con esa cédula</p>
            <p className="text-gray-600 mt-1">
              Revisá que el número esté bien escrito. Si todavía no te registraste, podés hacerlo ahora.
            </p>
            <Link href="/festival" className={btnPrincipal + " mt-4 block py-3 text-base"} style={degradado}>
              Registrarme
            </Link>
            <button onClick={otra} className="mt-4 font-semibold" style={{ color: ROSA }}>
              Probar con otra cédula
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
