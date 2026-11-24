"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type HasilPeriode =
  | { sukses: true }
  | { sukses: false; pesan: string; galat?: Record<string, string> };

type Masukan = {
  id?: string;
  tanggalMulai: string;
  tanggalSelesai: string;
};

function validasi(m: Masukan): Record<string, string> | null {
  const galat: Record<string, string> = {};

  const pola = /^\d{4}-\d{2}-\d{2}$/;

  if (!m.tanggalMulai || !pola.test(m.tanggalMulai)) {
    galat.tanggalMulai = "Tanggal mulai wajib diisi";
  }
  if (!m.tanggalSelesai || !pola.test(m.tanggalSelesai)) {
    galat.tanggalSelesai = "Tanggal selesai wajib diisi";
  }
  if (!galat.tanggalMulai && !galat.tanggalSelesai) {
    if (m.tanggalMulai > m.tanggalSelesai) {
      galat.tanggalSelesai = "Tanggal selesai tidak boleh mendahului tanggal mulai";
    }
  }

  return Object.keys(galat).length > 0 ? galat : null;
}

/** Hanya admin pusat yang boleh mengubah data periode. */
async function pastikanAdminPusat() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, pesan: "Sesi berakhir. Silakan masuk kembali." };

  const { data: profil } = await supabase
    .from("pengguna")
    .select("peran")
    .eq("id", user.id)
    .maybeSingle();

  if (profil?.peran !== "admin_pusat") {
    return {
      ok: false as const,
      pesan: "Hanya Admin Pusat yang dapat mengelola periode pelaporan.",
    };
  }

  return { ok: true as const, supabase };
}

export async function simpanPeriode(m: Masukan): Promise<HasilPeriode> {
  const galat = validasi(m);
  if (galat) return { sukses: false, pesan: "Periksa kembali isian.", galat };

  const cek = await pastikanAdminPusat();
  if (!cek.ok) return { sukses: false, pesan: cek.pesan };
  const { supabase } = cek;

  const isi = {
    tanggal_mulai: m.tanggalMulai,
    tanggal_selesai: m.tanggalSelesai,
  };

  const { error } = m.id
    ? await supabase.from("periode").update(isi).eq("id", m.id)
    : await supabase.from("periode").insert(isi);

  if (error) {
    // 23505 = unique_violation
    if (error.code === "23505") {
      return {
        sukses: false,
        pesan: "Periode dengan rentang tanggal tersebut sudah ada.",
        galat: { tanggalMulai: "Rentang tanggal sudah dipakai" },
      };
    }
    // 23514 = check_violation (periode_urutan)
    if (error.code === "23514") {
      return {
        sukses: false,
        pesan: "Tanggal selesai tidak boleh mendahului tanggal mulai.",
        galat: { tanggalSelesai: "Urutan tanggal tidak valid" },
      };
    }
    return { sukses: false, pesan: error.message };
  }

  revalidatePath("/admin/periode");
  revalidatePath("/monitoring");
  revalidatePath("/input");
  revalidatePath("/laporan-saya");
  return { sukses: true };
}

export async function hapusPeriode(id: string): Promise<HasilPeriode> {
  const cek = await pastikanAdminPusat();
  if (!cek.ok) return { sukses: false, pesan: cek.pesan };
  const { supabase } = cek;

  // Tolak lebih awal dengan pesan yang jelas; FK juga akan menolak.
  const { count } = await supabase
    .from("laporan")
    .select("id", { count: "exact", head: true })
    .eq("periode_id", id);

  if (count && count > 0) {
    return {
      sukses: false,
      pesan: `Periode ini dipakai oleh ${count} laporan dan tidak dapat dihapus.`,
    };
  }

  const { error } = await supabase.from("periode").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return {
        sukses: false,
        pesan: "Periode masih dipakai laporan sehingga tidak dapat dihapus.",
      };
    }
    return { sukses: false, pesan: error.message };
  }

  revalidatePath("/admin/periode");
  revalidatePath("/monitoring");
  return { sukses: true };
}

/**
 * Jumlah hari dalam periode. Dipakai untuk menandai periode yang tidak lazim
 * (mis. kurang dari 5 hari atau lebih dari 45 hari).
 */
export async function cekJumlahHari(mulai: string, selesai: string) {
  const a = new Date(mulai);
  const b = new Date(selesai);
  const hari = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  return hari;
}
