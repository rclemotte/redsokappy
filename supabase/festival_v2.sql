-- =============================================================
-- RedSokappy — Festival v2 (11-oct-2026)
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de festival.sql.
-- Se puede correr más de una vez.
--
-- Cambios:
--  * Teléfono (obligatorio en el form) y "comité / staff artístico".
--  * Fecha de nacimiento deja de pedirse (la columna queda, opcional).
--  * Cupo 700 por función, con bloqueo real: llegado el tope no se
--    registra nadie más en esa función.
--  * Una cédula no puede registrarse dos veces al mismo evento, ni
--    (por ahora) en más de un evento → constante v_max_eventos.
-- =============================================================
begin;

-- 1) Columnas nuevas
alter table fest_registro add column if not exists telefono text;
alter table fest_registro add column if not exists es_staff boolean not null default false;
alter table fest_registro alter column fecha_nacimiento drop not null;

-- 2) Cupo 700 en las dos funciones
update fest_evento set cupo = 700;

-- 3) Nuevo registro público (reemplaza al anterior)
drop function if exists public.fest_registrar(bigint[], text, text, text, date, boolean);

create or replace function public.fest_registrar(
  p_eventos    bigint[],
  p_cedula     text,
  p_nombre     text,
  p_apellido   text,
  p_telefono   text,
  p_es_miembro boolean,
  p_es_staff   boolean
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  -- Cuántos eventos distintos puede tener una misma cédula.
  -- Hoy: 1. Si se decide permitir los dos, cambiar a 2 y volver a ejecutar.
  v_max_eventos constant int := 1;

  v_ced  text := regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g');
  v_nom  text := left(btrim(coalesce(p_nombre, '')), 80);
  v_ape  text := left(btrim(coalesce(p_apellido, '')), 80);
  v_tel  text := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');
  v_ev   fest_evento%rowtype;
  v_cant bigint;
  v_prev text;
  v_id   bigint;
  v_ids  bigint[] := '{}';
begin
  -- Validaciones básicas
  if length(v_ced) < 4 or length(v_ced) > 10 then
    return json_build_object('ok', false, 'error', 'Número de cédula inválido.');
  end if;
  if v_nom = '' or v_ape = '' then
    return json_build_object('ok', false, 'error', 'Completá nombre y apellido.');
  end if;

  -- Teléfono paraguayo: acepta 0981..., 981..., +595981...
  if v_tel like '595%' then v_tel := '0' || substr(v_tel, 4); end if;
  if v_tel !~ '^0' then v_tel := '0' || v_tel; end if;
  if v_tel !~ '^0[2-9][0-9]{7,8}$' then
    return json_build_object('ok', false, 'error', 'Número de teléfono inválido. Ej.: 0981 123456');
  end if;

  if p_eventos is null or array_length(p_eventos, 1) is null then
    return json_build_object('ok', false, 'error', 'Elegí el evento al que vas a asistir.');
  end if;
  if array_length(p_eventos, 1) > v_max_eventos then
    return json_build_object('ok', false, 'error', 'Solo podés registrarte en una función.');
  end if;

  -- Evita que dos envíos simultáneos de la misma cédula se cuelen
  perform pg_advisory_xact_lock(hashtext('fest_cedula_' || v_ced));

  -- ¿Ya está registrada?
  select string_agg(e.nombre, ', ' order by e.id_evento), count(*)
    into v_prev, v_cant
    from fest_registro r join fest_evento e on e.id_evento = r.id_evento
   where r.cedula = v_ced;

  if v_cant > 0 and (v_cant + array_length(p_eventos, 1) > v_max_eventos
                     or exists (select 1 from fest_registro where cedula = v_ced and id_evento = any(p_eventos))) then
    return json_build_object('ok', false, 'codigo', 'ya_registrado',
      'error', 'Esta cédula ya está registrada en: ' || v_prev || '.');
  end if;

  -- Alta en cada evento, respetando el cupo
  foreach v_id in array p_eventos loop
    -- Bloquea la fila del evento: el conteo + insert es atómico (cupo real)
    select * into v_ev from fest_evento where id_evento = v_id and activo for update;
    if not found then
      return json_build_object('ok', false, 'error', 'El evento elegido ya no está disponible.');
    end if;

    if v_ev.cupo is not null then
      select count(*) into v_cant from fest_registro where id_evento = v_id;
      if v_cant >= v_ev.cupo then
        return json_build_object('ok', false, 'codigo', 'cupo_completo',
          'error', 'Se completó el cupo de "' || v_ev.nombre || '". Elegí otra función.');
      end if;
    end if;

    insert into fest_registro (id_evento, cedula, nombre, apellido, telefono, es_miembro, es_staff)
    values (v_id, v_ced, v_nom, v_ape, v_tel,
            coalesce(p_es_miembro, false),
            coalesce(p_es_miembro, false) and coalesce(p_es_staff, false));
    v_ids := v_ids || v_id;
  end loop;

  return json_build_object('ok', true, 'eventos', to_json(v_ids));
end;
$$;

revoke all on function public.fest_registrar(bigint[], text, text, text, text, boolean, boolean) from public;
grant execute on function public.fest_registrar(bigint[], text, text, text, text, boolean, boolean) to anon, authenticated;

commit;

-- Que la API (PostgREST) vea la función nueva enseguida
notify pgrst, 'reload schema';
