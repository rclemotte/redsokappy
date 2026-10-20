-- =============================================================
-- RedSokappy — Festival v8 (20-oct-2026): cambiar de función o anular el registro
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de v7. Se puede correr más de una vez.
--
-- Desde /festival/consulta la persona puede:
--   * cambiarse a otra función (si tiene lugar), o
--   * anular su registro.
-- Para confirmar se pide el TELÉFONO con el que se registró: así nadie puede
-- modificar el registro de otra persona solo sabiendo su cédula.
-- No aplica al comité / staff (está en todas las funciones) ni a quien ya ingresó.
-- =============================================================
begin;

-- Normaliza el teléfono igual que el registro (0981123456 / +5493718518121)
create or replace function public.fest_normalizar_tel(p_tel text)
returns text
language plpgsql immutable
as $$
declare
  v text := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g');
begin
  if btrim(coalesce(p_tel, '')) like '+%' and v not like '595%' then
    return '+' || v;
  end if;
  if v like '595%' then v := '0' || substr(v, 4); end if;
  if v !~ '^0' then v := '0' || v; end if;
  return v;
end;
$$;

-- Consulta: ahora también devuelve el id de la función (para poder cambiarla)
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
         json_agg(json_build_object('id_evento', e.id_evento, 'nombre', e.nombre, 'fecha', e.fecha,
                                    'hora', e.hora, 'lugar', e.lugar,
                                    'ingreso', exists (select 1 from fest_ingreso i
                                                        where i.id_evento = e.id_evento and i.cedula = v_ced))
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

-- Cambiar de función (público, no staff)
create or replace function public.fest_cambiar_funcion(p_cedula text, p_telefono text, p_evento_nuevo bigint)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_ced  text := regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g');
  v_reg  fest_registro%rowtype;
  v_ev   fest_evento%rowtype;
  v_cant bigint;
begin
  perform pg_advisory_xact_lock(hashtext('fest_cedula_' || v_ced));

  select * into v_reg from fest_registro where cedula = v_ced order by id_registro limit 1;
  if not found then
    return json_build_object('ok', false, 'error', 'No encontramos un registro con esa cédula.');
  end if;
  if v_reg.es_staff then
    return json_build_object('ok', false, 'error', 'El registro del comité / staff no se puede modificar desde acá.');
  end if;
  if v_reg.telefono is distinct from fest_normalizar_tel(p_telefono) then
    return json_build_object('ok', false, 'codigo', 'telefono', 'error', 'El teléfono no coincide con el que usaste al registrarte.');
  end if;
  if exists (select 1 from fest_ingreso where cedula = v_ced and id_evento = v_reg.id_evento) then
    return json_build_object('ok', false, 'error', 'Ya ingresaste al evento: el registro no se puede cambiar.');
  end if;
  if v_reg.id_evento = p_evento_nuevo then
    return json_build_object('ok', false, 'error', 'Ya estás registrado/a en esa función.');
  end if;

  -- Bloquea la función destino para controlar el cupo sin carreras
  select * into v_ev from fest_evento where id_evento = p_evento_nuevo and activo for update;
  if not found then
    return json_build_object('ok', false, 'error', 'La función elegida no está disponible.');
  end if;
  if v_ev.cupo is not null then
    select count(*) into v_cant from fest_registro where id_evento = p_evento_nuevo and not es_staff;
    if v_cant >= v_ev.cupo then
      return json_build_object('ok', false, 'codigo', 'cupo_completo', 'error', 'La función "' || v_ev.nombre || '" ya no tiene lugar.');
    end if;
  end if;

  update fest_registro
     set id_evento = p_evento_nuevo, actualizado_en = now()
   where id_registro = v_reg.id_registro;

  return json_build_object('ok', true, 'evento', json_build_object(
    'id_evento', v_ev.id_evento, 'nombre', v_ev.nombre, 'fecha', v_ev.fecha, 'hora', v_ev.hora, 'lugar', v_ev.lugar));
end;
$$;

-- Anular el registro (público, no staff)
create or replace function public.fest_anular_registro(p_cedula text, p_telefono text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_ced text := regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g');
  v_reg fest_registro%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('fest_cedula_' || v_ced));

  select * into v_reg from fest_registro where cedula = v_ced order by id_registro limit 1;
  if not found then
    return json_build_object('ok', false, 'error', 'No encontramos un registro con esa cédula.');
  end if;
  if v_reg.es_staff then
    return json_build_object('ok', false, 'error', 'El registro del comité / staff no se puede anular desde acá.');
  end if;
  if v_reg.telefono is distinct from fest_normalizar_tel(p_telefono) then
    return json_build_object('ok', false, 'codigo', 'telefono', 'error', 'El teléfono no coincide con el que usaste al registrarte.');
  end if;
  if exists (select 1 from fest_ingreso where cedula = v_ced and id_registro = v_reg.id_registro) then
    return json_build_object('ok', false, 'error', 'Ya ingresaste al evento: el registro no se puede anular.');
  end if;

  delete from fest_registro where cedula = v_ced and not es_staff;
  return json_build_object('ok', true);
end;
$$;

revoke all on function public.fest_normalizar_tel(text) from public;
revoke all on function public.fest_cambiar_funcion(text, text, bigint) from public;
revoke all on function public.fest_anular_registro(text, text) from public;
grant execute on function public.fest_cambiar_funcion(text, text, bigint) to anon, authenticated;
grant execute on function public.fest_anular_registro(text, text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
