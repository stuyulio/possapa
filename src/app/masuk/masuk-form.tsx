"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Tujuan default setelah masuk, menurut peran. */
function tujuanDefault(peran: string | null | undefined) {
  if (peran === "admin_pusat") return "/admin/akun";
  if (peran === "petugas") return "/laporan-saya";
  return "/dashboard";
}

export function MasukForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Bila pengguna datang dari tautan yang dilindungi, hormati tujuan itu.
  const lanjut = searchParams.get("lanjut");

  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setMemuat(true);
    setPesan(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: sandi,
    });

    if (error) {
      setPesan(
        error.message === "Invalid login credentials"
          ? "Email atau kata sandi salah."
          : error.message
      );
      setMemuat(false);
      return;
    }

    // Tentukan tujuan menurut peran bila tidak ada tujuan eksplisit.
    let tujuan = lanjut;
    if (!tujuan) {
      const { data: profil } = await supabase
        .from("pengguna")
        .select("peran")
        .eq("id", data.user?.id ?? "")
        .maybeSingle();

      tujuan = tujuanDefault(profil?.peran);
    }

    router.push(tujuan);
    router.refresh();
  }

  return (
    <form
      onSubmit={kirim}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4"
    >
      <div>
        <label
          htmlFor="email"
          className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-600"
          placeholder="nama@kemenpppa.go.id"
        />
      </div>

      <div>
        <label
          htmlFor="sandi"
          className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5"
        >
          Kata sandi
        </label>
        <input
          id="sandi"
          type="password"
          required
          autoComplete="current-password"
          value={sandi}
          onChange={(e) => setSandi(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-600"
        />
      </div>

      {pesan && (
        <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
          {pesan}
        </p>
      )}

      <button
        type="submit"
        disabled={memuat}
        className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 text-sm transition"
      >
        {memuat ? "Memproses…" : "Masuk"}
      </button>

      <p className="text-xs text-slate-500 text-center">
        Akun dibuat oleh Admin Pusat. Hubungi administrator bila belum memiliki akses.
      </p>
    </form>
  );
}
