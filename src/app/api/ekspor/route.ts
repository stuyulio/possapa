import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { ambilLaporan, bacaFilter } from "@/lib/data/laporan";
import {
  agregatAnak,
  agregatPerempuan,
  agregatPengaduan,
  agregatKasus,
  agregatPublikasi,
} from "@/lib/data/agregat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JUDUL: Record<string, string> = {
  anak: "Aktivitas Anak",
  perempuan: "Aktivitas Perempuan",
  pengaduan: "Layanan Pengaduan",
  kasus: "Tindak Lanjut Kasus",
  publikasi: "Publikasi",
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const jenis = params.get("jenis") ?? "ringkasan";
  const filter = bacaFilter(
    Object.fromEntries(params.entries()) as Record<string, string>
  );

  const laporan = await ambilLaporan(filter);
  let baris: Record<string, unknown>[] = [];
  /** Lembar kedua berisi narasi; lihat kasus "anak"/"perempuan" di bawah. */
  let lembarTambahan: { nama: string; sheet: XLSX.WorkSheet } | null = null;

  switch (jenis) {
    case "anak": {
      const a = agregatAnak(laporan);
      baris = [
        { Keterangan: "Total anak penerima manfaat", Nilai: a.totalAnak },
        { Keterangan: "Usia 0–5", Nilai: a.usia0_5 },
        { Keterangan: "Usia 6–12", Nilai: a.usia6_12 },
        { Keterangan: "Usia 13–17", Nilai: a.usia13_17 },
        { Keterangan: "Laki-laki", Nilai: a.laki },
        { Keterangan: "Perempuan", Nilai: a.perempuan },
        { Keterangan: "Penyandang disabilitas", Nilai: a.disabilitas },
        { Keterangan: "Perlu layanan lanjutan", Nilai: a.perluLanjutan },
        { Keterangan: "Total kegiatan", Nilai: a.totalKegiatan },
      ];
      // Narasi ikut diekspor terpisah: lembar "ringkasan" berisi angka saja,
      // jadi hambatan ditempatkan di lembarnya sendiri alih-alih sebagai baris
      // Nilai yang isinya teks.
      if (a.hambatan.length > 0) {
        lembarTambahan = {
          nama: "Hambatan",
          sheet: XLSX.utils.json_to_sheet(
            a.hambatan.map((h) => ({
              Kabupaten_Kota: h.kab_kota,
              Lokasi: h.lokasi,
              Hambatan_Kendala: h.isi,
            }))
          ),
        };
      }
      break;
    }
    case "perempuan": {
      const p = agregatPerempuan(laporan);
      baris = [
        { Keterangan: "Total peserta perempuan", Nilai: p.totalIkut },
        { Keterangan: "Kepala keluarga", Nilai: p.kepalaKeluarga },
        { Keterangan: "Hamil", Nilai: p.hamil },
        { Keterangan: "Menyusui", Nilai: p.menyusui },
        { Keterangan: "Lansia", Nilai: p.lansia },
        { Keterangan: "Disabilitas", Nilai: p.disabilitas },
        { Keterangan: "Total kegiatan", Nilai: p.totalKegiatan },
      ];
      if (p.hambatan.length > 0) {
        lembarTambahan = {
          nama: "Hambatan",
          sheet: XLSX.utils.json_to_sheet(
            p.hambatan.map((h) => ({
              Kabupaten_Kota: h.kab_kota,
              Lokasi: h.lokasi,
              Hambatan_Kendala: h.isi,
            }))
          ),
        };
      }
      break;
    }
    case "pengaduan": {
      const d = agregatPengaduan(laporan);
      baris = d.rincian.map((r) => ({
        Kabupaten_Kota: r.kab_kota,
        Provinsi: r.provinsi,
        Lokasi: r.lokasi,
        Periode: r.periode,
        Status: r.status_bulan,
        Aduan_Masuk: r.aduan_masuk,
        Kekerasan_Perempuan: r.kekerasan_perempuan,
        Kekerasan_Anak: r.kekerasan_anak,
        NonKekerasan_Perempuan: r.non_kekerasan_perempuan,
        NonKekerasan_Anak: r.non_kekerasan_anak,
        Sudah_Ditindaklanjuti: r.sudah_ditindaklanjuti,
        Tercatat_SIMFONI: r.tercatat_simfoni,
        Pihak_Terlibat: r.pihak_terlibat,
      }));
      break;
    }
    case "kasus": {
      const k = agregatKasus(laporan);
      baris = k.rincian.map((x) => ({
        Kode_Kasus: x.kode_kasus,
        Tanggal_Aduan: x.tanggal_aduan,
        Kabupaten_Kota: x.kab_kota,
        Lokasi: x.lokasi,
        Kategori: x.kategori,
        Jenis_Kasus: x.jenis_kasus,
        Jumlah_Korban: x.jumlah_korban,
        Jenis_Kelamin: x.jenis_kelamin,
        Kelompok_Usia: x.kelompok_usia,
        Disabilitas: x.disabilitas ? "Ya" : "Tidak",
        Status_Penanganan: x.status_penanganan,
        Kebutuhan_Korban: x.kebutuhan_korban,
        Tindak_Lanjut: x.tindak_lanjut,
        Hambatan: x.hambatan,
      }));
      break;
    }
    case "publikasi": {
      const p = agregatPublikasi(laporan);
      baris = p.daftar.map((x) => ({
        Tanggal_Publikasi: x.tanggal_publikasi,
        Kabupaten_Kota: x.kab_kota,
        Lokasi: x.lokasi,
        Kegiatan: x.kegiatan,
        Platform: x.platform,
        Nama_Akun: x.nama_akun,
        Link_Publikasi_Media_Sosial: x.link_publikasi,
        Link_Penyimpanan_Dokumentasi: x.file_publikasi,
      }));
      break;
    }
    default: {
      baris = laporan.map((l) => ({
        Kabupaten_Kota: l.pos_sapa?.wilayah?.kab_kota,
        Provinsi: l.pos_sapa?.wilayah?.provinsi,
        Lokasi: l.pos_sapa?.nama_lokasi,
        Periode: l.periode?.label,
        Jenis_Laporan: l.jenis_laporan,
        Status: l.status,
        Sumber_Input: l.sumber_input,
        Dokumentasi: l.link_dokumentasi,
        Dikirim_Pada: l.submitted_at,
      }));
    }
  }

  if (baris.length === 0) {
    baris = [{ Keterangan: "Tidak ada data pada filter ini" }];
  }

  const ws = XLSX.utils.json_to_sheet(baris);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, JUDUL[jenis] ?? "Data");
  if (lembarTambahan) {
    XLSX.utils.book_append_sheet(wb, lembarTambahan.sheet, lembarTambahan.nama);
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const nama = `Pos-SAPA_${jenis}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nama}"`,
      "Cache-Control": "no-store",
    },
  });
}
