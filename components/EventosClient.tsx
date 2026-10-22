"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type ResumenEvento, fechaCorta, lugaresLibres } from "@/lib/festival";

type Registro = {
  id_registro: number;
  cedula: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  es_miembro: boolean;
  es_staff: boolean;
  creado_en: string;
};

type Ingreso = {
  id_ingreso: number;
  cedula: string;
  ingresado_en: string;
  id_registro: number | null;
  fest_registro: { nombre: string; apellido: string; es_miembro: boolean } | null;
};

type EventoForm = {
  id_evento?: number;
  nombre: string;
  fecha: string;
  hora: string;
  lugar: string;
  cupo: string;
  activo: boolean;
};

const num = (v: unknown) => Number(v ?? 0);
const hora = (ts: string) => new Date(ts).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" });

export default function EventosClient() {
  const supabase = useMemo(() => createClient(), []);

  const [resumen, setResumen] = useState<ResumenEvento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [enVivo, setEnVivo] = useState(false);
  const [ultimo, setUltimo] = useState<Date | null>(null);

  const [sel, setSel] = useState<number | null>(null);
  const [tab, setTab] = useState<"registros" | "ingresos">("registros");
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [q, setQ] = useState("");

  const [form, setForm] = useState<EventoForm | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const selRef = useRef<number | null>(null);
  selRef.current = sel;

  const cargarResumen = useCallback(async () => {
    const { data } = await supabase.rpc("fest_resumen");
    const rows = ((data as any[]) ?? []).map((r) => ({
      ...r,
      registrados: num(r.registrados),
      reg_miembros: num(r.reg_miembros),
      reg_staff: num(r.reg_staff),
      ing_staff: num(r.ing_staff),
      reg_no_miembros: num(r.reg_no_miembros),
      ingresados: num(r.ingresados),
      ing_registrados: num(r.ing_registrados),
      ing_sin_registro: num(r.ing_sin_registro),
      ing_miembros: num(r.ing_miembros),
    })) as ResumenEvento[];
    setResumen(rows);
    setCargando(false);
    setSel((s) => s ?? rows[0]?.id_evento ?? null);
  }, [supabase]);

  const cargarDetalle = useCallback(
    async (id: number | null) => {
      if (!id) return;
      const [r, i] = await Promise.all([
        supabase
          .from("fest_registro")
          .select("id_registro, cedula, nombre, apellido, telefono, es_miembro, es_staff, creado_en")
          .eq("id_evento", id)
          .order("creado_en", { ascending: false }),
        supabase
          .from("fest_ingreso")
          .select("id_ingreso, cedula, ingresado_en, id_registro, fest_registro(nombre, apellido, es_miembro)")
          .eq("id_evento", id)
          .order("ingresado_en", { ascending: false }),
      ]);
      setRegistros((r.data as any) ?? []);
      setIngresos((i.data as any) ?? []);
    },
    [supabase]
  );

  // Carga inicial + suscripción en tiempo real
  useEffect(() => {
    cargarResumen();
    let t: ReturnType<typeof setTimeout> | null = null;
    const refrescar = () => {
      setUltimo(new Date());
      if (t) clearTimeout(t);
      // Agrupa ráfagas (ej. mucha gente entrando a la vez) en un solo refresco
      t = setTimeout(() => {
        cargarResumen();
        cargarDetalle(selRef.current);
      }, 700);
    };
    const canal = supabase
      .channel("festival-panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "fest_registro" }, refrescar)
      .on("postgres_changes", { event: "*", schema: "public", table: "fest_ingreso" }, refrescar)
      .subscribe((status) => setEnVivo(status === "SUBSCRIBED"));
    return () => {
      if (t) clearTimeout(t);
      supabase.removeChannel(canal);
    };
  }, [supabase, cargarResumen, cargarDetalle]);

  useEffect(() => {
    cargarDetalle(sel);
    setQ("");
  }, [sel, cargarDetalle]);

  const evento = resumen.find((e) => e.id_evento === sel);

  const totales = useMemo(
    () => ({
      // Personas: el comité / staff está en todas las funciones, cuenta una sola vez
      registros:
        resumen.reduce((a, e) => a + e.registrados - e.reg_staff, 0) +
        Math.max(0, ...resumen.map((e) => e.reg_staff)),
      ingresos: resumen.reduce((a, e) => a + e.ingresados, 0),
    }),
    [resumen]
  );

  const filtroTxt = q.trim().toLowerCase();
  const regFiltrados = useMemo(
    () =>
      !filtroTxt
        ? registros
        : registros.filter((r) => `${r.nombre} ${r.apellido} ${r.cedula}`.toLowerCase().includes(filtroTxt)),
    [registros, filtroTxt]
  );
  const ingFiltrados = useMemo(
    () =>
      !filtroTxt
        ? ingresos
        : ingresos.filter((i) =>
            `${i.fest_registro?.nombre ?? ""} ${i.fest_registro?.apellido ?? ""} ${i.cedula}`
              .toLowerCase()
              .includes(filtroTxt)
          ),
    [ingresos, filtroTxt]
  );

  async function copiar(texto: string, clave: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(clave);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      window.prompt("Copiá el link:", texto);
    }
  }

  async function guardarEvento() {
    if (!form) return;
    setErr(null);
    if (!form.nombre.trim()) return setErr("El nombre es obligatorio.");
    const payload = {
      nombre: form.nombre.trim(),
      fecha: form.fecha || null,
      hora: form.hora.trim() || null,
      lugar: form.lugar.trim() || null,
      cupo: form.cupo === "" ? null : Math.max(0, Number(form.cupo)),
      activo: form.activo,
    };
    setGuardando(true);
    const { error } = form.id_evento
      ? await supabase.from("fest_evento").update(payload).eq("id_evento", form.id_evento)
      : await supabase.from("fest_evento").insert(payload);
    setGuardando(false);
    if (error) return setErr(error.message);
    setForm(null);
    cargarResumen();
  }

  async function anularIngreso(i: Ingreso) {
    if (!confirm(`¿Anular el ingreso de la cédula ${i.cedula}?`)) return;
    await supabase.from("fest_ingreso").delete().eq("id_ingreso", i.id_ingreso);
    cargarResumen();
    cargarDetalle(sel);
  }

  // Listado único de registrados (una fila por persona; el staff figura una vez con "Ambas").
  // Sin acentos en encabezados ni textos, para que se lea bien en cualquier Excel.
  const [bajandoListado, setBajandoListado] = useState(false);
  async function exportarListado() {
    setBajandoListado(true);
    try {
      const sinAcentos = (v: string | null | undefined) =>
        (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      // Supabase devuelve hasta 1000 filas por pedido: se trae por páginas
      type Fila = {
        cedula: string; nombre: string; apellido: string; telefono: string | null;
        es_miembro: boolean; es_staff: boolean; creado_en: string; id_evento: number;
      };
      const filas: Fila[] = [];
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await supabase
          .from("fest_registro")
          .select("cedula, nombre, apellido, telefono, es_miembro, es_staff, creado_en, id_evento")
          .order("id_registro")
          .range(desde, desde + 999);
        if (error) throw error;
        filas.push(...((data as Fila[]) ?? []));
        if (!data || data.length < 1000) break;
      }
      const nombreEvento = new Map(resumen.map((e) => [e.id_evento, e.nombre]));

      // Agrupar por persona (igual que el select: cedula + nombre + apellido + telefono + miembro)
      const grupos = new Map<string, { f: Fila; staff: boolean; eventos: number[]; desde: string }>();
      for (const f of filas) {
        const k = [f.cedula, f.nombre, f.apellido, f.telefono, f.es_miembro].join("|");
        const g = grupos.get(k);
        if (!g) grupos.set(k, { f, staff: f.es_staff, eventos: [f.id_evento], desde: f.creado_en });
        else {
          g.staff = g.staff || f.es_staff;
          g.eventos.push(f.id_evento);
          if (f.creado_en < g.desde) g.desde = f.creado_en;
        }
      }

      const fmtFecha = (ts: string) =>
        new Date(ts).toLocaleString("es-PY", {
          timeZone: "America/Asuncion", day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit", hour12: false,
        }).replace(",", "");

      const filasExcel = Array.from(grupos.values())
        .sort(
          (a, b) =>
            Number(b.staff) - Number(a.staff) ||
            sinAcentos(a.f.apellido).localeCompare(sinAcentos(b.f.apellido)) ||
            sinAcentos(a.f.nombre).localeCompare(sinAcentos(b.f.nombre))
        )
        .map((g) => ({
          Cedula: g.f.cedula,
          Nombre: sinAcentos(g.f.nombre),
          Apellido: sinAcentos(g.f.apellido),
          Telefono: g.f.telefono ?? "",
          Miembro: g.f.es_miembro ? "Si" : "No",
          "Comite / staff": g.staff ? "Si" : "No",
          Funcion: g.staff
            ? "Ambas"
            : sinAcentos(
                [...g.eventos].sort((x, y) => x - y).map((id) => nombreEvento.get(id) ?? `Evento ${id}`).join(", ")
              ),
          "Registrado el": fmtFecha(g.desde),
        }));

      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(filasExcel);
      ws["!cols"] = [12, 18, 18, 16, 9, 14, 34, 17].map((wch) => ({ wch }));
      XLSX.utils.book_append_sheet(wb, ws, "Registrados");
      XLSX.writeFile(wb, `registrados_festival_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      alert("No se pudo generar el listado. Probá de nuevo.");
    } finally {
      setBajandoListado(false);
    }
  }

  async function exportar() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        resumen.map((e) => ({
          Evento: e.nombre,
          Fecha: e.fecha ?? "",
          Cupo: e.cupo ?? "",
          Registrados: e.registrados,
          "Registrados miembros": e.reg_miembros,
          "Registrados comité / staff": e.reg_staff,
          "Registrados no miembros": e.reg_no_miembros,
          Ingresaron: e.ingresados,
          "Ingresaron registrados": e.ing_registrados,
          "Ingresaron comité / staff": e.ing_staff,
          "Ingresaron sin registro": e.ing_sin_registro,
        }))
      ),
      "Resumen"
    );
    for (const e of resumen) {
      const [r, i] = await Promise.all([
        supabase
          .from("fest_registro")
          .select("cedula, nombre, apellido, telefono, es_miembro, es_staff, creado_en")
          .eq("id_evento", e.id_evento)
          .order("apellido"),
        supabase
          .from("fest_ingreso")
          .select("cedula, ingresado_en, fest_registro(nombre, apellido, es_miembro)")
          .eq("id_evento", e.id_evento)
          .order("ingresado_en"),
      ]);
      const corto = e.nombre.replace(/[\\/?*[\]:]/g, "").slice(0, 18);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          ((r.data as any[]) ?? []).map((x) => ({
            Cédula: x.cedula,
            Nombre: x.nombre,
            Apellido: x.apellido,
            Teléfono: x.telefono ?? "",
            Miembro: x.es_miembro ? "Sí" : "No",
            "Comité / staff": x.es_staff ? "Sí" : "No",
            "Registrado el": new Date(x.creado_en).toLocaleString("es-PY"),
          }))
        ),
        `Reg ${e.id_evento} ${corto}`.slice(0, 31)
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          ((i.data as any[]) ?? []).map((x) => ({
            Cédula: x.cedula,
            Nombre: x.fest_registro?.nombre ?? "",
            Apellido: x.fest_registro?.apellido ?? "",
            Registrado: x.fest_registro ? "Sí" : "No",
            Miembro: x.fest_registro ? (x.fest_registro.es_miembro ? "Sí" : "No") : "",
            Hora: new Date(x.ingresado_en).toLocaleString("es-PY"),
          }))
        ),
        `Ing ${e.id_evento} ${corto}`.slice(0, 31)
      );
    }
    XLSX.writeFile(wb, `festival_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (cargando) return <p className="text-gray-500">Cargando…</p>;

  const origen = typeof window !== "undefined" ? window.location.origin : "";
  const input = "w-full rounded-lg border border-gray-300 px-3 py-2";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Festival por la Paz</h1>
        <span className={`text-xs flex items-center gap-1 ${enVivo ? "text-green-700" : "text-gray-400"}`}>
          <span className={`h-2 w-2 rounded-full ${enVivo ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
          {enVivo ? "En vivo" : "Conectando…"}
          {ultimo && enVivo && <span className="text-gray-400"> · {hora(ultimo.toISOString())}</span>}
        </span>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <p className="text-xs text-gray-500">Personas registradas (todas las funciones)</p>
          <p className="text-3xl font-bold text-marca">{totales.registros}</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <p className="text-xs text-gray-500">Ingresos (todos los eventos)</p>
          <p className="text-3xl font-bold text-green-700">{totales.ingresos}</p>
        </div>
      </div>

      {/* Tarjeta por evento */}
      {resumen.map((e) => {
        // El comité / staff no ocupa butaca
        const publicoReg = e.registrados - e.reg_staff;
        const publicoSala = e.ingresados - e.ing_staff;
        const libresReg = lugaresLibres(e.cupo, publicoReg);
        const libresSala = lugaresLibres(e.cupo, publicoSala);
        const pct = (n: number) => (e.cupo ? Math.min(100, Math.round((n / e.cupo) * 100)) : 0);
        const activoSel = e.id_evento === sel;
        return (
          <div
            key={e.id_evento}
            onClick={() => setSel(e.id_evento)}
            className={`bg-white rounded-xl p-4 shadow-sm border-2 cursor-pointer ${
              activoSel ? "border-marca" : "border-transparent"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {e.nombre} {!e.activo && <span className="text-xs text-gray-400">(cerrado)</span>}
                </p>
                <p className="text-xs text-gray-500">
                  {[fechaCorta(e.fecha), e.hora, e.lugar, e.cupo != null ? `cupo ${e.cupo}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <button
                onClick={(ev) => {
                  ev.stopPropagation();
                  setErr(null);
                  setForm({
                    id_evento: e.id_evento,
                    nombre: e.nombre,
                    fecha: e.fecha ?? "",
                    hora: e.hora ?? "",
                    lugar: e.lugar ?? "",
                    cupo: e.cupo == null ? "" : String(e.cupo),
                    activo: e.activo,
                  });
                }}
                className="text-xs text-marca"
              >
                Editar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <p className="text-xs text-gray-500">Registrados</p>
                <p className="text-2xl font-bold">{e.registrados}</p>
                <p className="text-xs text-gray-500">
                  {e.reg_miembros} miembros · {e.reg_no_miembros} no miembros · {e.reg_staff} staff (sin butaca)
                </p>
                {e.cupo != null && (
                  <>
                    <div className="h-2 bg-gray-100 rounded mt-2">
                      <div className="h-2 bg-marca rounded" style={{ width: `${pct(publicoReg)}%` }} />
                    </div>
                    <p className="text-xs mt-1">
                      <b>{libresReg}</b> lugares libres
                    </p>
                  </>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">Ingresaron</p>
                <p className="text-2xl font-bold text-green-700">{e.ingresados}</p>
                <p className="text-xs text-gray-500">
                  {e.ing_registrados} con registro · {e.ing_sin_registro} sin registro (espera) · {e.ing_staff} staff
                </p>
                {e.cupo != null && (
                  <>
                    <div className="h-2 bg-gray-100 rounded mt-2">
                      <div className="h-2 bg-green-600 rounded" style={{ width: `${pct(publicoSala)}%` }} />
                    </div>
                    <p className="text-xs mt-1">
                      <b>{libresSala}</b> lugares libres en sala
                    </p>
                  </>
                )}
              </div>
            </div>
            {e.registrados > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Asistencia de registrados: <b>{Math.round((e.ing_registrados / e.registrados) * 100)}%</b>
              </p>
            )}
          </div>
        );
      })}

      {/* Links y acciones */}
      <div className="bg-white rounded-xl p-4 shadow-sm space-y-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span>Link de registro público</span>
          <button className="text-marca font-semibold" onClick={() => copiar(`${origen}/festival`, "reg")}>
            {copiado === "reg" ? "¡Copiado!" : "Copiar"}
          </button>
        </div>
        {evento && (
          <div className="flex items-center justify-between gap-2">
            <span>Kiosko de confirmación de ingreso (un solo link)</span>
            <span className="flex gap-3">
              <button
                className="text-marca font-semibold"
                onClick={() => copiar(`${origen}/festival/ingreso`, "kio")}
              >
                {copiado === "kio" ? "¡Copiado!" : "Copiar"}
              </button>
              <a className="text-marca font-semibold" href="/festival/ingreso" target="_blank">
                Abrir
              </a>
            </span>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button onClick={exportar} className="flex-1 rounded-lg border border-marca text-marca py-2 font-medium">
            Exportar Excel
          </button>
          <button
            onClick={exportarListado}
            disabled={bajandoListado}
            className="flex-1 rounded-lg border border-marca text-marca py-2 font-medium disabled:opacity-60"
          >
            {bajandoListado ? "Generando…" : "Listado de registrados"}
          </button>
          <button
            onClick={() => {
              setErr(null);
              setForm({ nombre: "", fecha: "", hora: "", lugar: "", cupo: "", activo: true });
            }}
            className="flex-1 rounded-lg bg-marca text-white py-2 font-medium"
          >
            + Nuevo evento
          </button>
        </div>
      </div>

      {/* Detalle del evento seleccionado */}
      {evento && (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="flex border-b">
            {(["registros", "ingresos"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-sm font-medium ${
                  tab === t ? "text-marca border-b-2 border-marca" : "text-gray-500"
                }`}
              >
                {t === "registros" ? `Registrados (${registros.length})` : `Ingresos (${ingresos.length})`}
              </button>
            ))}
          </div>
          <div className="p-3">
            <input
              className={input}
              placeholder="Buscar por nombre o cédula…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <ul className="divide-y mt-2 max-h-[60vh] overflow-auto">
              {tab === "registros" &&
                regFiltrados.map((r) => (
                  <li key={r.id_registro} className="py-2 text-sm flex justify-between gap-2">
                    <span>
                      <span className="font-medium">
                        {r.apellido}, {r.nombre}
                      </span>
                      <span className="block text-xs text-gray-500">
                        CI {r.cedula}
                        {r.telefono ? ` · ${r.telefono}` : ""}
                        {r.es_miembro ? " · miembro" : ""}
                        {r.es_staff ? " · staff" : ""}
                      </span>
                    </span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(r.creado_en).toLocaleDateString("es-PY")}
                    </span>
                  </li>
                ))}
              {tab === "ingresos" &&
                ingFiltrados.map((i) => (
                  <li key={i.id_ingreso} className="py-2 text-sm flex justify-between gap-2">
                    <span>
                      <span className="font-medium">
                        {i.fest_registro
                          ? `${i.fest_registro.apellido}, ${i.fest_registro.nombre}`
                          : "Sin registro previo"}
                      </span>
                      <span className="block text-xs text-gray-500">CI {i.cedula}</span>
                    </span>
                    <span className="text-right whitespace-nowrap">
                      <span className="block text-xs text-gray-500">{hora(i.ingresado_en)}</span>
                      <button onClick={() => anularIngreso(i)} className="text-xs text-red-500">
                        Anular
                      </button>
                    </span>
                  </li>
                ))}
              {((tab === "registros" && regFiltrados.length === 0) ||
                (tab === "ingresos" && ingFiltrados.length === 0)) && (
                <li className="py-6 text-center text-sm text-gray-400">Sin datos todavía.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Modal alta/edición de evento */}
      {form && (
        <div className="fixed inset-0 bg-black/40 z-20 flex items-end sm:items-center justify-center" onClick={() => setForm(null)}>
          <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">{form.id_evento ? "Editar evento" : "Nuevo evento"}</h2>
            <label className="block text-sm">
              Nombre
              <input className={input} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Fecha
                <input type="date" className={input} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              </label>
              <label className="block text-sm">
                Hora
                <input className={input} placeholder="18:00" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
              </label>
            </div>
            <label className="block text-sm">
              Lugar
              <input className={input} value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })} />
            </label>
            <label className="block text-sm">
              Cupo (lugares)
              <input
                inputMode="numeric"
                className={input}
                value={form.cupo}
                onChange={(e) => setForm({ ...form, cupo: e.target.value.replace(/\D/g, "") })}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
              Activo (visible en el registro y el kiosko)
            </label>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setForm(null)} className="flex-1 rounded-lg border py-2">
                Cancelar
              </button>
              <button onClick={guardarEvento} disabled={guardando} className="flex-1 rounded-lg bg-marca text-white py-2 disabled:opacity-60">
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
