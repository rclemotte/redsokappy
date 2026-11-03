"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthMarco from "@/components/AuthMarco";

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
    <AuthMarco titulo="Tu contraseña" texto="Elegí una contraseña nueva para tu cuenta. Solo vos la vas a saber.">
      <form onSubmit={guardar} className="space-y-4">
        <div>
          <label className="etiqueta">Nueva contraseña</label>
          <input type="password" required value={p1} onChange={(e) => setP1(e.target.value)} className="campo" placeholder="Mínimo 6 caracteres" />
        </div>
        <div>
          <label className="etiqueta">Repetir contraseña</label>
          <input type="password" required value={p2} onChange={(e) => setP2(e.target.value)} className="campo" placeholder="••••••••" />
        </div>

        {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}

        <button type="submit" disabled={guardando} className="btn-sol w-full py-4 text-lg">
          {guardando ? "Guardando…" : "Guardar y continuar"}
        </button>
      </form>
    </AuthMarco>
  );
}
