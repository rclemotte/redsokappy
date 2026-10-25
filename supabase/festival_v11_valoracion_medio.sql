-- =============================================================
-- RedSokappy — Festival v11 (25-oct-2026): "¿Por qué medio te enteraste del Festival?"
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de v10. Se puede correr más de una vez.
-- Opciones: REDES (Redes sociales) · AMIGO (Me invitó un amigo/a) ·
--           MIEMBRO (Soy miembro) · OTRO (+ texto libre).
-- Es opcional: las respuestas sin este dato se siguen aceptando.
-- =============================================================
begin;

alter table fest_valoracion add column if not exists medio      varchar(10);
alter table fest_valoracion add column if not exists medio_otro varchar(100);
do $$ begin
  alter table fest_valoracion add constraint ck_fest_valoracion_medio
    check (medio is null or medio in ('REDES','AMIGO','MIEMBRO','OTRO'));
exception when duplicate_object then null; end $$;

drop function if exists public.fest_valorar(bigint[], smallint, smallint, smallint, smallint, text, text);

create or replace function public.fest_valorar(
  p_eventos        bigint[],
  p_general        smallint,
  p_organizacion   smallint,
  p_presentaciones smallint,
  p_comodidad      smallint,
  p_comentario     text,
  p_nombre         text,
  p_medio          text default null,
  p_medio_otro     text default null
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_evs    bigint[];
  v_coment text := nullif(left(btrim(coalesce(p_comentario, '')), 500), '');
  v_nombre text := nullif(left(btrim(coalesce(p_nombre, '')), 80), '');
  v_medio  text := nullif(upper(btrim(coalesce(p_medio, ''))), '');
  v_otro   text := nullif(left(btrim(coalesce(p_medio_otro, '')), 100), '');
begin
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
  if v_medio is not null and v_medio not in ('REDES','AMIGO','MIEMBRO','OTRO') then
    v_medio := null;
  end if;
  if v_medio is distinct from 'OTRO' then v_otro := null; end if;

  insert into fest_valoracion (id_evento, eventos, general, organizacion, presentaciones, comodidad,
                               comentario, nombre, medio, medio_otro)
  values (v_evs[1], v_evs, p_general, p_organizacion, p_presentaciones, p_comodidad,
          v_coment, v_nombre, v_medio, v_otro);

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.fest_valorar(bigint[], smallint, smallint, smallint, smallint, text, text, text, text) from public;
grant execute on function public.fest_valorar(bigint[], smallint, smallint, smallint, smallint, text, text, text, text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
