-- =============================================================
-- RedSokappy — Vistas para el dashboard + permisos de edición
-- Ejecutar UNA vez en el SQL Editor de Supabase.
-- =============================================================

-- 1) Habilitar edición para tu usuario (perfil ADMINISTRADOR).
--    Sin esto, la app puede leer pero no guardar (por las reglas de seguridad RLS).
insert into perfiles (id, id_rol, id_persona)
select u.id, 3, 1
from auth.users u
where u.email = 'rclemotte@gmail.com'
on conflict (id) do update set id_rol = excluded.id_rol;

-- 2) Vistas de agregación para los gráficos.
create or replace view vw_dash_division as
select coalesce(d.descripcion, p.division, 'Sin división') as etiqueta,
       p.division as codigo,
       count(*)::int as cantidad
from personas p
left join divisiones d on d.codigo = p.division
group by p.division, d.descripcion
order by cantidad desc;

create or replace view vw_dash_estado as
select coalesce(e.descripcion, 'Sin estado') as etiqueta,
       count(*)::int as cantidad
from personas p
left join estados e on e.id_estado = p.id_estado
group by e.descripcion
order by cantidad desc;

create or replace view vw_dash_han as
select coalesce(h.nombre, 'Sin han') as etiqueta,
       count(*)::int as cantidad
from personas p
left join han h on h.id_han = p.id_han
group by h.nombre
order by cantidad desc;

create or replace view vw_dash_asistencia_mensual as
select to_char(ac.fecha_asistencia, 'YYYY-MM') as mes,
       count(ad.id_asistencia_d)::int as asistentes,
       count(distinct ac.id_asistencia)::int as reuniones
from asistencia_c ac
left join asistencia_d ad on ad.id_asistencia = ac.id_asistencia
group by 1
order by 1;

-- 3) Permisos de lectura para la app.
grant select on vw_dash_division, vw_dash_estado, vw_dash_han, vw_dash_asistencia_mensual
  to anon, authenticated;
