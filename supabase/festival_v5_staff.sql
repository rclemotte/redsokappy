-- =============================================================
-- RedSokappy — Festival v5 (11-oct-2026): el comité / staff NO ocupa butaca
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de v2, v3 y v4.
-- Se puede correr más de una vez.
--
--  * Cupo de 700 = butacas para el PÚBLICO. Los registros de staff no
--    descuentan lugares (ni en el formulario ni en los paneles).
--  * Paneles: staff contado aparte (registrados e ingresados).
--  * Kiosko: indica cuando la persona es del comité / staff.
-- =============================================================
begin;

-- 1) Eventos para el formulario y el kiosko: cuentan solo público
create or replace function public.fest_eventos_publicos()
returns table (
  id_evento bigint, nombre text, fecha date, hora text, lugar text,
  cupo integer, registrados bigint, ingresados bigint
)
language sql stable security definer
set search_path = public
as $$
  select e.id_evento, e.nombre, e.fecha, e.hora, e.lugar, e.cupo,
         (select count(*) from fest_registro r where r.id_evento = e.id_evento and not r.es_staff),
         (select count(*) from fest_ingreso i
            left join fest_registro r on r.id_registro = i.id_registro
           where i.id_evento = e.id_evento and not coalesce(r.es_staff, false))
    from fest_evento e
   where e.activo
   order by e.fecha nulls last, e.hora, e.id_evento;
$$;

-- 2) Registro: el cupo se controla solo con el público
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
      select count(*) into v_cant from fest_registro where id_evento = v_id and not es_staff;  -- el staff no ocupa butaca
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


-- 3) Ingreso: devuelve también si es staff
create or replace function public.fest_ingresar(p_evento bigint, p_cedula text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_ced  text := regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g');
  v_reg  fest_registro%rowtype;
  v_id   bigint;
begin
  if length(v_ced) < 4 or length(v_ced) > 10 then
    return json_build_object('estado', 'cedula_invalida');
  end if;
  if not exists (select 1 from fest_evento where id_evento = p_evento and activo) then
    return json_build_object('estado', 'evento_inactivo');
  end if;

  select * into v_reg from fest_registro where id_evento = p_evento and cedula = v_ced;

  insert into fest_ingreso (id_evento, cedula, id_registro)
  values (p_evento, v_ced, v_reg.id_registro)
  on conflict (id_evento, cedula) do nothing
  returning id_ingreso into v_id;

  return json_build_object(
    'estado',     case when v_id is null then 'ya_ingreso' else 'ok' end,
    'registrado', v_reg.id_registro is not null,
    'nombre',     split_part(coalesce(v_reg.nombre, ''), ' ', 1),
    'staff',      coalesce(v_reg.es_staff, false)
  );
end;
$$;


-- 4) Resumen del panel interno (pestaña Eventos), con staff aparte
drop function if exists public.fest_resumen();
create function public.fest_resumen()
returns table (
  id_evento bigint, nombre text, fecha date, hora text, lugar text, cupo integer, activo boolean,
  registrados bigint, reg_miembros bigint, reg_no_miembros bigint, reg_staff bigint,
  ingresados bigint, ing_registrados bigint, ing_sin_registro bigint, ing_miembros bigint, ing_staff bigint
)
language sql stable security definer
set search_path = public
as $$
  select e.id_evento, e.nombre, e.fecha, e.hora, e.lugar, e.cupo, e.activo,
         count(distinct r.id_registro),
         count(distinct r.id_registro) filter (where r.es_miembro),
         count(distinct r.id_registro) filter (where not r.es_miembro),
         count(distinct r.id_registro) filter (where r.es_staff),
         (select count(*) from fest_ingreso i where i.id_evento = e.id_evento),
         (select count(*) from fest_ingreso i where i.id_evento = e.id_evento and i.id_registro is not null),
         (select count(*) from fest_ingreso i where i.id_evento = e.id_evento and i.id_registro is null),
         (select count(*) from fest_ingreso i join fest_registro rr on rr.id_registro = i.id_registro
           where i.id_evento = e.id_evento and rr.es_miembro),
         (select count(*) from fest_ingreso i join fest_registro rr on rr.id_registro = i.id_registro
           where i.id_evento = e.id_evento and rr.es_staff)
    from fest_evento e
    left join fest_registro r on r.id_evento = e.id_evento
   where public.es_editor()
   group by e.id_evento
   order by e.fecha nulls last, e.id_evento;
$$;
revoke all on function public.fest_resumen() from public;
grant execute on function public.fest_resumen() to authenticated;

-- 5) Estadísticas del panel público: público y staff por separado
create or replace function public.fest_estadisticas()
returns json
language sql stable security definer
set search_path = public
as $$
  select json_build_object(
    'actualizado', now(),
    'eventos', coalesce(json_agg(x order by x.fecha nulls last, x.hora, x.id_evento), '[]'::json)
  )
  from (
    select e.id_evento, e.nombre, e.fecha, e.hora, e.lugar, e.cupo,
           -- Registro previo (público = sin staff)
           (select count(*) from fest_registro r where r.id_evento = e.id_evento and not r.es_staff)                    as registrados,
           (select count(*) from fest_registro r where r.id_evento = e.id_evento and not r.es_staff and r.es_miembro)   as reg_miembros,
           (select count(*) from fest_registro r where r.id_evento = e.id_evento and not r.es_miembro)                  as reg_no_miembros,
           (select count(*) from fest_registro r where r.id_evento = e.id_evento and r.es_staff)                        as reg_staff,
           -- Ingresos (público = sin registro + registrados que no son staff)
           (select count(*) from fest_ingreso i left join fest_registro r on r.id_registro = i.id_registro
             where i.id_evento = e.id_evento and not coalesce(r.es_staff, false))                                        as ingresados,
           (select count(*) from fest_ingreso i join fest_registro r on r.id_registro = i.id_registro
             where i.id_evento = e.id_evento and not r.es_staff)                                                         as ing_con_registro,
           (select count(*) from fest_ingreso i where i.id_evento = e.id_evento and i.id_registro is null)               as ing_sin_registro,
           (select count(*) from fest_ingreso i join fest_registro r on r.id_registro = i.id_registro
             where i.id_evento = e.id_evento and r.es_staff)                                                             as ing_staff,
           (select coalesce(json_agg(json_build_object('dia', d.dia, 'n', d.n) order by d.dia), '[]'::json)
              from (select (r.creado_en at time zone 'America/Asuncion')::date as dia, count(*) as n
                      from fest_registro r where r.id_evento = e.id_evento and not r.es_staff group by 1) d)            as por_dia,
           (select coalesce(json_agg(json_build_object('t', to_char(b.t, 'HH24:MI'), 'n', b.n) order by b.t), '[]'::json)
              from (select date_bin('10 minutes', i.ingresado_en at time zone 'America/Asuncion', timestamp '2000-01-01') as t,
                           count(*) as n
                      from fest_ingreso i left join fest_registro r on r.id_registro = i.id_registro
                     where i.id_evento = e.id_evento and not coalesce(r.es_staff, false) group by 1) b)                 as por_intervalo
      from fest_evento e
     where e.activo
  ) x;
$$;
revoke all on function public.fest_estadisticas() from public;
grant execute on function public.fest_estadisticas() to anon, authenticated;

commit;

notify pgrst, 'reload schema';
