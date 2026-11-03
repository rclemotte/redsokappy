import { Suspense } from "react";
import EstadisticasClient from "@/components/EstadisticasClient";

export const dynamic = "force-dynamic";

export default function EstadisticasPage() {
  return (
    <Suspense>
      <EstadisticasClient />
    </Suspense>
  );
}
