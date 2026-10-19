-- =============================================================================
-- RedSokappy → Tookan Digital · Paso 1: ESTRUCTURA
-- Fecha: 19-oct-2026
--
-- Qué hace: agrega a la base actual lo que falta para el Tookan de toda la SGPy.
--   A. Catálogos nuevos: condiciones, motivos de baja, Grupo Esperanza, nivel de cargos, rol encargado.
--   B. personas: cédula, apellido, condición, baja, depto. de contribuciones, auditoría.
--   C. persona_cargo: cargo organizacional con ámbito y fecha de asunción.
--   D. shakubuku: Recomendador 1 / 2.
--   E. examen_personas y suscripciones: año.
--   F. asistencia_c: actividades de grupos horizontales.
--   G. perfiles: ámbito del usuario (región / cabildo / distrito / han).
--   H. auditoria: historial de cambios.
--   I. stg_tookan: tabla intermedia para importar las planillas.
--   J. Vistas nuevas para el Tookan.
--   K. Limpieza: daimoku y stg_asistencia_import.
--
-- Qué NO hace (va en el Paso 2):
--   * Reglas de seguridad por ámbito (que cada cabildo vea solo lo suyo).
--     Mientras tanto, las tablas nuevas usan las mismas reglas que las actuales
--     (leer: cualquier usuario logueado; escribir: editores).
--
-- Es ADITIVO: no borra columnas que usa la app hoy (ej. personas.nombre,
-- titular_gohonzo) ni toca las tablas del Festival.
-- Se puede correr más de una vez.
-- Ejecutar en el SQL Editor de Supabase.
-- =============================================================================
begin;

-- =============================================================================
-- A. CATÁLOGOS
-- =============================================================================

-- A.1 Condición de la persona (dato 2 del Tookan)
create table if not exists condiciones (
  codigo      varchar(20) primary key,
  descripcion varchar(60) not null,
  orden       smallint    not null
);
insert into condiciones (codigo, descripcion, orden) values
  ('NUEVO_AMIGO', 'Nuevo amigo',               1),
  ('AMIGO_SOKA',  'Amigo Soka',                2),
  ('MEMBRESIA',   'Miembro con membresía',     3),
  ('GOHONZON',    'Miembro con Gohonzon',      4)
on conflict (codigo) do nothing;

-- A.2 Motivos de baja (salen de las hojas extra de las planillas)
create table if not exists motivos_baja (
  codigo      varchar(20) primary key,
  descripcion varchar(60) not null
);
insert into motivos_baja (codigo, descripcion) values
  ('FALLECIDO',         'Fallecido/a'),
  ('EXTERIOR',          'Reside en el exterior'),
  ('TRASLADO',          'Trasladado/a a otra zona'),
  ('DEVOLVIO_GOHONZON', 'Devolvió el Gohonzon (taiten)'),
  ('NO_UBICADO',        'No se lo/la pudo ubicar'),
  ('OTRO',              'Otro motivo')
on conflict (codigo) do nothing;

-- A.3 División Grupo Esperanza (columna "G.Esp." de las planillas)
insert into divisiones (codigo, descripcion) values ('GE', 'Grupo Esperanza')
on conflict (codigo) do nothing;

-- A.4 Cargos: nivel en el que se ejerce (la lista oficial la define la SGPy)
do $$ begin
  if (select character_maximum_length from information_schema.columns
       where table_schema = 'public' and table_name = 'cargo' and column_name = 'cargo') < 100 then
    alter table cargo alter column cargo type varchar(100);
  end if;
end $$;
alter table cargo add column if not exists nivel  varchar(10);
alter table cargo add column if not exists orden  smallint;
alter table cargo add column if not exists activo boolean not null default true;
do $$ begin
  alter table cargo add constraint ck_cargo_nivel
    check (nivel is null or nivel in ('NACIONAL','REGION','CABILDO','DISTRITO','HAN'));
exception when duplicate_object then null; end $$;

-- A.5 Rol nuevo: encargado de estadística (carga y mantiene datos dentro de su ámbito)
insert into rol (id_rol, rol) values (4, 'ENCARGADO DE ESTADISTICA')
on conflict (id_rol) do nothing;
select setval(pg_get_serial_sequence('rol','id_rol'), greatest((select max(id_rol) from rol), 1));

-- es_editor(): ahora también el encargado de estadística (4) puede editar.
-- (En el Paso 2 se limita a su ámbito.)
create or replace function public.es_editor()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.id_rol in (1, 3, 4)
  );
$$;

-- =============================================================================
-- B. PERSONAS
-- =============================================================================
alter table personas add column if not exists apellido            varchar(100);
alter table personas add column if not exists cedula              varchar(15);
alter table personas add column if not exists fecha_nacimiento    date;
alter table personas add column if not exists condicion           varchar(20) references condiciones(codigo);
alter table personas add column if not exists activo              boolean not null default true;
alter table personas add column if not exists motivo_baja         varchar(20) references motivos_baja(codigo);
alter table personas add column if not exists fecha_baja          date;
alter table personas add column if not exists observacion         varchar(500);
alter table personas add column if not exists dpto_contribuciones boolean not null default false;
alter table personas add column if not exists creado_en           timestamptz default now();
alter table personas add column if not exists creado_por          uuid default auth.uid();
alter table personas add column if not exists modificado_por      uuid;

-- Cédula: solo números, única (puede quedar vacía hasta que se complete)
do $$ begin
  alter table personas add constraint ck_personas_cedula check (cedula is null or cedula ~ '^[0-9]{4,10}$');
exception when duplicate_object then null; end $$;
create unique index if not exists ux_personas_cedula on personas(cedula) where cedula is not null;

-- Si está dado de baja, tiene que tener motivo
do $$ begin
  alter table personas add constraint ck_personas_baja check (activo or motivo_baja is not null);
exception when duplicate_object then null; end $$;

create index if not exists ix_personas_condicion on personas(condicion);
create index if not exists ix_personas_activo    on personas(activo);
create index if not exists ix_personas_apellido  on personas(lower(apellido), lower(nombre));

-- Pasar lo que ya había al campo nuevo de condición
update personas set condicion = 'GOHONZON'    where condicion is null and titular_gohonzo = 1;
update personas set condicion = 'NUEVO_AMIGO' where condicion is null and id_estado = 4;
update personas set condicion = 'AMIGO_SOKA'  where condicion is null and id_estado = 5;
update personas set activo = false, motivo_baja = 'EXTERIOR'
 where activo and id_estado = 2;  -- "RESIDE EN EL EXTRANJERO"

-- Al modificar una persona: fecha y usuario que modificó
create or replace function public.fn_touch_persona()
returns trigger language plpgsql as $$
begin
  new.fecha_actualizacion := now();
  new.modificado_por      := coalesce(auth.uid(), new.modificado_por);
  -- Coherencia de la baja
  if new.activo then
    new.motivo_baja := null;
    new.fecha_baja  := null;
  elsif new.fecha_baja is null then
    new.fecha_baja := current_date;
  end if;
  return new;
end;
$$;

-- Mantener condición y titular_gohonzo sincronizados mientras la app use los dos
create or replace function public.fn_shakubuku_gohonzon()
returns trigger
language plpgsql
as $$
begin
  if new.id_shakubuku_para is not null and (new.gohonzon = 1 or new.membresia = 1) then
    update personas
       set titular_gohonzo = case when new.gohonzon = 1 then 1 else titular_gohonzo end,
           condicion = case
                         when new.gohonzon = 1 then 'GOHONZON'
                         when coalesce(condicion, '') <> 'GOHONZON' then 'MEMBRESIA'
                         else condicion
                       end,
           fecha_ingreso = coalesce(
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
-- C. CARGOS ORGANIZACIONALES (datos 4 y 9)
-- =============================================================================
create table if not exists persona_cargo (
  id_persona_cargo bigint generated by default as identity primary key,
  id_persona       bigint not null references personas(id_persona) on delete cascade,
  id_cargo         bigint not null references cargo(id_cargo),
  nivel            varchar(10) not null,
  id_region        bigint references region(id_region),
  id_cabildo       bigint references cabildo(id_cabildo),
  id_distrito      bigint references distrito(id_distrito),
  id_han           bigint references han(id_han),
  fecha_asuncion   date,
  fecha_fin        date,
  observacion      varchar(200),
  creado_en        timestamptz default now(),
  creado_por       uuid default auth.uid(),
  constraint ck_pc_nivel check (nivel in ('NACIONAL','REGION','CABILDO','DISTRITO','HAN')),
  -- El ámbito tiene que coincidir con el nivel (ej. cargo de cabildo → solo id_cabildo)
  constraint ck_pc_ambito check (
       (nivel = 'NACIONAL' and id_region is null     and id_cabildo is null     and id_distrito is null     and id_han is null)
    or (nivel = 'REGION'   and id_region is not null and id_cabildo is null     and id_distrito is null     and id_han is null)
    or (nivel = 'CABILDO'  and id_region is null     and id_cabildo is not null and id_distrito is null     and id_han is null)
    or (nivel = 'DISTRITO' and id_region is null     and id_cabildo is null     and id_distrito is not null and id_han is null)
    or (nivel = 'HAN'      and id_region is null     and id_cabildo is null     and id_distrito is null     and id_han is not null)
  ),
  constraint ck_pc_fechas check (fecha_fin is null or fecha_asuncion is null or fecha_fin >= fecha_asuncion)
);
create index if not exists ix_pc_persona on persona_cargo(id_persona);
create index if not exists ix_pc_vigente on persona_cargo(id_cargo) where fecha_fin is null;

-- =============================================================================
-- D. SHAKUBUKU: Recomendador 1 y 2 (dato 10)
-- =============================================================================
-- orden = 1 (Recomendador 1) / 2 (Recomendador 2) / null (a confirmar).
-- Queda en null por defecto para que el alta automática desde asistencia no choque.
alter table shakubuku add column if not exists orden smallint;
do $$ begin
  alter table shakubuku add constraint ck_shakubuku_orden check (orden is null or orden in (1, 2));
exception when duplicate_object then null; end $$;
create unique index if not exists ux_shakubuku_para_orden
  on shakubuku(id_shakubuku_para, orden) where orden is not null;
create index if not exists ix_shakubuku_de on shakubuku(id_shakubuku_de);

-- =============================================================================
-- E. EXÁMENES Y SUSCRIPCIONES: año (datos 5 y 6)
-- =============================================================================
alter table examen_personas add column if not exists anho smallint;
alter table suscripciones   add column if not exists anho smallint;
create index if not exists ix_examen_personas_persona on examen_personas(id_persona);
create index if not exists ix_suscripciones_persona   on suscripciones(id_persona);
create index if not exists ix_grupos_personas_persona on grupos_personas(id_persona);

-- =============================================================================
-- F. ASISTENCIA: actividades de grupos horizontales
-- =============================================================================
alter table asistencia_c add column if not exists id_grupo   bigint references grupos(id_grupo);
alter table asistencia_c add column if not exists creado_en  timestamptz default now();
alter table asistencia_c add column if not exists creado_por uuid default auth.uid();
-- Toda reunión es de un Han o de un grupo horizontal (no valida datos viejos)
do $$ begin
  alter table asistencia_c add constraint ck_asistencia_c_origen
    check (id_han is not null or id_grupo is not null) not valid;
exception when duplicate_object then null; end $$;
create index if not exists ix_asistencia_c_han   on asistencia_c(id_han);
create index if not exists ix_asistencia_c_grupo on asistencia_c(id_grupo);

-- =============================================================================
-- G. PERFILES: ámbito del usuario
-- =============================================================================
-- Ninguno cargado = alcance nacional (solo para Coordinación General / ADMINISTRADOR).
-- Uno solo cargado = ve y edita ese ámbito y todo lo que tiene adentro (se aplica en el Paso 2).
alter table perfiles add column if not exists id_region   bigint references region(id_region);
alter table perfiles add column if not exists id_cabildo  bigint references cabildo(id_cabildo);
alter table perfiles add column if not exists id_distrito bigint references distrito(id_distrito);
alter table perfiles add column if not exists id_han      bigint references han(id_han);
do $$ begin
  alter table perfiles add constraint ck_perfiles_un_ambito check (
    (id_region is not null)::int + (id_cabildo is not null)::int +
    (id_distrito is not null)::int + (id_han is not null)::int <= 1
  );
exception when duplicate_object then null; end $$;

-- =============================================================================
-- H. AUDITORÍA (quién cambió qué y cuándo)
-- =============================================================================
create table if not exists auditoria (
  id          bigint generated by default as identity primary key,
  tabla       varchar(40)  not null,
  id_registro varchar(40),
  accion      char(1)      not null check (accion in ('I','U','D')),
  cambios     jsonb,         -- I: fila nueva · U: solo los campos que cambiaron (antes/después) · D: fila borrada
  usuario     uuid default auth.uid(),
  fecha       timestamptz not null default now()
);
create index if not exists ix_auditoria_tabla_reg on auditoria(tabla, id_registro);
create index if not exists ix_auditoria_fecha     on auditoria(fecha);

create or replace function public.fn_auditoria()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_pk     text := tg_argv[0];
  v_old    jsonb;
  v_new    jsonb;
  v_diff   jsonb;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    insert into auditoria (tabla, id_registro, accion, cambios)
    values (tg_table_name, v_new ->> v_pk, 'I', v_new);
    return new;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    select jsonb_object_agg(k, jsonb_build_object('antes', v_old -> k, 'despues', v_new -> k))
      into v_diff
      from jsonb_object_keys(v_new) k
     where (v_old -> k) is distinct from (v_new -> k)
       and k not in ('fecha_actualizacion', 'modificado_por');
    if v_diff is not null then
      insert into auditoria (tabla, id_registro, accion, cambios)
      values (tg_table_name, v_new ->> v_pk, 'U', v_diff);
    end if;
    return new;
  else
    v_old := to_jsonb(old);
    insert into auditoria (tabla, id_registro, accion, cambios)
    values (tg_table_name, v_old ->> v_pk, 'D', v_old);
    return old;
  end if;
end;
$$;

-- Se audita la ficha y sus datos (la asistencia NO, para no inflar la base)
do $$
declare
  r record;
begin
  for r in select * from (values
    ('personas',        'id_persona'),
    ('persona_cargo',   'id_persona_cargo'),
    ('shakubuku',       'id_shakubuku'),
    ('grupos_personas', 'id_grupo_persona'),
    ('examen_personas', 'id_examen_personas'),
    ('suscripciones',   'id_suscripcion'),
    ('perfiles',        'id')
  ) as t(tabla, pk)
  loop
    execute format('drop trigger if exists trg_auditoria on %I', r.tabla);
    execute format(
      'create trigger trg_auditoria after insert or update or delete on %I
         for each row execute function public.fn_auditoria(%L)', r.tabla, r.pk);
  end loop;
end $$;

-- =============================================================================
-- I. STAGING PARA IMPORTAR LAS PLANILLAS
-- =============================================================================
-- Cada fila de cada planilla entra acá tal cual; se revisa (duplicados, han/cargo
-- que no existe) y recién después se pasa a personas / persona_cargo.
create table if not exists stg_tookan (
  id             bigint generated by default as identity primary key,
  archivo        varchar(200),
  hoja           varchar(100),
  fila           integer,
  region         varchar(100),
  cabildo        varchar(100),
  distrito       varchar(100),
  han            varchar(100),
  nombre_completo varchar(200),
  division       varchar(10),
  cargo_texto    varchar(200),
  estado_texto   varchar(100),
  gohonzon       boolean,
  membresia      boolean,
  pyseikyo       boolean,
  kofu           boolean,
  observacion    varchar(500),
  extra          jsonb,          -- columnas propias de cada cabildo
  id_persona     bigint references personas(id_persona),  -- a quién se asoció
  estado_import  varchar(15) not null default 'PENDIENTE'
                 check (estado_import in ('PENDIENTE','OK','DUPLICADO','REVISAR','ERROR','DESCARTADO')),
  mensaje        varchar(500),
  lote           varchar(50),
  cargado_en     timestamptz not null default now()
);
create index if not exists ix_stg_tookan_estado on stg_tookan(estado_import);
create index if not exists ix_stg_tookan_lote   on stg_tookan(lote);

-- =============================================================================
-- J. VISTAS DEL TOOKAN (respetan los permisos de quien consulta)
-- =============================================================================

-- Ficha completa de la persona
create or replace view vw_personas_tookan with (security_invoker = true) as
select p.id_persona,
       p.cedula,
       p.nombre,
       p.apellido,
       case when coalesce(p.apellido, '') = '' then p.nombre
            else p.apellido || ', ' || p.nombre end          as nombre_completo,
       p.division,
       p.condicion,
       c.descripcion  as condicion_desc,
       p.activo,
       p.motivo_baja,
       p.fecha_baja,
       p.dpto_contribuciones,
       p.telefono,
       p.fecha_nacimiento,
       p.fecha_ingreso,
       est.id_han, est.han, est.id_distrito, est.distrito,
       est.id_cabildo, est.cabildo, est.id_region, est.region,
       (select string_agg(cg.cargo, ' / ' order by cg.orden nulls last, cg.cargo)
          from persona_cargo pc join cargo cg on cg.id_cargo = pc.id_cargo
         where pc.id_persona = p.id_persona and pc.fecha_fin is null)            as cargos_vigentes,
       (select count(*) from shakubuku s
         where s.id_shakubuku_de = p.id_persona and s.gohonzon = 1)               as shakubuku_gohonzon,
       (select count(*) from shakubuku s
         where s.id_shakubuku_de = p.id_persona and s.membresia = 1)              as shakubuku_membresia,
       p.fecha_actualizacion
from personas p
left join condiciones c   on c.codigo = p.condicion
left join vw_estructura est on est.id_han = p.id_han;

-- Totales por han (base para sumar por distrito, cabildo, región)
create or replace view vw_tookan_resumen_han with (security_invoker = true) as
select est.id_region, est.region, est.id_cabildo, est.cabildo,
       est.id_distrito, est.distrito, est.id_han, est.han,
       count(p.id_persona) filter (where p.activo)                                   as total_activos,
       count(p.id_persona) filter (where p.activo and p.division = 'DS')             as ds,
       count(p.id_persona) filter (where p.activo and p.division = 'DF')             as df,
       count(p.id_persona) filter (where p.activo and p.division = 'DJM')            as djm,
       count(p.id_persona) filter (where p.activo and p.division = 'DJF')            as djf,
       count(p.id_persona) filter (where p.activo and p.division = 'GE')             as ge,
       count(p.id_persona) filter (where p.activo and p.condicion = 'NUEVO_AMIGO')   as nuevos_amigos,
       count(p.id_persona) filter (where p.activo and p.condicion = 'AMIGO_SOKA')    as amigos_soka,
       count(p.id_persona) filter (where p.activo and p.condicion = 'MEMBRESIA')     as con_membresia,
       count(p.id_persona) filter (where p.activo and p.condicion = 'GOHONZON')      as con_gohonzon,
       count(p.id_persona) filter (where p.activo and p.condicion is null)           as sin_condicion,
       count(p.id_persona) filter (where p.activo and p.cedula is null)              as sin_cedula,
       count(p.id_persona) filter (where not p.activo)                               as bajas
from vw_estructura est
left join personas p on p.id_han = est.id_han
group by est.id_region, est.region, est.id_cabildo, est.cabildo,
         est.id_distrito, est.distrito, est.id_han, est.han;

-- Shakubuku concretado por persona (lo que el sistema "calcula solo")
create or replace view vw_shakubuku_por_persona with (security_invoker = true) as
select s.id_shakubuku_de as id_persona,
       count(*) filter (where s.gohonzon = 1)                    as con_gohonzon,
       count(*) filter (where s.membresia = 1)                   as con_membresia,
       count(*) filter (where s.orden = 1)                       as como_recomendador_1,
       count(*) filter (where s.orden = 2)                       as como_recomendador_2,
       count(*)                                                  as total_registros
from shakubuku s
where s.id_shakubuku_de is not null
group by s.id_shakubuku_de;

-- =============================================================================
-- K. LIMPIEZA (tablas sin uso)
-- =============================================================================
drop table if exists daimoku;
drop table if exists stg_asistencia_import;

-- =============================================================================
-- L. SEGURIDAD de las tablas nuevas (mismo modelo que hoy; se refina en el Paso 2)
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['condiciones','motivos_baja','persona_cargo'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "sel_auth_%1$s" on %1$I', t);
    execute format('create policy "sel_auth_%1$s" on %1$I for select to authenticated using (true)', t);
    execute format('drop policy if exists "ins_edit_%1$s" on %1$I', t);
    execute format('create policy "ins_edit_%1$s" on %1$I for insert to authenticated with check (public.es_editor())', t);
    execute format('drop policy if exists "upd_edit_%1$s" on %1$I', t);
    execute format('create policy "upd_edit_%1$s" on %1$I for update to authenticated using (public.es_editor()) with check (public.es_editor())', t);
    execute format('drop policy if exists "del_edit_%1$s" on %1$I', t);
    execute format('create policy "del_edit_%1$s" on %1$I for delete to authenticated using (public.es_editor())', t);
  end loop;
end $$;

-- Auditoría y staging: solo Coordinación General (ADMINISTRADOR) los lee.
-- Nadie escribe directo en auditoría: la llena el trigger.
alter table auditoria  enable row level security;
alter table stg_tookan enable row level security;
drop policy if exists sel_admin_auditoria on auditoria;
create policy sel_admin_auditoria on auditoria for select to authenticated
  using (exists (select 1 from perfiles p where p.id = auth.uid() and p.id_rol = 3));
drop policy if exists all_admin_stg_tookan on stg_tookan;
create policy all_admin_stg_tookan on stg_tookan for all to authenticated
  using (exists (select 1 from perfiles p where p.id = auth.uid() and p.id_rol = 3))
  with check (exists (select 1 from perfiles p where p.id = auth.uid() and p.id_rol = 3));

grant select on vw_personas_tookan, vw_tookan_resumen_han, vw_shakubuku_por_persona to authenticated;

commit;

notify pgrst, 'reload schema';

-- Verificación rápida: tiene que listar las tablas nuevas
select table_name from information_schema.tables
 where table_schema = 'public'
   and table_name in ('condiciones','motivos_baja','persona_cargo','auditoria','stg_tookan')
 order by 1;
