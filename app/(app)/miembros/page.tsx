import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MiembrosPage() {
  const supabase = createClient();

  const { data: miembros } = await supabase
    .from("personas")
    .select("id_persona, nombre, division, han(nombre)")
    .order("nombre", { ascending: true });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">
        Miembros{" "}
        <span className="text-sm font-normal text-gray-500">
          ({miembros?.length ?? 0})
        </span>
      </h1>

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {(miembros ?? []).map((m: any) => (
          <div key={m.id_persona} className="p-3">
            <div className="text-sm font-medium">{m.nombre}</div>
            <div className="text-xs text-gray-500">
              {m.division ?? "—"}
              {m.han?.nombre ? ` · Han ${m.han.nombre}` : ""}
            </div>
          </div>
        ))}
        {(!miembros || miembros.length === 0) && (
          <div className="p-3 text-sm text-gray-500">No hay miembros para mostrar.</div>
        )}
      </div>
    </div>
  );
}
