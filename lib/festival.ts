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

// Teléfono: deja dígitos y un "+" inicial opcional.
export function limpiarTelefono(v: string) {
  const mas = v.trim().startsWith("+");
  return (mas ? "+" : "") + v.replace(/\D/g, "").slice(0, 13);
}

// Mismo criterio que la base: 0981 123456, 981123456, +595 981 123456.
export function telefonoValido(v: string) {
  let d = v.replace(/\D/g, "");
  if (d.startsWith("595")) d = "0" + d.slice(3);
  if (!d.startsWith("0")) d = "0" + d;
  return /^0[2-9]\d{7,8}$/.test(d);
}

export const FESTIVAL = {
  mapa: "https://maps.app.goo.gl/HDeY53Ehgit6KUiL8",
  whatsapp: "595981556611",
  whatsappVisible: "+595 981 556611",
  whatsappTexto:
    "¡Hola! Me registré al Festival Soka por la Paz y quiero colaborar con víveres no perecederos. ¿Qué días y horarios puedo llevarlos al Centro Cultural?",
};
