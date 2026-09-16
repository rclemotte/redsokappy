import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import NavInferior from "@/components/NavInferior";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let esEditor = false;
  if (user) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("id_rol, debe_cambiar_password")
      .eq("id", user.id)
      .single();

    // Primer ingreso: obligar a cambiar la contraseña.
    if (perfil?.debe_cambiar_password) {
      redirect("/cambiar-password");
    }
    esEditor = perfil ? [1, 3].includes(Number(perfil.id_rol)) : false;
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-10 bg-marca text-white px-4 py-3 flex items-center justify-between">
        <span className="font-semibold">RedSokappy</span>
        <LogoutButton />
      </header>
      <main className="p-4 max-w-2xl mx-auto">{children}</main>
      <NavInferior esEditor={esEditor} />
    </div>
  );
}
