-- =============================================================
-- RedSokappy — Módulo FESTIVAL (registro + ingreso a eventos)
-- Ejecutar en el SQL Editor de Supabase (una sola vez).
--
-- Diseño:
--  * fest_evento   : los eventos (ej. Festival por la Paz, 2 funciones).
--  * fest_registro : pre-inscripción pública (link sin login).
--  * fest_ingreso  : ingreso el día del evento (kiosko abierto, solo cédula).
--  * El público (anon) NUNCA lee las tablas: solo llama a 3 funciones
--    security definer que validan y devuelven lo mínimo.
--  * Los editores (rol 1/3) ven todo y reciben cambios en tiempo real.
-- =============================================================
begin;

-- 1) Tablas ---------------------------------------------------
create table if not exists fest_evento (
  id_evento  bigint generated always as identity primary key,
  nombre     text not null,
  fecha      date,
  hora       text,                    -- texto libre, ej. "18:00"
  lugar      text,
  cupo       integer check (cupo is null or cupo >= 0),  -- informativo
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

create table if not exists fest_registro (
  id_registro      bigint generated always as identity primary key,
  id_evento        bigint not null references fest_evento(id_evento) on delete cascade,
  cedula           text not null,
  nombre           text not null,
  apellido         text not null,
  fecha_nacimiento date,
  es_miembro       boolean not null default false,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (id_evento, cedula)
);

create table if not exists fest_ingreso (
  id_ingreso   bigint generated always as identity primary key,
  id_evento    bigint not null references fest_evento(id_evento) on delete cascade,
  cedula       text not null,
  id_registro  bigint references fest_registro(id_registro) on delete set null,
  ingresado_en timestamptz not null default now(),
  unique (id_evento, cedula)          -- una persona entra una sola vez por evento
);

create index if not exists ix_fest_registro_evento on fest_registro(id_evento);
create index if not exists ix_fest_ingreso_evento  on fest_ingreso(id_evento);

-- 2) Seguridad (RLS) -----------------------------------------
alter table fest_evento   enable row level security;
alter table fest_registro enable row level security;
alter table fest_ingreso  enable row level security;

-- Eventos: los usuarios logueados los ven; solo editores los modifican.
drop policy if exists fest_evento_sel on fest_evento;
create policy fest_evento_sel on fest_evento for select to authenticated using (true);
drop policy if exists fest_evento_ins on fest_evento;
create policy fest_evento_ins on fest_evento for insert to authenticated with check (public.es_editor());
drop policy if exists fest_evento_upd on fest_evento;
create policy fest_evento_upd on fest_evento for update to authenticated using (public.es_editor()) with check (public.es_editor());
drop policy if exists fest_evento_del on fest_evento;
create policy fest_evento_del on fest_evento for delete to authenticated using (public.es_editor());

-- Registros e ingresos: SOLO editores leen/corrigen/borran.
-- (Las altas públicas entran por las funciones de abajo.)
drop policy if exists fest_registro_sel on fest_registro;
create policy fest_registro_sel on fest_registro for select to authenticated using (public.es_editor());
drop policy if exists fest_registro_upd on fest_registro;
create policy fest_registro_upd on fest_registro for update to authenticated using (public.es_editor()) with check (public.es_editor());
drop policy if exists fest_registro_del on fest_registro;
create policy fest_registro_del on fest_registro for delete to authenticated using (public.es_editor());

drop policy if exists fest_ingreso_sel on fest_ingreso;
create policy fest_ingreso_sel on fest_ingreso for select to authenticated using (public.es_editor());
drop policy if exists fest_ingreso_del on fest_ingreso;
create policy fest_ingreso_del on fest_ingreso for delete to authenticated using (public.es_editor());

-- 3) Funciones públicas --------------------------------------

-- 3.1 Eventos activos + contadores (sin datos personales)
create or replace function public.fest_eventos_publicos()
returns table (
  id_evento bigint, nombre text, fecha date, hora text, lugar text,
  cupo integer, registrados bigint, ingresados bigint
)
language sql stable security definer
set search_path = public
as $$
  select e.id_evento, e.nombre, e.fecha, e.hora, e.lugar, e.cupo,
         (select count(*) from fest_registro r where r.id_evento = e.id_evento),
         (select count(*) from fest_ingreso  i where i.id_evento = e.id_evento)
    from fest_evento e
   where e.activo
   order by e.fecha nulls last, e.id_evento;
$$;

-- 3.2 Registro público (uno o varios eventos). Si la cédula ya estaba
--     anotada en ese evento, actualiza sus datos (sirve para corregir).
create or replace function public.fest_registrar(
  p_eventos    bigint[],
  p_cedula     text,
  p_nombre     text,
  p_apellido   text,
  p_fecha_nac  date,
  p_es_miembro boolean
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_ced   text := regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g');
  v_nom   text := left(btrim(coalesce(p_nombre, '')), 80);
  v_ape   text := left(btrim(coalesce(p_apellido, '')), 80);
  v_ev    bigint;
  v_nuevo boolean;
  v_res   json[] := '{}';
begin
  if length(v_ced) < 4 or length(v_ced) > 10 then
    return json_build_object('ok', false, 'error', 'Número de cédula inválido.');
  end if;
  if v_nom = '' or v_ape = '' then
    return json_build_object('ok', false, 'error', 'Completá nombre y apellido.');
  end if;
  if p_fecha_nac is null or p_fecha_nac < date '1900-01-01' or p_fecha_nac > current_date then
    return json_build_object('ok', false, 'error', 'Fecha de nacimiento inválida.');
  end if;
  if p_eventos is null or array_length(p_eventos, 1) is null then
    return json_build_object('ok', false, 'error', 'Elegí al menos un evento.');
  end if;
  if array_length(p_eventos, 1) > 10 then
    return json_build_object('ok', false, 'error', 'Demasiados eventos.');
  end if;

  foreach v_ev in array p_eventos loop
    if not exists (select 1 from fest_evento where id_evento = v_ev and activo) then
      continue;
    end if;

    insert into fest_registro (id_evento, cedula, nombre, apellido, fecha_nacimiento, es_miembro)
    values (v_ev, v_ced, v_nom, v_ape, p_fecha_nac, coalesce(p_es_miembro, false))
    on conflict (id_evento, cedula) do update
       set nombre = excluded.nombre,
           apellido = excluded.apellido,
           fecha_nacimiento = excluded.fecha_nacimiento,
           es_miembro = excluded.es_miembro,
           actualizado_en = now()
    returning (xmax = 0) into v_nuevo;   -- true = alta nueva, false = actualización

    v_res := v_res || json_build_object('id_evento', v_ev, 'nuevo', v_nuevo);
  end loop;

  if array_length(v_res, 1) is null then
    return json_build_object('ok', false, 'error', 'Los eventos elegidos ya no están disponibles.');
  end if;

  return json_build_object('ok', true, 'eventos', to_json(v_res));
end;
$$;

-- 3.3 Ingreso el día del evento (kiosko): solo con la cédula.
--     Funciona para registrados y no registrados.
--     Devuelve solo el PRIMER nombre (para el saludo), nunca otros datos.
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
    'nombre',     split_part(coalesce(v_reg.nombre, ''), ' ', 1)
  );
end;
$$;

-- 3.4 Resumen para el panel (solo editores)
create or replace function public.fest_resumen()
returns table (
  id_evento bigint, nombre text, fecha date, hora text, lugar text, cupo integer, activo boolean,
  registrados bigint, reg_miembros bigint, reg_no_miembros bigint,
  ingresados bigint, ing_registrados bigint, ing_sin_registro bigint, ing_miembros bigint
)
language sql stable security definer
set search_path = public
as $$
  select e.id_evento, e.nombre, e.fecha, e.hora, e.lugar, e.cupo, e.activo,
         count(distinct r.id_registro),
         count(distinct r.id_registro) filter (where r.es_miembro),
         count(distinct r.id_registro) filter (where not r.es_miembro),
         (select count(*) from fest_ingreso i where i.id_evento = e.id_evento),
         (select count(*) from fest_ingreso i where i.id_evento = e.id_evento and i.id_registro is not null),
         (select count(*) from fest_ingreso i where i.id_evento = e.id_evento and i.id_registro is null),
         (select count(*) from fest_ingreso i join fest_registro rr on rr.id_registro = i.id_registro
           where i.id_evento = e.id_evento and rr.es_miembro)
    from fest_evento e
    left join fest_registro r on r.id_evento = e.id_evento
   where public.es_editor()
   group by e.id_evento
   order by e.fecha nulls last, e.id_evento;
$$;

revoke all on function public.fest_eventos_publicos() from public;
revoke all on function public.fest_registrar(bigint[], text, text, text, date, boolean) from public;
revoke all on function public.fest_ingresar(bigint, text) from public;
revoke all on function public.fest_resumen() from public;

grant execute on function public.fest_eventos_publicos() to anon, authenticated;
grant execute on function public.fest_registrar(bigint[], text, text, text, date, boolean) to anon, authenticated;
grant execute on function public.fest_ingresar(bigint, text) to anon, authenticated;
grant execute on function public.fest_resumen() to authenticated;

-- 4) Tiempo real (el panel escucha altas de registros e ingresos)
do $$
begin
  begin
    alter publication supabase_realtime add table fest_registro;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table fest_ingreso;
  exception when duplicate_object then null;
  end;
end $$;

-- 5) Los dos eventos (editá nombre/fecha/cupo después desde la app)
insert into fest_evento (nombre, cupo)
select x.nombre, x.cupo
  from (values ('Festival por la Paz — Función 1', 500),
               ('Festival por la Paz — Función 2', 500)) as x(nombre, cupo)
 where not exists (select 1 from fest_evento);

commit;
