"use client";

import { useEffect, useState } from "react";
import { Share2, Facebook, Download, ExternalLink, ChevronDown } from "lucide-react";
import { Decoracion } from "@/components/ui";
import type { Aliento } from "@/lib/aliento";

function IconoWhatsApp({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.55-3.7 8.24-8.24 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  );
}

// Corta el texto en líneas que entren en el ancho dado
function lineas(ctx: CanvasRenderingContext2D, texto: string, ancho: number) {
  const out: string[] = [];
  for (const parrafo of texto.split("\n")) {
    if (!parrafo.trim()) { out.push(""); continue; }
    let linea = "";
    for (const palabra of parrafo.split(" ")) {
      const prueba = linea ? linea + " " + palabra : palabra;
      if (ctx.measureText(prueba).width > ancho && linea) { out.push(linea); linea = palabra; }
      else linea = prueba;
    }
    out.push(linea);
  }
  return out;
}

// Estrella recortada como en el arte del festival
function estrella(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, puntas: number, color: string, alfa: number) {
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < puntas * 2; i++) {
    const rr = i % 2 === 0 ? r : r * 0.55;
    const a = (Math.PI / puntas) * i - Math.PI / 2;
    ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Imagen 1080×1350 para compartir (Instagram, estados de WhatsApp, Facebook)
async function crearImagen(a: Aliento): Promise<Blob | null> {
  await (document as any).fonts?.ready;
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#F11579");
  g.addColorStop(1, "#FF4A0A");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  estrella(ctx, W - 80, 120, 260, 9, "#FF4A0A", 0.55);
  estrella(ctx, 60, H - 140, 220, 8, "#FFB127", 0.35);
  estrella(ctx, W / 2 + 80, -10, 120, 9, "#FFFFFF", 0.1);

  const m = 96;
  ctx.fillStyle = "#FFFFFF";
  ctx.font = '800 44px "Baloo 2", sans-serif';
  ctx.fillText("Aliento diario", m, 170);
  ctx.globalAlpha = 0.85;
  ctx.font = '700 34px Nunito, sans-serif';
  ctx.fillText(a.fecha.charAt(0).toUpperCase() + a.fecha.slice(1), m, 222);
  ctx.globalAlpha = 1;

  // Texto: se achica la letra hasta que entre
  let tam = 54;
  let ls: string[] = [];
  for (; tam >= 30; tam -= 2) {
    ctx.font = `700 ${tam}px Nunito, sans-serif`;
    ls = lineas(ctx, a.texto, W - m * 2);
    if (ls.length * tam * 1.42 < H - 620) break;
  }
  ctx.font = '800 150px "Baloo 2", sans-serif';
  ctx.globalAlpha = 0.35;
  ctx.fillText("“", m - 10, 380);
  ctx.globalAlpha = 1;
  ctx.font = `700 ${tam}px Nunito, sans-serif`;
  let y = 400;
  for (const l of ls) { ctx.fillText(l, m, y); y += tam * 1.42; }

  if (a.cita) {
    y += 24;
    ctx.globalAlpha = 0.9;
    ctx.font = '600 28px Nunito, sans-serif';
    for (const l of lineas(ctx, a.cita, W - m * 2).slice(0, 3)) { ctx.fillText(l, m, y); y += 38; }
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(m, H - 150, W - m * 2, 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = '800 34px "Baloo 2", sans-serif';
  ctx.fillText("Daisaku Ikeda", m, H - 92);
  ctx.globalAlpha = 0.85;
  ctx.font = '700 26px Nunito, sans-serif';
  const pie = "sokaglobal.org";
  ctx.fillText(pie, W - m - ctx.measureText(pie).width, H - 92);
  ctx.globalAlpha = 1;
  return await new Promise((r) => c.toBlob((b) => r(b), "image/png"));
}

export default function AlientoCard({ aliento }: { aliento: Aliento }) {
  const [abierto, setAbierto] = useState(false);
  const [puedeCompartir, setPuedeCompartir] = useState(false);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => setPuedeCompartir(typeof navigator !== "undefined" && !!navigator.share), []);

  const hayTexto = aliento.texto.length > 0;
  const largo = aliento.texto.length > 320;
  const mensaje = `🌸 *Aliento diario · ${aliento.fecha}*\n\n${aliento.texto}${aliento.cita ? `\n\n_${aliento.cita}_` : ""}\n\n${aliento.url}`;

  async function compartir() {
    setTrabajando(true);
    try {
      const blob = hayTexto ? await crearImagen(aliento) : null;
      const archivo = blob ? new File([blob], `aliento-${aliento.fecha.replace(/\s+/g, "-")}.png`, { type: "image/png" }) : null;
      if (archivo && navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({ files: [archivo], text: mensaje.replace(/[*_]/g, ""), title: "Aliento diario" });
      } else {
        await navigator.share({ title: "Aliento diario", text: mensaje.replace(/[*_]/g, ""), url: aliento.url });
      }
    } catch {
      // el usuario cerró el menú de compartir
    }
    setTrabajando(false);
  }

  async function descargar() {
    setTrabajando(true);
    const blob = await crearImagen(aliento);
    if (blob) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `aliento-${aliento.fecha.replace(/\s+/g, "-")}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    setTrabajando(false);
  }

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] bg-white shadow-suave">
      <div className="relative overflow-hidden bg-sol px-5 pb-4 pt-4 text-white">
        <Decoracion className="opacity-70" />
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-xl font-extrabold leading-none">Aliento diario</p>
            <p className="mt-1 text-sm font-bold text-white/85">{aliento.fecha.charAt(0).toUpperCase() + aliento.fecha.slice(1)}</p>
          </div>
          <span className="font-display text-6xl font-extrabold leading-[0.6] text-white/35" aria-hidden>“</span>
        </div>
      </div>

      <div className="px-5 pb-5 pt-4">
        {hayTexto ? (
          <>
            <div className={`relative ${largo && !abierto ? "max-h-40 overflow-hidden" : ""}`}>
              {aliento.texto.split("\n\n").map((p, i) => (
                <p key={i} className="mb-2 text-[16px] font-semibold leading-relaxed text-tinta">{p}</p>
              ))}
              {largo && !abierto && <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white to-transparent" />}
            </div>
            {largo && (
              <button onClick={() => setAbierto((v) => !v)} className="mb-2 inline-flex items-center gap-1 text-sm font-extrabold text-marca">
                {abierto ? "Ver menos" : "Leer todo"} <ChevronDown size={16} className={abierto ? "rotate-180" : ""} />
              </button>
            )}
            {aliento.cita && <p className="text-sm font-semibold italic text-tinta-suave">{aliento.cita}</p>}
            <p className="mt-1 text-sm font-extrabold text-marca">Daisaku Ikeda</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-chico bg-[#25D366] text-white"
              >
                <IconoWhatsApp /> WhatsApp
              </a>
              {puedeCompartir ? (
                <button onClick={compartir} disabled={trabajando} className="btn-chico bg-sol text-white disabled:opacity-60">
                  <Share2 size={16} strokeWidth={2.6} /> {trabajando ? "Preparando…" : "Compartir imagen"}
                </button>
              ) : (
                <button onClick={descargar} disabled={trabajando} className="btn-chico bg-sol text-white disabled:opacity-60">
                  <Download size={16} strokeWidth={2.6} /> {trabajando ? "Preparando…" : "Descargar imagen"}
                </button>
              )}
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(aliento.url)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-chico bg-[#1877F2] text-white"
              >
                <Facebook size={16} strokeWidth={2.6} /> Facebook
              </a>
            </div>
            {puedeCompartir && (
              <p className="mt-2 text-xs font-semibold text-tinta-tenue">“Compartir imagen” abre las apps del celular: Instagram, estados de WhatsApp y más.</p>
            )}
          </>
        ) : (
          <a href={aliento.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-extrabold text-marca">
            Leer el aliento de hoy en sokaglobal.org <ExternalLink size={16} />
          </a>
        )}
      </div>
    </section>
  );
}
