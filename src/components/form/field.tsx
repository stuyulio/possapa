"use client";

export function Field({
  label,
  galat,
  bantuan,
  wajib,
  children,
}: {
  label: string;
  galat?: string;
  bantuan?: string;
  wajib?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">
        {label}
        {wajib && <span className="text-rose-600 ml-0.5">*</span>}
      </label>
      {children}
      {bantuan && !galat && (
        <p className="text-[11px] text-slate-500 mt-1">{bantuan}</p>
      )}
      {galat && (
        <p className="text-[11px] text-rose-600 font-semibold mt-1">{galat}</p>
      )}
    </div>
  );
}

export const kelasInput =
  "w-full text-sm border rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-1";

export function kelasField(galat?: string) {
  return `${kelasInput} ${
    galat
      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-300"
      : "border-slate-300 focus:border-blue-600 focus:ring-blue-300"
  }`;
}

export function InputAngka({
  nilai,
  ubah,
  galat,
  min = 0,
  ...sisa
}: {
  nilai: number;
  ubah: (n: number) => void;
  galat?: string;
  min?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      value={Number.isFinite(nilai) ? nilai : 0}
      onChange={(e) => ubah(e.target.value === "" ? 0 : Number(e.target.value))}
      className={kelasField(galat)}
      {...sisa}
    />
  );
}
