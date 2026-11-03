"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, LogOut, KeyRound } from "lucide-react";
import { Avatar, Cabecera } from "@/components/ui";
import { itemsExtra, salir } from "@/components/Shell";

export default function MasClient({ nombre, esEditor, esAdmin }: { nombre: string; esEditor: boolean; esAdmin: boolean }) {
  const router = useRouter();
  const items = itemsExtra(esEditor, esAdmin);

  return (
    <div className="space-y-5">
      <Cabecera titulo="Más opciones">
        <div className="flex items-center gap-3 rounded-3xl bg-white/15 p-3 backdrop-blur-sm">
          <Avatar nombre={nombre || "?"} size={48} />
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-bold">{nombre}</div>
            <div className="text-sm font-semibold text-white/85">Tu cuenta</div>
          </div>
        </div>
      </Cabecera>

      {items.length > 0 && (
        <div className="card divide-y divide-linea overflow-hidden">
          {items.map(({ href, label, desc, Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-4 p-4 transition active:bg-marca-50">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sol-suave text-marca">
                <Icon size={22} strokeWidth={2.4} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold">{label}</div>
                <div className="text-sm text-tinta-suave">{desc}</div>
              </div>
              <ChevronRight className="text-tinta-tenue" size={20} />
            </Link>
          ))}
        </div>
      )}

      <div className="card divide-y divide-linea overflow-hidden">
        <Link href="/cambiar-password" className="flex items-center gap-4 p-4 transition active:bg-marca-50">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-marca-50 text-marca">
            <KeyRound size={22} strokeWidth={2.4} />
          </div>
          <div className="flex-1 font-bold">Cambiar contraseña</div>
          <ChevronRight className="text-tinta-tenue" size={20} />
        </Link>
        <button onClick={() => salir(router)} className="flex w-full items-center gap-4 p-4 text-left transition active:bg-marca-50">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 text-tinta-suave">
            <LogOut size={22} strokeWidth={2.4} />
          </div>
          <div className="flex-1 font-bold">Cerrar sesión</div>
        </button>
      </div>

      <p className="pb-2 text-center text-xs font-semibold text-tinta-tenue">RedSokappy · Soka Gakkai del Paraguay</p>
    </div>
  );
}
