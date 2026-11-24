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
5. `supabase/seed.sql` (memasukkan 18 kabupaten/kota sasaran)

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
  laporan-saya/                checklist kelengkapan petugas per lokasi
  lokasi-saya/                 petugas mengelola lokasi Pos SAPA di wilayahnya
  input/                       formulir input 5 jenis laporan
  admin/                       area admin (sidebar, admin pusat saja)
    akun/                      buat/ubah akun, aktif-nonaktif
    periode/                   kelola periode pelaporan
    wilayah/                   kelola lokasi Pos SAPA + koordinat
  api/ekspor/route.ts          ekspor Excel mengikuti filter aktif
src/components/brand/logo.tsx  logo KemenPPPA (inline SVG, sumber Wikimedia Commons)
src/components/dashboard/      KPI, filter bar, grafik, panel, aksi, sidebar petugas
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

## Operasional wajib (paket Free)

Lihat PRD §7.5 dan §15.1. Dua hal ini **prasyarat**, bukan opsional:

1. **Cron ping harian** agar project Supabase tidak di-pause setelah 7 hari
   tanpa aktivitas.
2. **`pg_dump` mingguan** yang disimpan di luar Supabase, dengan prosedur
   restore yang sudah diuji.
