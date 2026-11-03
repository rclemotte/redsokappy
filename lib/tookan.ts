// Tipos y utilidades del Tookan (estados, divisiones, carga de datos).

export type Estado = "NUEVO_AMIGO" | "AMIGO_SOKA" | "MIEMBRO_ACTIVO" | "MIEMBRO_INACTIVO";

export const ESTADOS: Record<Estado, { label: string; corto: string; color: string; bg: string; hex: string }> = {
  MIEMBRO_ACTIVO: { label: "Miembro activo", corto: "Activo", color: "text-estado-activo", bg: "bg-estado-activoBg", hex: "#12945F" },
  MIEMBRO_INACTIVO: { label: "Miembro inactivo", corto: "Inactivo", color: "text-estado-inactivo", bg: "bg-estado-inactivoBg", hex: "#9C8FA2" },
  AMIGO_SOKA: { label: "Amigo Soka", corto: "Amigo Soka", color: "text-estado-amigo", bg: "bg-estado-amigoBg", hex: "#FF6A2B" },
  NUEVO_AMIGO: { label: "Nuevo amigo", corto: "Nuevo amigo", color: "text-estado-nuevo", bg: "bg-estado-nuevoBg", hex: "#FFB127" },
};
export const ORDEN_ESTADOS: Estado[] = ["MIEMBRO_ACTIVO", "MIEMBRO_INACTIVO", "AMIGO_SOKA", "NUEVO_AMIGO"];

export const DIVISIONES: Record<string, { label: string; hex: string }> = {
  DS: { label: "División de Señores", hex: "#7A2E8E" },
  DF: { label: "División Femenina", hex: "#F11579" },
  DJM: { label: "División Juvenil Masculina", hex: "#FF4A0A" },
  DJF: { label: "División Juvenil Femenina", hex: "#FFB127" },
  GE: { label: "Grupo Esperanza", hex: "#2BB3A3" },
};
export const ORDEN_DIVISIONES = ["DS", "DF", "DJM", "DJF", "GE"];

export const MOTIVOS_BAJA: Record<string, string> = {
  FALLECIDO: "Fallecido/a",
  EXTERIOR: "Reside en el exterior",
  TRASLADO: "Trasladado/a a otra zona",
  DEVOLVIO_GOHONZON: "Devolvió el Gohonzon",
  NO_UBICADO: "No ubicado/a",
  OTRO: "Otro motivo",
};

// Ficha (vista vw_personas_tookan)
export type PersonaTookan = {
  id_persona: number;
  nombre: string;
  apellido: string | null;
  nombre_completo: string;
  division: string | null;
  estado: Estado | null;
  membresia: boolean;
  gohonzon: boolean;
  activo: boolean;
  motivo_baja: string | null;
  telefono: string | null;
  cedula: string | null;
  fecha_nacimiento: string | null;
  fecha_ingreso: string | null;
  participaciones: number;
  ultima_participacion: string | null;
  id_han: number | null;
  han: string | null;
  distrito: string | null;
  cabildo: string | null;
  region: string | null;
  cargos_vigentes: string | null;
  shakubuku: number;
  observacion: string | null;
};

// Resumen por han (vista vw_tookan_resumen_han)
export type ResumenHan = {
  id_region: number; region: string;
  id_cabildo: number; cabildo: string;
  id_distrito: number; distrito: string;
  id_han: number; han: string;
  personas: number; miembros_activos: number; miembros_inactivos: number;
  amigos_soka: number; nuevos_amigos: number; con_gohonzon: number;
  ds: number; df: number; djm: number; djf: number; ge: number;
  bajas: number;
};

// PostgREST devuelve como máximo 1000 filas por pedido: trae todo por partes.
export async function traerTodo<T>(armar: (desde: number, hasta: number) => any, tam = 1000): Promise<T[]> {
  const todo: T[] = [];
  for (let desde = 0; ; desde += tam) {
    const { data, error } = await armar(desde, desde + tam - 1);
    if (error) throw error;
    todo.push(...((data as T[]) ?? []));
    if (!data || data.length < tam) break;
  }
  return todo;
}

// Iniciales para el avatar
export function iniciales(nombre: string) {
  const p = (nombre || "").replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length > 2 ? 1 : p.length - 1][0]).toUpperCase();
}

// Color estable por nombre (paleta del festival)
const AVATARES = ["#F11579", "#FF4A0A", "#E9A100", "#7A2E8E", "#2BB3A3", "#C2185B", "#E8590C", "#5C6BC0"];
export function colorAvatar(nombre: string) {
  let h = 0;
  for (const c of nombre || "") h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATARES[h % AVATARES.length];
}

// Sin acentos y en minúscula, para buscar
export function normalizar(s: string) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function fechaCorta(f: string | null) {
  if (!f) return "";
  const d = new Date(f.length <= 10 ? f + "T12:00:00" : f);
  return d.toLocaleDateString("es-PY", { day: "numeric", month: "short", year: "numeric" });
}
