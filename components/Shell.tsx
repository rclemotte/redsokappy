"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  House, Users, CalendarCheck, ChartColumnBig, LayoutGrid, Ticket, Star, KeyRound, Settings, LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Decoracion } from "@/components/ui";

type Item = { href: string; label: string; Icon: any };

const PRINCIPALES: Item[] = [
  { href: "/inicio", label: "Inicio", Icon: House },
  { href: "/miembros", label: "Personas", Icon: Users },
  { href: "/asistencia", label: "Participación", Icon: CalendarCheck },
  { href: "/estadisticas", label: "Estadísticas", Icon: ChartColumnBig },
];

export function itemsExtra(esEditor: boolean, esAdmin: boolean): (Item & { desc: string })[] {
  const l: (Item & { desc: string })[] = [];
  if (esEditor) {
    l.push({ href: "/eventos", label: "Eventos", Icon: Ticket, desc: "Registros e ingreso a actividades" });
    l.push({ href: "/valoraciones", label: "Valoraciones", Icon: Star, desc: "Encuesta del Festival" });
    l.push({ href: "/usuarios", label: "Usuarios", Icon: KeyRound, desc: "Accesos a la app" });
  }
  if (esAdmin) l.push({ href: "/administracion", label: "Administración", Icon: Settings, desc: "Parámetros y cargos" });
  return l;
}

function activo(path: string, href: string) {
  return path === href || path.startsWith(href + "/");
}

export function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden>
        <path d="M20 2l4.2 8.6 9.2-3-2.9 9.2 8.5 4.2-8.5 4.2 2.9 9.2-9.2-3L20 38l-4.2-8.6-9.2 3 2.9-9.2L1 19l8.5-4.2-2.9-9.2 9.2 3z" fill={claro ? "#FFFFFF" : "#F11579"} />
        <circle cx="20" cy="20" r="7.5" fill={claro ? "#FF4A0A" : "#FFB127"} />
      </svg>
      <span className={`font-display text-[1.35rem] font-extrabold tracking-tight ${claro ? "text-white" : "text-tinta"}`}>
        RedSokappy
      </span>
    </div>
  );
}

export async function salir(router: ReturnType<typeof useRouter>) {
  await createClient().auth.signOut();
  router.push("/login");
  router.refresh();
}

export default function Shell({
  children,
  nombre,
  rol,
  esEditor,
  esAdmin,
}: {
  children: React.ReactNode;
  nombre: string;
  rol: string;
  esEditor: boolean;
  esAdmin: boolean;
}) {
  const path = usePathname();
  const router = useRouter();
  const extra = itemsExtra(esEditor, esAdmin);
  const masActivo = path === "/mas" || extra.some((e) => activo(path, e.href));

  return (
    <div className="min-h-screen lg:flex">
      {/* ---------- Barra lateral (computadora) ---------- */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col overflow-hidden bg-tinta px-4 py-6 text-white lg:flex">
        <div className="relative px-2">
          <Logo claro />
        </div>
        <nav className="mt-8 flex-1 space-y-1">
          {[...PRINCIPALES, ...extra].map(({ href, label, Icon }) => {
            const on = activo(path, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[15px] font-bold transition ${
                  on ? "bg-sol text-white shadow-[0_8px_20px_-8px_rgba(241,21,121,0.8)]" : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={20} strokeWidth={2.4} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="relative overflow-hidden rounded-3xl bg-white/5 p-4">
          <Decoracion className="opacity-40" />
          <div className="relative">
            <div className="truncate font-display text-lg font-bold">{nombre}</div>
            <div className="text-xs font-semibold text-white/60">{rol}</div>
            <button onClick={() => salir(router)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-white/80 hover:text-white">
              <LogOut size={16} /> Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      {/* ---------- Contenido ---------- */}
      <main className="pb-nav min-w-0 flex-1 px-4 pt-4 lg:px-8 lg:pb-10 lg:pt-8">
        <div className="mx-auto w-full max-w-2xl lg:max-w-6xl">{children}</div>
      </main>

      {/* ---------- Barra inferior (celular) ---------- */}
      <nav className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-30 flex rounded-[1.75rem] bg-white/95 p-1.5 shadow-flotante backdrop-blur lg:hidden">
        {[...PRINCIPALES, { href: "/mas", label: "Más", Icon: LayoutGrid }].map(({ href, label, Icon }) => {
          const on = href === "/mas" ? masActivo : activo(path, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-[1.35rem] py-2 text-[10.5px] font-extrabold transition ${
                on ? "bg-sol text-white" : "text-tinta-suave active:bg-marca-50"
              }`}
            >
              <Icon size={21} strokeWidth={on ? 2.6 : 2.2} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
