-- =============================================================
-- RedSokappy — Festival v4: panel público de indicadores
-- Ejecutar en el SQL Editor de Supabase. Se puede correr más de una vez.
--
-- Una sola función pública que devuelve SOLO números agregados por función
-- (sin cédulas, nombres ni teléfonos). La usa la página /festival/panel.
-- =============================================================
begin;

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
           (select count(*) from fest_registro r where r.id_evento = e.id_evento)                                   as registrados,
           (select count(*) from fest_registro r where r.id_evento = e.id_evento and r.es_miembro)                  as reg_miembros,
           (select count(*) from fest_registro r where r.id_evento = e.id_evento and not r.es_miembro)              as reg_no_miembros,
           (select count(*) from fest_registro r where r.id_evento = e.id_evento and r.es_staff)                    as reg_staff,
           (select count(*) from fest_ingreso i where i.id_evento = e.id_evento)                                    as ingresados,
           (select count(*) from fest_ingreso i where i.id_evento = e.id_evento and i.id_registro is not null)      as ing_con_registro,
           (select count(*) from fest_ingreso i where i.id_evento = e.id_evento and i.id_registro is null)          as ing_sin_registro,
           -- Registros por día (hora de Paraguay)
           (select coalesce(json_agg(json_build_object('dia', d.dia, 'n', d.n) order by d.dia), '[]'::json)
              from (select (r.creado_en at time zone 'America/Asuncion')::date as dia, count(*) as n
                      from fest_registro r where r.id_evento = e.id_evento group by 1) d)                          as por_dia,
           -- Ingresos cada 10 minutos (hora de Paraguay, "HH:MM")
           (select coalesce(json_agg(json_build_object('t', to_char(b.t, 'HH24:MI'), 'n', b.n) order by b.t), '[]'::json)
              from (select date_bin('10 minutes', i.ingresado_en at time zone 'America/Asuncion', timestamp '2000-01-01') as t,
                           count(*) as n
                      from fest_ingreso i where i.id_evento = e.id_evento group by 1) b)                           as por_intervalo
      from fest_evento e
     where e.activo
  ) x;
$$;

revoke all on function public.fest_estadisticas() from public;
grant execute on function public.fest_estadisticas() to anon, authenticated;

commit;

notify pgrst, 'reload schema';
