-- =============================================================================
-- RedSokappy → Tookan Digital · Paso 4: PERMISOS POR NIVEL (ámbito)
-- Fecha: 03-nov-2026 · Correr DESPUÉS de tookan_01 y tookan_02 (antes o después
-- de la importación, da igual). Se puede correr más de una vez.
--
-- Regla general:
--   * ADMINISTRADOR (rol 3) = Coordinación General: ve y edita todo.
--   * El resto ve SOLO lo de su ámbito, que se asigna en Usuarios:
--       Región → todos los cabildos de la región
--       Cabildo → todos sus distritos y hanes
--       Distrito → sus hanes
--       Han → solo ese han
--     Sin ámbito asignado → ve solo su propia ficha y su participación.
--   * Todos ven siempre su propia ficha y las reuniones en las que participaron.
--   * Editan (dentro de su ámbito): Responsable (1) y Encargado de estadística (4).
--     Miembro (2) solo mira.
--   * Las personas sin han (bajas, pendientes de ubicar) las ven solo los ámbitos
--     de cabildo o región que las contienen.
--   * Catálogos y estructura (regiones, cabildos, hanes, cargos…): todos leen,
--     solo el ADMINISTRADOR cambia.
--   * Usuarios (perfiles): solo el ADMINISTRADOR asigna roles y ámbitos.
--   * El estado (activo/inactivo…) se calcula con TODA la participación de la
--     persona, aunque haya ido a reuniones de otro han que quien mira no ve.
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- A. Cabildo de cada persona (por si todavía no se corrió la importación)
-- -----------------------------------------------------------------------------
alter table personas add column if not exists id_cabildo bigint references cabildo(id_cabildo);
create index if not exists ix_personas_cabildo on personas(id_cabildo);

create or replace function public.fn_personas_cabildo()
returns trigger language plpgsql as $f$
begin
  if new.id_han is not null then
    select d.id_cabildo into new.id_cabildo
      from han h join distrito d on d.id_distrito = h.id_distrito
     where h.id_han = new.id_han;
  end if;
  return new;
end;
$f$;
drop trigger if exists trg_personas_cabildo on personas;
create trigger trg_personas_cabildo before insert or update of id_han, id_cabildo on personas
  for each row execute function public.fn_personas_cabildo();

update personas p set id_cabildo = d.id_cabildo
  from han h join distrito d on d.id_distrito = h.id_distrito
 where h.id_han = p.id_han and p.id_cabildo is distinct from d.id_cabildo;

-- -----------------------------------------------------------------------------
-- B. Funciones de ámbito (se calculan una vez por consulta)
-- -----------------------------------------------------------------------------
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles p where p.id = auth.uid() and p.id_rol = 3);
$$;

-- Editor = Responsable, Administrador o Encargado de estadística
create or replace function public.es_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles p where p.id = auth.uid() and p.id_rol in (1, 3, 4));
$$;

-- Hanes que el usuario puede ver
create or replace function public.mis_hanes()
returns bigint[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(h.id_han), '{}')
    from perfiles p
    join han h on true
    join distrito d on d.id_distrito = h.id_distrito
    join cabildo c on c.id_cabildo = d.id_cabildo
   where p.id = auth.uid()
     and (p.id_rol = 3
          or c.id_region   = p.id_region
          or c.id_cabildo  = p.id_cabildo
          or d.id_distrito = p.id_distrito
          or h.id_han      = p.id_han);
$$;

-- Cabildos completos que el usuario puede ver (para personas sin han)
create or replace function public.mis_cabildos()
returns bigint[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(c.id_cabildo), '{}')
    from perfiles p
    join cabildo c on true
   where p.id = auth.uid()
     and (p.id_rol = 3 or c.id_region = p.id_region or c.id_cabildo = p.id_cabildo);
$$;

-- La persona del propio usuario (todos ven siempre su propia ficha y participación)
create or replace function public.mi_persona()
returns bigint language sql stable security definer set search_path = public as $$
  select id_persona from perfiles where id = auth.uid();
$$;

-- ¿El usuario puede ver a esta persona?
create or replace function public.ve_persona(p_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from personas x
     where x.id_persona = p_id
       and (public.es_admin()
            or x.id_persona = public.mi_persona()
            or x.id_han = any (public.mis_hanes())
            or (x.id_han is null and x.id_cabildo = any (public.mis_cabildos())))
  );
$$;

-- -----------------------------------------------------------------------------
-- C. Estado: la participación se cuenta completa, sin importar quién mira
-- -----------------------------------------------------------------------------
create or replace function public.participacion_resumen()
returns table (id_persona bigint, participaciones bigint, primera date, ultima date)
language sql stable security definer set search_path = public as $$
  select ad.id_persona, count(distinct ac.id_asistencia), min(ac.fecha_asistencia), max(ac.fecha_asistencia)
    from asistencia_d ad
    join asistencia_c ac on ac.id_asistencia = ad.id_asistencia
   where ad.id_persona is not null
   group by ad.id_persona;
$$;

create or replace view vw_estado_persona with (security_invoker = true) as
with par as (
  select coalesce((select valor_num   from parametros where clave = 'NUEVO_AMIGO_PARTICIPACIONES'), 3)  as p_part,
         coalesce((select valor_num   from parametros where clave = 'NUEVO_AMIGO_DIAS'), 30)            as p_dias,
         coalesce((select valor_num   from parametros where clave = 'ACTIVO_MESES'), 3)                 as p_meses,
                  (select valor_fecha from parametros where clave = 'INICIO_PARTICIPACION')             as p_inicio
),
part as (select * from public.participacion_resumen())
select p.id_persona,
       coalesce(part.participaciones, 0) as participaciones,
       part.primera                      as primera_participacion,
       part.ultima                       as ultima_participacion,
       case
         when not p.activo then null
         when p.membresia then
           case
             when part.ultima >= (current_date - make_interval(months => par.p_meses))::date
               then 'MIEMBRO_ACTIVO'
             when par.p_inicio is null
               or current_date < (par.p_inicio + make_interval(months => par.p_meses))::date
               then case when p.estado_inicial = 'MIEMBRO_INACTIVO' then 'MIEMBRO_INACTIVO'
                         else 'MIEMBRO_ACTIVO' end
             else 'MIEMBRO_INACTIVO'
           end
         else
           case
             when p.estado_inicial = 'AMIGO_SOKA'
               or coalesce(part.participaciones, 0) >= par.p_part
               or part.primera <= current_date - par.p_dias
               then 'AMIGO_SOKA'
             else 'NUEVO_AMIGO'
           end
       end as estado
from personas p
cross join par
left join part on part.id_persona = p.id_persona;

-- -----------------------------------------------------------------------------
-- D. Funciones para registrar participación con visitas de otros hanes
--    (devuelven solo nombre y han, y solo a quien puede editar)
-- -----------------------------------------------------------------------------
create or replace function public.buscar_personas(p_texto text)
returns table (id_persona bigint, nombre text, division text, id_han bigint, han text, cabildo text)
language sql stable security definer set search_path = public as $$
  select p.id_persona, p.nombre::text, p.division::text, p.id_han, e.han::text, e.cabildo::text
    from personas p
    left join vw_estructura e on e.id_han = p.id_han
   where public.es_editor()
     and p.activo
     and length(btrim(coalesce(p_texto, ''))) >= 3
     and translate(lower(p.nombre), 'áéíóúüñ', 'aeiouun')
         like '%' || translate(lower(btrim(p_texto)), 'áéíóúüñ', 'aeiouun') || '%'
   order by p.nombre
   limit 15;
$$;

create or replace function public.personas_nombres(p_ids bigint[])
returns table (id_persona bigint, nombre text, division text, id_han bigint, han text)
language sql stable security definer set search_path = public as $$
  select p.id_persona, p.nombre::text, p.division::text, p.id_han, h.nombre::text
    from personas p
    left join han h on h.id_han = p.id_han
   where public.es_editor() and p.id_persona = any (p_ids);
$$;

-- Participación de una persona (completa, incluso en otros hanes), si se la puede ver
create or replace function public.participacion_persona(p_id bigint)
returns table (id_asistencia bigint, fecha date, tipo text, id_han bigint, han text)
language sql stable security definer set search_path = public as $$
  select ac.id_asistencia, ac.fecha_asistencia, te.nombre::text, ac.id_han, h.nombre::text
    from asistencia_d ad
    join asistencia_c ac on ac.id_asistencia = ad.id_asistencia
    left join tipo_evento te on te.id_tipo_evento = ac.id_tipo_evento
    left join han h on h.id_han = ac.id_han
   where ad.id_persona = p_id and public.ve_persona(p_id)
   order by ac.fecha_asistencia desc
   limit 200;
$$;

revoke all on function public.buscar_personas(text) from public, anon;
revoke all on function public.personas_nombres(bigint[]) from public, anon;
revoke all on function public.participacion_persona(bigint) from public, anon;
revoke all on function public.participacion_resumen() from public, anon;
grant execute on function public.buscar_personas(text) to authenticated;
grant execute on function public.personas_nombres(bigint[]) to authenticated;
grant execute on function public.participacion_persona(bigint) to authenticated;
grant execute on function public.participacion_resumen() to authenticated;

-- Triggers que leen o tocan personas fuera del ámbito de quien carga
alter function public.fn_asistencia_d_autofill() security definer;
alter function public.fn_asistencia_d_autofill() set search_path = public;
alter function public.fn_shakubuku_gohonzon() security definer;
alter function public.fn_shakubuku_gohonzon() set search_path = public;

-- -----------------------------------------------------------------------------
-- E. Reglas de seguridad (RLS)
-- -----------------------------------------------------------------------------
-- Borra las reglas viejas de una tabla (las genéricas del esquema y de pasos anteriores)
create or replace function pg_temp.limpiar_politicas(t text) returns void language plpgsql as $f$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
    execute format('drop policy %I on %I', r.policyname, t);
  end loop;
  execute format('alter table %I enable row level security', t);
end $f$;

-- E.1 Catálogos y estructura: todos leen, solo el ADMINISTRADOR cambia
do $$
declare t text;
begin
  foreach t in array array['region','cabildo','distrito','han','estados','divisiones','tipo_evento',
                           'tipos_grupos','grupos','cargo','rol','examenes','tipo_suscripciones',
                           'condiciones','motivos_baja'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    perform pg_temp.limpiar_politicas(t);
    execute format('create policy amb_sel on %I for select to authenticated using (true)', t);
    execute format('create policy amb_admin on %I for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()))', t);
  end loop;
end $$;

-- E.2 Personas
select pg_temp.limpiar_politicas('personas');
create policy amb_sel on personas for select to authenticated using (
  (select public.es_admin())
  or id_persona = (select public.mi_persona())
  or id_han = any ((select public.mis_hanes())::bigint[])
  or (id_han is null and id_cabildo = any ((select public.mis_cabildos())::bigint[]))
);
create policy amb_ins on personas for insert to authenticated with check (
  (select public.es_editor()) and (
    (select public.es_admin())
    or id_han = any ((select public.mis_hanes())::bigint[])
    or (id_han is null and id_cabildo = any ((select public.mis_cabildos())::bigint[]))
  )
);
create policy amb_upd on personas for update to authenticated
  using (
    (select public.es_editor()) and (
      (select public.es_admin())
      or id_han = any ((select public.mis_hanes())::bigint[])
      or (id_han is null and id_cabildo = any ((select public.mis_cabildos())::bigint[]))
    ))
  with check (
    (select public.es_editor()) and (
      (select public.es_admin())
      or id_han = any ((select public.mis_hanes())::bigint[])
      or (id_han is null and id_cabildo = any ((select public.mis_cabildos())::bigint[]))
    ));
create policy amb_del on personas for delete to authenticated using ((select public.es_admin()));

-- E.3 Reuniones (cabecera): por han. Las de grupos horizontales (sin han) las ven todos.
select pg_temp.limpiar_politicas('asistencia_c');
create policy amb_sel on asistencia_c for select to authenticated using (
  id_han is null or (select public.es_admin()) or id_han = any ((select public.mis_hanes())::bigint[])
);
create policy amb_mod on asistencia_c for all to authenticated
  using ((select public.es_editor()) and ((select public.es_admin()) or id_han = any ((select public.mis_hanes())::bigint[])))
  with check ((select public.es_editor()) and ((select public.es_admin()) or id_han = any ((select public.mis_hanes())::bigint[])));

-- E.4 Participantes: según la reunión (así se pueden cargar visitas de otros hanes)
select pg_temp.limpiar_politicas('asistencia_d');
create policy amb_sel on asistencia_d for select to authenticated using (
  exists (select 1 from asistencia_c c where c.id_asistencia = asistencia_d.id_asistencia)
);
create policy amb_mod on asistencia_d for all to authenticated
  using ((select public.es_editor()) and exists (
    select 1 from asistencia_c c where c.id_asistencia = asistencia_d.id_asistencia
       and ((select public.es_admin()) or c.id_han = any ((select public.mis_hanes())::bigint[]))))
  with check ((select public.es_editor()) and exists (
    select 1 from asistencia_c c where c.id_asistencia = asistencia_d.id_asistencia
       and ((select public.es_admin()) or c.id_han = any ((select public.mis_hanes())::bigint[]))));

-- E.5 Datos de la ficha: según la persona
do $$
declare t text;
begin
  foreach t in array array['persona_cargo','grupos_personas','examen_personas','suscripciones'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    perform pg_temp.limpiar_politicas(t);
    execute format($p$create policy amb_sel on %1$I for select to authenticated using (
      exists (select 1 from personas p where p.id_persona = %1$I.id_persona))$p$, t);
    execute format($p$create policy amb_mod on %1$I for all to authenticated
      using ((select public.es_editor()) and exists (select 1 from personas p where p.id_persona = %1$I.id_persona))
      with check ((select public.es_editor()) and exists (select 1 from personas p where p.id_persona = %1$I.id_persona))$p$, t);
  end loop;
end $$;

-- E.6 Shakubuku: se ve si se ve a quien recibió o a quien recomendó; se carga sobre quien recibió
select pg_temp.limpiar_politicas('shakubuku');
create policy amb_sel on shakubuku for select to authenticated using (
  exists (select 1 from personas p where p.id_persona in (shakubuku.id_shakubuku_para, shakubuku.id_shakubuku_de))
);
create policy amb_mod on shakubuku for all to authenticated
  using ((select public.es_editor()) and exists (select 1 from personas p where p.id_persona = shakubuku.id_shakubuku_para))
  with check ((select public.es_editor()) and exists (select 1 from personas p where p.id_persona = shakubuku.id_shakubuku_para));

-- E.7 Metas por han
select pg_temp.limpiar_politicas('objetivos');
create policy amb_sel on objetivos for select to authenticated using (
  (select public.es_admin()) or id_han = any ((select public.mis_hanes())::bigint[])
);
create policy amb_admin on objetivos for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- E.8 Usuarios: cada uno ve su perfil; los editores ven los de su ámbito; solo el ADMINISTRADOR cambia
select pg_temp.limpiar_politicas('perfiles');
create policy amb_sel on perfiles for select to authenticated using (
  id = auth.uid()
  or (select public.es_admin())
  or ((select public.es_editor()) and exists (select 1 from personas p where p.id_persona = perfiles.id_persona))
);
create policy amb_admin on perfiles for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));


-- Resumen por han: solo los hanes del ámbito (si no, aparecerían todos en cero)
create or replace view vw_tookan_resumen_han with (security_invoker = true) as
select est.id_region, est.region, est.id_cabildo, est.cabildo,
       est.id_distrito, est.distrito, est.id_han, est.han,
       count(p.id_persona) filter (where p.activo)                                   as personas,
       count(p.id_persona) filter (where ep.estado = 'MIEMBRO_ACTIVO')               as miembros_activos,
       count(p.id_persona) filter (where ep.estado = 'MIEMBRO_INACTIVO')             as miembros_inactivos,
       count(p.id_persona) filter (where ep.estado = 'AMIGO_SOKA')                   as amigos_soka,
       count(p.id_persona) filter (where ep.estado = 'NUEVO_AMIGO')                  as nuevos_amigos,
       count(p.id_persona) filter (where p.activo and p.titular_gohonzo = 1)         as con_gohonzon,
       count(p.id_persona) filter (where p.activo and p.division = 'DS')             as ds,
       count(p.id_persona) filter (where p.activo and p.division = 'DF')             as df,
       count(p.id_persona) filter (where p.activo and p.division = 'DJM')            as djm,
       count(p.id_persona) filter (where p.activo and p.division = 'DJF')            as djf,
       count(p.id_persona) filter (where p.activo and p.division = 'GE')             as ge,
       count(p.id_persona) filter (where p.activo and p.cedula is null)              as sin_cedula,
       count(p.id_persona) filter (where not p.activo)                               as bajas
from vw_estructura est
left join personas p          on p.id_han = est.id_han
left join vw_estado_persona ep on ep.id_persona = p.id_persona
where (select public.es_admin()) or est.id_han = any ((select public.mis_hanes())::bigint[])
group by est.id_region, est.region, est.id_cabildo, est.cabildo,
         est.id_distrito, est.distrito, est.id_han, est.han;

-- -----------------------------------------------------------------------------
-- F. Vistas: que respeten el ámbito de quien consulta
-- -----------------------------------------------------------------------------
do $$
declare v text;
begin
  foreach v in array array['vw_estructura','vw_asistencia_detalle','vw_asistencia_por_evento',
                           'vw_participacion_miembro','vw_dash_division','vw_dash_estado','vw_dash_han',
                           'vw_dash_asistencia_mensual','vw_personas_tookan','vw_tookan_resumen_han',
                           'vw_shakubuku_por_persona','vw_cargos_vigentes','vw_estado_persona'] loop
    if to_regclass('public.' || v) is not null then
      execute format('alter view %I set (security_invoker = true)', v);
    end if;
  end loop;
end $$;

-- Las vistas del tablero eran públicas (anon): ahora solo usuarios logueados
do $$
declare v text;
begin
  foreach v in array array['vw_dash_division','vw_dash_estado','vw_dash_han','vw_dash_asistencia_mensual'] loop
    if to_regclass('public.' || v) is not null then
      execute format('revoke all on %I from anon', v);
    end if;
  end loop;
end $$;

commit;

notify pgrst, 'reload schema';

-- Verificación: reglas por tabla
select tablename, count(*) as reglas
  from pg_policies
 where schemaname = 'public'
   and tablename in ('personas','asistencia_c','asistencia_d','persona_cargo','shakubuku','perfiles','han')
 group by tablename order by tablename;
