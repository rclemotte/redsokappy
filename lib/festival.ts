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
  reg_staff: number;
  ing_staff: number;
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
  return (mas ? "+" : "") + v.replace(/\D/g, "").slice(0, 15);
}

// Mismo criterio que la base:
//  * Paraguay: 0981 123456, 981123456, +595 981 123456
//  * Exterior: "+" + código de país, 8 a 15 dígitos (ej. +54 9 3718 518121)
export function telefonoValido(v: string) {
  let d = v.replace(/\D/g, "");
  if (v.trim().startsWith("+") && !d.startsWith("595")) return d.length >= 8 && d.length <= 15;
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

// Inicio de un evento como Date (hora de Paraguay, UTC-3). null si falta fecha u hora.
export function inicioEvento(ev: { fecha: string | null; hora: string | null }) {
  if (!ev.fecha || !ev.hora) return null;
  const m = ev.hora.match(/(\d{1,2})[:.h]?(\d{2})?/);
  if (!m) return null;
  const hh = m[1].padStart(2, "0");
  const mm = (m[2] ?? "00").padStart(2, "0");
  const d = new Date(`${ev.fecha}T${hh}:${mm}:00-03:00`);
  return isNaN(d.getTime()) ? null : d;
}

// Kiosko automático: qué función se está confirmando ahora.
// Cada función "manda" desde la mitad del tiempo entre su inicio y el de la
// anterior (ej. 16:00 y 18:00 → cambia a la 2ª a las 17:00).
// Antes de la primera → la primera; después de la última → la última.
// Devuelve null si alguna función no tiene fecha y hora cargadas.
export function eventoSegunHora<T extends { id_evento: number; fecha: string | null; hora: string | null }>(
  eventos: T[],
  ahora = new Date()
): T | null {
  const conHora = eventos.map((e) => ({ e, t: inicioEvento(e) }));
  if (conHora.length === 0 || conHora.some((x) => !x.t)) return null;
  const orden = conHora.sort((a, b) => a.t!.getTime() - b.t!.getTime());
  let elegido = orden[0].e;
  for (let i = 1; i < orden.length; i++) {
    const corte = (orden[i - 1].t!.getTime() + orden[i].t!.getTime()) / 2;
    if (ahora.getTime() >= corte) elegido = orden[i].e;
  }
  return elegido;
}
