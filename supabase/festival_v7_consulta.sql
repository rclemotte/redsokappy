-- =============================================================
-- RedSokappy — Festival v7 (18-oct-2026): consultar mi registro
-- Ejecutar en el SQL Editor de Supabase. Se puede correr más de una vez.
--
-- La persona pone su cédula y ve en qué función quedó registrada.
-- Por privacidad devuelve SOLO la(s) función(es): nada de nombre ni teléfono.
-- Al comité / staff no se le dice la función (solo que está registrado).
-- =============================================================
begin;

create or replace function public.fest_consultar(p_cedula text)
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_ced   text := regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g');
  v_staff boolean;
  v_evs   json;
begin
  if length(v_ced) < 4 or length(v_ced) > 10 then
    return json_build_object('ok', false, 'error', 'Número de cédula inválido.');
  end if;

  select bool_or(r.es_staff),
         json_agg(json_build_object('nombre', e.nombre, 'fecha', e.fecha, 'hora', e.hora, 'lugar', e.lugar)
                  order by e.fecha nulls last, e.hora, e.id_evento)
    into v_staff, v_evs
    from fest_registro r
    join fest_evento e on e.id_evento = r.id_evento
   where r.cedula = v_ced and e.activo;

  if v_evs is null then
    return json_build_object('ok', true, 'encontrado', false);
  end if;

  return json_build_object(
    'ok', true,
    'encontrado', true,
    'staff', coalesce(v_staff, false),
    'eventos', case when coalesce(v_staff, false) then '[]'::json else v_evs end
  );
end;
$$;

revoke all on function public.fest_consultar(text) from public;
grant execute on function public.fest_consultar(text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
