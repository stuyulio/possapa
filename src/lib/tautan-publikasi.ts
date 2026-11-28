/**
 * Menerjemahkan tautan publikasi menjadi bentuk yang bisa ditampilkan di
 * dashboard.
 *
 * LATAR
 *   Galeri publikasi sebelumnya hanya menampilkan tombol "Buka publikasi" yang
 *   membuka tab baru. Untuk memeriksa apakah tautannya benar, Admin harus
 *   berpindah tab dan kembali lagi — puluhan kali bila laporannya banyak.
 *
 * BATASAN YANG MENENTUKAN BENTUK KODE INI
 *   1. Tidak ada thumbnail publikasi yang tersimpan. Yang ada hanya URL
 *      halaman, jadi pratinjau harus datang dari platformnya sendiri.
 *   2. Platform menentukan sendiri apakah halamannya boleh ditanam di iframe.
 *      Instagram/Facebook/YouTube menyediakan endpoint khusus sematan
 *      (`/embed`, `/plugins/...`) yang memang dirancang untuk itu — itulah yang
 *      dipakai. Halaman biasa mereka (`instagram.com/p/xxx`) mengirim
 *      `X-Frame-Options: DENY` dan akan tampil kosong.
 *   3. Situs berita tidak seragam. Sebagian mengizinkan iframe (tidak mengirim
 *      X-Frame-Options), sebagian menolak. Tidak ada cara mengetahui dari
 *      sisi klien sebelum memuat, jadi halaman biasa tetap dicoba ditanam dan
 *      antarmuka menyediakan tautan "buka di tab baru" sebagai jalan keluar.
 *
 * Modul ini MURNI (tanpa jaringan, tanpa React) supaya aturan pengenalan URL
 * yang mudah salah ini dapat diuji langsung — lihat tautan-publikasi.test.ts.
 */

export type JenisTautan =
  | "youtube"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "drive"
  | "situs";

/** Perkiraan bentuk halaman sematan; menentukan tinggi bingkai di layar. */
export type BentukSematan = "video" | "persegi" | "tegak" | "halaman";

export type TautanPublikasi = {
  jenis: JenisTautan;
  /** URL yang dimuat di dalam iframe. Null bila tidak ada bentuk sematan. */
  sematan: string | null;
  bentuk: BentukSematan;
  /** Halaman asli untuk dibuka di tab baru. Null bila tautan tidak sah. */
  halaman: string | null;
  /** Nama pendek platform, dipakai pada label tombol/modal. */
  label: string;
  /** Hostname tanpa `www.`, ditampilkan di atas bingkai pratinjau. */
  domain: string;
  /** ID bawaan platform (video YouTube, kode Instagram, ...) bila ada. */
  id: string | null;
};

const ID_YOUTUBE = /^[\w-]{6,}$/;
const KODE_INSTAGRAM = /^\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/;

function hostTanpaWww(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

const PLATFORM_YOUTUBE = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
]);

function idYoutube(url: URL, host: string): string | null {
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return ID_YOUTUBE.test(id) ? id : null;
  }

  if (!PLATFORM_YOUTUBE.has(host)) return null;

  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v") ?? "";
    return ID_YOUTUBE.test(id) ? id : null;
  }

  const cocok = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]+)/);
  return cocok && ID_YOUTUBE.test(cocok[1]) ? cocok[1] : null;
}

function kodeInstagram(url: URL): { jenis: string; kode: string } | null {
  const cocok = url.pathname.match(KODE_INSTAGRAM);
  if (!cocok) return null;
  // Instagram memakai dua ejaan untuk hal yang sama; samakan supaya alamat
  // sematannya selalu satu bentuk.
  const jenis = cocok[1] === "reels" ? "reel" : cocok[1];
  return { jenis, kode: cocok[2] };
}

function idDrive(url: URL, host: string): string | null {
  if (host !== "drive.google.com") return null;
  const dariPath = url.pathname.match(/^\/file\/d\/([\w-]+)/);
  if (dariPath) return dariPath[1];
  const dariQuery = url.searchParams.get("id");
  return dariQuery && /^[\w-]+$/.test(dariQuery) ? dariQuery : null;
}

function idTiktok(url: URL): string | null {
  const cocok = url.pathname.match(/\/video\/(\d{6,})/);
  return cocok ? cocok[1] : null;
}

/**
 * Baca satu tautan publikasi.
 *
 * Tidak pernah melempar: nilai tak terbaca menghasilkan `halaman: null` dan
 * `sematan: null` supaya pemanggil dapat menampilkan teks apa adanya tanpa
 * pemeriksaan tambahan.
 */
export function bacaTautanPublikasi(
  mentah: string | null | undefined
): TautanPublikasi {
  const kosong: TautanPublikasi = {
    jenis: "situs",
    sematan: null,
    bentuk: "halaman",
    halaman: null,
    label: "Tautan",
    domain: "",
    id: null,
  };

  const teks = mentah?.trim();
  if (!teks) return kosong;

  let url: URL;
  try {
    url = new URL(teks);
  } catch {
    return kosong;
  }

  // Hanya http(s). `javascript:` dan `data:` yang lolos ke href adalah celah
  // XSS; menolaknya di sini berarti komponen tinggal memakai `halaman` yang
  // sudah terjamin aman.
  if (url.protocol !== "https:" && url.protocol !== "http:") return kosong;

  const halaman = url.toString();
  const host = hostTanpaWww(url);
  const domain = host;

  // Pengenalan platform dipisah dari pengenalan ID: halaman profil atau
  // beranda platform tetap milik platform itu walau tidak punya bentuk
  // sematan. Kalau digabung, "youtube.com/" jatuh menjadi situs biasa.
  if (PLATFORM_YOUTUBE.has(host)) {
    const yt = idYoutube(url, host);
    return {
      jenis: "youtube",
      sematan: yt ? `https://www.youtube-nocookie.com/embed/${yt}` : null,
      bentuk: "video",
      halaman,
      label: "YouTube",
      domain,
      id: yt,
    };
  }

  if (host === "instagram.com") {
    const ig = kodeInstagram(url);
    return {
      jenis: "instagram",
      sematan: ig
        ? `https://www.instagram.com/${ig.jenis}/${ig.kode}/embed/`
        : null,
      bentuk: ig?.jenis === "p" ? "persegi" : "tegak",
      halaman,
      label: "Instagram",
      domain,
      id: ig?.kode ?? null,
    };
  }

  if (host === "facebook.com" || host === "fb.watch" || host === "fb.com") {
    // Plugin resmi memakai URL halaman sebagai parameter, bukan ID. Video
    // butuh endpoint berbeda dari kiriman biasa; keduanya menolak URL yang
    // tidak dikenali dengan halaman kosong, jadi tautan tetap disediakan.
    const video = /\/videos?\//.test(url.pathname) || host === "fb.watch";
    const endpoint = video ? "video.php" : "post.php";
    return {
      jenis: "facebook",
      // `width` dihormati plugin dan menentukan lebar tata letak di dalam
      // bingkai; 340 muat di kolom tegak tanpa gulir mendatar.
      sematan: `https://www.facebook.com/plugins/${endpoint}?href=${encodeURIComponent(
        halaman
      )}&width=340&show_text=true`,
      bentuk: "tegak",
      halaman,
      label: "Facebook",
      domain,
      id: null,
    };
  }

  if (host === "tiktok.com") {
    const id = idTiktok(url);
    return {
      jenis: "tiktok",
      sematan: id ? `https://www.tiktok.com/player/v1/${id}` : null,
      bentuk: "tegak",
      halaman,
      label: "TikTok",
      domain,
      id,
    };
  }

  const drive = idDrive(url, host);
  if (drive) {
    return {
      jenis: "drive",
      // `/preview` hanya tampil untuk berkas yang dibagikan publik. Berkas
      // privat menampilkan halaman izin Google, bukan galat kita — masih lebih
      // informatif daripada bingkai kosong.
      sematan: `https://drive.google.com/file/d/${drive}/preview`,
      bentuk: "halaman",
      halaman,
      label: "Google Drive",
      domain,
      id: drive,
    };
  }

  return {
    jenis: "situs",
    sematan: halaman,
    bentuk: "halaman",
    halaman,
    label: domain || "Website",
    domain,
    id: null,
  };
}
