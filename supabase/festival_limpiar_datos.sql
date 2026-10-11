-- =============================================================
-- RedSokappy — Festival: BORRAR todos los registros e ingresos
-- (deja los eventos/funciones como están).
-- ⚠️ No se puede deshacer. Antes, si querés un respaldo, usá
--    "Exportar Excel" en la pestaña Eventos.
-- Ejecutar en el SQL Editor de Supabase.
-- =============================================================
begin;

truncate table fest_ingreso, fest_registro restart identity;

commit;

-- Verificación: las dos cantidades tienen que dar 0
select (select count(*) from fest_registro) as registros,
       (select count(*) from fest_ingreso)  as ingresos;
