"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/inicio", label: "Inicio", icon: "🏠" },
  { href: "/miembros", label: "Miembros", icon: "👥" },
];

export default function NavInferior() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex">
      {items.map((it) => {
        const activo = path === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex-1 py-2.5 text-center text-xs ${
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
