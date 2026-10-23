"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type EventoPublico } from "@/lib/festival";

// Valoración PÚBLICA post festival (se llega por QR). Link: /festival/valoracion
// Obligatorio: función + calificación general. Lo demás es opcional.

const ROSA = "#f11579";
const ETIQUETAS = ["", "Necesita mejorar", "Regular", "Buena", "Muy buena", "¡Excelente!"];
const AREAS = [
  { k: "organizacion", l: "Organización del evento" },
  { k: "presentaciones", l: "Presentaciones artísticas" },
  { k: "comodidad", l: "Comodidad del lugar" },
] as const;
type AreaK = (typeof AREAS)[number]["k"];

// "Festival por la Paz — Función 1" -> "Función 1"
const corto = (n: string) => n.split("—").pop()!.trim();

export default function ValoracionFestival() {
  const supabase = createClient();
  const [eventos, setEventos] = useState<EventoPublico[]>([]);
  const [cargando, setCargando] = useState(true);

  const [elegidos, setElegidos] = useState<number[]>([]);
  const [general, setGeneral] = useState(0);
  const [areas, setAreas] = useState<Record<AreaK, number>>({ organizacion: 0, presentaciones: 0, comodidad: 0 });
  const [comentario, setComentario] = useState("");
  const [nombre, setNombre] = useState("");

  const [faltan, setFaltan] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("fest_eventos_publicos");
      setEventos((data as EventoPublico[]) ?? []);
      setCargando(false);
    })();
  }, []); // eslint-disable-line

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const f: string[] = [];
    if (elegidos.length === 0) f.push("la función a la que asististe");
    if (!general) f.push("la calificación general");
    setFaltan(f);
    if (f.length) return;

    setEnviando(true);
    const { data, error } = await supabase.rpc("fest_valorar", {
      p_eventos: elegidos,
      p_general: general,
      p_organizacion: areas.organizacion || null,
      p_presentaciones: areas.presentaciones || null,
      p_comodidad: areas.comodidad || null,
      p_comentario: comentario,
      p_nombre: nombre,
    });
    setEnviando(false);
    const r = data as { ok: boolean; error?: string } | null;
    if (error || !r) return setErr("No pudimos enviar tu opinión. Probá de nuevo en un momento.");
    if (!r.ok) return setErr(r.error ?? "No pudimos enviar tu opinión.");
    setEnviado(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function otra() {
    setElegidos([]);
    setGeneral(0);
    setAreas({ organizacion: 0, presentaciones: 0, comodidad: 0 });
    setComentario("");
    setNombre("");
    setFaltan([]);
    setErr(null);
    setEnviado(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const tarjeta = "bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-5 sm:p-6";

  if (enviado) {
    return (
      <main className="px-4 pb-10">
        <section className={tarjeta + " text-center"}>
          <div className="mx-auto h-24 w-24 rounded-full bg-[#f11579]/10 flex items-center justify-center text-5xl">💗</div>
          <h1 className="text-3xl font-extrabold text-gray-900 mt-4 leading-tight">¡Gracias por compartir tu experiencia!</h1>
          <p className="text-gray-700 mt-3 text-lg leading-relaxed">
            Tu opinión nos ayuda a seguir creciendo y creando encuentros llenos de paz, cultura y esperanza.
          </p>
          <div className="mt-5 rounded-2xl bg-[#f11579]/10 px-4 py-3 font-bold" style={{ color: ROSA }}>
            ¡Juntos construimos una cultura de paz!
          </div>
          <figure className="mt-6 border-t border-dashed pt-5">
            <blockquote className="text-sm italic text-gray-600 leading-relaxed">
              «La fuente de luz necesaria para disipar el caos y la oscuridad de la época se encuentra en las acciones que
              hacen surgir nuestra propia luz interior, cuando actuamos en bien de otras personas».
            </blockquote>
            <figcaption className="mt-2 text-xs font-semibold text-gray-500">— Daisaku Ikeda</figcaption>
          </figure>
          <p className="mt-5 text-xs text-gray-500">🔒 Tu opinión será utilizada únicamente para mejorar nuestros próximos eventos.</p>
          <button
            onClick={otra}
            className="mt-6 w-full rounded-xl border-2 border-gray-200 py-3 font-semibold text-gray-700"
          >
            Enviar otra respuesta
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="px-4 pb-10">
      <form onSubmit={enviar} className="space-y-4">
        {/* 01 Bienvenida */}
        <section className={tarjeta + " text-center"}>
          <div className="mx-auto h-12 w-12 rounded-full bg-[#f11579]/10 flex items-center justify-center text-2xl">💗</div>
          <h1 className="text-2xl font-extrabold mt-2" style={{ color: ROSA }}>
            ¡Tu opinión nos importa!
          </h1>
          <p className="text-gray-700 mt-1">
            Gracias por acompañarnos en el Festival Soka por la Paz 2026. Tus comentarios nos ayudan a seguir construyendo
            momentos inolvidables.
          </p>
        </section>

        {/* 02 Función */}
        <section className={tarjeta}>
          <p className="font-semibold">
            ¿A qué función asististe? <span style={{ color: ROSA }}>*</span>
          </p>
          <p className="text-sm text-gray-500">Si fuiste a las dos, marcá ambas.</p>
          {cargando ? (
            <p className="text-gray-500 text-sm mt-2">Cargando…</p>
          ) : (
            <div className="mt-3 space-y-2">
              {eventos.map((ev, i) => {
                const sel = elegidos.includes(ev.id_evento);
                return (
                  <button
                    type="button"
                    key={ev.id_evento}
                    onClick={() => {
                      setElegidos((xs) => (xs.includes(ev.id_evento) ? xs.filter((x) => x !== ev.id_evento) : [...xs, ev.id_evento]));
                      setFaltan((f) => f.filter((x) => !x.startsWith("la función")));
                    }}
                    className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${
                      sel ? "border-[#f11579] bg-[#f11579]/5" : "border-gray-200"
                    }`}
                  >
                    <span
                      className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center font-bold ${
                        sel ? "bg-[#f11579] text-white" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {sel ? "✓" : i + 1}
                    </span>
                    <span>
                      <span className="block font-semibold">
                        {corto(ev.nombre)}
                        {ev.hora ? ` · ${ev.hora} hs` : ""}
                      </span>
                      {ev.lugar && <span className="block text-sm text-gray-500">{ev.lugar}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* 03 Calificación general */}
        <section className={tarjeta + " text-center"}>
          <p className="font-semibold">
            ¿Cómo calificarías tu experiencia general? <span style={{ color: ROSA }}>*</span>
          </p>
          <Estrellas
            valor={general}
            onChange={(v) => {
              setGeneral(v);
              setFaltan((f) => f.filter((x) => !x.startsWith("la calificación")));
            }}
            grande
          />
          <p className="h-6 font-bold" style={{ color: general ? ROSA : "#9ca3af" }}>
            {general ? ETIQUETAS[general] : "Tocá una estrella"}
          </p>
        </section>

        {/* 04 Áreas (opcional) */}
        <section className={tarjeta}>
          <p className="font-semibold">Contanos un poquito más</p>
          <p className="text-sm text-gray-500">Opcional · Ayudanos a evaluar áreas específicas</p>
          <div className="mt-2 divide-y">
            {AREAS.map((a) => (
              <div key={a.k} className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm text-gray-800">{a.l}</span>
                <Estrellas
                  valor={areas[a.k]}
                  onChange={(v) => setAreas((x) => ({ ...x, [a.k]: x[a.k] === v ? 0 : v }))}
                />
              </div>
            ))}
          </div>
        </section>

        {/* 05 Comentario + 06 Nombre */}
        <section className={tarjeta + " space-y-4"}>
          <label className="block">
            <span className="font-semibold">¿Querés dejarnos un comentario?</span>
            <textarea
              rows={4}
              maxLength={500}
              className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#f11579] focus:border-transparent"
              placeholder="¿Qué te gustó? ¿Qué podríamos mejorar? También podés dejar un mensaje para los artistas…"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />
            <span className="block text-right text-xs text-gray-400">{comentario.length}/500</span>
          </label>
          <label className="block">
            <span className="font-semibold">
              Tu nombre <span className="font-normal text-gray-500">(opcional)</span>
            </span>
            <input
              maxLength={80}
              autoComplete="name"
              className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#f11579] focus:border-transparent"
              placeholder="Ej. María Gómez"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
        </section>

        {/* 07 Envío */}
        {faltan.length > 0 && (
          <div className="rounded-2xl bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-900">
            Para enviar, completá {faltan.join(" y ")}. Lo que ya respondiste no se borra.
          </div>
        )}
        {err && <p className="rounded-2xl bg-white/95 px-4 py-3 text-red-600 text-sm font-medium">{err}</p>}
        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-2xl text-white font-bold py-4 text-lg shadow-xl disabled:opacity-60"
          style={{ background: `linear-gradient(90deg, ${ROSA}, #ff4501)` }}
        >
          {enviando ? "Enviando…" : "💗 Enviar mi opinión"}
        </button>
        <p className="text-center text-xs text-white/90 drop-shadow">
          🔒 Tus respuestas son privadas y se usan solo para mejorar próximos eventos.
        </p>
      </form>
    </main>
  );
}

function Estrellas({ valor, onChange, grande = false }: { valor: number; onChange: (v: number) => void; grande?: boolean }) {
  return (
    <div className={`flex justify-center ${grande ? "gap-2 my-3" : "gap-1"}`} role="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={valor === n}
          aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          className={`leading-none transition active:scale-90 ${grande ? "text-5xl" : "text-2xl"}`}
          style={{ color: n <= valor ? "#ffb127" : "#d1d5db" }}
        >
          ★
        </button>
      ))}
    </div>
  );
}
