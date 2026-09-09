import LogoutButton from "@/components/LogoutButton";
import NavInferior from "@/components/NavInferior";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-10 bg-marca text-white px-4 py-3 flex items-center justify-between">
        <span className="font-semibold">RedSokappy</span>
        <LogoutButton />
      </header>
      <main className="p-4 max-w-2xl mx-auto">{children}</main>
      <NavInferior />
    </div>
  );
}
