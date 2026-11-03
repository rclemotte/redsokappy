import MemberForm from "@/components/MemberForm";

export const dynamic = "force-dynamic";

export default function EditarPersonaPage({ params }: { params: { id: string } }) {
  return <MemberForm id={Number(params.id)} />;
}
