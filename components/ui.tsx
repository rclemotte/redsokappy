"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ESTADOS, colorAvatar, iniciales, type Estado } from "@/lib/tookan";

// Formas recortadas del arte del festival (estrellas y sol), como decoración.
export function Decoracion({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}>
      <path d="M300 -40 l18 52 52 -30 -22 54 58 8 -54 24 34 46 -56 -12 -2 58 -34 -48 -38 44 4 -58 -56 10 36 -44 -52 -26 58 -6 -20 -54 50 32z" fill="#FF4A0A" opacity="0.55" />
      <path d="M-30 150 l40 -26 6 48 44 -20 -18 46 50 4 -42 28 30 40 -50 -8 -6 50 -30 -40 -34 36 2 -50 -48 6 34 -36 -44 -24z" fill="#FFB127" opacity="0.35" />
      <circle cx="372" cy="196" r="46" fill="#FFFFFF" opacity="0.08" />
      <path d="M150 -20 l10 30 30 -14 -14 30 32 8 -32 10 18 28 -30 -10 -4 32 -18 -28 -22 24 4 -32 -32 2 24 -22 -28 -16 32 -4 -10 -30 28 16z" fill="#FFFFFF" opacity="0.10" />
    </svg>
  );
}

// Encabezado de cada pantalla, con el degradé del festival.
export function Cabecera({
  titulo,
  subtitulo,
  volver,
  accion,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  volver?: string | boolean;
  accion?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="relative -mx-4 -mt-4 mb-5 overflow-hidden rounded-b-[2rem] bg-sol px-5 pb-6 pt-[calc(env(safe-area-inset-top)+1.25rem)] text-white lg:mx-0 lg:mt-0 lg:rounded-4xl lg:px-8 lg:pt-7">
      <Decoracion />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {volver && (
              typeof volver === "string" ? (
                <Link href={volver} className="mb-1 -ml-1 inline-flex items-center text-sm font-bold text-white/85">
                  <ChevronLeft size={18} /> Volver
                </Link>
              ) : (
                <button onClick={() => router.back()} className="mb-1 -ml-1 inline-flex items-center text-sm font-bold text-white/85">
                  <ChevronLeft size={18} /> Volver
                </button>
              )
            )}
            <h1 className="font-display text-[1.9rem] font-extrabold leading-[1.05] drop-shadow-sm">{titulo}</h1>
            {subtitulo && <p className="mt-1 text-[15px] font-semibold text-white/90">{subtitulo}</p>}
          </div>
          {accion && <div className="shrink-0 pt-1">{accion}</div>}
        </div>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </header>
  );
}

// Botón redondo blanco para la cabecera (ej. "+ Nueva persona")
export function BotonCabecera({ href, children, label }: { href: string; children: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-marca shadow-flotante transition active:scale-95"
    >
      {children}
    </Link>
  );
}

export function BadgeEstado({ estado, className = "" }: { estado: Estado | null; className?: string }) {
  if (!estado) return <span className={`rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-500 ${className}`}>Baja</span>;
  const e = ESTADOS[estado];
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold ${e.bg} ${e.color} ${className}`}>{e.corto}</span>;
}

export function Avatar({ nombre, size = 44 }: { nombre: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-2xl font-display font-bold text-white"
      style={{ width: size, height: size, background: colorAvatar(nombre), fontSize: size * 0.38 }}
    >
      {iniciales(nombre)}
    </div>
  );
}

export function Vacio({ icono, titulo, texto, children }: { icono: React.ReactNode; titulo: string; texto?: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-sol-suave text-marca">{icono}</div>
      <p className="font-display text-lg font-bold">{titulo}</p>
      {texto && <p className="mt-1 max-w-xs text-sm text-tinta-suave">{texto}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function Cargando({ filas = 6 }: { filas?: number }) {
  return (
    <div className="card divide-y divide-linea overflow-hidden" aria-busy>
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <div className="h-11 w-11 animate-pulse rounded-2xl bg-marca-50" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded-full bg-marca-50" />
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-marca-50" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Número grande con etiqueta (tarjetas del inicio y estadísticas)
export function Kpi({
  valor,
  label,
  color = "text-tinta",
  punto,
  href,
}: {
  valor: number | string;
  label: string;
  color?: string;
  punto?: string;
  href?: string;
}) {
  const cuerpo = (
    <>
      <div className={`font-display text-[2rem] font-extrabold leading-none ${color}`}>
        {typeof valor === "number" ? valor.toLocaleString("es-PY") : valor}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[13px] font-bold text-tinta-suave">
        {punto && <span className="h-2.5 w-2.5 rounded-full" style={{ background: punto }} />}
        {label}
      </div>
    </>
  );
  return href ? (
    <Link href={href} className="card block p-4 transition active:scale-[0.98]">{cuerpo}</Link>
  ) : (
    <div className="card p-4">{cuerpo}</div>
  );
}
