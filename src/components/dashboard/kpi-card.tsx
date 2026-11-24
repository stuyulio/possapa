export function KpiCard({
  label,
  nilai,
  keterangan,
  aksen = "slate",
}: {
  label: string;
  nilai: string;
  keterangan?: string;
  aksen?: "slate" | "blue" | "rose" | "emerald" | "amber";
}) {
  const warna = {
    slate: "text-slate-900",
    blue: "text-blue-700",
    rose: "text-rose-700",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
  }[aksen];

  return (
    <div className="kpi-card">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`font-display text-2xl sm:text-3xl font-extrabold mt-1 ${warna}`}>
        {nilai}
      </p>
      {keterangan && (
        <p className="text-xs text-slate-500 mt-1 leading-snug">{keterangan}</p>
      )}
    </div>
  );
}
