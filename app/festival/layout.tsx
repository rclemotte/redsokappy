import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Festival Soka por la Paz — Soka Gakkai Paraguay",
  description: "Registrate para participar del Festival Soka por la Paz · 25 de octubre.",
};

export const viewport: Viewport = { themeColor: "#f11579" };

// Fondo del Festival (arte oficial), fijo detrás del contenido.
// En celular ocupa toda la pantalla; en pantallas grandes queda una columna
// centrada y a los costados el magenta del arte.
export default function FestivalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f11579]">
      <div
        aria-hidden
        className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[520px] bg-[#f11579] bg-top bg-no-repeat shadow-2xl"
        style={{ backgroundImage: "url(/festival/fondo.webp)", backgroundSize: "100% auto" }}
      />
      <div className="relative mx-auto w-full max-w-[520px] min-h-screen">
        {/* Espacio para que se vea el logo y la fecha del arte */}
        <div style={{ height: "min(36vw, 188px)" }} />
        {children}
      </div>
    </div>
  );
}
