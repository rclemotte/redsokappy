"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type EventoPublico, fechaCorta, limpiarCedula } from "@/lib/festival";

type Resultado =
  | { tipo: "ok"; registrado: boolean; nombre: string }
  | { tipo: "ya_ingreso"; nombre: string }
  | { tipo: "error"; mensaje: string };

// KIOSKO de ingreso (abierto, sin login). Uso típico: una tablet en la entrada.
// Tip: abrir /festival/ingreso?evento=<id> deja el evento fijo y oculta el selector.
export default function IngresoFestivalPage() {
  const supabase = createClient();

  const [eventos, setEventos] = useState<EventoPublico[]>([]);
  const [idEvento, setIdEvento] = useState<number | null>(null);
  const [fijo, setFijo] = useState(false);
  const [cargando, setCargando] = useState(true);

  const [cedula, setCedula] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function cargarEventos() {
    const { data } = await supabase.rpc("fest_eventos_publicos");
    const evs = ((data as EventoPublico[]) ?? []).map((e) => ({ ...e, ingresados: Number(e.ingresados) }));
    setEventos(evs);
    return evs;
  }

  useEffect(() => {
    (async () => {
      const evs = await cargarEventos();
      const param = Number(new URLSearchParams(window.location.search).get("evento"));
      if (param && evs.some((e) => e.id_evento === param)) {
        setIdEvento(param);
        setFijo(true);
      } else if (evs.length === 1) {
        setIdEvento(evs[0].id_evento);
      }
      setCargando(false);
    })();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []); // eslint-disable-line

  function mostrar(r: Resultado) {
    setRes(r);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setRes(null);
      inputRef.current?.focus();
    }, r.tipo === "ok" ? 2500 : 4000);
  }

  async function ingresar() {
    if (!idEvento || enviando) return;
    if (cedula.length < 4) {
      mostrar({ tipo: "error", mensaje: "Ingresá un número de cédula válido." });
      return;
    }
    setEnviando(true);
    const { data, error } = await supabase.rpc("fest_ingresar", { p_evento: idEvento, p_cedula: cedula });
    setEnviando(false);
    setCedula("");

    const r = data as { estado: string; registrado?: boolean; nombre?: string } | null;
    if (error || !r) return mostrar({ tipo: "error", mensaje: "Sin conexión. Probá de nuevo." });

    if (r.estado === "ok") mostrar({ tipo: "ok", registrado: !!r.registrado, nombre: r.nombre ?? "" });
    else if (r.estado === "ya_ingreso") mostrar({ tipo: "ya_ingreso", nombre: r.nombre ?? "" });
    else if (r.estado === "evento_inactivo") mostrar({ tipo: "error", mensaje: "Este evento ya no está activo." });
    else mostrar({ tipo: "error", mensaje: "Número de cédula inválido." });

    cargarEventos();
  }

  function tecla(k: string) {
    if (res) return;
    if (k === "⌫") setCedula((c) => c.slice(0, -1));
    else if (k === "OK") ingresar();
    else setCedula((c) => limpiarCedula(c + k));
  }

  const evento = eventos.find((e) => e.id_evento === idEvento);

  if (cargando) return <p className="text-center text-white pt-24">Cargando…</p>;

  // Paso 1: elegir el evento (lo hace el voluntario al armar el kiosko)
  if (!evento) {
    return (
      <main className="max-w-md mx-auto px-4 py-10 text-white">
        <h1 className="text-2xl font-bold text-center mb-6">Ingreso — ¿qué evento?</h1>
        {eventos.length === 0 && <p className="text-center opacity-80">No hay eventos activos.</p>}
        <div className="space-y-3">
          {eventos.map((ev) => (
            <button
              key={ev.id_evento}
              onClick={() => setIdEvento(ev.id_evento)}
              className="w-full bg-white text-gray-900 rounded-2xl px-5 py-4 text-left shadow"
            >
              <span className="block font-semibold text-lg">{ev.nombre}</span>
              <span className="block text-sm text-gray-500">
                {[fechaCorta(ev.fecha), ev.hora, ev.lugar].filter(Boolean).join(" · ")}
              </span>
            </button>
          ))}
        </div>
      </main>
    );
  }

  const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"];

  return (
    <main className="max-w-md mx-auto px-4 py-6 text-white min-h-screen flex flex-col">
      <header className="text-center">
        <p className="text-sm uppercase tracking-widest opacity-80">Festival Soka por la Paz</p>
        <h1 className="text-xl font-bold">{evento.nombre}</h1>
        <p className="text-sm opacity-80 mt-1">Ingresaron: {evento.ingresados}</p>
      </header>

      <div className="mt-6 bg-white text-gray-900 rounded-2xl p-5 shadow-lg">
        <p className="text-center text-gray-600">Escribí tu número de cédula</p>
        <input
          ref={inputRef}
          autoFocus
          inputMode="none"
          className="mt-3 w-full text-center text-4xl font-bold tracking-widest py-3 border-b-2 border-gray-200 focus:outline-none focus:border-marca"
          value={cedula}
          placeholder="—"
          onChange={(e) => setCedula(limpiarCedula(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && ingresar()}
        />
        <div className="grid grid-cols-3 gap-3 mt-5">
          {teclas.map((k) => (
            <button
              key={k}
              onClick={() => tecla(k)}
              disabled={enviando}
              className={`rounded-xl py-5 text-2xl font-semibold active:scale-95 transition ${
                k === "OK" ? "bg-marca text-white" : "bg-gray-100"
              }`}
            >
              {k === "OK" ? (enviando ? "…" : "Entrar") : k}
            </button>
          ))}
        </div>
      </div>

      {!fijo && eventos.length > 1 && (
        <button onClick={() => setIdEvento(null)} className="mt-auto pt-6 text-sm opacity-70 underline">
          Cambiar evento
        </button>
      )}

      {res && (
        <div
          onClick={() => setRes(null)}
          className={`fixed inset-0 flex flex-col items-center justify-center text-center px-6 ${
            res.tipo === "ok" ? "bg-green-600" : res.tipo === "ya_ingreso" ? "bg-amber-500" : "bg-red-600"
          }`}
        >
          <div className="text-7xl mb-4">{res.tipo === "ok" ? "✅" : res.tipo === "ya_ingreso" ? "👋" : "⚠️"}</div>
          {res.tipo === "ok" && (
            <>
              <p className="text-3xl font-bold">¡Bienvenido/a{res.nombre ? `, ${res.nombre}` : ""}!</p>
              <p className="text-lg mt-2 opacity-90">Ingreso registrado</p>
            </>
          )}
          {res.tipo === "ya_ingreso" && (
            <>
              <p className="text-3xl font-bold">Esta cédula ya ingresó</p>
              <p className="text-lg mt-2 opacity-90">Si es un error, avisá a un voluntario.</p>
            </>
          )}
          {res.tipo === "error" && <p className="text-2xl font-bold">{res.mensaje}</p>}
        </div>
      )}
    </main>
  );
}
