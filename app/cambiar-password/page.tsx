"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CambiarPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (p1.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (p1 !== p2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setGuardando(true);

    const { error: eUpd } = await supabase.auth.updateUser({ password: p1 });
    if (eUpd) {
      setGuardando(false);
      setError("No se pudo cambiar la contraseña. " + eUpd.message);
      return;
    }
    // Marca que ya cambió la clave (función segura del lado del servidor).
    await supabase.rpc("marcar_password_cambiado");

    setGuardando(false);
    router.push("/inicio");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6">
        <div className="text-center mb-5">
          <h1 className="text-xl font-semibold">Cambiá tu contraseña</h1>
          <p className="text-sm text-gray-500 mt-1">
            Es tu primer ingreso. Elegí una contraseña nueva para tu cuenta.
          </p>
        </div>

        <form onSubmit={guardar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
            <input
              type="password"
              required
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-marca"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Repetir contraseña</label>
            <input
              type="password"
              required
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-marca"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={guardando}
            className="w-full rounded-lg bg-marca text-white py-2.5 font-medium disabled:opacity-60"
          >
            {guardando ? "Guardando..." : "Guardar y continuar"}
          </button>
        </form>
      </div>
    </main>
  );
}
