"use client";

import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";

// Paleta Okabe-Ito (segura para daltonismo), en orden fijo.
const PALETA = ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#56B4E9", "#D55E00", "#F0E442", "#999999"];

type Cat = { etiqueta: string; cantidad: number };
type Mes = { mes: string; asistentes: number };

function Panel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{titulo}</h3>
      {children}
    </div>
  );
}

export default function DashboardCharts({
  division, estado, mensual,
}: { division: Cat[]; estado: Cat[]; mensual: Mes[] }) {
  return (
    <div className="space-y-4">
      <Panel titulo="Miembros por división">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={division}
              dataKey="cantidad"
              nameKey="etiqueta"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={(e: any) => `${e.etiqueta}: ${e.cantidad}`}
              labelLine={false}
            >
              {division.map((_, i) => (
                <Cell key={i} fill={PALETA[i % PALETA.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Panel>

      <Panel titulo="Asistentes por mes">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={mensual} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="asistentes" name="Asistentes" fill="#0072B2" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel titulo="Miembros por estado">
        <ResponsiveContainer width="100%" height={Math.max(200, estado.length * 34)}>
          <BarChart data={estado} layout="vertical" margin={{ top: 4, right: 24, left: 40, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis type="category" dataKey="etiqueta" tick={{ fontSize: 10 }} width={110} />
            <Tooltip />
            <Bar dataKey="cantidad" name="Miembros" fill="#009E73" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}
