"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usuarioAEmail } from "@/lib/usuarios";

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
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-marca flex items-center justify-center text-white text-2xl font-bold">
            R
          </div>
          <h1 className="text-xl font-semibold">RedSokappy</h1>
          <p className="text-sm text-gray-500">Soka Gakkai del Paraguay</p>
        </div>

        <form onSubmit={ingresar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Usuario</label>
            <input
              type="text"
              required
              autoCapitalize="none"
              autoCorrect="off"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-marca"
              placeholder="Número de cédula"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-marca"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-lg bg-marca text-white py-2.5 font-medium active:bg-marca-dark disabled:opacity-60"
          >
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>

          <p className="text-xs text-gray-400 text-center">
            La primera vez, tu contraseña es tu número de cédula.
          </p>
        </form>
      </div>
    </main>
  );
}
