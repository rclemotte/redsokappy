-- =============================================================
-- RedSokappy — Festival v3 (11-oct-2026)
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de festival_v2.sql.
-- Se puede correr más de una vez.
--
-- Cambio: si la persona es MIEMBRO y pertenece a un COMITÉ / STAFF
-- ARTÍSTICO, queda registrada en las dos funciones (todas las activas),
-- sin bloqueo por cupo. El resto sigue igual: una sola función, cupo 700,
-- una sola inscripción por cédula.
-- =============================================================
begin;

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
  v_staff boolean := coalesce(p_es_miembro, false) and coalesce(p_es_staff, false);
  v_evs  bigint[] := p_eventos;
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

  -- Miembro + comité/staff artístico: queda registrado en TODAS las funciones activas
  -- (sin importar lo que mande el formulario y sin bloqueo por cupo).
  if v_staff then
    select array_agg(id_evento order by id_evento) into v_evs from fest_evento where activo;
  end if;

  if v_evs is null or array_length(v_evs, 1) is null then
    return json_build_object('ok', false, 'error', 'Elegí el evento al que vas a asistir.');
  end if;
  if not v_staff and array_length(v_evs, 1) > v_max_eventos then
    return json_build_object('ok', false, 'error', 'Solo podés registrarte en una función.');
  end if;

  -- Evita que dos envíos simultáneos de la misma cédula se cuelen
  perform pg_advisory_xact_lock(hashtext('fest_cedula_' || v_ced));

  -- ¿Ya está registrada?
  select string_agg(e.nombre, ', ' order by e.id_evento), count(*)
    into v_prev, v_cant
    from fest_registro r join fest_evento e on e.id_evento = r.id_evento
   where r.cedula = v_ced;

  if v_cant > 0 then
    return json_build_object('ok', false, 'codigo', 'ya_registrado',
      'error', 'Esta cédula ya está registrada en: ' || v_prev || '.');
  end if;

  -- Alta en cada evento, respetando el cupo
  foreach v_id in array v_evs loop
    -- Bloquea la fila del evento: el conteo + insert es atómico (cupo real)
    select * into v_ev from fest_evento where id_evento = v_id and activo for update;
    if not found then
      return json_build_object('ok', false, 'error', 'El evento elegido ya no está disponible.');
    end if;

    if v_ev.cupo is not null and not v_staff then
      select count(*) into v_cant from fest_registro where id_evento = v_id;
      if v_cant >= v_ev.cupo then
        return json_build_object('ok', false, 'codigo', 'cupo_completo',
          'error', 'Se completó el cupo de "' || v_ev.nombre || '". Elegí otra función.');
      end if;
    end if;

    insert into fest_registro (id_evento, cedula, nombre, apellido, telefono, es_miembro, es_staff)
    values (v_id, v_ced, v_nom, v_ape, v_tel,
            coalesce(p_es_miembro, false), v_staff);
    v_ids := v_ids || v_id;
  end loop;

  return json_build_object('ok', true, 'eventos', to_json(v_ids));
end;
$$;

commit;

notify pgrst, 'reload schema';
