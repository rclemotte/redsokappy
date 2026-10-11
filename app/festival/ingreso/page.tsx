import KioskoIngreso from "@/components/KioskoIngreso";

// Kiosko de confirmación de ingreso: pestañas de función siempre visibles
// (el voluntario elige la función). Link oficial: /festival/ingreso
export default function Page() {
  return <KioskoIngreso modo="pestanas" />;
}
