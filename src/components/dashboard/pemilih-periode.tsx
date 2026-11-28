"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export type PilihanPeriode = {
  id: string;
  label: string;
  /** Teks tambahan di belakang label, mis. " (berjalan)". */
  tanda?: string;
};

/**
 * Pemilih periode yang langsung memuat ulang halaman begitu pilihan berubah.
 *
 * Menggantikan `<form>` GET + tombol "Tampilkan": form biasa tidak melakukan
 * apa pun sampai tombolnya ditekan, sehingga memilih periode terasa seperti
 * tidak berfungsi. Periode adalah satu-satunya pilihan di sini, jadi tombol
 * konfirmasi tidak menambah keamanan apa pun.
 *
 * Parameter lain di URL sengaja DIPERTAHANKAN: filter wilayah pada halaman
 * yang memakainya tidak boleh hilang hanya karena periode diganti.
 */
export function PemilihPeriode({
  daftar,
  terpilih,
  kelas,
}: {
  daftar: PilihanPeriode[];
  /** id periode yang sedang dibuka. */
  terpilih: string;
  /** Kelas tambahan agar tampilannya menyatu dengan halaman pemakainya. */
  kelas?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [memuat, mulai] = useTransition();

  function ganti(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("periode", id);
    else params.delete("periode");
    mulai(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <span className="inline-flex items-center gap-2">
      <select
        aria-label="Periode"
        className={
          kelas ??
          "text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white"
        }
        value={terpilih}
        onChange={(e) => ganti(e.target.value)}
      >
        {daftar.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
            {p.tanda ?? ""}
          </option>
        ))}
      </select>
      {memuat && (
        <span className="text-xs text-slate-400" role="status">
          Memuat…
        </span>
      )}
    </span>
  );
}
