"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Opt = { value: string; label: string };

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-marca bg-white";

export default function MemberForm({ id }: { id?: number }) {
  const supabase = createClient();
  const router = useRouter();
  const editar = typeof id === "number";

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // catálogos
  const [divisiones, setDivisiones] = useState<Opt[]>([]);
  const [estados, setEstados] = useState<Opt[]>([]);
  const [hans, setHans] = useState<Opt[]>([]);
  const [personas, setPersonas] = useState<Opt[]>([]);

  // campos persona
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [division, setDivision] = useState("");
  const [idEstado, setIdEstado] = useState("");
  const [idHan, setIdHan] = useState("");
  const [titular, setTitular] = useState(false);
  const [fechaIngreso, setFechaIngreso] = useState("");
  const [invitadoPor, setInvitadoPor] = useState("");

  useEffect(() => {
    (async () => {
      const [d, e, h, p] = await Promise.all([
        supabase.from("divisiones").select("codigo, descripcion").order("codigo"),
        supabase.from("estados").select("id_estado, descripcion").order("descripcion"),
        supabase.from("han").select("id_han, nombre").order("nombre"),
        supabase.from("personas").select("id_persona, nombre").order("nombre"),
      ]);
      setDivisiones((d.data ?? []).map((x: any) => ({ value: x.codigo, label: `${x.codigo} — ${x.descripcion}` })));
      setEstados((e.data ?? []).map((x: any) => ({ value: String(x.id_estado), label: x.descripcion })));
      setHans((h.data ?? []).map((x: any) => ({ value: String(x.id_han), label: x.nombre })));
      setPersonas((p.data ?? []).map((x: any) => ({ value: String(x.id_persona), label: x.nombre })));

      if (editar) {
        const { data: per } = await supabase.from("personas").select("*").eq("id_persona", id).single();
        if (per) {
          setNombre(per.nombre ?? "");
          setTelefono(per.telefono ?? "");
          setCorreo(per.correo ?? "");
          setDivision(per.division ?? "");
          setIdEstado(per.id_estado != null ? String(per.id_estado) : "");
          setIdHan(per.id_han != null ? String(per.id_han) : "");
          setTitular(per.titular_gohonzo === 1);
          setFechaIngreso(per.fecha_ingreso ? String(per.fecha_ingreso).slice(0, 10) : "");
        }
        const { data: sk } = await supabase
          .from("shakubuku").select("id_shakubuku_de").eq("id_shakubuku_para", id).limit(1);
        if (sk && sk.length) setInvitadoPor(String(sk[0].id_shakubuku_de));
      }
      setCargando(false);
    })();
  }, []); // eslint-disable-line

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setGuardando(true);
    const payload: any = {
      nombre: nombre.trim(),
      telefono: telefono.trim() || null,
      correo: correo.trim() || null,
      division: division || null,
      id_estado: idEstado ? Number(idEstado) : null,
      id_han: idHan ? Number(idHan) : null,
      titular_gohonzo: titular ? 1 : 0,
      fecha_ingreso: fechaIngreso || null,
    };

    let personaId = id;
    if (editar) {
      const { error } = await supabase.from("personas").update(payload).eq("id_persona", id);
      if (error) { setErr(traducir(error.message)); setGuardando(false); return; }
    } else {
      const { data, error } = await supabase.from("personas").insert(payload).select("id_persona").single();
      if (error) { setErr(traducir(error.message)); setGuardando(false); return; }
      personaId = data.id_persona;
    }

    // "invitado por" -> shakubuku (id_shakubuku_de = invitador, id_shakubuku_para = esta persona)
    if (invitadoPor && personaId) {
      const de = Number(invitadoPor);
      const { data: ex } = await supabase
        .from("shakubuku").select("id_shakubuku").eq("id_shakubuku_para", personaId).limit(1);
      if (ex && ex.length) {
        await supabase.from("shakubuku").update({ id_shakubuku_de: de }).eq("id_shakubuku", ex[0].id_shakubuku);
      } else {
        await supabase.from("shakubuku").insert({ id_shakubuku_de: de, id_shakubuku_para: personaId, gohonzon: 0, membresia: 0 });
      }
    }

    setGuardando(false);
    if (editar) {
      setMsg("Cambios guardados ✓");
    } else {
      router.push(`/miembros/${personaId}`);
    }
  }

  if (cargando) return <p className="text-sm text-gray-500">Cargando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="text-gray-500 text-sm">‹ Volver</button>
        <h1 className="text-lg font-semibold">{editar ? "Editar miembro" : "Nuevo miembro"}</h1>
      </div>

      <form onSubmit={guardar} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <Campo label="Nombre *">
          <input className={inputCls} required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Teléfono">
            <input className={inputCls} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </Campo>
          <Campo label="Correo">
            <input className={inputCls} value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="División">
            <select className={inputCls} value={division} onChange={(e) => setDivision(e.target.value)}>
              <option value="">—</option>
              {divisiones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Campo>
          <Campo label="Estado">
            <select className={inputCls} value={idEstado} onChange={(e) => setIdEstado(e.target.value)}>
              <option value="">—</option>
              {estados.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Han">
            <select className={inputCls} value={idHan} onChange={(e) => setIdHan(e.target.value)}>
              <option value="">—</option>
              {hans.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Campo>
          <Campo label="Fecha de ingreso">
            <input type="date" className={inputCls} value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} />
          </Campo>
        </div>
        <Campo label="Le hizo shakubuku (lo invitó)">
          <select className={inputCls} value={invitadoPor} onChange={(e) => setInvitadoPor(e.target.value)}>
            <option value="">—</option>
            {personas.filter((o) => o.value !== String(id)).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Campo>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={titular} onChange={(e) => setTitular(e.target.checked)} />
          Titular de Gohonzon
        </label>

        {err && <p className="text-sm text-red-600">{err}</p>}
        {msg && <p className="text-sm text-green-600">{msg}</p>}

        <button disabled={guardando} className="w-full rounded-lg bg-marca text-white py-2.5 font-medium disabled:opacity-60">
          {guardando ? "Guardando..." : editar ? "Guardar cambios" : "Crear miembro"}
        </button>
      </form>

      {editar && personaId(id) && <Relacionadas idPersona={id!} />}
    </div>
  );
}

function personaId(id?: number) { return typeof id === "number"; }

function traducir(m: string) {
  if (m?.toLowerCase().includes("row-level security")) {
    return "No tenés permiso para guardar. Ejecutá supabase/dashboard.sql (asigna tu perfil de administrador) y reintentá.";
  }
  return m;
}

// ---------- Tablas relacionadas (grupos, suscripciones, exámenes, daimoku) ----------
function Relacionadas({ idPersona }: { idPersona: number }) {
  const supabase = createClient();
  const [grupos, setGrupos] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [examenes, setExamenes] = useState<any[]>([]);
  const [daimoku, setDaimoku] = useState<number>(0);

  const [catGrupos, setCatGrupos] = useState<Opt[]>([]);
  const [catCargos, setCatCargos] = useState<Opt[]>([]);
  const [catTipoSus, setCatTipoSus] = useState<Opt[]>([]);
  const [catExam, setCatExam] = useState<Opt[]>([]);

  const [ngGrupo, setNgGrupo] = useState("");
  const [ngCargo, setNgCargo] = useState("");
  const [nSus, setNSus] = useState("");
  const [nExam, setNExam] = useState("");

  async function recargar() {
    const [g, s, ep, dk] = await Promise.all([
      supabase.from("grupos_personas").select("id_grupo_persona, id_cargo, grupos(nombre_grupo), cargo(cargo)").eq("id_persona", idPersona),
      supabase.from("suscripciones").select("id_suscripcion, tipo_suscripciones(suscripcion)").eq("id_persona", idPersona),
      supabase.from("examen_personas").select("id_examen_personas, examenes(nivel)").eq("id_persona", idPersona),
      supabase.from("daimoku").select("*", { count: "exact", head: true }).eq("id_persona", idPersona),
    ]);
    setGrupos((g.data as any) ?? []);
    setSubs((s.data as any) ?? []);
    setExamenes((ep.data as any) ?? []);
    setDaimoku(dk.count ?? 0);
  }

  useEffect(() => {
    (async () => {
      const [g, c, t, e] = await Promise.all([
        supabase.from("grupos").select("id_grupo, nombre_grupo").order("nombre_grupo"),
        supabase.from("cargo").select("id_cargo, cargo").order("cargo"),
        supabase.from("tipo_suscripciones").select("id_tipo_suscripcion, suscripcion").order("suscripcion"),
        supabase.from("examenes").select("id_examen, nivel").order("nivel"),
      ]);
      setCatGrupos((g.data ?? []).map((x: any) => ({ value: String(x.id_grupo), label: x.nombre_grupo })));
      setCatCargos((c.data ?? []).map((x: any) => ({ value: String(x.id_cargo), label: x.cargo })));
      setCatTipoSus((t.data ?? []).map((x: any) => ({ value: String(x.id_tipo_suscripcion), label: x.suscripcion })));
      setCatExam((e.data ?? []).map((x: any) => ({ value: String(x.id_examen), label: x.nivel })));
      await recargar();
    })();
  }, []); // eslint-disable-line

  const secc = "bg-white rounded-xl shadow-sm p-4 space-y-2";
  const chip = "flex items-center justify-between text-sm border-b last:border-0 py-1.5";
  const selCls = "flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm bg-white";
  const addBtn = "rounded-lg bg-marca text-white text-sm px-3";

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-600 pt-2">Datos relacionados</h2>

      <div className={secc}>
        <h3 className="text-sm font-semibold">Grupos</h3>
        {grupos.map((x) => (
          <div key={x.id_grupo_persona} className={chip}>
            <span>{x.grupos?.nombre_grupo} <span className="text-gray-400">· {x.cargo?.cargo}</span></span>
            <button className="text-red-500 text-xs" onClick={async () => { await supabase.from("grupos_personas").delete().eq("id_grupo_persona", x.id_grupo_persona); recargar(); }}>Quitar</button>
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <select className={selCls} value={ngGrupo} onChange={(e) => setNgGrupo(e.target.value)}>
            <option value="">Grupo...</option>{catGrupos.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className={selCls} value={ngCargo} onChange={(e) => setNgCargo(e.target.value)}>
            <option value="">Cargo...</option>{catCargos.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button className={addBtn} onClick={async () => {
            if (!ngGrupo || !ngCargo) return;
            await supabase.from("grupos_personas").insert({ id_persona: idPersona, id_grupo: Number(ngGrupo), id_cargo: Number(ngCargo) });
            setNgGrupo(""); setNgCargo(""); recargar();
          }}>+</button>
        </div>
      </div>

      <div className={secc}>
        <h3 className="text-sm font-semibold">Suscripciones</h3>
        {subs.map((x) => (
          <div key={x.id_suscripcion} className={chip}>
            <span>{x.tipo_suscripciones?.suscripcion}</span>
            <button className="text-red-500 text-xs" onClick={async () => { await supabase.from("suscripciones").delete().eq("id_suscripcion", x.id_suscripcion); recargar(); }}>Quitar</button>
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <select className={selCls} value={nSus} onChange={(e) => setNSus(e.target.value)}>
            <option value="">Tipo...</option>{catTipoSus.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button className={addBtn} onClick={async () => {
            if (!nSus) return;
            await supabase.from("suscripciones").insert({ id_persona: idPersona, id_tipo_suscripcion: Number(nSus) });
            setNSus(""); recargar();
          }}>+</button>
        </div>
      </div>

      <div className={secc}>
        <h3 className="text-sm font-semibold">Exámenes</h3>
        {examenes.map((x) => (
          <div key={x.id_examen_personas} className={chip}>
            <span>{x.examenes?.nivel}</span>
            <button className="text-red-500 text-xs" onClick={async () => { await supabase.from("examen_personas").delete().eq("id_examen_personas", x.id_examen_personas); recargar(); }}>Quitar</button>
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <select className={selCls} value={nExam} onChange={(e) => setNExam(e.target.value)}>
            <option value="">Nivel...</option>{catExam.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button className={addBtn} onClick={async () => {
            if (!nExam) return;
            await supabase.from("examen_personas").insert({ id_persona: idPersona, id_examen: Number(nExam) });
            setNExam(""); recargar();
          }}>+</button>
        </div>
      </div>

      <div className={secc}>
        <h3 className="text-sm font-semibold">Daimoku</h3>
        <div className="flex items-center justify-between text-sm">
          <span>Registros: <b>{daimoku}</b></span>
          <button className="rounded-lg bg-marca text-white text-sm px-3 py-1.5" onClick={async () => {
            await supabase.from("daimoku").insert({ id_persona: idPersona }); recargar();
          }}>+ Registrar</button>
        </div>
      </div>
    </div>
  );
}
