import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Festival Soka por la Paz — Soka Gakkai Paraguay",
  description: "Registrate para participar del Festival Soka por la Paz.",
};

export default function FestivalLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gradient-to-b from-marca to-marca-dark">{children}</div>;
}
