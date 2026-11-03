// Aliento diario de la Soka Gakkai (sokaglobal.org), en español.
// Se lee de la página oficial del día y se guarda en caché unas horas.

export type Aliento = { fecha: string; texto: string; cita: string | null; url: string };

const MESES_EN = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MESES_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function hoyParaguay() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion", year: "numeric", month: "numeric", day: "numeric" })
    .formatToParts(new Date());
  const v = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { mes: v("month") - 1, dia: v("day") };
}

export function urlAliento() {
  const { mes, dia } = hoyParaguay();
  return {
    url: `${process.env.ALIENTO_BASE ?? "https://www.sokaglobal.org"}/es/resources/daily-encouragement/${MESES_EN[mes]}-${dia}.html`,
    fecha: `${dia} de ${MESES_ES[mes]}`,
  };
}

function decodificar(s: string) {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+)acute;/gi, (_, l) => ({ a: "á", e: "é", i: "í", o: "ó", u: "ú", A: "Á", E: "É", I: "Í", O: "Ó", U: "Ú" } as any)[l] ?? "")
    .replace(/&ntilde;/g, "ñ")
    .replace(/&Ntilde;/g, "Ñ")
    .replace(/&uuml;/g, "ü")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// El texto del día es el párrafo que está justo antes de la cita ("Adaptado de …").
export function extraerAliento(html: string): { texto: string; cita: string | null } | null {
  const cuerpo = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const porParrafos = Array.from(cuerpo.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((m) => decodificar(m[1]))
    .filter((t) => t.length > 0);
  // Por si el texto no está en <p>: se corta por cualquier bloque
  const porBloques = cuerpo
    .replace(/<\/(p|div|li|h[1-6]|section|article|blockquote|figure)>/gi, "\n\n")
    .split(/\n\s*\n/)
    .map((t) => decodificar(t).replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 0);
  return buscar(porParrafos) ?? buscar(porBloques);
}

function buscar(parrafos: string[]): { texto: string; cita: string | null } | null {
  const i = parrafos.findIndex((t) => /^(adaptado|traducido|extra[ií]do|tomado) de/i.test(t));
  if (i > 0) {
    // Puede haber más de un párrafo de texto: se toman los que siguen a la fecha
    const previos: string[] = [];
    for (let k = i - 1; k >= 0 && previos.length < 3; k--) {
      const t = parrafos[k];
      if (t.length < 25 || /^\d{1,2} de [a-z]+$/i.test(t)) break;
      previos.unshift(t);
    }
    if (previos.length) return { texto: previos.join("\n\n"), cita: parrafos[i] };
  }
  return null;
}

export async function alientoDeHoy(): Promise<Aliento | null> {
  const { url, fecha } = urlAliento();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      next: { revalidate: 60 * 60 * 6 },
      headers: { "User-Agent": "RedSokappy (app de la Soka Gakkai del Paraguay)" },
    });
    clearTimeout(t);
    if (!res.ok) return { fecha, texto: "", cita: null, url };
    const r = extraerAliento(await res.text());
    return { fecha, texto: r?.texto ?? "", cita: r?.cita ?? null, url };
  } catch {
    return { fecha, texto: "", cita: null, url };
  }
}
