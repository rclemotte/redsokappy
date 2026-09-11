"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/inicio", label: "Inicio", icon: "🏠" },
  { href: "/miembros", label: "Miembros", icon: "👥" },
  { href: "/asistencia", label: "Asistencia", icon: "📝" },
];

export default function NavInferior() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex z-10">
      {items.map((it) => {
        const activo = path === it.href || path.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex-1 py-2 text-center text-xs ${
              activo ? "text-marca font-semibold" : "text-gray-500"
            }`}
          >
            <div className="text-lg leading-none">{it.icon}</div>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
