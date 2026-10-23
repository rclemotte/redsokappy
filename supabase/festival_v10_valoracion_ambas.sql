-- =============================================================
-- RedSokappy — Festival v10 (23-oct-2026): valoración de una o AMBAS funciones
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de v9. Se puede correr más de una vez.
--
-- Cada respuesta guarda la(s) función(es) a la que asistió la persona en `eventos`.
-- id_evento queda como la primera de la lista (compatibilidad).
-- =============================================================
begin;

alter table fest_valoracion add column if not exists eventos bigint[];
update fest_valoracion set eventos = array[id_evento] where eventos is null;
alter table fest_valoracion alter column eventos set not null;
create index if not exists ix_fest_valoracion_eventos on fest_valoracion using gin (eventos);

drop function if exists public.fest_valorar(bigint, smallint, smallint, smallint, smallint, text, text);

create or replace function public.fest_valorar(
  p_eventos        bigint[],
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
  v_evs    bigint[];
  v_coment text := nullif(left(btrim(coalesce(p_comentario, '')), 500), '');
  v_nombre text := nullif(left(btrim(coalesce(p_nombre, '')), 80), '');
begin
  -- Solo funciones activas, sin repetir, ordenadas
  select array_agg(distinct e.id_evento order by e.id_evento) into v_evs
    from fest_evento e
   where e.activo and e.id_evento = any(coalesce(p_eventos, '{}'));
  if v_evs is null then
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

  insert into fest_valoracion (id_evento, eventos, general, organizacion, presentaciones, comodidad, comentario, nombre)
  values (v_evs[1], v_evs, p_general, p_organizacion, p_presentaciones, p_comodidad, v_coment, v_nombre);

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.fest_valorar(bigint[], smallint, smallint, smallint, smallint, text, text) from public;
grant execute on function public.fest_valorar(bigint[], smallint, smallint, smallint, smallint, text, text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
