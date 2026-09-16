import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { usuarioAEmail } from "@/lib/usuarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/usuarios  -> crea un usuario de login asociado a un miembro.
// Body: { id_persona: number, cedula: string }
// Reglas: solo un editor (rol 1 o 3) puede crear. Clave inicial = la cédula.
export async function POST(req: Request) {
  // 1) ¿Quién llama? Debe estar logueado y ser editor.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id_rol")
    .eq("id", user.id)
    .single();
  if (!perfil || ![1, 3].includes(Number(perfil.id_rol))) {
    return NextResponse.json(
      { error: "No tenés permiso para crear usuarios." },
      { status: 403 }
    );
  }

  // 2) Validar entrada
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  const idPersona = Number(body?.id_persona);
  const cedula = String(body?.cedula ?? "").trim();

  if (!idPersona || Number.isNaN(idPersona)) {
    return NextResponse.json({ error: "Elegí un miembro." }, { status: 400 });
  }
  if (!/^[0-9A-Za-z.\-]{4,}$/.test(cedula)) {
    return NextResponse.json(
      { error: "La cédula no es válida (mínimo 4 caracteres, sin espacios)." },
      { status: 400 }
    );
  }
  if (cedula.length < 6) {
    return NextResponse.json(
      {
        error:
          "La cédula debe tener al menos 6 caracteres para usarse como contraseña inicial.",
      },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // 3) ¿El miembro ya tiene usuario?
  const { data: yaPersona } = await admin
    .from("perfiles")
    .select("id")
    .eq("id_persona", idPersona)
    .limit(1);
  if (yaPersona && yaPersona.length) {
    return NextResponse.json(
      { error: "Ese miembro ya tiene un usuario." },
      { status: 409 }
    );
  }

  // 4) ¿La cédula ya está usada?
  const { data: yaCedula } = await admin
    .from("perfiles")
    .select("id")
    .eq("cedula", cedula)
    .limit(1);
  if (yaCedula && yaCedula.length) {
    return NextResponse.json(
      { error: "Ya existe un usuario con esa cédula." },
      { status: 409 }
    );
  }

  // 5) Crear la cuenta de acceso (email sintético, clave = cédula, ya confirmada)
  const email = usuarioAEmail(cedula);
  const { data: creado, error: eCrear } = await admin.auth.admin.createUser({
    email,
    password: cedula,
    email_confirm: true,
    user_metadata: { cedula, id_persona: idPersona },
  });
  if (eCrear || !creado?.user) {
    const msg = (eCrear?.message || "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return NextResponse.json(
        { error: "Ya existe un usuario con esa cédula." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "No se pudo crear el usuario. " + (eCrear?.message ?? "") },
      { status: 500 }
    );
  }

  // 6) Crear el perfil (rol Miembro = 2, debe cambiar la clave en el 1er ingreso)
  const { error: ePerfil } = await admin.from("perfiles").insert({
    id: creado.user.id,
    id_persona: idPersona,
    id_rol: 2,
    cedula,
    debe_cambiar_password: true,
    estado: 1,
  });
  if (ePerfil) {
    // Rollback: si falla el perfil, borramos la cuenta recién creada.
    await admin.auth.admin.deleteUser(creado.user.id);
    return NextResponse.json(
      { error: "No se pudo guardar el perfil. " + ePerfil.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, cedula });
}
