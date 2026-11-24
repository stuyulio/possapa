export function Panel({
  judul,
  keterangan,
  children,
  aksi,
}: {
  judul: string;
  keterangan?: string;
  children: React.ReactNode;
  aksi?: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-sm sm:text-base text-slate-900">
            {judul}
          </h2>
          {keterangan && (
            <p className="text-xs text-slate-500 mt-0.5">{keterangan}</p>
          )}
        </div>
        {aksi && <div className="no-print shrink-0">{aksi}</div>}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function TabelKosong({ kolom, pesan }: { kolom: number; pesan: string }) {
  return (
    <tr>
      <td colSpan={kolom} className="py-8 text-center text-sm text-slate-400">
        {pesan}
      </td>
    </tr>
  );
}

export function Badge({
  children,
  warna = "slate",
}: {
  children: React.ReactNode;
  warna?: "slate" | "blue" | "rose" | "emerald" | "amber";
}) {
  const kelas = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-50 text-blue-700 border border-blue-200",
    rose: "bg-rose-50 text-rose-700 border border-rose-200",
    emerald: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border border-amber-200",
  }[warna];

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${kelas}`}>
      {children}
    </span>
  );
}
