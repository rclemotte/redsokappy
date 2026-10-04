"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type EventoPublico, fechaCorta, limpiarCedula, lugaresLibres } from "@/lib/festival";

// Registro PÚBLICO al Festival (sin login). Se comparte el link /festival.
export default function RegistroFestivalPage() {
  const supabase = createClient();

  const [eventos, setEventos] = useState<EventoPublico[]>([]);
  const [cargando, setCargando] = useState(true);

  const [elegidos, setElegidos] = useState<number[]>([]);
  const [cedula, setCedula] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [fechaNac, setFechaNac] = useState("");
  const [esMiembro, setEsMiembro] = useState<boolean | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [listo, setListo] = useState<{ nombre: string; eventos: string[]; actualizado: boolean } | null>(null);

  async function cargarEventos() {
    const { data } = await supabase.rpc("fest_eventos_publicos");
    const evs = ((data as EventoPublico[]) ?? []).map((e) => ({
      ...e,
      registrados: Number(e.registrados),
      ingresados: Number(e.ingresados),
    }));
    setEventos(evs);
    if (evs.length === 1) setElegidos([evs[0].id_evento]);
    setCargando(false);
  }

  useEffect(() => {
    cargarEventos();
  }, []); // eslint-disable-line

  function toggle(id: number) {
    setElegidos((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (elegidos.length === 0) return setErr("Elegí al menos un evento.");
    if (cedula.length < 4) return setErr("Ingresá tu número de cédula.");
    if (!nombre.trim() || !apellido.trim()) return setErr("Completá nombre y apellido.");
    if (!fechaNac) return setErr("Ingresá tu fecha de nacimiento.");
    if (esMiembro === null) return setErr("Indicá si sos miembro de la Soka Gakkai.");

    setEnviando(true);
    const { data, error } = await supabase.rpc("fest_registrar", {
      p_eventos: elegidos,
      p_cedula: cedula,
      p_nombre: nombre,
      p_apellido: apellido,
      p_fecha_nac: fechaNac,
      p_es_miembro: esMiembro,
    });
    setEnviando(false);

    const r = data as { ok: boolean; error?: string; eventos?: { id_evento: number; nuevo: boolean }[] } | null;
    if (error || !r) return setErr("No pudimos registrarte. Probá de nuevo en un momento.");
    if (!r.ok) return setErr(r.error ?? "No pudimos registrarte.");

    const ids = (r.eventos ?? []).map((x) => x.id_evento);
    setListo({
      nombre: nombre.trim().split(" ")[0],
      eventos: eventos.filter((ev) => ids.includes(ev.id_evento)).map((ev) => ev.nombre),
      actualizado: (r.eventos ?? []).every((x) => !x.nuevo),
    });
  }

  function otraPersona() {
    setListo(null);
    setCedula("");
    setNombre("");
    setApellido("");
    setFechaNac("");
    setEsMiembro(null);
    setElegidos(eventos.length === 1 ? [eventos[0].id_evento] : []);
    cargarEventos();
  }

  const input =
    "w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-marca";

  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <header className="text-center text-white mb-6">
        <p className="text-sm uppercase tracking-widest opacity-80">Soka Gakkai Paraguay</p>
        <h1 className="text-3xl font-bold mt-1">Festival por la Paz</h1>
        <p className="opacity-90 mt-2">Registrate para participar</p>
      </header>

      <section className="bg-white rounded-2xl shadow-lg p-5">
        {listo ? (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-xl font-bold">
              {listo.actualizado ? "¡Datos actualizados" : "¡Listo"}, {listo.nombre}!
            </h2>
            <p className="text-gray-600 mt-2">Quedaste registrado/a en:</p>
            <ul className="mt-2 font-medium">
              {listo.eventos.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <p className="text-gray-600 mt-4 text-sm">
              El día del evento solo tenés que dar tu <b>número de cédula</b> en la entrada.
            </p>
            <button onClick={otraPersona} className="mt-6 text-marca font-semibold">
              Registrar a otra persona
            </button>
          </div>
        ) : cargando ? (
          <p className="text-center text-gray-500 py-10">Cargando…</p>
        ) : eventos.length === 0 ? (
          <p className="text-center text-gray-500 py-10">El registro no está abierto en este momento.</p>
        ) : (
          <form onSubmit={enviar} className="space-y-5">
            <div>
              <p className="font-semibold mb-2">¿A qué evento vas a ir?</p>
              <div className="space-y-2">
                {eventos.map((ev) => {
                  const sel = elegidos.includes(ev.id_evento);
                  const libres = lugaresLibres(ev.cupo, ev.registrados);
                  return (
                    <button
                      type="button"
                      key={ev.id_evento}
                      onClick={() => toggle(ev.id_evento)}
                      className={`w-full text-left rounded-xl border-2 px-4 py-3 transition ${
                        sel ? "border-marca bg-marca/5" : "border-gray-200"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center text-xs text-white ${
                            sel ? "bg-marca border-marca" : "border-gray-300"
                          }`}
                        >
                          {sel && "✓"}
                        </span>
                        <span className="flex-1">
                          <span className="block font-medium">{ev.nombre}</span>
                          <span className="block text-sm text-gray-500">
                            {[fechaCorta(ev.fecha), ev.hora, ev.lugar].filter(Boolean).join(" · ")}
                          </span>
                          {libres != null && (
                            <span className={`block text-sm mt-1 ${libres > 0 ? "text-green-700" : "text-orange-600"}`}>
                              {libres > 0 ? `Quedan ${libres} lugares` : "Cupo completo — igual podés registrarte"}
                            </span>
                          )}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {eventos.length > 1 && <p className="text-xs text-gray-500 mt-1">Podés elegir uno o los dos.</p>}
            </div>

            <label className="block">
              <span className="font-semibold">Número de cédula</span>
              <input
                className={input + " mt-1"}
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ej. 4123456"
                value={cedula}
                onChange={(e) => setCedula(limpiarCedula(e.target.value))}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="font-semibold">Nombre</span>
                <input className={input + " mt-1"} autoComplete="given-name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </label>
              <label className="block">
                <span className="font-semibold">Apellido</span>
                <input className={input + " mt-1"} autoComplete="family-name" value={apellido} onChange={(e) => setApellido(e.target.value)} />
              </label>
            </div>

            <label className="block">
              <span className="font-semibold">Fecha de nacimiento</span>
              <input
                type="date"
                className={input + " mt-1"}
                max={new Date().toISOString().slice(0, 10)}
                value={fechaNac}
                onChange={(e) => setFechaNac(e.target.value)}
              />
            </label>

            <div>
              <p className="font-semibold mb-2">¿Sos miembro de la Soka Gakkai?</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { v: true, l: "Sí" },
                  { v: false, l: "No" },
                ].map((o) => (
                  <button
                    type="button"
                    key={o.l}
                    onClick={() => setEsMiembro(o.v)}
                    className={`rounded-xl border-2 py-3 font-medium ${
                      esMiembro === o.v ? "border-marca bg-marca text-white" : "border-gray-200"
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            {err && <p className="text-red-600 text-sm">{err}</p>}

            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-xl bg-marca text-white font-semibold py-4 text-lg disabled:opacity-60"
            >
              {enviando ? "Registrando…" : "Registrarme"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
