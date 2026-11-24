"use client";

import { KelolaLokasiForm } from "@/components/lokasi/kelola-lokasi";
import { simpanLokasi, hapusLokasi } from "./actions";
import type { Lokasi, WilayahRingkas } from "@/lib/lokasi/tipe";

export type { HasilLokasi, Lokasi, WilayahRingkas } from "@/lib/lokasi/tipe";

/**
 * Pembungkus tipis: halaman admin memakai komponen form bersama,
 * dengan server action admin pusat (lintas wilayah).
 */
export function KelolaLokasi({
  daftar,
  wilayah,
}: {
  daftar: Lokasi[];
  wilayah: WilayahRingkas[];
}) {
  return (
    <KelolaLokasiForm
      daftar={daftar}
      wilayah={wilayah}
      simpanAksi={simpanLokasi}
      hapusAksi={hapusLokasi}
    />
  );
}
