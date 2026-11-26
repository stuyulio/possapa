import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { KakiHalaman } from "@/components/brand/kaki";

import { HeaderPublik } from "@/components/landing/header-publik";
import { Hero } from "@/components/landing/hero";
import { TileIndeks } from "@/components/landing/tile-indeks";
import { Mandat } from "@/components/landing/mandat";
import { Konsep } from "@/components/landing/konsep";
import { Alur } from "@/components/landing/alur";
import { Aktivitas } from "@/components/landing/aktivitas";
import { Pintu } from "@/components/landing/pintu";
import { Sebaran } from "@/components/landing/sebaran";
import {
  DataPublik,
  type Ringkasan,
  type Total,
} from "@/components/landing/data-publik";

// Halaman publik boleh di-cache; data diperbarui tiap 5 menit.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Pos SAPA — Sahabat Perempuan dan Anak | KemenPPPA",
  description:
    "Ruang layanan perlindungan perempuan dan anak di wilayah terdampak bencana. Mandat Menteri PPPA melalui Instruksi Presiden Nomor 18 Tahun 2025.",
};

async function ambilRingkasan(): Promise<Ringkasan[]> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("publik_ringkasan")
      .select("*")
      .order("provinsi")
      .order("kab_kota");

    if (error) {
      console.error("[publik_ringkasan]", error.message);
      return [];
    }
    return (data ?? []) as Ringkasan[];
  } catch (err) {
    console.error("[publik_ringkasan] gagal terhubung", err);
    return [];
  }
}

type Pembaruan = {
  terakhir_diperbarui: string | null;
  jumlah_laporan: number;
  jumlah_terverifikasi: number;
};

async function ambilPembaruan(): Promise<Pembaruan | null> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("publik_pembaruan")
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[publik_pembaruan]", error.message);
      return null;
    }
    return (data as Pembaruan) ?? null;
  } catch (err) {
    console.error("[publik_pembaruan] gagal terhubung", err);
    return null;
  }
}

export default async function Beranda() {
  const [ringkasan, pembaruan] = await Promise.all([
    ambilRingkasan(),
    ambilPembaruan(),
  ]);

  const total = ringkasan.reduce<Total>(
    (acc, r) => ({
      anak: acc.anak + Number(r.total_anak),
      perempuan: acc.perempuan + Number(r.total_perempuan),
      disabilitas: acc.disabilitas + Number(r.total_anak_disabilitas),
      aduan: acc.aduan + Number(r.total_aduan),
      ditindaklanjuti:
        acc.ditindaklanjuti + Number(r.total_aduan_ditindaklanjuti),
      simfoni: acc.simfoni + Number(r.total_aduan_simfoni),
      publikasi: acc.publikasi + Number(r.total_publikasi),
    }),
    {
      anak: 0,
      perempuan: 0,
      disabilitas: 0,
      aduan: 0,
      ditindaklanjuti: 0,
      simfoni: 0,
      publikasi: 0,
    }
  );

  return (
    <>
      <a
        href="#mulai"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Langsung ke konten
      </a>

      <div className="min-h-screen bg-white">
        <HeaderPublik />

        <main>
          <Hero />
          <TileIndeks />
          <Konsep />
          <Mandat />
          <Alur />
          <Aktivitas />
          <Pintu />
          <Sebaran />
          <DataPublik
            ringkasan={ringkasan}
            total={total}
            terakhirDiperbarui={pembaruan?.terakhir_diperbarui ?? null}
          />
        </main>

        <KakiHalaman />
      </div>
    </>
  );
}
