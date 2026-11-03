import Link from "next/link";
import { CalendarPlus, UserPlus, TriangleAlert, ChevronRight, CalendarCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Decoracion, Kpi } from "@/components/ui";
import { DIVISIONES, ESTADOS, ORDEN_DIVISIONES, type ResumenHan } from "@/lib/tookan";

export const dynamic = "force-dynamic";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function saludo() {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Asuncion" }));
  return h < 12 ? "Buen día" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

export default async function InicioPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [perfilR, resumenR, mensualR, reunionesR] = await Promise.all([
    user ? supabase.from("perfiles").select("id_rol, personas(nombre)").eq("id", user.id).single() : Promise.resolve({ data: null }),
    supabase.from("vw_tookan_resumen_han").select("*"),
    supabase.from("vw_dash_asistencia_mensual").select("*"),
    supabase.from("vw_asistencia_por_evento").select("*").order("fecha_asistencia", { ascending: false }).limit(3),
  ]);

  const perfil: any = perfilR.data;
  const nombre = (perfil?.personas?.nombre ?? "").split(" ")[0] || "";
  const puedeEditar = [1, 3, 4].includes(Number(perfil?.id_rol));
  const filas = (resumenR.data ?? []) as ResumenHan[];

  const suma = (k: keyof ResumenHan) => filas.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const tot = {
    personas: suma("personas"),
    activos: suma("miembros_activos"),
    inactivos: suma("miembros_inactivos"),
    amigos: suma("amigos_soka"),
    nuevos: suma("nuevos_amigos"),
    gohonzon: suma("con_gohonzon"),
  };
  const cabildos = new Set(filas.map((r) => r.id_cabildo)).size;
  const hanes = filas.length;
  const div = ORDEN_DIVISIONES.map((d) => ({ d, n: suma(d.toLowerCase() as keyof ResumenHan) }));
  const totDiv = div.reduce((a, x) => a + x.n, 0) || 1;

  // Últimos 6 meses de participación
  const hoy = new Date();
  const mapa = new Map((mensualR.data ?? []).map((m: any) => [m.mes, Number(m.asistentes) || 0]));
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - 5 + i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { k, label: MESES[d.getMonth()], n: mapa.get(k) ?? 0 };
  });
  const maxMes = Math.max(1, ...meses.map((m) => m.n));
  const reuniones = (reunionesR.data ?? []) as any[];

  const fecha = hoy.toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Asuncion" });

  return (
    <div className="space-y-5">
      {/* ---------- Saludo ---------- */}
      <header className="relative -mx-4 -mt-4 overflow-hidden rounded-b-[2.25rem] bg-sol px-5 pb-20 pt-[calc(env(safe-area-inset-top)+1.5rem)] text-white lg:mx-0 lg:mt-0 lg:rounded-4xl lg:px-8 lg:pb-16 lg:pt-8">
        <Decoracion />
        <div className="relative">
          <p className="text-[15px] font-bold text-white/85">{fecha.charAt(0).toUpperCase() + fecha.slice(1)}</p>
          <h1 className="mt-0.5 font-display text-[2.2rem] font-extrabold leading-[1.05] drop-shadow-sm">
            {saludo()}{nombre ? `, ${nombre}` : ""}
          </h1>
          <p className="mt-1.5 max-w-md text-[15px] font-semibold text-white/90">
            {tot.personas > 0
              ? `${tot.personas.toLocaleString("es-PY")} personas en ${cabildos} cabildos y ${hanes} hanes.`
              : "Todavía no hay personas cargadas."}
          </p>
        </div>
      </header>

      {/* ---------- Números por estado ---------- */}
      <section className="-mt-16 grid grid-cols-2 gap-3 lg:-mt-12 lg:grid-cols-4">
        <Kpi valor={tot.activos} label="Miembros activos" color="text-estado-activo" punto={ESTADOS.MIEMBRO_ACTIVO.hex} href="/miembros?estado=MIEMBRO_ACTIVO" />
        <Kpi valor={tot.inactivos} label="Miembros inactivos" color="text-tinta-suave" punto={ESTADOS.MIEMBRO_INACTIVO.hex} href="/miembros?estado=MIEMBRO_INACTIVO" />
        <Kpi valor={tot.amigos} label="Amigos Soka" color="text-estado-amigo" punto={ESTADOS.AMIGO_SOKA.hex} href="/miembros?estado=AMIGO_SOKA" />
        <Kpi valor={tot.nuevos} label="Nuevos amigos" color="text-estado-nuevo" punto={ESTADOS.NUEVO_AMIGO.hex} href="/miembros?estado=NUEVO_AMIGO" />
      </section>

      {/* ---------- Acciones rápidas ---------- */}
      {puedeEditar && (
        <section className="grid grid-cols-2 gap-3 lg:max-w-xl">
          <Link href="/asistencia/nueva" className="btn-sol h-auto flex-col items-start rounded-3xl p-4 text-left">
            <CalendarPlus size={26} strokeWidth={2.4} />
            <span className="leading-tight">Registrar participación</span>
          </Link>
          <Link href="/miembros/nuevo" className="btn flex-col items-start rounded-3xl bg-white p-4 text-left text-tinta shadow-suave">
            <UserPlus size={26} strokeWidth={2.4} className="text-marca" />
            <span className="leading-tight">Nueva persona</span>
          </Link>
        </section>
      )}

      {tot.inactivos > 0 && (
        <Link href="/miembros?estado=MIEMBRO_INACTIVO" className="flex items-center gap-3 rounded-3xl bg-estado-amigoBg p-4 transition active:scale-[0.99]">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-estado-amigo">
            <TriangleAlert size={22} strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-extrabold">{tot.inactivos} miembros sin participar</div>
            <div className="text-sm font-semibold text-tinta-suave">Un llamado o una visita puede hacer la diferencia</div>
          </div>
          <ChevronRight className="text-estado-amigo" size={20} />
        </Link>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ---------- Participación ---------- */}
        <section className="card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="subtitulo">Participación</h2>
            <span className="text-xs font-bold text-tinta-tenue">últimos 6 meses</span>
          </div>
          <div className="mt-4 flex h-36 items-end gap-2.5">
            {meses.map((m, i) => (
              <div key={m.k} className="flex h-full flex-1 flex-col items-center gap-1.5">
                <span className="text-[11px] font-extrabold text-tinta-suave">{m.n || ""}</span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-xl ${i === meses.length - 1 ? "bg-sol" : "bg-marca-100"}`}
                    style={{ height: `${Math.max(6, (m.n / maxMes) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-tinta-tenue">{m.label}</span>
              </div>
            ))}
          </div>
          {meses.every((m) => m.n === 0) && (
            <p className="mt-3 text-center text-sm font-semibold text-tinta-suave">
              Cuando se registren reuniones, acá vas a ver cómo crece la participación.
            </p>
          )}
        </section>

        {/* ---------- Divisiones ---------- */}
        <section className="card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="subtitulo">Por división</h2>
            <span className="text-xs font-bold text-tinta-tenue">{tot.gohonzon.toLocaleString("es-PY")} con Gohonzon</span>
          </div>
          <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-marca-50">
            {div.map(({ d, n }) => (
              <div key={d} style={{ width: `${(n / totDiv) * 100}%`, background: DIVISIONES[d].hex }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2">
            {div.map(({ d, n }) => (
              <div key={d} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-bold text-tinta-suave">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: DIVISIONES[d].hex }} />
                  {d}
                </span>
                <span className="font-extrabold">{n.toLocaleString("es-PY")}</span>
              </div>
            ))}
          </div>
          <Link href="/estadisticas" className="mt-4 inline-flex items-center gap-1 text-sm font-extrabold text-marca">
            Ver todas las estadísticas <ChevronRight size={16} />
          </Link>
        </section>
      </div>

      {/* ---------- Últimas reuniones ---------- */}
      {reuniones.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h2 className="subtitulo">Últimas reuniones</h2>
            <Link href="/asistencia" className="text-sm font-extrabold text-marca">Ver todas</Link>
          </div>
          <div className="card divide-y divide-linea overflow-hidden">
            {reuniones.map((r) => (
              <Link key={r.id_asistencia} href={`/asistencia/${r.id_asistencia}`} className="flex items-center gap-3 p-4 active:bg-marca-50">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sol-suave text-marca">
                  <CalendarCheck size={22} strokeWidth={2.4} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{r.tipo_evento ?? "Reunión"}{r.han ? ` · ${r.han}` : ""}</div>
                  <div className="text-sm text-tinta-suave">
                    {r.fecha_asistencia ? new Date(String(r.fecha_asistencia).slice(0, 10) + "T12:00:00").toLocaleDateString("es-PY", { weekday: "short", day: "numeric", month: "short" }) : ""}
                  </div>
                </div>
                <span className="rounded-full bg-marca-50 px-3 py-1 text-sm font-extrabold text-marca">{r.asistentes}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
