// Tipos y helpers compartidos del módulo Festival.

export type EventoPublico = {
  id_evento: number;
  nombre: string;
  fecha: string | null;
  hora: string | null;
  lugar: string | null;
  cupo: number | null;
  registrados: number;
  ingresados: number;
};

export type ResumenEvento = EventoPublico & {
  activo: boolean;
  reg_miembros: number;
  reg_no_miembros: number;
  ing_registrados: number;
  ing_sin_registro: number;
  ing_miembros: number;
};

// Deja solo dígitos (la gente escribe "4.123.456" o "4 123 456").
export function limpiarCedula(v: string) {
  return v.replace(/\D/g, "").slice(0, 10);
}

// "2026-11-14" -> "sáb 14 nov"
export function fechaCorta(f: string | null) {
  if (!f) return "";
  const d = new Date(f + "T12:00:00");
  return d.toLocaleDateString("es-PY", { weekday: "short", day: "numeric", month: "short" });
}

// "2026-10-25" + "18:00" -> "Domingo 25 de octubre · 18:00 hs"
export function fechaLarga(f: string | null, h?: string | null) {
  const partes: string[] = [];
  if (f) {
    const d = new Date(f + "T12:00:00");
    const t = d.toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long" });
    partes.push(t.charAt(0).toUpperCase() + t.slice(1).replace(",", ""));
  }
  if (h) partes.push(/hs?$/i.test(h.trim()) ? h.trim() : `${h.trim()} hs`);
  return partes.join(" · ");
}

export function lugaresLibres(cupo: number | null, usados: number) {
  if (cupo == null) return null;
  return Math.max(cupo - usados, 0);
}
