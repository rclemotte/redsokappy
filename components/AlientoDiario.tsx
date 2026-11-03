import AlientoCard from "@/components/AlientoCard";
import { alientoDeHoy } from "@/lib/aliento";

// Carga el aliento del día en el servidor (con caché) y lo muestra.
export default async function AlientoDiario() {
  const a = await alientoDeHoy();
  if (!a) return null;
  return <AlientoCard aliento={a} />;
}

export function AlientoCargando() {
  return <div className="h-56 animate-pulse rounded-[1.75rem] bg-white shadow-suave" />;
}
