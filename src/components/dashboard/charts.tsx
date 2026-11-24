"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Palet semantik — konsisten di seluruh aplikasi (PRD §8.1). */
export const WARNA = {
  navy: "#1e293b",
  blue: "#2563eb",
  rose: "#e11d48",
  amber: "#f59e0b",
  emerald: "#10b981",
  indigo: "#6366f1",
  slate: "#94a3b8",
};

const PALET = [
  WARNA.blue,
  WARNA.rose,
  WARNA.amber,
  WARNA.emerald,
  WARNA.indigo,
  WARNA.slate,
];

export type Titik = { nama: string; jumlah: number };

export function GrafikBatang({
  data,
  satuan = "orang",
  tinggi = 260,
  warna = WARNA.blue,
  horizontal = false,
}: {
  data: Titik[];
  satuan?: string;
  tinggi?: number;
  warna?: string;
  horizontal?: boolean;
}) {
  if (data.length === 0) return <Kosong />;

  return (
    <div style={{ height: tinggi }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 12, bottom: 8, left: horizontal ? 8 : 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="nama"
                width={130}
                tick={{ fontSize: 11 }}
              />
            </>
          ) : (
            <>
              <XAxis dataKey="nama" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            </>
          )}
          <Tooltip
            formatter={(v) => [`${Number(v).toLocaleString("id-ID")} ${satuan}`, "Jumlah"]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="jumlah" fill={warna} radius={[6, 6, 0, 0]} name="Jumlah" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GrafikDonat({
  data,
  tinggi = 260,
  satuan = "laporan",
}: {
  data: Titik[];
  tinggi?: number;
  satuan?: string;
}) {
  const total = data.reduce((a, d) => a + d.jumlah, 0);
  if (total === 0) return <Kosong />;

  return (
    <div style={{ height: tinggi }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="jumlah"
            nameKey="nama"
            innerRadius="52%"
            outerRadius="80%"
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALET[i % PALET.length]} stroke="#fff" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => [`${Number(v).toLocaleString("id-ID")} ${satuan}`, "Jumlah"]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Legend
            verticalAlign="bottom"
            iconSize={10}
            formatter={(v) => <span className="text-[11px] text-slate-600">{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function Kosong() {
  return (
    <div className="h-[220px] flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
      Belum ada data pada filter ini.
    </div>
  );
}
