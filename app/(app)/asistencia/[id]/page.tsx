import ReunionForm from "@/components/ReunionForm";

export const dynamic = "force-dynamic";

export default function ReunionPage({ params }: { params: { id: string } }) {
  return <ReunionForm id={Number(params.id)} />;
}
