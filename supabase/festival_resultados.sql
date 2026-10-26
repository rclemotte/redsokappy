-- =============================================================
-- RedSokappy — Festival: RPC público de RESULTADOS (perfil demográfico)
-- Ejecutar en el SQL Editor de Supabase. Re-ejecutable.
-- Requiere que ya exista y esté cargada la tabla `fest_padron`
-- (correr antes `festival_padron.sql`).
--
-- Devuelve SOLO números agregados (sin cédulas, nombres ni direcciones).
-- La usa la página pública /festival/resultados.
-- =============================================================
begin;

create or replace function public.fest_resultados()
returns json
language sql stable security definer
set search_path = public
as $$
  select json_build_object(
    'actualizado', now(),
    'total',         (select count(*) from fest_padron),
    'identificados', (select count(*) from fest_padron where en_padron),
    'registrados',   (select count(distinct cedula) from fest_registro),
    'ingresaron',    (select count(distinct cedula) from fest_ingreso),

    'por_sexo', (
      select coalesce(json_agg(json_build_object('k', k, 'n', n) order by n desc), '[]'::json)
      from (
        select case sexo when 'F' then 'Femenino' when 'M' then 'Masculino' end as k,
               count(*) as n
        from fest_padron
        where en_padron and sexo in ('F','M')
        group by 1
      ) s
    ),

    'por_edad', (
      select coalesce(json_agg(json_build_object('k', k, 'n', n) order by ord), '[]'::json)
      from (
        select
          case when edad < 18 then 'Menor de 18'
               when edad <= 29 then '18–29'
               when edad <= 44 then '30–44'
               when edad <= 59 then '45–59'
               else '60 o más' end as k,
          case when edad < 18 then 0
               when edad <= 29 then 1
               when edad <= 44 then 2
               when edad <= 59 then 3
               else 4 end as ord,
          count(*) as n
        from fest_padron
        where en_padron and edad is not null
        group by k, ord
      ) e
    ),

    'por_ciudad', (
      select coalesce(json_agg(json_build_object('k', k, 'n', n) order by (k = 'Otras'), n desc), '[]'::json)
      from (
        select case when rn <= 12 then distrito else 'Otras' end as k,
               sum(n) as n
        from (
          select distrito, count(*) as n,
                 row_number() over (order by count(*) desc) as rn
          from fest_padron
          where en_padron and distrito is not null and distrito <> ''
          group by distrito
        ) a
        group by (case when rn <= 12 then distrito else 'Otras' end)
      ) c
    )
  );
$$;

revoke all on function public.fest_resultados() from public;
grant execute on function public.fest_resultados() to anon, authenticated;

commit;

notify pgrst, 'reload schema';
