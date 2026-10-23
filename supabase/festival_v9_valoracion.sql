-- =============================================================
-- RedSokappy — Festival v9 (23-oct-2026): valoración post festival
-- Ejecutar en el SQL Editor de Supabase. Se puede correr más de una vez.
--
-- * Página pública /festival/valoracion (se llega por QR).
-- * Obligatorio: función + calificación general (1 a 5).
-- * Opcional: organización, presentaciones, comodidad del lugar (1 a 5),
--   comentario (hasta 500) y nombre.
-- * El público solo puede ENVIAR (función fest_valorar). Las respuestas
--   solo las leen los editores, en la app (Eventos → Valoraciones).
-- =============================================================
begin;

create table if not exists fest_valoracion (
  id_valoracion  bigint generated always as identity primary key,
  id_evento      bigint not null references fest_evento(id_evento) on delete cascade,
  general        smallint not null check (general between 1 and 5),
  organizacion   smallint check (organizacion between 1 and 5),
  presentaciones smallint check (presentaciones between 1 and 5),
  comodidad      smallint check (comodidad between 1 and 5),
  comentario     varchar(500),
  nombre         varchar(80),
  creado_en      timestamptz not null default now()
);
create index if not exists ix_fest_valoracion_evento on fest_valoracion(id_evento);

alter table fest_valoracion enable row level security;
drop policy if exists fest_valoracion_sel on fest_valoracion;
create policy fest_valoracion_sel on fest_valoracion for select to authenticated using (public.es_editor());
drop policy if exists fest_valoracion_del on fest_valoracion;
create policy fest_valoracion_del on fest_valoracion for delete to authenticated using (public.es_editor());

-- Envío público
create or replace function public.fest_valorar(
  p_evento         bigint,
  p_general        smallint,
  p_organizacion   smallint,
  p_presentaciones smallint,
  p_comodidad      smallint,
  p_comentario     text,
  p_nombre         text
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_coment text := nullif(left(btrim(coalesce(p_comentario, '')), 500), '');
  v_nombre text := nullif(left(btrim(coalesce(p_nombre, '')), 80), '');
begin
  if not exists (select 1 from fest_evento where id_evento = p_evento and activo) then
    return json_build_object('ok', false, 'error', 'Elegí la función a la que asististe.');
  end if;
  if p_general is null or p_general not between 1 and 5 then
    return json_build_object('ok', false, 'error', 'Elegí una calificación general.');
  end if;
  if (p_organizacion   is not null and p_organizacion   not between 1 and 5)
  or (p_presentaciones is not null and p_presentaciones not between 1 and 5)
  or (p_comodidad      is not null and p_comodidad      not between 1 and 5) then
    return json_build_object('ok', false, 'error', 'Calificación inválida.');
  end if;

  insert into fest_valoracion (id_evento, general, organizacion, presentaciones, comodidad, comentario, nombre)
  values (p_evento, p_general, p_organizacion, p_presentaciones, p_comodidad, v_coment, v_nombre);

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.fest_valorar(bigint, smallint, smallint, smallint, smallint, text, text) from public;
grant execute on function public.fest_valorar(bigint, smallint, smallint, smallint, smallint, text, text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
