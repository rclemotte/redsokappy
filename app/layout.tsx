import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RedSokappy",
  description: "Gestión de miembros y asistencia — Soka Gakkai del Paraguay",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#F11579",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
