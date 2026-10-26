-- =============================================================================
-- RedSokappy → Tookan Digital · BORRAR LOS DATOS DEL PILOTO
-- Fecha: 26-oct-2026 · Correr DESPUÉS de tookan_01 y tookan_02,
--                      y justo ANTES de importar las planillas.
--
-- ⚠ NO TIENE VUELTA ATRÁS.
--
-- Borra:   personas, asistencia, shakubuku, grupos horizontales de cada persona,
--          exámenes y suscripciones de cada persona, cargos de cada persona,
--          objetivos, la estructura (regiones, cabildos, distritos, hanes),
--          los cargos viejos, el staging y el historial de cambios.
-- Queda:   usuarios (pueden seguir entrando), Festival, catálogos
--          (divisiones, estados, tipos de evento, grupos horizontales, exámenes,
--          suscripciones), parámetros y las 3 funciones de cargo.
--
-- Los usuarios quedan sin persona y sin ámbito asignado: se vuelven a vincular
-- después de la importación.
-- =============================================================================
begin;

-- Usuarios: se desvinculan de personas y de la estructura (no se borran)
update perfiles
   set id_persona = null, id_region = null, id_cabildo = null, id_distrito = null, id_han = null
 where id_persona is not null or id_region is not null or id_cabildo is not null
    or id_distrito is not null or id_han is not null;

delete from asistencia_d;
delete from asistencia_c;
delete from shakubuku;
delete from grupos_personas;
delete from examen_personas;
delete from suscripciones;
delete from persona_cargo;
delete from objetivos;
delete from stg_tookan;
delete from personas;

delete from han;
delete from distrito;
delete from cabildo;
delete from region;

-- Cargos: quedan solo las funciones del Tookan
delete from cargo where upper(btrim(cargo)) not in ('RESPONSABLE', 'VICE RESPONSABLE', 'CONSEJERO');

-- El historial de cambios del piloto (incluye estos borrados) no sirve
delete from auditoria;

-- Numeración desde 1 para lo que se va a importar
alter table personas       alter column id_persona       restart with 1;
alter table region         alter column id_region        restart with 1;
alter table cabildo        alter column id_cabildo       restart with 1;
alter table distrito       alter column id_distrito      restart with 1;
alter table han            alter column id_han           restart with 1;
alter table asistencia_c   alter column id_asistencia    restart with 1;
alter table asistencia_d   alter column id_asistencia_d  restart with 1;
alter table shakubuku      alter column id_shakubuku     restart with 1;
alter table persona_cargo  alter column id_persona_cargo restart with 1;
alter table stg_tookan     alter column id               restart with 1;
alter table auditoria      alter column id               restart with 1;

commit;

-- Verificación: todo en 0 salvo usuarios y cargos
select 'personas' as tabla, count(*) from personas
union all select 'asistencia_c', count(*) from asistencia_c
union all select 'han', count(*) from han
union all select 'region', count(*) from region
union all select 'cargo', count(*) from cargo
union all select 'usuarios (perfiles)', count(*) from perfiles
union all select 'festival registros', count(*) from fest_registro;
