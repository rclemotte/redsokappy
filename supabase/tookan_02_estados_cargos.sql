-- =============================================================================
-- RedSokappy → Tookan Digital · Paso 2: ESTADOS, PARÁMETROS Y CARGOS
-- Fecha: 26-oct-2026 · Correr DESPUÉS de tookan_01_estructura.sql
--
-- Qué hace:
--   A. parametros: los números de las reglas, editables desde Administración.
--   B. Estado de la persona (un solo estado, lo calcula el sistema):
--        Nuevo amigo · Amigo Soka · Miembro activo · Miembro inactivo
--      - personas.membresia (sí/no) pasa a ser un dato; el Gohonzon sigue en titular_gohonzo.
--      - personas.condicion se renombra a estado_inicial: el estado que traía la
--        planilla, que se usa solo mientras no haya historial de participación.
--   C. Vista vw_estado_persona: calcula el estado de cada persona.
--   D. Cargos en tres partes: función (tabla cargo) · nivel · división.
--      La lista de funciones la mantiene el ADMINISTRADOR desde la app.
--   E. Vistas del Tookan actualizadas.
--
-- Reglas (con los valores por defecto de parametros):
--   Miembro (tiene membresía):
--     activo   = participó al menos una vez en los últimos 3 meses
--     inactivo = no participó en los últimos 3 meses
--     Mientras no haya 3 meses de participación registrada (INICIO_PARTICIPACION
--     vacío o reciente), se usa el estado de la planilla; si no trae, activo.
--   Sin membresía:
--     Amigo Soka  = ya tuvo 3 participaciones, o pasó 1 mes desde la primera,
--                   o la planilla ya lo traía como Amigo Soka
--     Nuevo amigo = el resto
--   Dado de baja (personas.activo = false): sin estado, sale de las listas.
--
-- Se puede correr más de una vez. Ejecutar en el SQL Editor de Supabase.
-- =============================================================================
begin;

-- Helper: ¿el usuario actual es ADMINISTRADOR (Coordinación General)?
create or replace function public.es_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.perfiles p where p.id = auth.uid() and p.id_rol = 3);
$$;

-- =============================================================================
-- A. PARÁMETROS
-- =============================================================================
create table if not exists parametros (
  clave          varchar(40) primary key,
  valor_num      integer,
  valor_fecha    date,
  descripcion    varchar(200) not null,
  orden          smallint not null default 0,
  modificado_en  timestamptz not null default now(),
  modificado_por uuid default auth.uid()
);

insert into parametros (clave, valor_num, valor_fecha, descripcion, orden) values
  ('NUEVO_AMIGO_PARTICIPACIONES', 3,    null, 'Participaciones para pasar de Nuevo amigo a Amigo Soka', 1),
  ('NUEVO_AMIGO_DIAS',            30,   null, 'Días desde la primera participación para pasar de Nuevo amigo a Amigo Soka', 2),
  ('ACTIVO_MESES',                3,    null, 'Meses: un miembro es activo si participó en este período', 3),
  ('INICIO_PARTICIPACION',        null, null, 'Fecha desde la que se registra la participación en el Tookan (antes se usa el estado de la planilla)', 4)
on conflict (clave) do nothing;

create or replace function public.fn_touch_parametro()
returns trigger language plpgsql as $$
begin
  new.modificado_en  := now();
  new.modificado_por := coalesce(auth.uid(), new.modificado_por);
  if new.clave <> 'INICIO_PARTICIPACION' and (new.valor_num is null or new.valor_num < 1) then
    raise exception 'El valor tiene que ser un número mayor a 0';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_touch_parametro on parametros;
create trigger trg_touch_parametro before update on parametros
  for each row execute function public.fn_touch_parametro();

drop trigger if exists trg_auditoria on parametros;
create trigger trg_auditoria after insert or update or delete on parametros
  for each row execute function public.fn_auditoria('clave');

alter table parametros enable row level security;
drop policy if exists sel_auth_parametros on parametros;
create policy sel_auth_parametros on parametros for select to authenticated using (true);
drop policy if exists upd_admin_parametros on parametros;
create policy upd_admin_parametros on parametros for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- =============================================================================
-- B. ESTADO DE LA PERSONA
-- =============================================================================

-- Las vistas que usan personas.condicion se recrean más abajo
drop view if exists vw_tookan_resumen_han;
drop view if exists vw_personas_tookan;

-- B.1 Catálogo: los 4 estados
insert into condiciones (codigo, descripcion, orden) values
  ('NUEVO_AMIGO',      'Nuevo amigo',      1),
  ('AMIGO_SOKA',       'Amigo Soka',       2),
  ('MIEMBRO_ACTIVO',   'Miembro activo',   3),
  ('MIEMBRO_INACTIVO', 'Miembro inactivo', 4)
on conflict (codigo) do update set descripcion = excluded.descripcion, orden = excluded.orden;

-- B.2 Membresía como dato propio
alter table personas add column if not exists membresia boolean not null default false;

-- B.3 condicion → estado_inicial (el estado que trae la planilla)
do $$ begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'personas' and column_name = 'condicion')
     and not exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'personas' and column_name = 'estado_inicial') then
    alter table personas rename column condicion to estado_inicial;
  end if;
end $$;
alter index if exists ix_personas_condicion rename to ix_personas_estado_inicial;

update personas set membresia = true
 where not membresia and (titular_gohonzo = 1 or estado_inicial in ('MEMBRESIA', 'GOHONZON'));
update personas set estado_inicial = null where estado_inicial in ('MEMBRESIA', 'GOHONZON');
delete from condiciones where codigo in ('MEMBRESIA', 'GOHONZON');

-- B.4 Quien tiene Gohonzon tiene membresía
create or replace function public.fn_personas_membresia()
returns trigger language plpgsql as $$
begin
  if new.titular_gohonzo = 1 then
    new.membresia := true;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_personas_membresia on personas;
create trigger trg_personas_membresia before insert or update on personas
  for each row execute function public.fn_personas_membresia();

-- B.5 Shakubuku con Gohonzon o membresía → marca a la persona
create or replace function public.fn_shakubuku_gohonzon()
returns trigger
language plpgsql
as $$
begin
  if new.id_shakubuku_para is not null and (new.gohonzon = 1 or new.membresia = 1) then
    update personas
       set titular_gohonzo = case when new.gohonzon = 1 then 1 else titular_gohonzo end,
           membresia       = true,
           fecha_ingreso   = coalesce(
             fecha_ingreso,
             least(coalesce(new.fecha_gohonzon, new.fecha_membresia),
                   coalesce(new.fecha_membresia, new.fecha_gohonzon))
           )
     where id_persona = new.id_shakubuku_para;
  end if;
  return new;
end;
$$;

-- =============================================================================
-- C. ESTADO CALCULADO
-- =============================================================================
create or replace view vw_estado_persona with (security_invoker = true) as
with par as (
  select coalesce((select valor_num   from parametros where clave = 'NUEVO_AMIGO_PARTICIPACIONES'), 3)  as p_part,
         coalesce((select valor_num   from parametros where clave = 'NUEVO_AMIGO_DIAS'), 30)            as p_dias,
         coalesce((select valor_num   from parametros where clave = 'ACTIVO_MESES'), 3)                 as p_meses,
                  (select valor_fecha from parametros where clave = 'INICIO_PARTICIPACION')             as p_inicio
),
part as (
  select ad.id_persona,
         count(distinct ac.id_asistencia) as participaciones,
         min(ac.fecha_asistencia)         as primera,
         max(ac.fecha_asistencia)         as ultima
    from asistencia_d ad
    join asistencia_c ac on ac.id_asistencia = ad.id_asistencia
   where ad.id_persona is not null
   group by ad.id_persona
)
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
             -- Todavía no hay historial suficiente: se usa la planilla
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

-- =============================================================================
-- D. CARGOS EN TRES PARTES: función · nivel · división
-- =============================================================================
-- División del cargo (null = General, para todas las divisiones)
alter table persona_cargo add column if not exists division varchar(10) references divisiones(codigo);

-- Funciones iniciales (se agregan más desde Administración)
update cargo c
   set cargo = v.cargo, orden = v.orden, activo = true
  from (values ('Responsable', 1), ('Vice responsable', 2), ('Consejero', 3)) v(cargo, orden)
 where upper(btrim(c.cargo)) = upper(v.cargo)
   and (c.cargo is distinct from v.cargo or c.orden is distinct from v.orden);
insert into cargo (cargo, orden, activo)
select v.cargo, v.orden, true
  from (values ('Responsable', 1), ('Vice responsable', 2), ('Consejero', 3)) v(cargo, orden)
 where not exists (select 1 from cargo c where upper(btrim(c.cargo)) = upper(v.cargo));
select setval(pg_get_serial_sequence('cargo', 'id_cargo'), greatest((select max(id_cargo) from cargo), 1));

-- Solo el ADMINISTRADOR modifica la lista de cargos (no se borran: se desactivan)
drop policy if exists "ins_edit_cargo" on cargo;
drop policy if exists "upd_edit_cargo" on cargo;
drop policy if exists "del_edit_cargo" on cargo;
drop policy if exists ins_admin_cargo on cargo;
create policy ins_admin_cargo on cargo for insert to authenticated with check (public.es_admin());
drop policy if exists upd_admin_cargo on cargo;
create policy upd_admin_cargo on cargo for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- =============================================================================
-- E. VISTAS DEL TOOKAN
-- =============================================================================

-- Cargo vigente en texto: "Vice responsable · Han · DF"
create or replace view vw_cargos_vigentes with (security_invoker = true) as
select pc.id_persona_cargo,
       pc.id_persona,
       pc.id_cargo,
       cg.cargo                                   as funcion,
       pc.nivel,
       pc.division,
       pc.id_region, pc.id_cabildo, pc.id_distrito, pc.id_han,
       pc.fecha_asuncion,
       cg.cargo
         || ' · ' || initcap(case pc.nivel when 'REGION' then 'Región' else pc.nivel end)
         || coalesce(' · ' || pc.division, '')    as cargo_texto,
       cg.orden
  from persona_cargo pc
  join cargo cg on cg.id_cargo = pc.id_cargo
 where pc.fecha_fin is null;

create or replace view vw_personas_tookan with (security_invoker = true) as
select p.id_persona,
       p.cedula,
       p.nombre,
       p.apellido,
       case when coalesce(p.apellido, '') = '' then p.nombre
            else p.apellido || ', ' || p.nombre end          as nombre_completo,
       p.division,
       ep.estado,
       c.descripcion                                         as estado_desc,
       p.membresia,
       (p.titular_gohonzo = 1)                               as gohonzon,
       p.activo,
       p.motivo_baja,
       p.fecha_baja,
       p.dpto_contribuciones,
       p.telefono,
       p.fecha_nacimiento,
       p.fecha_ingreso,
       ep.participaciones,
       ep.ultima_participacion,
       est.id_han, est.han, est.id_distrito, est.distrito,
       est.id_cabildo, est.cabildo, est.id_region, est.region,
       (select string_agg(cv.cargo_texto, ' / ' order by cv.orden nulls last, cv.cargo_texto)
          from vw_cargos_vigentes cv where cv.id_persona = p.id_persona)         as cargos_vigentes,
       (select count(*) from shakubuku s
         where s.id_shakubuku_de = p.id_persona and (s.gohonzon = 1 or s.membresia = 1)) as shakubuku,
       p.observacion,
       p.fecha_actualizacion
from personas p
join vw_estado_persona ep on ep.id_persona = p.id_persona
left join condiciones c   on c.codigo = ep.estado
left join vw_estructura est on est.id_han = p.id_han;

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
group by est.id_region, est.region, est.id_cabildo, est.cabildo,
         est.id_distrito, est.distrito, est.id_han, est.han;

grant select on vw_estado_persona, vw_cargos_vigentes, vw_personas_tookan, vw_tookan_resumen_han
  to authenticated;

commit;

notify pgrst, 'reload schema';

-- Verificación: tiene que mostrar los 4 parámetros y los cargos
select clave, valor_num, valor_fecha from parametros order by orden;
select id_cargo, cargo, orden, activo from cargo order by orden nulls last, cargo;
