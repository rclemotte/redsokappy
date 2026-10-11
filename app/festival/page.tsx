"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  FESTIVAL,
  type EventoPublico,
  fechaLarga,
  limpiarCedula,
  limpiarTelefono,
  telefonoValido,
} from "@/lib/festival";

const ROSA = "#f11579";

// Registro PÚBLICO al Festival (sin login). Se comparte el link /festival.
export default function RegistroFestivalPage() {
  const supabase = createClient();

  const [eventos, setEventos] = useState<EventoPublico[]>([]);
  const [cargando, setCargando] = useState(true);

  const [cedula, setCedula] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [esMiembro, setEsMiembro] = useState<boolean | null>(null);
  const [esStaff, setEsStaff] = useState<boolean | null>(null);
  const [idEvento, setIdEvento] = useState<number | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [listo, setListo] = useState<{ nombre: string; eventos: EventoPublico[]; staff: boolean } | null>(null);

  const lleno = (ev: EventoPublico) => ev.cupo != null && ev.registrados >= ev.cupo;
  // Miembro + comité/staff artístico → queda registrado en todas las funciones
  const staff = esMiembro === true && esStaff === true;

  async function cargarEventos() {
    const { data } = await supabase.rpc("fest_eventos_publicos");
    const evs = ((data as EventoPublico[]) ?? []).map((e) => ({
      ...e,
      registrados: Number(e.registrados),
      ingresados: Number(e.ingresados),
    }));
    setEventos(evs);
    // Si el evento elegido se llenó mientras completaba el form, se deselecciona
    setIdEvento((id) => (id && evs.some((e) => e.id_evento === id && !lleno(e)) ? id : null));
    setCargando(false);
    return evs;
  }

  useEffect(() => {
    cargarEventos();
  }, []); // eslint-disable-line

  function elegirMiembro(v: boolean) {
    setEsMiembro(v);
    if (!v) setEsStaff(null);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (cedula.length < 4) return setErr("Ingresá tu número de cédula.");
    if (!nombre.trim() || !apellido.trim()) return setErr("Completá nombre y apellido.");
    if (!telefonoValido(telefono)) return setErr("Ingresá un teléfono válido. Ej.: 0981 123456");
    if (esMiembro === null) return setErr("Indicá si sos miembro de la Soka Gakkai.");
    if (esMiembro && esStaff === null) return setErr("Indicá si pertenecés a un comité / staff artístico.");
    if (!staff && todoLleno) return setErr("Se completaron los cupos de todas las funciones.");
    if (!staff && !idEvento) return setErr("Elegí la función a la que vas a asistir.");

    setEnviando(true);
    const { data, error } = await supabase.rpc("fest_registrar", {
      p_eventos: staff ? eventos.map((ev) => ev.id_evento) : [idEvento],
      p_cedula: cedula,
      p_nombre: nombre,
      p_apellido: apellido,
      p_telefono: telefono,
      p_es_miembro: esMiembro,
      p_es_staff: esMiembro ? !!esStaff : false,
    });
    setEnviando(false);

    const r = data as { ok: boolean; error?: string; codigo?: string; eventos?: number[] } | null;
    if (error || !r) return setErr("No pudimos registrarte. Probá de nuevo en un momento.");
    if (!r.ok) {
      if (r.codigo === "cupo_completo") cargarEventos();
      return setErr(r.error ?? "No pudimos registrarte.");
    }

    const ids = r.eventos ?? [];
    setListo({
      nombre: nombre.trim().split(" ")[0],
      eventos: eventos.filter((ev) => ids.includes(ev.id_evento)),
      staff,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function otraPersona() {
    setListo(null);
    setCedula("");
    setNombre("");
    setApellido("");
    setTelefono("");
    setEsMiembro(null);
    setEsStaff(null);
    setIdEvento(null);
    setErr(null);
    cargarEventos();
  }

  const input =
    "w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#f11579] focus:border-transparent";
  const disponibles = eventos.filter((e) => !lleno(e));
  const todoLleno = disponibles.length === 0;

  return (
    <main className="px-4 pb-10">
      <section className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-5 sm:p-6">
        {listo ? (
          <Confirmacion listo={listo} onOtra={otraPersona} />
        ) : cargando ? (
          <p className="text-center text-gray-500 py-10">Cargando…</p>
        ) : eventos.length === 0 ? (
          <p className="text-center text-gray-600 py-10">El registro no está abierto en este momento.</p>
        ) : (
          <form onSubmit={enviar} className="space-y-5">
            <h1 className="text-2xl font-extrabold text-center" style={{ color: ROSA }}>
              Registrate para participar
            </h1>

            {todoLleno && (
              <div className="rounded-xl bg-[#ffb127]/20 border border-[#ffb127] px-4 py-3 text-sm text-center">
                <b>¡Se completaron los cupos de todas las funciones!</b> Solo pueden registrarse integrantes de comités / staff
                artístico.
              </div>
            )}

            {/* 1) Datos personales */}
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

            {/* 2) Contacto */}
            <label className="block">
              <span className="font-semibold">Teléfono / WhatsApp</span>
              <input
                className={input + " mt-1"}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Ej. 0981 123456"
                value={telefono}
                onChange={(e) => setTelefono(limpiarTelefono(e.target.value))}
              />
            </label>

            {/* 3) Membresía */}
            <SiNo label="¿Sos miembro de la Soka Gakkai?" valor={esMiembro} onChange={elegirMiembro} />
            {esMiembro && (
              <SiNo label="¿Pertenecés a un comité / staff artístico?" valor={esStaff} onChange={setEsStaff} />
            )}

            {/* 4) Función */}
            <div>
              <p className="font-semibold mb-1">{staff ? "Funciones" : "¿A qué función vas a asistir?"}</p>
              {staff ? (
                <p className="text-sm text-gray-600 mb-2">
                  Como integrante de un comité / staff artístico, quedás registrado/a en <b>todas las funciones</b>.
                </p>
              ) : (
                <div className="mb-1" />
              )}
              <div className="space-y-2">
                {eventos.map((ev) => {
                  const sel = staff || idEvento === ev.id_evento;
                  const full = !staff && lleno(ev);
                  return (
                    <button
                      type="button"
                      key={ev.id_evento}
                      disabled={full || staff}
                      onClick={() => setIdEvento(ev.id_evento)}
                      className={`w-full text-left rounded-xl border-2 px-4 py-3 transition ${
                        full
                          ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                          : sel
                          ? `border-[#f11579] bg-[#f11579]/5 ${staff ? "cursor-default" : ""}`
                          : "border-gray-200"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 h-5 w-5 shrink-0 ${staff ? "rounded" : "rounded-full"} border-2 flex items-center justify-center ${
                            sel ? "border-[#f11579]" : "border-gray-300"
                          }`}
                        >
                          {sel &&
                            (staff ? (
                              <span className="h-full w-full bg-[#f11579] text-white text-xs flex items-center justify-center">✓</span>
                            ) : (
                              <span className="h-2.5 w-2.5 rounded-full bg-[#f11579]" />
                            ))}
                        </span>
                        <span className="flex-1">
                          <span className="block font-semibold">{ev.nombre}</span>
                          {(ev.fecha || ev.hora) && (
                            <span className="block text-sm font-medium mt-0.5 text-[#e03e00]">
                              📅 {fechaLarga(ev.fecha, ev.hora)}
                            </span>
                          )}
                          {ev.lugar && <span className="block text-sm text-gray-500">📍 {ev.lugar}</span>}
                          {full && <span className="block text-sm font-semibold text-gray-600 mt-1">Cupo completo</span>}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {err && <p className="text-red-600 text-sm font-medium">{err}</p>}

            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-xl text-white font-bold py-4 text-lg shadow-lg disabled:opacity-60 active:scale-[0.99] transition"
              style={{ background: `linear-gradient(90deg, ${ROSA}, #ff4501)` }}
            >
              {enviando ? "Registrando…" : "Registrarme"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

function SiNo({
  label,
  valor,
  onChange,
}: {
  label: string;
  valor: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <p className="font-semibold mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { v: true, l: "Sí" },
          { v: false, l: "No" },
        ].map((o) => (
          <button
            type="button"
            key={o.l}
            onClick={() => onChange(o.v)}
            className={`rounded-xl border-2 py-3 font-semibold transition ${
              valor === o.v ? "border-[#f11579] bg-[#f11579] text-white" : "border-gray-200"
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

// Pantalla siguiente al registro: confirmación + causa solidaria.
function Confirmacion({
  listo,
  onOtra,
}: {
  listo: { nombre: string; eventos: EventoPublico[]; staff: boolean };
  onOtra: () => void;
}) {
  const wa = `https://wa.me/${FESTIVAL.whatsapp}?text=${encodeURIComponent(FESTIVAL.whatsappTexto)}`;

  return (
    <div>
      <div className="text-center">
        <div className="text-5xl mb-2">🎉</div>
        <h2 className="text-2xl font-extrabold" style={{ color: ROSA }}>
          ¡Listo, {listo.nombre}!
        </h2>
        <p className="text-gray-700 mt-1">
          {listo.staff ? "Quedaste registrado/a como comité / staff artístico en:" : "Tu lugar quedó registrado."}
        </p>
        {listo.eventos.map((ev) => (
          <div key={ev.id_evento} className="mt-3 rounded-xl bg-[#ffb127]/15 border border-[#ffb127]/50 px-4 py-3 text-left">
            <p className="font-semibold">{ev.nombre}</p>
            {(ev.fecha || ev.hora) && <p className="text-sm text-[#e03e00] font-medium">📅 {fechaLarga(ev.fecha, ev.hora)}</p>}
            {ev.lugar && <p className="text-sm text-gray-600">📍 {ev.lugar}</p>}
          </div>
        ))}
        <p className="text-sm text-gray-600 mt-3">
          Presenta tu <b>cédula</b> en la entrada. Las personas registradas previamente tienen <b>acceso prioritario</b>.
        </p>
      </div>

      <hr className="my-5 border-dashed" />

      <div>
        <h3 className="text-xl font-extrabold text-center">¡Sumate también a la causa solidaria! ❤️</h3>
        <p className="mt-3 text-gray-700 leading-relaxed">
          Te invitamos a colaborar llevando <b>víveres no perecederos</b> al <b>Centro Cultural de la Soka Gakkai del Paraguay</b>,
          que posteriormente serán destinados a donaciones para quienes más lo necesitan.
        </p>

        <div className="mt-4 space-y-2">
          <a
            href={FESTIVAL.mapa}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border-2 border-gray-200 px-4 py-3 hover:border-[#ff4501] transition"
          >
            <IconoMapa />
            <span className="flex-1">
              <span className="block font-semibold">Centro Cultural Soka Gakkai</span>
              <span className="block text-sm text-gray-500">Ver ubicación en el mapa</span>
            </span>
            <span className="text-gray-400">›</span>
          </a>
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl bg-[#25d366] text-white px-4 py-3 shadow hover:brightness-95 transition"
          >
            <IconoWhatsApp />
            <span className="flex-1">
              <span className="block font-semibold">Escribinos por WhatsApp</span>
              <span className="block text-sm opacity-90">{FESTIVAL.whatsappVisible}</span>
            </span>
            <span className="opacity-80">›</span>
          </a>
        </div>

        <div className="mt-4 rounded-xl bg-[#ff4501]/10 border-l-4 border-[#ff4501] px-4 py-3 text-sm text-gray-800">
          <b>Importante:</b> Las donaciones se recibirán <b>exclusivamente en el Centro Cultural</b>, no en el teatro el día del
          festival.
        </div>

      </div>

      <button onClick={onOtra} className="mt-6 w-full text-center font-semibold" style={{ color: ROSA }}>
        Registrar a otra persona
      </button>
    </div>
  );
}

function IconoMapa() {
  return (
    <span className="h-10 w-10 shrink-0 rounded-full bg-[#ff4501] text-white flex items-center justify-center">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
        <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
      </svg>
    </span>
  );
}

function IconoWhatsApp() {
  return (
    <span className="h-10 w-10 shrink-0 rounded-full bg-white/20 flex items-center justify-center">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.21 8.21 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.22-8.24 8.22zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z" />
      </svg>
    </span>
  );
}
