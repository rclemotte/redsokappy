"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usuarioAEmail } from "@/lib/usuarios";
import AuthMarco from "@/components/AuthMarco";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function ingresar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const email = usuarioAEmail(usuario);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setCargando(false);
      setError("No pudimos ingresar. Revisá el usuario y la contraseña.");
      return;
    }

    // ¿Primer ingreso? -> a cambiar la contraseña.
    let destino = "/inicio";
    const uid = data.user?.id;
    if (uid) {
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("debe_cambiar_password")
        .eq("id", uid)
        .single();
      if (perfil?.debe_cambiar_password) destino = "/cambiar-password";
    }

    setCargando(false);
    router.push(destino);
    router.refresh();
  }

  return (
    <AuthMarco titulo="¡Bienvenido/a!" texto="El Tookan de la Soka Gakkai del Paraguay, siempre al día.">
      <form onSubmit={ingresar} className="space-y-4">
        <div>
          <label className="etiqueta">Usuario</label>
          <input
            type="text"
            required
            autoCapitalize="none"
            autoCorrect="off"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="campo"
            placeholder="Tu número de cédula"
          />
        </div>
        <div>
          <label className="etiqueta">Contraseña</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="campo"
            placeholder="••••••••"
          />
        </div>

        {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}

        <button type="submit" disabled={cargando} className="btn-sol w-full py-4 text-lg">
          {cargando ? "Ingresando…" : "Ingresar"}
        </button>

        <p className="text-center text-sm font-semibold text-tinta-suave">
          La primera vez, tu contraseña es tu número de cédula.
        </p>
      </form>
    </AuthMarco>
  );
}
