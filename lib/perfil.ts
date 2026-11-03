// Datos del usuario logueado: nombre, rol y ámbito (qué parte de la SGPy ve).
export type MiPerfil = {
  nombre: string;
  idRol: number;
  esAdmin: boolean;
  esEditor: boolean; // carga y corrige datos (Responsable, Encargado, Administrador)
  ambito: string | null; // "Cabildo Renacer", "Han Esperanza", "Toda la SGPy"…
  debeCambiarPassword: boolean;
};

export async function miPerfil(supabase: any): Promise<MiPerfil | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase
    .from("perfiles")
    .select("id_rol, debe_cambiar_password, personas(nombre), region(nombre), cabildo(nombre), distrito(nombre), han(nombre)")
    .eq("id", user.id)
    .single();
  const idRol = Number(p?.id_rol ?? 2);
  const ambito = p?.han?.nombre
    ? `Han ${p.han.nombre}`
    : p?.distrito?.nombre
    ? `Distrito ${p.distrito.nombre}`
    : p?.cabildo?.nombre
    ? `Cabildo ${p.cabildo.nombre}`
    : p?.region?.nombre
    ? `Región ${p.region.nombre}`
    : idRol === 3
    ? "Toda la SGPy"
    : null;
  return {
    nombre: p?.personas?.nombre ?? user.email?.split("@")[0] ?? "",
    idRol,
    esAdmin: idRol === 3,
    esEditor: [1, 3, 4].includes(idRol),
    ambito,
    debeCambiarPassword: !!p?.debe_cambiar_password,
  };
}
