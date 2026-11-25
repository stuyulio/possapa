import { LogoKemenPPPA } from "@/components/brand/logo";

/**
 * Slot gambar landing page.
 *
 * Foto lapangan belum tersedia. Selama `FOTO` di `konvensi.ts` masih kosong,
 * komponen ini menampilkan gradient navy ber-lambang KemenPPPA sebagai
 * placeholder — bukan gambar rusak dan bukan 404 di konsol jaringan.
 *
 * KONVENSI BERKAS
 * ---------------
 * Simpan foto ke `public/foto/` dengan nama berikut, lalu isi `FOTO` di
 * `src/components/landing/konvensi.ts` dengan path publiknya (mis.
 * `"/foto/hero-utama.jpg"`). Rasio yang disarankan:
 *
 *   hero-utama.jpg          hero, 16:9
 *   hero-latar.jpg          lapisan belakang hero, 21:9
 *   aktivitas-anak.jpg      kartu aktivitas 01, 16:10
 *   aktivitas-perempuan.jpg kartu aktivitas 02, 16:10
 *   aktivitas-pengaduan.jpg kartu aktivitas 03, 16:10
 *   aktivitas-edu.jpg       kartu aktivitas 04, 16:10
 *   pintu-warga.jpg         kartu jalur 1, 16:10
 *   pintu-petugas.jpg       kartu jalur 2, 16:10
 *   pintu-mitra.jpg         kartu jalur 3, 16:10
 *   mandat.jpg              sisi kanan blok kutipan, 4:3
 *
 * Catatan: `alt` wajib. Saat placeholder tampil, pembaca layar tetap
 * mendapat deskripsi gambar yang dimaksud lewat `role="img"`.
 */
export function Gambar({
  src,
  alt,
  className = "",
  prioritas = false,
  ukuran = "besar",
}: {
  src?: string;
  alt: string;
  className?: string;
  /** True untuk gambar di atas lipatan: eager + fetchPriority tinggi. */
  prioritas?: boolean;
  /** Ukuran slot placeholder — menentukan tampil/tidaknya lambang. */
  ukuran?: "besar" | "sedang" | "strip";
}) {
  if (src) {
    return (
      // img biasa, bukan next/image: berkas di public/ bisa belum ada saat
      // build, dan next/image akan gagal mengoptimisasi path yang tidak ada.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading={prioritas ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={prioritas ? "high" : "auto"}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  // `alt=""` menandai gambar hiasan (mis. strip tile). Placeholder-nya pun
  // harus tak terlihat oleh pembaca layar, bukan memberi label kosong.
  const hiasan = alt.trim() === "";

  // Lambang hanya untuk slot besar. Di strip 84px lambang penuh justru
  // memenuhi bidang dan terlihat seperti gambar rusak, bukan placeholder.
  const lambang = ukuran === "besar" || ukuran === "sedang";

  const tinggiLambang =
    ukuran === "besar" ? "h-16 w-16" : "h-10 w-10";

  return (
    <div
      {...(hiasan
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": alt })}
      className={`relative h-full w-full overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 ${className}`}
    >
      {/* Sorot hangat di sudut, sepadan dengan "sunball" referensi. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(60%_80%_at_85%_15%,rgba(245,158,11,0.28),transparent_60%)]"
      />
      {/* aria-hidden di pembungkus: lambang ini murni hiasan, dan label
          deskriptif sudah dibawa oleh role="img" di induknya. */}
      {lambang && (
        <div aria-hidden="true" className="absolute inset-0">
          <LogoKemenPPPA
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 ${tinggiLambang}`}
            title=""
          />
        </div>
      )}
    </div>
  );
}
