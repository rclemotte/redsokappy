import FichaPersona from "@/components/FichaPersona";

export const dynamic = "force-dynamic";

export default function FichaPage({ params }: { params: { id: string } }) {
  return <FichaPersona id={Number(params.id)} />;
}
