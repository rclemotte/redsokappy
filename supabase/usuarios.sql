-- =============================================================
-- RedSokappy — Módulo de USUARIOS (login por cédula)
-- Ejecutar en el SQL Editor de Supabase (una sola vez).
-- =============================================================
begin;

-- 1) Columnas nuevas en perfiles
--    cedula  = "usuario" con el que ingresa la persona (se guarda como texto)
--    debe_cambiar_password = obliga a cambiar la clave en el primer ingreso
alter table perfiles add column if not exists cedula text;
alter table perfiles add column if not exists debe_cambiar_password boolean not null default true;

-- Cédula única (permite varios NULL, p.ej. el admin que entra por correo)
create unique index if not exists ux_perfiles_cedula on perfiles(cedula) where cedula is not null;

-- 2) Los perfiles que ya existían (admin) no deben cambiar la clave
update perfiles set debe_cambiar_password = false;

-- 3) Función segura para que CADA usuario marque su propio cambio de clave.
--    (security definer: corre con permisos del dueño, pero SOLO afecta su propia fila
--     y no puede tocar el rol → no hay riesgo de que un miembro se haga admin.)
create or replace function public.marcar_password_cambiado()
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfiles
     set debe_cambiar_password = false
   where id = auth.uid();
$$;

grant execute on function public.marcar_password_cambiado() to authenticated;

commit;
