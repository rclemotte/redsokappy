"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type ResumenEvento, fechaCorta, lugaresLibres } from "@/lib/festival";

type Registro = {
  id_registro: number;
  cedula: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string | null;
  es_miembro: boolean;
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
          .select("id_registro, cedula, nombre, apellido, fecha_nacimiento, es_miembro, creado_en")
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
      registros: resumen.reduce((a, e) => a + e.registrados, 0),
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
          "Registrados no miembros": e.reg_no_miembros,
          Ingresaron: e.ingresados,
          "Ingresaron registrados": e.ing_registrados,
          "Ingresaron sin registro": e.ing_sin_registro,
        }))
      ),
      "Resumen"
    );
    for (const e of resumen) {
      const [r, i] = await Promise.all([
        supabase
          .from("fest_registro")
          .select("cedula, nombre, apellido, fecha_nacimiento, es_miembro, creado_en")
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
            "Fecha nac.": x.fecha_nacimiento ?? "",
            Miembro: x.es_miembro ? "Sí" : "No",
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
          <p className="text-xs text-gray-500">Registros (todos los eventos)</p>
          <p className="text-3xl font-bold text-marca">{totales.registros}</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <p className="text-xs text-gray-500">Ingresos (todos los eventos)</p>
          <p className="text-3xl font-bold text-green-700">{totales.ingresos}</p>
        </div>
      </div>

      {/* Tarjeta por evento */}
      {resumen.map((e) => {
        const libresReg = lugaresLibres(e.cupo, e.registrados);
        const libresSala = lugaresLibres(e.cupo, e.ingresados);
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
                  {e.reg_miembros} miembros · {e.reg_no_miembros} no miembros
                </p>
                {e.cupo != null && (
                  <>
                    <div className="h-2 bg-gray-100 rounded mt-2">
                      <div className="h-2 bg-marca rounded" style={{ width: `${pct(e.registrados)}%` }} />
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
                  {e.ing_registrados} registrados · {e.ing_sin_registro} sin registro
                </p>
                {e.cupo != null && (
                  <>
                    <div className="h-2 bg-gray-100 rounded mt-2">
                      <div className="h-2 bg-green-600 rounded" style={{ width: `${pct(e.ingresados)}%` }} />
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
            <span>Kiosko de ingreso — {evento.nombre}</span>
            <span className="flex gap-3">
              <button
                className="text-marca font-semibold"
                onClick={() => copiar(`${origen}/festival/ingreso?evento=${evento.id_evento}`, "kio")}
              >
                {copiado === "kio" ? "¡Copiado!" : "Copiar"}
              </button>
              <a className="text-marca font-semibold" href={`/festival/ingreso?evento=${evento.id_evento}`} target="_blank">
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
                        {r.es_miembro ? " · miembro" : ""}
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
