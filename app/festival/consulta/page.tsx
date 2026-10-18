"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fechaLarga, limpiarCedula } from "@/lib/festival";

// Consulta PÚBLICA: "¿en qué función me registré?" (solo con la cédula).
// Link: /festival/consulta
type Ev = { nombre: string; fecha: string | null; hora: string | null; lugar: string | null };
type Res = { encontrado: boolean; staff?: boolean; eventos?: Ev[] };

const ROSA = "#f11579";

export default function ConsultaFestival() {
  const supabase = createClient();
  const [cedula, setCedula] = useState("");
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Res | null>(null);

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setRes(null);
    if (cedula.length < 4) return setErr("Ingresá tu número de cédula.");
    setCargando(true);
    const { data, error } = await supabase.rpc("fest_consultar", { p_cedula: cedula });
    setCargando(false);
    const r = data as ({ ok: boolean; error?: string } & Res) | null;
    if (error || !r) return setErr("No pudimos consultar. Probá de nuevo en un momento.");
    if (!r.ok) return setErr(r.error ?? "No pudimos consultar.");
    setRes(r);
  }

  function otra() {
    setRes(null);
    setCedula("");
    setErr(null);
  }

  const input =
    "w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#f11579] focus:border-transparent";

  return (
    <main className="px-4 pb-10">
      <section className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-5 sm:p-6">
        <h1 className="text-2xl font-extrabold text-center" style={{ color: ROSA }}>
          Consultá tu registro
        </h1>

        {!res ? (
          <form onSubmit={consultar} className="space-y-4 mt-4">
            <p className="text-center text-gray-600">Ingresá tu número de cédula para ver en qué función te registraste.</p>
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
            <button
              type="submit"
              disabled={cargando}
              className="w-full rounded-xl text-white font-bold py-4 text-lg shadow-lg disabled:opacity-60"
              style={{ background: `linear-gradient(90deg, ${ROSA}, #ff4501)` }}
            >
              {cargando ? "Consultando…" : "Consultar"}
            </button>
          </form>
        ) : res.encontrado ? (
          <div className="mt-4 text-center">
            <div className="text-5xl mb-2">✅</div>
            <p className="text-lg font-bold text-gray-900">¡Estás registrado/a!</p>
            {res.staff ? (
              <p className="text-gray-600 mt-1">Tu lugar quedó registrado.</p>
            ) : (
              <>
                <p className="text-gray-600 mt-1">
                  {(res.eventos?.length ?? 0) > 1 ? "Tus funciones:" : "Tu función:"}
                </p>
                {res.eventos?.map((ev) => (
                  <div
                    key={ev.nombre}
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
            <button onClick={otra} className="mt-5 font-semibold" style={{ color: ROSA }}>
              Consultar otra cédula
            </button>
          </div>
        ) : (
          <div className="mt-4 text-center">
            <div className="text-5xl mb-2">🔍</div>
            <p className="text-lg font-bold text-gray-900">No encontramos un registro con esa cédula</p>
            <p className="text-gray-600 mt-1">
              Revisá que el número esté bien escrito. Si todavía no te registraste, podés hacerlo ahora.
            </p>
            <Link
              href="/festival"
              className="mt-4 block w-full rounded-xl text-white font-bold py-3 shadow-lg"
              style={{ background: `linear-gradient(90deg, ${ROSA}, #ff4501)` }}
            >
              Registrarme
            </Link>
            <button onClick={otra} className="mt-4 font-semibold" style={{ color: ROSA }}>
              Probar con otra cédula
            </button>
          </div>
        )}

        {!res && (
          <p className="text-center mt-5">
            <Link href="/festival" className="text-sm font-semibold underline" style={{ color: ROSA }}>
              ← Volver al registro
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}
