// Utilidades del módulo de usuarios (login por cédula).

// Dominio "sintético" para las cuentas creadas por cédula.
// El usuario NO usa este correo: ingresa con su número de cédula.
export const EMAIL_DOMAIN = "redsokappy.app";

// Convierte lo que se tipea en el login a un email para Supabase Auth.
// Si ya es un correo (tiene @), se usa tal cual (login del admin).
// Si es una cédula, se arma <cedula>@redsokappy.app.
export function usuarioAEmail(usuario: string): string {
  const v = (usuario || "").trim();
  return v.includes("@") ? v.toLowerCase() : `${v}@${EMAIL_DOMAIN}`;
}
