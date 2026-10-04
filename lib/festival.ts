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

export function lugaresLibres(cupo: number | null, usados: number) {
  if (cupo == null) return null;
  return Math.max(cupo - usados, 0);
}
