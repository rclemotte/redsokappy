"""Arma la importación del Tookan a partir de filas.json (salida de parse_tookan.py).

Salidas:
  tookan_03_importar.sql  → se corre en Supabase después de tookan_limpiar_piloto.sql
  revision_importacion.xlsx → para que Rick revise antes de cargar
Uso: python3 -I generar.py filas.json <dir_salida>
"""
import sys, json, re, unicodedata, collections, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_tookan import norm

F = json.load(open(sys.argv[1]))
OUT = sys.argv[2]

BAJA = {"EXTERIOR": "EXTERIOR", "FALLECIDO": "FALLECIDO", "TAITEN": "DEVOLVIO_GOHONZON",
        "TRASLADO": "TRASLADO", "NO_UBICADO": "NO_UBICADO", "GOHONZON_OTRO": "OTRO"}
JAPONES = ("HANCHO", "HANTAN", "CHIKUTAN", "CHIKUCHO", "SHIBU", "FUJIMBUCHO", "FUJINBUCHO", "HONBUCHO",
           "SOKANBU", "SHIBUCHO", "BUCHO", "FUYIMBU", "CHIKUBU")


def clave_nombre(n):
    n = unicodedata.normalize("NFKD", n).encode("ascii", "ignore").decode().lower()
    n = re.sub(r"\(.*?\)", " ", n)
    return re.sub(r"[^a-z ]", "", re.sub(r"\s+", " ", n)).strip()


MENORES = {"de", "del", "la", "las", "los", "y", "el"}


def titulo_han(h):
    h = re.sub(r"\s+", " ", (h or "").strip())
    if h and h.upper() == h:
        h = " ".join(w.lower() if i and w.lower() in MENORES else w.capitalize() for i, w in enumerate(h.split(" ")))
    return h[:1].upper() + h[1:] if h else h


def mapear_cargo(texto):
    """'Vice Resp. de la DF del Han' → [('Vice responsable','HAN','DF')]. Devuelve (cargos, resto)."""
    cargos, resto = [], []
    previo = None
    for parte in re.split(r"\s*/\s*|\s*;\s*|\s*\*\s*", texto or ""):
        p = parte.strip()
        if not p:
            continue
        if re.fullmatch(r"(?i)(est[aá] )?in[ac]+tiv[oa]|membres[ií]a", p):
            continue  # ya se usa para el estado / la membresía
        nn = unicodedata.normalize("NFKD", p).encode("ascii", "ignore").decode().lower()
        # "Resp. Han/Distrito": la segunda parte hereda la función
        if previo and re.fullmatch(r"(distr\.?|distrito|cab\.?|cabildo|han|region)( (ds|df|djm|djf))?", nn.strip(" .")):
            p = previo + " " + p
        n = " " + re.sub(r"[\.\,]", " ", unicodedata.normalize("NFKD", p).encode("ascii", "ignore").decode().lower()) + " "
        n = re.sub(r"\s+", " ", n)
        if any(j in norm(p) for j in JAPONES):
            resto.append(p)
            continue
        if re.search(r" (vice|v) ?(resp|res|responsable)", n) or n.startswith(" vice "):
            fun = "Vice responsable"
            previo = "Vice Resp."
        elif re.search(r" (resp|respon|responsable|rep|res)\b", n):
            previo = "Resp."
            fun = "Responsable"
        elif "consejer" in n:
            previo = None
            fun = "Consejero"
        else:
            resto.append(p)
            continue
        if "nacional" in n:
            niv = "NACIONAL"
        elif "region" in n:
            niv = "REGION"
        elif re.search(r" (cabildo|cab) ", n):
            niv = "CABILDO"
        elif "distrito" in n or re.search(r" distr? ", n):
            niv = "DISTRITO"
        elif re.search(r" han ", n):
            niv = "HAN"
        else:
            resto.append(p)
            continue
        if re.search(r" djm ", n):
            div = "DJM"
        elif re.search(r" djf ", n):
            div = "DJF"
        elif re.search(r" ds ", n):
            div = "DS"
        elif re.search(r" df ", n):
            div = "DF"
        elif "grupo esperanza" in n or re.search(r" ge ", n) or "g esp" in n:
            div = "GE"
        else:
            div = None
        cargos.append((fun, niv, div, p))
    return cargos, resto


# ---------------------------------------------------------------------------
# 1. Decidir cada fila
# ---------------------------------------------------------------------------
personas = []          # filas que se cargan
stg = []               # todas las filas, con su resultado
vistos = {}            # (cabildo, clave_nombre) → persona
orden_sec = {"MAIN": 0, "NO_MIEMBRO": 1, "INACTIVO": 2}

# Hanes reales por cabildo (de las listas principales) para ubicar las hojas extra
HANES = {}
for f in F:
    if f["seccion"] == "MAIN" and f["han"]:
        HANES.setdefault((f["cabildo"], norm(f["han"])), (f["distrito"], f["han"]))
for f in F:
    if f["seccion"] == "NO_MIEMBRO" and f["han"]:
        real = HANES.get((f["cabildo"], norm(f["han"])))
        if real:
            f["distrito"], f["han"] = real
        else:
            f["han"] = None

# MAIN primero para que gane sobre las secciones de bajas y las hojas repetidas
F.sort(key=lambda f: (orden_sec.get(f["seccion"], 5), f["archivo"], f["hoja"], f["fila"]))

for f in F:
    nombre = f["nombre"].strip()
    st = dict(f)
    st["estado_import"], st["mensaje"] = "OK", ""
    if re.match(r"(?i)^(sub)?total", nombre):
        st["estado_import"], st["mensaje"] = "DESCARTADO", "Fila de totales"
        stg.append(st)
        continue
    k = (f["cabildo"], clave_nombre(nombre))
    if k in vistos:
        st["estado_import"] = "DUPLICADO"
        st["mensaje"] = f"Ya está en {vistos[k]['hoja']} fila {vistos[k]['fila']} ({vistos[k]['seccion']})"
        stg.append(st)
        continue

    sec = f["seccion"]
    obs = []
    textos = [f.get("obs") or "", " ".join(f.get("sueltos") or [])]
    p = {
        "src": f, "nombre": nombre, "region": f["region"], "cabildo": f["cabildo"],
        "distrito": titulo_han(f["distrito"] or f["cabildo"]) if f["han"] else None,
        "han": titulo_han(f["han"]) if f["han"] else None,
        "division": f["division"], "activo": True, "motivo_baja": None,
        "membresia": True, "gohonzon": False, "estado_inicial": None,
        "kofu": bool(f.get("kofu")), "pyseikyo": bool(f.get("pyseikyo")), "cargos": [],
    }
    if len(f.get("divisiones") or []) > 1:
        obs.append("Planilla marcaba varias divisiones: " + ", ".join(f["divisiones"]))

    # Gohonzon: columna propia si existe; si no, la primera columna (G / Nº) marcada, solo en las listas por han
    if f.get("gohonzon") is not None:
        p["gohonzon"] = bool(f["gohonzon"])
    elif sec == "MAIN" and f.get("primera_tipo") in ("G", "N"):
        p["gohonzon"] = (f.get("primera_valor") or "") not in ("", "0")

    # Membresía: explícita (Pioneros) o todos los de la lista del han
    if f.get("membresia") is not None:
        p["membresia"] = bool(f["membresia"]) or p["gohonzon"]
    todo = " ".join([f.get("cargo") or ""] + textos).lower()
    if sec == "NO_MIEMBRO" or re.search(r"amig[oa]|no miembro|nunca fue", todo):
        p["membresia"] = p["gohonzon"]
    if not p["membresia"]:
        p["estado_inicial"] = "NUEVO_AMIGO" if "nuev" in todo else "AMIGO_SOKA"

    # Estado de la planilla (AC / IN)
    est = norm(f.get("estado") or "")
    if p["membresia"]:
        if est == "AC":
            p["estado_inicial"] = "MIEMBRO_ACTIVO"
        elif est == "IN" or re.search(r"\binactiv", (f.get("cargo") or "").lower()) or sec == "INACTIVO":
            p["estado_inicial"] = "MIEMBRO_INACTIVO"

    # Bajas
    if sec in BAJA:
        p["activo"] = False
        p["motivo_baja"] = BAJA[sec]
        if f.get("pais"):
            obs.append(("País: " if sec == "EXTERIOR" else "Zona: ") + f["pais"])
    if sec == "INACTIVO" and f.get("pais"):
        obs.append("Zona: " + f["pais"])
    if sec == "GOHONZON_OTRO":
        obs.append("Tiene el Gohonzon de un familiar pero no practica")
    if sec == "NO_UBICADO":
        obs.append("Planilla: a ubicar / a resolver")

    # Cargos
    cargos, resto = mapear_cargo(f.get("cargo") or "")
    if p["activo"] and p["han"]:
        p["cargos"] = cargos
    elif cargos:
        resto = [c[3] for c in cargos] + resto
    if resto:
        obs.append("Planilla: " + " / ".join(resto))
    for t in textos:
        t = t.strip()
        if t and t not in " ".join(obs):
            obs.append(t)
    p["observacion"] = " · ".join(o for o in obs if o)[:500] or None

    # Avisos para la revisión
    avisos = []
    if p["activo"] and not p["han"]:
        avisos.append("Sin han asignado")
    if p["activo"] and not p["division"]:
        avisos.append("Sin división")
    if resto and any(any(j in norm(r) for j in JAPONES) for r in resto):
        avisos.append("Cargo en japonés: queda vacío")
    elif resto and p["activo"] and p["han"]:
        avisos.append("Cargo u observación no reconocida")
    st["mensaje"] = "; ".join(avisos)
    if "Sin han asignado" in avisos or "Sin división" in avisos:
        st["estado_import"] = "REVISAR"
    p["avisos"] = avisos
    vistos[k] = f
    personas.append(p)
    st["_p"] = p
    stg.append(st)

# Mismo nombre en distintos cabildos
por_nombre = collections.defaultdict(list)
for p in personas:
    por_nombre[clave_nombre(p["nombre"])].append(p)
for n, ps in por_nombre.items():
    if len({p["cabildo"] for p in ps}) > 1:
        for p in ps:
            otros = sorted({q["cabildo"] for q in ps if q is not p})
            p["avisos"].append("Mismo nombre en: " + ", ".join(otros))

# ---------------------------------------------------------------------------
# 2. SQL
# ---------------------------------------------------------------------------
def q(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


regiones = sorted({p["region"] for p in personas})
cabildos = sorted({(p["region"], p["cabildo"]) for p in personas})
distritos = sorted({(p["cabildo"], p["distrito"]) for p in personas if p["han"]})
hanes = sorted({(p["cabildo"], p["distrito"], p["han"]) for p in personas if p["han"]})

L = []
w = L.append
w("""-- =============================================================================
-- RedSokappy → Tookan Digital · Paso 3: IMPORTAR LAS 13 PLANILLAS
-- Generado automáticamente el 26-oct-2026 a partir de las planillas Tookan 2026.
-- Correr DESPUÉS de tookan_limpiar_piloto.sql (la base tiene que estar vacía).
--
-- Carga: 4 regiones, 13 cabildos, distritos, hanes, personas (activas y bajas),
-- cargos reconocidos, Paraguay Seikyo y depto. de contribuciones (kofu).
-- Cada fila de cada planilla queda en stg_tookan con su resultado
-- (OK / REVISAR / DUPLICADO / DESCARTADO), para poder rastrear de dónde salió cada dato.
-- =============================================================================
begin;

-- Seguridad: no cargar dos veces
do $$ begin
  if exists (select 1 from personas) or exists (select 1 from han) then
    raise exception 'La base ya tiene personas o hanes. Corré primero tookan_limpiar_piloto.sql';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- A. Cabildo de cada persona (para bajas y personas todavía sin han)
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

-- -----------------------------------------------------------------------------
-- B. Estructura
-- -----------------------------------------------------------------------------""")
w("insert into region (nombre) values " + ", ".join(f"({q(r)})" for r in regiones) + ";")
w("insert into cabildo (id_region, nombre) select r.id_region, v.c from (values "
  + ", ".join(f"({q(r)}, {q(c)})" for r, c in cabildos)
  + ") v(r, c) join region r on r.nombre = v.r;")
w("insert into distrito (id_cabildo, nombre) select c.id_cabildo, v.d from (values "
  + ", ".join(f"({q(c)}, {q(d)})" for c, d in distritos)
  + ") v(c, d) join cabildo c on c.nombre = v.c;")
w("insert into han (id_distrito, nombre) select d.id_distrito, v.h from (values "
  + ", ".join(f"({q(c)}, {q(d)}, {q(h)})" for c, d, h in hanes)
  + ") v(c, d, h) join cabildo c on c.nombre = v.c join distrito d on d.id_cabildo = c.id_cabildo and d.nombre = v.d;")

w("""
-- -----------------------------------------------------------------------------
-- C. Personas
-- -----------------------------------------------------------------------------
create temp table imp_personas (
  n integer primary key, nombre text, cabildo text, distrito text, han text, division text,
  activo boolean, motivo_baja text, membresia boolean, gohonzon boolean, estado_inicial text,
  kofu boolean, pyseikyo boolean, observacion text, id_persona bigint
) on commit drop;""")
filas = []
for i, p in enumerate(personas, 1):
    p["n"] = i
    filas.append("(" + ", ".join(q(x) for x in (
        i, p["nombre"], p["cabildo"], p["distrito"], p["han"], p["division"], p["activo"], p["motivo_baja"],
        p["membresia"], p["gohonzon"], p["estado_inicial"], p["kofu"], p["pyseikyo"], p["observacion"])) + ")")
for k in range(0, len(filas), 400):
    w("insert into imp_personas values\n  " + ",\n  ".join(filas[k:k + 400]) + ";")

w("""
-- id_estado viejo (lo sigue mostrando la app hasta el rediseño)
insert into personas (nombre, division, id_han, id_cabildo, activo, motivo_baja, fecha_baja, membresia,
                      titular_gohonzo, estado_inicial, dpto_contribuciones, observacion, id_estado)
select i.nombre, i.division, h.id_han, c.id_cabildo, i.activo, i.motivo_baja,
       case when i.activo then null else current_date end,
       i.membresia, case when i.gohonzon then 1 else 0 end, i.estado_inicial, i.kofu, i.observacion,
       case when i.motivo_baja = 'EXTERIOR' then 2
            when not i.activo then null
            when i.estado_inicial = 'MIEMBRO_INACTIVO' then 3
            when i.estado_inicial = 'AMIGO_SOKA' then 5
            when i.estado_inicial = 'NUEVO_AMIGO' then 4
            else 1 end
  from imp_personas i
  join cabildo c on c.nombre = i.cabildo
  left join distrito d on d.id_cabildo = c.id_cabildo and d.nombre = i.distrito
  left join han h on h.id_distrito = d.id_distrito and h.nombre = i.han
 order by i.n;

-- Asociar cada fila con la persona creada (mismo orden)
update imp_personas i set id_persona = x.id_persona
  from (select id_persona, row_number() over (order by id_persona) as n from personas) x
 where x.n = i.n;

-- Paraguay Seikyo 2026
insert into tipo_suscripciones (suscripcion)
select 'PARAGUAY SEIKYO' where not exists (select 1 from tipo_suscripciones where suscripcion = 'PARAGUAY SEIKYO');
insert into suscripciones (id_persona, id_tipo_suscripcion, anho)
select i.id_persona, (select id_tipo_suscripcion from tipo_suscripciones where suscripcion = 'PARAGUAY SEIKYO'), 2026
  from imp_personas i where i.pyseikyo and i.activo;
""")

# Cargos
cf = []
for p in personas:
    for fun, niv, div, txt in p["cargos"]:
        cf.append("(" + ", ".join(q(x) for x in (p["n"], fun, niv, div)) + ")")
w("-- -----------------------------------------------------------------------------\n-- D. Cargos reconocidos en la planilla\n-- -----------------------------------------------------------------------------")
if cf:
    w("""insert into persona_cargo (id_persona, id_cargo, nivel, id_region, id_cabildo, id_distrito, id_han, division, observacion)
select i.id_persona, cg.id_cargo, v.nivel,
       case when v.nivel = 'REGION'   then est.id_region   end,
       case when v.nivel = 'CABILDO'  then est.id_cabildo  end,
       case when v.nivel = 'DISTRITO' then est.id_distrito end,
       case when v.nivel = 'HAN'      then est.id_han      end,
       v.division::varchar, 'Importado de la planilla 2026'
  from (values
  """ + ",\n  ".join(cf) + """
  ) v(n, funcion, nivel, division)
  join imp_personas i on i.n = v.n
  join personas p on p.id_persona = i.id_persona
  join vw_estructura est on est.id_han = p.id_han
  join cargo cg on upper(cg.cargo) = upper(v.funcion);""")

# Staging
w("""
-- -----------------------------------------------------------------------------
-- E. Registro de cada fila de las planillas (stg_tookan)
-- -----------------------------------------------------------------------------""")
sf = []
for s in stg:
    p = s.get("_p")
    sf.append("(" + ", ".join(q(x) for x in (
        s["archivo"], s["hoja"], s["fila"], s["region"], s["cabildo"], s["distrito"], s["han"], s["nombre"],
        s["division"], (s.get("cargo") or "")[:200] or None, (s.get("estado") or s["seccion"])[:100],
        s.get("gohonzon"), s.get("membresia"), bool(s.get("pyseikyo")), bool(s.get("kofu")),
        (s.get("obs") or "")[:500] or None, s["estado_import"], (s["mensaje"] or "")[:500] or None,
        p["n"] if p else None)) + ")")
for k in range(0, len(sf), 400):
    w("""insert into stg_tookan (archivo, hoja, fila, region, cabildo, distrito, han, nombre_completo, division,
                        cargo_texto, estado_texto, gohonzon, membresia, pyseikyo, kofu, observacion,
                        estado_import, mensaje, lote, id_persona)
select v.archivo, v.hoja, v.fila::int, v.region, v.cabildo, v.distrito, v.han, v.nombre, v.division, v.cargo, v.estado,
       v.goh::boolean, v.memb::boolean, v.pys::boolean, v.kofu::boolean, v.obs, v.est, v.msg, 'planillas-2026', i.id_persona
  from (values
  """ + ",\n  ".join(sf[k:k + 400]) + """
  ) v(archivo, hoja, fila, region, cabildo, distrito, han, nombre, division, cargo, estado, goh, memb, pys, kofu, obs, est, msg, n)
  left join imp_personas i on i.n = v.n::int;""")

w("""
commit;

notify pgrst, 'reload schema';

-- Verificación
select c.nombre as cabildo,
       count(*) filter (where p.activo)                         as personas,
       count(*) filter (where e.estado = 'MIEMBRO_ACTIVO')      as miembros_activos,
       count(*) filter (where e.estado = 'MIEMBRO_INACTIVO')    as miembros_inactivos,
       count(*) filter (where e.estado in ('AMIGO_SOKA','NUEVO_AMIGO')) as amigos,
       count(*) filter (where p.titular_gohonzo = 1 and p.activo) as con_gohonzon,
       count(*) filter (where not p.activo)                     as bajas
  from personas p
  join cabildo c on c.id_cabildo = p.id_cabildo
  join vw_estado_persona e on e.id_persona = p.id_persona
 group by c.nombre order by c.nombre;
""")
open(os.path.join(OUT, "tookan_03_importar.sql"), "w").write("\n".join(L))

json.dump([{k: v for k, v in p.items() if k != "src"} | {"hoja": p["src"]["hoja"], "fila": p["src"]["fila"],
            "seccion": p["src"]["seccion"], "cargo_planilla": p["src"].get("cargo")} for p in personas],
          open(os.path.join(OUT, "personas.json"), "w"), ensure_ascii=False, indent=1)
json.dump([{k: v for k, v in s.items() if k != "_p"} for s in stg],
          open(os.path.join(OUT, "stg.json"), "w"), ensure_ascii=False, indent=1)
print("personas", len(personas), "stg", len(stg), "cargos", len(cf),
      "regiones", len(regiones), "cabildos", len(cabildos), "distritos", len(distritos), "hanes", len(hanes))
