-- =============================================================
-- RedSokappy — Festival: RPC público de RESULTADOS (perfil demográfico)
-- Ejecutar en el SQL Editor de Supabase. Re-ejecutable.
-- Requiere `fest_padron` ya cargada (correr antes `festival_padron.sql`).
--
-- Devuelve SOLO números agregados (sin cédulas, nombres ni direcciones),
-- filtrados por grupo: 'registrados' | 'ingresaron' | 'ambos'.
-- Cada desglose incluye "Sin identificar" para que sume el total del grupo.
-- La usa la página pública /festival/resultados.
-- =============================================================
begin;

-- quita la versión anterior sin parámetro (si existía)
drop function if exists public.fest_resultados();

create or replace function public.fest_resultados(p_seg text default 'todos')
returns json
language sql stable security definer
set search_path = public
as $$
  with seg as (
    -- cédulas del grupo elegido
    select cedula from fest_padron where p_seg = 'todos'
    union
    select distinct cedula from fest_registro where p_seg = 'registrados'
    union
    select distinct cedula from fest_ingreso  where p_seg = 'ingresaron'
    union
    select r.cedula
      from (select distinct cedula from fest_registro) r
      join (select distinct cedula from fest_ingreso)  i on i.cedula = r.cedula
     where p_seg = 'ambos'
  ),
  base as (
    select p.* from fest_padron p join seg s on s.cedula = p.cedula
  ),
  tot as (select count(*)::int as total from base)
  select json_build_object(
    'segmento',      p_seg,
    'total',         (select total from tot),
    'identificados', (select count(*) from base where en_padron),
    -- totales globales (para los botones)
    'todos',         (select count(*) from fest_padron),
    'registrados',   (select count(distinct cedula) from fest_registro),
    'ingresaron',    (select count(distinct cedula) from fest_ingreso),
    'ambos',         (select count(*) from (
                         select distinct cedula from fest_registro
                         intersect
                         select distinct cedula from fest_ingreso) z),

    'por_sexo', (
      select coalesce(json_agg(json_build_object('k', k, 'n', n) order by ord), '[]'::json)
      from (
        select case sexo when 'F' then 'Femenino' when 'M' then 'Masculino' end as k,
               case sexo when 'F' then 0 when 'M' then 1 end as ord,
               count(*) as n
        from base where en_padron and sexo in ('F','M')
        group by 1, 2
        union all
        select 'Sin identificar', 9,
               (select total from tot) - (select count(*) from base where en_padron and sexo in ('F','M'))
      ) s
    ),

    'por_edad', (
      select coalesce(json_agg(json_build_object('k', k, 'n', n) order by ord), '[]'::json)
      from (
        select k, min(ord) as ord, count(*) as n
        from (
          select case when edad < 18 then 'Menor de 18'
                      when edad <= 29 then '18–29'
                      when edad <= 44 then '30–44'
                      when edad <= 59 then '45–59'
                      else '60 o más' end as k,
                 case when edad < 18 then 0
                      when edad <= 29 then 1
                      when edad <= 44 then 2
                      when edad <= 59 then 3
                      else 4 end as ord
          from base where en_padron and edad is not null
        ) t
        group by k
        union all
        select 'Sin identificar', 9,
               (select total from tot) - (select count(*) from base where en_padron and edad is not null)
      ) e
    ),

    'por_ciudad', (
      select coalesce(json_agg(json_build_object('k', k, 'n', n) order by (k = 'Sin identificar'), (k = 'Otras'), n desc), '[]'::json)
      from (
        select case when rn <= 12 then distrito else 'Otras' end as k, sum(n) as n
        from (
          select distrito, count(*) as n,
                 row_number() over (order by count(*) desc) as rn
          from base
          where en_padron and distrito is not null and distrito <> ''
          group by distrito
        ) a
        group by (case when rn <= 12 then distrito else 'Otras' end)
        union all
        select 'Sin identificar',
               (select total from tot) - (select count(*) from base where en_padron and distrito is not null and distrito <> '')
      ) c
    )
  );
$$;

revoke all on function public.fest_resultados(text) from public;
grant execute on function public.fest_resultados(text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
