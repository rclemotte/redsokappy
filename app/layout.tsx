import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RedSokappy",
  description: "Gestión de miembros y asistencia — Soka Gakkai del Paraguay",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#2a4d9b",
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
