# Dashboard Capaian Kinerja Pos SAPA

Sistem informasi pemantauan dan analisis capaian kinerja penyelenggaraan Pos
Sahabat Perempuan dan Anak (Pos SAPA) dalam perlindungan perempuan dan anak
pascabencana di Provinsi Aceh, Sumatera Utara, dan Sumatera Barat.

Dokumen produk: [`PRD.md`](./PRD.md)

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- Supabase (PostgreSQL, Auth, RLS)
- Deploy: Vercel

## Prasyarat

- Node.js 20+
- npm 10+
- Akun Supabase (paket Free sudah cukup untuk pengembangan)

## Penyiapan

### 1. Pasang dependensi

```bash
npm install
```

### 2. Buat project Supabase

1. Buat project baru di <https://supabase.com/dashboard>.
2. Salin **Project URL** dan **anon public key** dari *Project Settings → API*.
3. Salin juga **service_role key** (hanya untuk skrip migrasi).

```bash
cp .env.example .env.local
# isi ketiga variabel
```

### 3. Jalankan migrasi skema

Bila memakai Supabase CLI yang terhubung ke project:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Atau jalankan berkas SQL berikut secara berurutan melalui SQL Editor Supabase:

1. `supabase/migrations/20261118000001_init.sql`
2. `supabase/migrations/20261118000002_rls.sql`
3. `supabase/migrations/20261118000003_petugas_wilayah.sql`
4. `supabase/migrations/20261123000001_petugas_kelola_pos.sql`
5. `supabase/migrations/20261124000001_tutup_celah_verifikasi.sql`
6. `supabase/migrations/20261124000002_publik_pembaruan.sql`
7. `supabase/migrations/20261124000003_fase4_verifikasi_audit.sql`
8. `supabase/migrations/20261124000004_fase4_perbaikan.sql`
9. `supabase/seed.sql` (memasukkan 18 kabupaten/kota sasaran)

### 4. Buat pengguna pertama

Daftarkan lewat *Authentication → Users → Add user*, lalu lengkapi profil:

```sql
insert into pengguna (id, nama, email, peran)
values ('<uuid-dari-auth-users>', 'Nama Admin', 'admin@kemenpppa.go.id', 'admin_pusat');
```

### 5. Jalankan

```bash
npm run dev
```

- Halaman publik: <http://localhost:3000>
- Masuk: <http://localhost:3000/masuk>

## Migrasi data historis

```bash
# pratinjau tanpa menulis ke database
node scripts/migrasi-sheets.mjs "docs/Laporan Berkala Pos SAPA (Jawaban).xlsx" --dry-run

# tulis ke database
node scripts/migrasi-sheets.mjs "docs/Laporan Berkala Pos SAPA (Jawaban).xlsx" --commit
```

Skrip memetakan kolom berdasarkan **indeks tetap form asli** (bukan template
CSV), memvalidasi header, dan **berhenti** bila urutan kolom berubah.

## Struktur

```
src/app/
  page.tsx                     halaman publik (agregat, via view publik_ringkasan)
  masuk/                       login
  dashboard/
    layout.tsx                 header, navigasi, filter global
    page.tsx                   ringkasan + sorotan prioritas
    anak/page.tsx              analisis aktivitas anak
    perempuan/page.tsx         analisis aktivitas perempuan
    pengaduan/page.tsx         layanan pengaduan
    kasus/page.tsx             tindak lanjut kasus
    publikasi/page.tsx         publikasi & dokumentasi
  monitoring/                  matriks kepatuhan pelaporan per Pos SAPA
  verifikasi/                  antrean verifikasi admin + penandaan anomali
  laporan-saya/                checklist kelengkapan petugas per lokasi
  lokasi-saya/                 petugas mengelola lokasi Pos SAPA di wilayahnya
  input/                       formulir 5 jenis laporan (dibuka dari laporan-saya)
  peta/                        peta sebaran Pos SAPA (Leaflet)
  admin/                       area admin (sidebar, admin pusat saja)
    akun/                      buat/ubah akun, aktif-nonaktif
    periode/                   kelola periode pelaporan
    wilayah/                   kelola lokasi Pos SAPA + koordinat
    audit/                     log audit perubahan data
  api/ekspor/route.ts          ekspor Excel mengikuti filter aktif
src/components/brand/logo.tsx  logo KemenPPPA (inline SVG, sumber Wikimedia Commons)
src/components/dashboard/      KPI, filter bar, grafik, panel, aksi, sidebar petugas
src/components/dashboard/menu-akun.tsx  bar akun kanan atas (identitas + keluar)
src/components/lokasi/         form kelola lokasi Pos SAPA (admin & petugas)
src/app/icon.svg               favicon (salinan logo KemenPPPA)
public/logo-kemenpppa.svg      berkas logo mentah
src/lib/data/                  pengambilan & agregasi data
src/lib/supabase/              client, server, middleware
supabase/                      migrasi SQL & seed
scripts/                       skrip migrasi data
docs/                          KAK, data mentah, template
```

## Filter

Filter global disimpan di URL (`?periode=&provinsi=&kabkota=&lokasi=`), sehingga
tampilan dapat dibagikan dan tombol kembali browser berfungsi. Setiap halaman
membaca filter yang sama, dan ekspor Excel mengikuti filter aktif.

## Verifikasi, anomali, dan audit

Tiga hal ini ditegakkan di database, bukan hanya di UI. Ketiganya berlaku
setelah migrasi `20261124000003_fase4_verifikasi_audit.sql` dijalankan.

**Verifikasi berjenjang.** Petugas mengirim laporan (`terkirim`). Admin Kab/Kota
memverifikasi laporan di wilayahnya, Admin Pusat memverifikasi semuanya — RLS
yang membatasi, bukan sekadar tombol yang disembunyikan. Satu langkah, tanpa
tingkat persetujuan berlapis.

**Buka kunci.** Admin dapat mengembalikan laporan `terverifikasi` menjadi
`terkirim` dengan alasan tertulis, agar petugas memperbaiki datanya. Alasan itu
tampil di halaman *Laporan Saya* petugas, dan formulir input terbuka dengan data
yang tersimpan — bukan kosong — sehingga memperbaiki satu angka tidak
mengosongkan kolom lain. `verified_by` dan `verified_at` sengaja tidak dihapus:
keduanya mencatat bahwa laporan itu pernah diverifikasi.

**Anomali.** Dihitung saat dibaca lewat view `anomali_laporan`, bukan disimpan
sebagai kolom — tanda akan hilang sendiri begitu datanya konsisten. Enam
pemeriksaan: distribusi usia, subkelompok peserta perempuan, rincian kategori
aduan, status *Nihil* yang masih berisi hitungan, kelengkapan SIMFONI, dan
laporan tanpa rincian. Laporan beranomali tetap boleh diverifikasi, tetapi Admin
**wajib** menuliskan alasannya — anomali ditandai, bukan ditutupi dengan `max()`
seperti pada prototipe (PRD §6.5).

Tumpang tindih periode **tidak** termasuk di sini. Awalnya ikut dimasukkan,
tetapi setelah diuji terhadap data nyata ia menandai 849 dari 871 laporan
(97,5%) — periode historis memang tumpang tindih karena inkonsistensi format
§6.5. Karena catatan verifikasi wajib diisi untuk laporan beranomali, hampir
setiap verifikasi menjadi permintaan alasan atas masalah yang bukan pada
laporan itu. PRD §6.4 menempatkannya di *Aturan Validasi Data* bersama aturan
master data lain, jadi pemeriksaannya kini ada di `/admin/periode` sebagai
peringatan yang tidak memblokir. Lihat migrasi
`20261124000004_fase4_perbaikan.sql`.

**Audit log.** Ditulis oleh trigger database pada `laporan` dan kelima tabel
rinciannya, `pos_sapa`, serta `pengguna` — sehingga perubahan lewat SQL Editor
atau skrip migrasi pun terekam. Hanya kolom yang benar-benar berubah yang
dicatat; nilai teks dipotong 200 karakter agar narasi sensitif tidak tergandakan
ke tabel kedua. `audit_log` tidak punya policy INSERT: entri hanya lahir dari
trigger, jadi tidak dapat dipalsukan dari klien. Halaman `/admin/audit` tersedia
untuk Admin Pusat.

## Alur input petugas

`/laporan-saya` adalah satu-satunya pintu masuk pengisian. Halaman itu
menampilkan setiap kombinasi periode × lokasi Pos SAPA beserta status kelima
laporan, dan tombol *Isi* di sebuah sel membuka `/input?pos=…&periode=…`.

Lokasi dan periode sengaja **tidak dapat diubah** di dalam formulir: keduanya
datang dari sel yang diklik. Pemilih lokasi di dalam form akan membatalkan
mitigasi PRD §15 ("lokasi dipilih eksplisit di setiap input"), dan pemilih
periode memungkinkan angka satu periode masuk ke periode lain tanpa terlihat
sampai diverifikasi. Tautan `/input` tanpa kedua parameter dialihkan kembali ke
`/laporan-saya`. Yang tetap dapat berpindah adalah **jenis** laporan — kelimanya
berbagi lokasi dan periode yang sama, jadi tab jenis tidak membawa risiko itu
sekaligus memungkinkan mengisi lima laporan dalam satu duduk.

Setelah laporan dikirim, halaman kembali ke `/laporan-saya?periode=<periode yang
diisi>` — bukan ke periode terbaru. Perbedaan itu penting: laporan tersimpan di
periode yang benar, tetapi bila yang tampil periode lain, kiriman tampak tidak
pernah masuk. Karena itu pula `router.refresh()` tidak dipakai: ia mengirim ulang
`/input` tanpa `searchParams`, sehingga penjaga parameter halaman
mem-`redirect()` ke `/laporan-saya` tanpa periode sama sekali.

## Pengujian

```bash
npm test        # uji unit murni (tanpa database)
```

`src/lib/periode.test.ts` menguji deteksi tumpang tindih periode terhadap
bentuk data historis yang nyata (§6.5). Pemeriksaan lain masih manual:
`npm run typecheck`, `npm run build`, lalu telusuri `/verifikasi`,
`/admin/audit`, dan `/admin/periode` dengan akun berperan berbeda.

## Operasional wajib (paket Free)

Lihat PRD §7.5 dan §15.1. Dua hal ini **prasyarat**, bukan opsional:

1. **Cron ping harian** agar project Supabase tidak di-pause setelah 7 hari
   tanpa aktivitas.
2. **`pg_dump` mingguan** yang disimpan di luar Supabase, dengan prosedur
   restore yang sudah diuji.
