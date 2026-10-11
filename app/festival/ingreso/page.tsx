"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type EventoPublico, fechaLarga, limpiarCedula } from "@/lib/festival";

type Resultado =
  | { tipo: "ok"; registrado: boolean; nombre: string }
  | { tipo: "ya_ingreso"; registrado: boolean; nombre: string }
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
    }, r.tipo === "ok" && r.registrado ? 2500 : 6000);
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
    else if (r.estado === "ya_ingreso") mostrar({ tipo: "ya_ingreso", registrado: !!r.registrado, nombre: r.nombre ?? "" });
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
      <main className="px-4 pb-10">
        <h1 className="text-2xl font-extrabold text-center mb-4 text-white drop-shadow">Confirmación de ingreso</h1>
        {eventos.length === 0 && <p className="text-center text-white">No hay eventos activos.</p>}
        <div className="space-y-3">
          {eventos.map((ev) => (
            <button
              key={ev.id_evento}
              onClick={() => setIdEvento(ev.id_evento)}
              className="w-full bg-white/95 text-gray-900 rounded-2xl px-5 py-4 text-left shadow-xl"
            >
              <span className="block font-semibold text-lg">{ev.nombre}</span>
              <span className="block text-sm text-gray-500">
                {[fechaLarga(ev.fecha, ev.hora), ev.lugar].filter(Boolean).join(" · ")}
              </span>
            </button>
          ))}
        </div>
      </main>
    );
  }

  const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"];

  return (
    <main className="px-4 pb-8 flex flex-col">
      <div className="bg-white/95 backdrop-blur text-gray-900 rounded-3xl p-5 shadow-2xl">
        <header className="text-center">
          <h1 className="text-lg font-extrabold text-[#f11579]">{evento.nombre}</h1>
          <p className="text-xs text-gray-500">Confirmación de ingreso · Ingresaron: {evento.ingresados}</p>
        </header>
        <p className="text-center text-gray-700 mt-3 font-medium">Escribí tu número de cédula</p>
        <input
          ref={inputRef}
          autoFocus
          inputMode="none"
          className="mt-3 w-full text-center text-4xl font-bold tracking-widest py-3 border-b-2 border-gray-200 focus:outline-none focus:border-[#f11579]"
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
              className={`rounded-xl py-4 text-2xl font-semibold active:scale-95 transition ${
                k === "OK" ? "bg-[#f11579] text-white text-xl" : "bg-gray-100"
              }`}
            >
              {k === "OK" ? (enviando ? "…" : "Entrar") : k}
            </button>
          ))}
        </div>
      </div>

      {!fijo && eventos.length > 1 && (
        <button onClick={() => setIdEvento(null)} className="mt-4 text-sm text-white/90 underline drop-shadow">
          Cambiar evento
        </button>
      )}

      {res && <Pantalla res={res} onCerrar={() => setRes(null)} />}
    </main>
  );
}

// Pantalla de resultado a pantalla completa
function Pantalla({ res, onCerrar }: { res: Resultado; onCerrar: () => void }) {
  let fondo = "bg-red-600";
  let icono = "⚠️";
  let titulo: React.ReactNode = null;
  let detalle: React.ReactNode = null;

  if (res.tipo === "ok" && res.registrado) {
    fondo = "bg-green-600";
    icono = "✅";
    titulo = `¡Bienvenido/a${res.nombre ? `, ${res.nombre}` : ""}!`;
    detalle = (
      <>
        <span className="inline-block mt-3 rounded-full bg-white/20 px-4 py-1 font-bold tracking-wide">
          ⭐ ACCESO PRIORITARIO
        </span>
        <span className="block mt-3">Registro previo confirmado. Puede ingresar.</span>
      </>
    );
  } else if (res.tipo === "ok") {
    // Vino sin registro previo: queda anotado, pero debe aguardar
    fondo = "bg-amber-500";
    icono = "⏳";
    titulo = "Sin registro previo";
    detalle = (
      <>
        <span className="block mt-2">Esta persona <b>no se registró</b> antes del evento.</span>
        <span className="block mt-3 rounded-2xl bg-black/15 px-5 py-3 font-semibold">
          Por favor, aguardá tu turno. Las personas con registro previo tienen prioridad de ingreso. Un voluntario te indicará
          cuándo pasar.
        </span>
      </>
    );
  } else if (res.tipo === "ya_ingreso") {
    fondo = "bg-slate-700";
    icono = "👋";
    titulo = "Esta cédula ya fue confirmada";
    detalle = res.registrado
      ? "Ya ingresó con registro previo. Si es un error, avisá a un voluntario."
      : "Ya está anotada en la lista de espera (sin registro previo).";
  } else {
    titulo = res.mensaje;
  }

  return (
    <div
      onClick={onCerrar}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center text-center px-6 text-white ${fondo}`}
    >
      <div className="text-7xl mb-4">{icono}</div>
      <p className="text-3xl font-extrabold">{titulo}</p>
      {detalle && <div className="text-lg mt-2 max-w-md opacity-95">{detalle}</div>}
      <p className="absolute bottom-6 text-sm opacity-70">Tocá la pantalla para continuar</p>
    </div>
  );
}
