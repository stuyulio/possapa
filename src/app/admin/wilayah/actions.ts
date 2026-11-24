"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validasiMasukanLokasi, pesanGalatLokasi } from "@/lib/lokasi/validasi";
import type { HasilLokasi, MasukanLokasi } from "@/lib/lokasi/tipe";

export type { HasilLokasi } from "@/lib/lokasi/tipe";

async function pastikanAdminPusat() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, pesan: "Sesi berakhir." };

  const { data: profil } = await supabase
    .from("pengguna")
    .select("peran")
    .eq("id", user.id)
    .maybeSingle();

  if (profil?.peran !== "admin_pusat") {
    return { ok: false as const, pesan: "Hanya Admin Pusat yang dapat mengelola lokasi." };
  }
  return { ok: true as const, supabase };
}

export async function simpanLokasi(m: MasukanLokasi): Promise<HasilLokasi> {
  const { galat, nilai } = validasiMasukanLokasi(m);
  if (!m.wilayahId) galat.wilayahId = "Kabupaten/kota wajib dipilih";

  if (Object.keys(galat).length > 0) {
    return { sukses: false, pesan: "Periksa kembali isian.", galat };
  }

  const cek = await pastikanAdminPusat();
  if (!cek.ok) return { sukses: false, pesan: cek.pesan };
  const { supabase } = cek;

  const isi = { ...nilai, wilayah_id: m.wilayahId! };

  const { error } = m.id
    ? await supabase.from("pos_sapa").update(isi).eq("id", m.id)
    : await supabase.from("pos_sapa").insert(isi);

  if (error) {
    const g = pesanGalatLokasi(error.code, error.message);
    return { sukses: false, pesan: g.pesan, galat: g.galat };
  }

  revalidatePath("/admin/wilayah");
  revalidatePath("/lokasi-saya");
  revalidatePath("/input");
  revalidatePath("/monitoring");
  return { sukses: true };
}

export async function hapusLokasi(id: string): Promise<HasilLokasi> {
  const cek = await pastikanAdminPusat();
  if (!cek.ok) return { sukses: false, pesan: cek.pesan };
  const { supabase } = cek;

  const { count } = await supabase
    .from("laporan")
    .select("id", { count: "exact", head: true })
    .eq("pos_id", id);

  if (count && count > 0) {
    return {
      sukses: false,
      pesan: `Lokasi ini memiliki ${count} laporan dan tidak dapat dihapus. Nonaktifkan saja.`,
    };
  }

  const { error } = await supabase.from("pos_sapa").delete().eq("id", id);
  if (error) return { sukses: false, pesan: error.message };

  revalidatePath("/admin/wilayah");
  revalidatePath("/lokasi-saya");
  revalidatePath("/input");
  return { sukses: true };
}
