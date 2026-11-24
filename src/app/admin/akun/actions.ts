"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type HasilAkun =
  | { sukses: true; pesan?: string }
  | { sukses: false; pesan: string; galat?: Record<string, string> };

type Peran = "petugas" | "admin_kabkota" | "admin_pusat" | "pimpinan";

export type MasukanAkun = {
  id?: string;
  nama: string;
  email: string;
  peran: Peran;
  wilayahId?: string;
  sandi?: string;
};

/** Hanya admin pusat. Dipanggil sebelum operasi apa pun. */
async function pastikanAdminPusat() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, pesan: "Sesi berakhir. Silakan masuk kembali." };
  }

  const { data: profil } = await supabase
    .from("pengguna")
    .select("peran")
    .eq("id", user.id)
    .maybeSingle();

  if (profil?.peran !== "admin_pusat") {
    return {
      ok: false as const,
      pesan: "Hanya Admin Pusat yang dapat mengelola akun.",
    };
  }

  return { ok: true as const, supabase, userId: user.id };
}

function validasiAkun(m: MasukanAkun, baru: boolean): Record<string, string> | null {
  const galat: Record<string, string> = {};

  if (!m.nama?.trim()) galat.nama = "Nama wajib diisi";

  const email = m.email?.trim() ?? "";
  if (!email) galat.email = "Email wajib diisi";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    galat.email = "Format email tidak valid";

  if (!["petugas", "admin_kabkota", "admin_pusat", "pimpinan"].includes(m.peran)) {
    galat.peran = "Peran tidak valid";
  }

  // Petugas dan admin kab/kota wajib terikat wilayah (constraint database).
  if ((m.peran === "petugas" || m.peran === "admin_kabkota") && !m.wilayahId) {
    galat.wilayahId = "Wilayah wajib dipilih untuk peran ini";
  }

  if (baru) {
    const sandi = m.sandi ?? "";
    if (!sandi) galat.sandi = "Kata sandi wajib diisi";
    else if (sandi.length < 8) galat.sandi = "Minimal 8 karakter";
  } else if (m.sandi && m.sandi.length < 8) {
    galat.sandi = "Minimal 8 karakter";
  }

  return Object.keys(galat).length > 0 ? galat : null;
}

export async function buatAkun(m: MasukanAkun): Promise<HasilAkun> {
  const galat = validasiAkun(m, true);
  if (galat) return { sukses: false, pesan: "Periksa kembali isian.", galat };

  const cek = await pastikanAdminPusat();
  if (!cek.ok) return { sukses: false, pesan: cek.pesan };

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return {
      sukses: false,
      pesan:
        "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server. " +
        "Tambahkan ke .env.local lalu restart server.",
    };
  }

  const email = m.email.trim().toLowerCase();

  // 1. Buat akun auth. Email langsung dikonfirmasi agar bisa dipakai masuk.
  const { data: dibuat, error: errAuth } = await admin.auth.admin.createUser({
    email,
    password: m.sandi!,
    email_confirm: true,
    user_metadata: { nama: m.nama.trim() },
  });

  if (errAuth || !dibuat.user) {
    const pesan = errAuth?.message ?? "Gagal membuat akun.";
    if (/already registered|already exists|duplicate/i.test(pesan)) {
      return {
        sukses: false,
        pesan: "Email ini sudah terdaftar.",
        galat: { email: "Email sudah dipakai" },
      };
    }
    return { sukses: false, pesan };
  }

  // 2. Lengkapi profil. Bila gagal, hapus akun auth agar tidak meninggalkan
  //    akun tanpa profil yang tidak bisa dipakai.
  const { error: errProfil } = await admin.from("pengguna").insert({
    id: dibuat.user.id,
    nama: m.nama.trim(),
    email,
    peran: m.peran,
    wilayah_id:
      m.peran === "petugas" || m.peran === "admin_kabkota"
        ? m.wilayahId
        : null,
  });

  if (errProfil) {
    await admin.auth.admin.deleteUser(dibuat.user.id);
    return {
      sukses: false,
      pesan: `Gagal menyimpan profil: ${errProfil.message}. Akun dibatalkan.`,
    };
  }

  revalidatePath("/admin/akun");
  return { sukses: true, pesan: "Akun berhasil dibuat." };
}

export async function ubahAkun(m: MasukanAkun): Promise<HasilAkun> {
  if (!m.id) return { sukses: false, pesan: "ID akun tidak valid." };

  const galat = validasiAkun(m, false);
  if (galat) return { sukses: false, pesan: "Periksa kembali isian.", galat };

  const cek = await pastikanAdminPusat();
  if (!cek.ok) return { sukses: false, pesan: cek.pesan };

  if (m.id === cek.userId && m.peran !== "admin_pusat") {
    return {
      sukses: false,
      pesan: "Anda tidak dapat mengubah peran akun Anda sendiri.",
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      sukses: false,
      pesan: "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server.",
    };
  }

  const { error: errProfil } = await admin
    .from("pengguna")
    .update({
      nama: m.nama.trim(),
      peran: m.peran,
      wilayah_id:
        m.peran === "petugas" || m.peran === "admin_kabkota"
          ? m.wilayahId
          : null,
    })
    .eq("id", m.id);

  if (errProfil) {
    return { sukses: false, pesan: `Gagal menyimpan: ${errProfil.message}` };
  }

  // Kata sandi opsional saat mengubah.
  if (m.sandi) {
    const { error: errSandi } = await admin.auth.admin.updateUserById(m.id, {
      password: m.sandi,
    });
    if (errSandi) {
      return {
        sukses: false,
        pesan: `Profil tersimpan, tetapi kata sandi gagal diubah: ${errSandi.message}`,
      };
    }
  }

  revalidatePath("/admin/akun");
  return { sukses: true, pesan: "Akun diperbarui." };
}

export async function ubahStatusAkun(
  id: string,
  aktif: boolean
): Promise<HasilAkun> {
  const cek = await pastikanAdminPusat();
  if (!cek.ok) return { sukses: false, pesan: cek.pesan };

  if (id === cek.userId) {
    return {
      sukses: false,
      pesan: "Anda tidak dapat menonaktifkan akun Anda sendiri.",
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      sukses: false,
      pesan: "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server.",
    };
  }

  const { error } = await admin
    .from("pengguna")
    .update({ aktif })
    .eq("id", id);

  if (error) return { sukses: false, pesan: error.message };

  // Nonaktifkan juga sesi auth agar tidak bisa masuk lagi.
  if (!aktif) {
    await admin.auth.admin.updateUserById(id, { ban_duration: "876000h" });
  } else {
    await admin.auth.admin.updateUserById(id, { ban_duration: "none" });
  }

  revalidatePath("/admin/akun");
  return {
    sukses: true,
    pesan: aktif ? "Akun diaktifkan." : "Akun dinonaktifkan.",
  };
}
