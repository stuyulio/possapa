# Panduan Deploy ke Vercel + Pengosongan Data

Dokumen ini adalah langkah manual yang dijalankan pemilik produk. Kode untuk
deploy sudah di-commit (`3335dc5`). Yang tersisa hanya pekerjaan yang butuh
kredensial Anda.

**Baca bagian 1 sebelum menyentuh apa pun.** Kalau tidak, Anda bisa kehilangan
data tanpa jaring pengaman.

---

## 1. Backup lebih dulu — dan satu kenyataan yang perlu diketahui

**Paket Free Supabase tidak punya backup sama sekali.** Tidak ada backup harian
otomatis, tidak ada Point-in-Time Recovery, dan **tidak ada backup yang bisa
diunduh dari Dashboard**. Ini berbeda dari paket Pro (backup harian 7 hari).
Jadi tombol "Download backup" yang mungkin Anda cari **tidak ada** di paket Free.

Artinya backup harus dilakukan sendiri lewat CLI. Ada dua jalur:

### Jalur A — Backup penuh lewat Supabase CLI (disarankan)

Butuh tiga hal di mesin Anda: Docker Desktop **berjalan**, `supabase login`
sekali saja, dan project sudah di-link.

Perintah di bawah ditulis dua versi: **PowerShell** (bawaan Windows, yang
dipakai di sesi ini) dan **Git Bash**. Pilih satu sesuai terminal yang Anda
buka — sintaks keduanya tidak bisa ditukar. Ciri cepat: kalau prompt Anda
`PS C:\...>` itu PowerShell.

```powershell
# 1. Nyalakan Docker Desktop, lalu pastikan daemon hidup:
docker info --format '{{.ServerVersion}}'

# 2. Login (sekali saja; membuka browser):
npx supabase login

# 3. Tautkan ke project Supabase Anda (ganti <project-ref>):
npx supabase link --project-ref <project-ref>
```

`<project-ref>` terlihat di Dashboard Supabase → Project Settings → General →
*Reference ID*, atau di URL dashboard.

**Penting: `supabase db dump` harus dijalankan DUA KALI.** Tanpa flag, perintah
itu memakai `--schema-only` — hasilnya **hanya struktur tabel, tanpa satu pun
baris data**. Perintah tunggal yang wajar ditebak akan menghasilkan "backup"
yang tidak bisa memulihkan data apa pun.

**PowerShell:**

```powershell
$STAMP = Get-Date -Format 'yyyyMMdd'

# 4a. Skema (struktur tabel, view, policy, function):
npx supabase db dump --remote -f "C:/Users/Restu/backup-possapa-${STAMP}-schema.sql"

# 4b. Data — INI yang berisi baris sungguhan:
npx supabase db dump --remote --data-only -f "C:/Users/Restu/backup-possapa-${STAMP}-data.sql"

# 5. Verifikasi kedua berkas benar-benar berisi:
Get-ChildItem "C:/Users/Restu/backup-possapa-${STAMP}-*.sql" | Select-Object Name, Length

# Hitung BARIS DATA, bukan jumlah perintah.
# Supabase memakai pg_dump versi 17, dan keluarannya BUKAN blok COPY:
# satu pernyataan INSERT untuk SETIAP tabel, lalu baris-baris datanya, dan
# SETIAP baris data diawali karakter TAB. Jadi satu tabel = satu INSERT
# dengan ratusan baris di bawahnya.
$data = "C:/Users/Restu/backup-possapa-${STAMP}-data.sql"
$isi  = Get-Content $data

"baris data  : " + @($isi | Where-Object { $_ -match "^\t" }).Count
"pernyataan  : " + @($isi | Where-Object { $_ -match "^INSERT INTO " }).Count

# Nama tabel selalu berkutip: INSERT INTO "auth"."users" (...)
$tabel = $isi | ForEach-Object {
  if ($_ -match '^INSERT INTO "([^"]+)"\."([^"]+)"') { "$($Matches[1]).$($Matches[2])" }
} | Sort-Object -Unique
"tabel       : " + @($tabel).Count
$tabel

if ($isi -match '^INSERT INTO "auth"\."users"') { "auth.users  : ADA" } else { "auth.users  : TIDAK ADA" }
```

> **Jangan pakai pola `'^(INSERT INTO|COPY )'` atau `'auth\.users'`.** Keduanya
> menghasilkan angka palsu di berkas ini: baris data dimulai TAB (bukan
> `INSERT`), sehingga pola pertama hanya mencacah *pernyataan* INSERT — 16,
> bukan 2.002 baris. Dan `auth.users` selalu ditulis berkutip
> (`"auth"."users"`), sehingga pola kedua mengembalikan **0** meski akunnya ada.
> Backup yang sah melaporkan **2.002 baris data** dengan `auth.users : ADA`.

**Git Bash:**

```bash
STAMP=$(date +%Y%m%d)

npx supabase db dump --remote -f "C:/Users/Restu/backup-possapa-$STAMP-schema.sql"
npx supabase db dump --remote --data-only -f "C:/Users/Restu/backup-possapa-$STAMP-data.sql"

ls -lh "C:/Users/Restu/backup-possapa-$STAMP-"*.sql

# Hitung BARIS DATA, bukan jumlah perintah.
# Keluaran bukan blok COPY: satu INSERT untuk SETIAP tabel, lalu baris-baris
# datanya, dan setiap baris data diawali karakter TAB.
data="C:/Users/Restu/backup-possapa-$STAMP-data.sql"
echo "baris data  : $(awk '/^\t/{n++} END{print n+0}' "$data")"
echo "pernyataan  : $(grep -c '^INSERT INTO ' "$data")"
echo "tabel       :"
grep -o '^INSERT INTO "[^"]*"\."[^"]*"' "$data" | sed 's/^INSERT INTO //' | sort -u
grep -q '^INSERT INTO "auth"\."users"' "$data" && echo "auth.users  : ADA" || echo "auth.users  : TIDAK ADA"
```

> **Jangan pakai `grep -c "^INSERT INTO\|^COPY "`.** Pola itu hanya mencacah
> *pernyataan* INSERT (16), bukan baris data (2.002) — setiap baris data
> diawali TAB, bukan `INSERT`.

Langkah 5 harus menunjukkan **angka besar** (ratusan/ribuan) pada hitungan baris
data. Kalau hasilnya `0`, berkas data itu kosong dan backup-nya tidak berguna —
jangan lanjut ke pengosongan.

Berkas skema **tidak memuat** schema `auth` (Supabase mengelolanya dan
mengecualikannya dari dump skema), sedangkan berkas data **memuat** baris
`auth.users`. Jadi pasangan kedua berkas ini sudah cukup memulihkan: struktur
`public` dari berkas skema, isi tabel termasuk akun dari berkas data, dan
`auth` disediakan oleh platform Supabase.

Dua berkas, bukan satu. Simpan keduanya di luar Supabase (Google Drive, hard
disk eksternal). Ini juga memenuhi kewajiban `pg_dump` mingguan di README.

### Jalur B — Tanpa backup (sudah tidak berlaku; dipertahankan sebagai catatan)

Rencana awal mengandaikan seluruh isi database berasal dari berkas seed di repo
sehingga bisa dibangkitkan ulang. **Anggapan itu terbukti salah** setelah backup
2026-11-25 dibaca. Yang benar:

| Isi database saat backup | Sumber | Bisa dibuat ulang? |
|---|---|---|
| 36 lokasi Pos SAPA berkode `UJI-` | `supabase/seed-data-uji.sql` | Ya |
| ~917 laporan berkode `UJI-` | `supabase/seed-data-uji.sql` | Ya |
| 4 lokasi Pos SAPA **non-uji** | data nyata Google Form, diimpor skrip ad-hoc | **Tidak** |
| 4 laporan pada lokasi non-uji itu | 3 impor Google Form, 1 input lewat aplikasi | **Tidak** |
| 2 periode tumpang tindih | dibuat skrip ad-hoc yang sama, agar kiriman bisa masuk | **Tidak** |
| 18 kab/kota | `supabase/seed.sql` | Ya |
| 6 periode resmi | `supabase/seed-periode.sql` | Ya |
| 18 akun petugas | `supabase/seed-akun-petugas.sql` | Ya |
| 5 akun uji | `supabase/seed-data-uji.sql` | Ya |
| 2 akun dibuat satu per satu | tidak ada di seed mana pun | **Tidak** |

Ada data yang **tidak** bisa dibangkitkan dari repo. Yang paling penting: 4
laporan sungguhan — 3 di antaranya salinan kiriman Google Form — dan 4 lokasi
yang mewakili Pos SAPA nyata (nama-namanya terdokumentasi di `PRD.md` §6.5).
Karena itu Jalur B **tidak boleh** diandalkan, dan Jalur A menjadi wajib.
Backup 2026-11-25 sudah diambil dan memuat semuanya.

Catatan: JANGAN memakai `npm run db:reset` (`supabase db reset`) sebagai upaya
pemulihan. Perintah itu menjatuhkan seluruh database, termasuk akun `auth.users`
yang justru ingin kita pertahankan.

**Jalur A sudah dijalankan** (backup 2026-11-25 diambil). Jalur B hanya
dipertahankan sebagai catatan supaya alasan perubahan rencana tetap terbaca.
Kalau Anda mengulang pengosongan di masa depan, ambil backup lagi lebih dulu —
Jalur B tidak lagi bisa dijadikan alasan untuk melewatinya.

---

## 2. Pengerasan di Supabase (sebelum deploy)

Buka Dashboard Supabase, lalu:

1. **Atur URL.** Authentication → URL Configuration
   - *Site URL*: `https://<domain-vercel-anda>` (mis. `https://possapa.vercel.app`)
   - *Redirect URLs*: tambahkan `https://<domain-vercel-anda>/**`
     dan `http://localhost:3000/**`
   - Aplikasi ini tidak memakai alur masuk berbasis email sama sekali (tidak ada
     registrasi, lupa sandi, OAuth), jadi ini hanya pencegahan agar tautan
     Supabase tidak menunjuk ke `localhost`.

2. **Matikan pendaftaran publik.** Authentication → Sign In / Up (atau
   Project Settings → Authentication) → nonaktifkan **Allow new users to sign
   up**. Aplikasi tidak punya halaman registrasi; akun hanya dibuat Admin Pusat
   lewat `/admin/akun`. Ini menutup satu-satunya jalan orang membuat akun sendiri.

3. **Ganti kata sandi akun seed yang lemah — wajib.** Akun petugas dari
   `seed-akun-petugas.sql` memakai pola kata sandi `<slug>possapa` dan alamat
   email `<slug>@kemenpppa.go.id` (mis. `kotapadang@kemenpppa.go.id` /
   `kotapadangpossapa`). Backup 2026-11-25 menunjukkan **25 akun** tersimpan —
   bukan 18 — sebagian buatan seed dan sebagian dibuat manual. Karena Anda
   memilih mempertahankan semuanya, kata sandi lemah itu ikut terbawa ke
   produksi. Ganti lewat `/admin/akun` → **Ubah** → isi **Kata sandi baru**
   untuk **setiap** akun, termasuk yang tidak berasal dari seed. Lakukan
   **setelah** bagian 3 (data dikosongkan) tapi **sebelum** petugas sungguhan
   memakai aplikasinya.

   Daftar 25 email ada di backup Anda (`INSERT INTO "public"."pengguna"`), dan
   juga bisa dibaca langsung di `/admin/akun` setelah aplikasi jalan.

---

## 3. Kosongkan data

Ini langkah yang tidak bisa dibatalkan. Pastikan bagian 1 sudah selesai.

1. Buka Dashboard Supabase → **SQL Editor**.
2. Buka berkas `supabase/reset-data-laporan-20261127.sql` di repo, **salin
   seluruh isinya**, tempel ke SQL Editor.
3. Jalankan (Run). Ini berjalan sebagai role `postgres`, jadi RLS tidak
   menghalangi dan `audit_log` bisa dibersihkan.

Yang akan terjadi: skrip berjalan dalam satu transaksi. Ia menghapus seluruh
laporan + detailnya, satu lokasi Pos SAPA (Huntara Agam), lalu `audit_log`
yang terkait keduanya di akhir.

> **Catatan revisi 27 Nov 2026.** Rencana awal menghapus **seluruh** Pos SAPA.
> Itu dibatalkan: lima pos yang ada di basis data ternyata lokasi sungguhan
> dengan nama pengurus nyata, bukan sisa seed `UJI-`. Skrip lama
> (`reset-data-produksi.sql`) sudah dihapus dan **tidak boleh** dipakai lagi —
> ia menuntut tepat 6 periode (sekarang ada 7) dan menghapus kelima pos.

**Anda akan melihat tabel ringkasan** berisi kolom `tabel`, `sebelum`, `sesudah`,
`dihapus`. Angka `sebelum` di bawah adalah isi basis data per **27 Nov 2026**
(dibaca langsung dari proyek Supabase); `sesudah` adalah hasil yang diharapkan.

| tabel | sebelum | sesudah |
|---|---|---|
| `laporan` | 4 | 0 |
| `laporan_anak` | 2 | 0 |
| `laporan_perempuan` | 1 | 0 |
| `laporan_rekap_pengaduan` | 0 | 0 |
| `laporan_kasus` | 0 | 0 |
| `laporan_publikasi` | 1 | 0 |
| `audit_log` | 25 | **6** |
| `pos_sapa` | 5 | **4** |
| `wilayah` | 18 | 18 |
| `periode` | 7 | 7 |
| `pengguna` | 25 | **25 — tidak berubah** |
| `auth.users` | 25 | **25 — tidak berubah** |

Dua baris **memang** berubah, sesuai keputusan Anda:

- **`pos_sapa` 5 → 4. Hanya Huntara Agam** (`4b48f71c-718b-4763-93f9-1f5777b989a6`,
  kode pos `1234456`) yang dihapus. Empat lainnya dipertahankan: Beutong Ateuh
  (Nagan Raya), Tunyang (Bener Meriah), Kec. Linge (Aceh Tengah), dan Rigeb
  (Gayo Lues) — semuanya lokasi sungguhan dengan nama pengurus nyata.
- **`audit_log` 25 → 6.** Yang tersisa hanya enam entri milik empat Pos yang
  dipertahankan (lima `tambah`, satu `ubah`). Yang dibuang 19: seluruh entri
  `laporan*` (18) dan satu entri `pos_sapa` Huntara Agam. Angka 19 — bukan 18 —
  karena trigger `catat_audit` juga menulis entri `hapus` untuk setiap laporan
  yang dihapus; entri-entri itu terbuang bersama sisanya sebab `audit_log`
  dibersihkan **terakhir**.
Sebaliknya `periode` **tetap 7**: tidak ada periode tumpang tindih di basis data
sekarang, jadi tidak ada yang perlu dihapus. Ketujuh periode (23 Okt – 10 Des)
utuh.

Catatan operasional: aplikasi **sengaja hanya memperingatkan**, tidak memblokir
periode tumpang tindih (`src/app/admin/periode/form-periode.tsx`), justru
supaya data historis Google Form bisa dirapikan. Selama Google Form masih
dipakai berdampingan (PRD §15.2), periode tumpang tindih bisa muncul lagi —
jadi peringatan di `/admin/periode` perlu diperiksa berkala.

Kalau muncul galat berawalan `BATAL:` — bagus, itu penjaganya bekerja. Artinya
ada yang tidak sesuai harapan (mis. akun akan ikut terhapus), dan **seluruh
transaksi otomatis dibatalkan**, tidak ada yang terhapus separuh. Laporkan
pesan galatnya sebelum mencoba lagi.

Kalau SQL Editor mengeluh soal transaksi bersarang (`there is already a
transaction in progress`), itu peringatan yang tidak berbahaya — boleh
diabaikan. Skripnya tetap berjalan dalam satu transaksi, dan bila penjaga
membatalkan, `commit` di akhir otomatis menjadi rollback.

Skrip ini **idempoten**: menjalankannya lagi setelah sukses hanya menghapus 0
baris dan tetap lulus.

### Skrip ini sudah diuji

Skripnya belum pernah dijalankan pada database produksi Anda, tetapi sudah diuji
pada Postgres 16 sekali pakai di mesin lokal, dengan seluruh migrasi repo dan
seed akun diterapkan apa adanya. Basis data uji itu **dibentuk menyerupai
produksi per 27 Nov 2026**: 5 lokasi (UUID apa adanya), 7 periode, dan 4 laporan
di Huntara Agam. Yang terbukti:

| Yang diuji | Hasil |
|---|---|
| Skrip berjalan utuh sampai `COMMIT` | Lulus, exit code 0 |
| Keadaan akhir: semua tabel `laporan*` = 0 | Lulus |
| Keadaan akhir: `pos_sapa` 4, `periode` 7, `wilayah` 18, akun utuh | Lulus |
| Empat Pos SAPA yang dipertahankan hadir, diperiksa per UUID | Lulus |
| `audit_log` hanya menyisakan entri pos yang dipertahankan | Lulus |
| Idempoten (dijalankan tiga kali) | Lulus, dua jalan terakhir menghapus 0 baris |
| **Penjaga UUID** — nama/kode pos sasaran ditukar | Menyala: `BATAL: UUID sasaran bukan Huntara Agam` |
| **Penjaga LAPORAN ASING** — ada laporan di luar pos sasaran | Menyala: `BATAL: ada 1 laporan di luar Pos Huntara Agam` |
| **Penjaga WILAYAH** — jumlah `wilayah` berubah saat transaksi berjalan | Menyala: `BATAL: jumlah baris wilayah berubah (18 -> 19)` |
| **Penjaga PERIODE** — ada periode asing saat transaksi berjalan | Menyala: `BATAL: jumlah baris periode berubah (7 -> 8)` |
| **Penjaga POS LAIN** — satu Pos yang wajib lestari hilang | Menyala: `BATAL: Pos SAPA lain tidak utuh, tersisa 3 dari 4` |
| Kegagalan penjaga membatalkan **seluruh** transaksi | Terbukti — 4 laporan tetap utuh setelah `BATAL` |
| `delete from pos_sapa` sebelum `laporan` | Ditolak `RESTRICT`, sesuai dugaan |
| `DELETE` memicu trigger audit (`aksi='hapus'`) | Terbukti — karena itu `audit_log` dibersihkan terakhir |

Untuk membuktikan penjaga-penjaga itu benar-benar menyala, jumlah baris harus
berubah **selagi** transaksi berjalan — karena itu pengujiannya memakai trigger
sementara yang menempel pada penghapusan `pos_sapa`. Uji "hapus satu baris dulu,
lalu jalankan skrip" **tidak sah** di sini: snapshot pembanding diambil di dalam
transaksi, jadi penjaganya memang tidak seharusnya menyala pada cara itu.

Catatan tambahan: `pengguna.pos_id → pos_sapa` adalah `ON DELETE SET NULL`, dan
`pengguna.pos_id` sudah NULL untuk semua baris sejak migrasi
`20261118000003_petugas_wilayah.sql`. Menghapus satu lokasi **tidak mungkin**
menghapus atau mengunci akun. Penjaga di skrip tetap ada sebagai pengaman tambahan.

Harness ujinya memakai fixture, sehingga pengujian ini **tidak** menghilangkan
kewajiban backup di bagian 1 — 4 laporan yang ada hanya tersimpan di backup.

### Verifikasi setelah pengosongan

Jalankan di SQL Editor:

```sql
-- Akun utuh? (harus 25, sama seperti sebelum wipe)
select peran, count(*) from pengguna group by peran;
select count(*) as jumlah_auth_users from auth.users;

-- Data bersih? Harus: laporan 0, pos_sapa 4, audit_log 6, wilayah 18, periode 7.
select
  (select count(*) from laporan)   as laporan,
  (select count(*) from pos_sapa)  as pos_sapa,
  (select count(*) from audit_log) as audit_log,
  (select count(*) from wilayah)   as wilayah,
  (select count(*) from periode)   as periode;

-- Keempat Pos SAPA yang dipertahankan harus hadir. Diharapkan: 4 baris.
select nama_lokasi, kode_pos from pos_sapa order by nama_lokasi;

-- Tidak boleh ada sisa audit untuk laporan / pos yang dihapus.
-- Diharapkan: 0 baris.
select entitas, count(*)
from audit_log
where entitas like 'laporan%'
   or (entitas = 'pos_sapa'
       and entitas_id = '4b48f71c-718b-4763-93f9-1f5777b989a6')
group by entitas;

-- Ketujuh periode harus utuh. Diharapkan: 7 baris.
select tanggal_mulai, tanggal_selesai from periode order by tanggal_mulai;

-- Setiap akun masih punya profil lengkap dan aktif.
-- (aktif = false akan ditolak auth_peran() dan membuat akun terkunci)
select p.email, p.peran, p.aktif, p.wilayah_id
from pengguna p
order by p.peran, p.email;
```

Catatan: `select auth_peran()` di SQL Editor **selalu** mengembalikan NULL karena
di sana tidak ada JWT. Itu normal, bukan tanda kerusakan. Untuk menguji helper
RLS dengan benar, tirukan identitas satu akun:

```sql
select set_config('request.jwt.claims',
  json_build_object('sub',
    (select id from pengguna where peran = 'petugas' limit 1))::text, true);
select auth_peran(), auth_wilayah_id();  -- harus 'petugas' + uuid wilayah
```

---

## 4. Deploy ke Vercel

1. **Import repo.** Buka <https://vercel.com/new>, pilih
   `github.com/stuyulio/possapa`. Vercel mengenali Next.js otomatis — jangan
   ubah Build Command atau Output Directory.

2. **Node.js Version.** Default Vercel untuk project baru sekarang **26.x**.
   Anda **tidak perlu** mengubahnya: `package.json` sudah menyatakan
   `engines.node: 22.x`, dan menurut dokumentasi Vercel field itu **menimpa**
   pilihan di dashboard. Jadi deploy akan memakai 22.x dengan sendirinya.

   Bila ingin memastikan/mengubahnya secara eksplisit: Settings → **Build and
   Deployment** → Node.js Version (bukan di halaman *General*).

3. **Environment Variables** (Project Settings → Environment Variables):

   | Nama | Production | Preview | Development |
   |---|---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ |
   | `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **jangan** | ✅ |

   Nilai ketiganya dari Supabase → Project Settings → **API** (di dashboard
   terbaru kadang berlabel *API Keys*). Tandai `SUPABASE_SERVICE_ROLE_KEY`
   sebagai **Sensitive**.

   **Isi ketiga variabel ini di layar import, bukan sesudahnya.** Kalau lupa,
   deploy tidak gagal — halaman publik justru **tayang dengan semua angka 0**
   dan pesan "Belum ada data", karena `src/app/page.tsx` menangkap galat
   koneksi dan mengembalikan daftar kosong. Ini sudah dibuktikan: build dengan
   env var kosong tetap **exit 0** di mesin lokal, dan HTML hasilnya memang
   memuat kalimat fallback itu. Jadi jangan mengandalkan "berhasil deploy"
   sebagai tanda env var-nya benar.

   Mengubah `NEXT_PUBLIC_*` setelahnya wajib **redeploy**, bukan sekadar
   restart, karena nilainya disisipkan saat build.

   **Jangan** menyetel `NEXT_DIST_DIR` di Vercel — variabel itu hanya untuk
   pemakaian lokal, dan menyetelnya akan membuat Vercel mencari hasil build di
   folder yang salah.

   `SUPABASE_SERVICE_ROLE_KEY` sengaja tidak dipasang di Preview: Supabase hanya
   punya satu project, jadi preview menunjuk database produksi. Tanpa kunci itu
   di preview, `/admin/akun` hanya menampilkan pesan "belum dikonfigurasi"
   alih-alih bisa membuat atau menghapus akun sungguhan.

4. **Deploy.** Vercel memberi domain berdasarkan nama project. **Catat domain
   persisnya** — nama itu mudah tertukar satu huruf (project ini menjadi
   `posapa.vercel.app`, perhatikan hanya **satu** huruf `s` setelah `po`).
   Setelah tahu domainnya, kembali ke langkah 2.1 dan isi *Site URL* dengan
   domain itu (kalau tadi diisi placeholder).

Catatan: dua variabel `NEXT_PUBLIC_*` disisipkan saat build. Kalau nilainya
diubah, harus **redeploy**, bukan sekadar restart.

### Kalau situs balas 500 pada SEMUA halaman

Ciri khasnya: respons berisi `X-Vercel-Error: MIDDLEWARE_INVOCATION_FAILED`,
dan bahkan `/api/ping` ikut 500.

Penyebabnya hampir selalu **env var Supabase tidak terisi saat middleware
dijalankan** — untuk `NEXT_PUBLIC_*` artinya **tidak ada saat build**.
`src/lib/supabase/middleware.ts` memanggil `createServerClient` dengan env var
**tanpa `try/catch`** — berbeda dari `src/app/page.tsx` yang menangkap galat.
Middleware berjalan untuk setiap request, jadi satu galat itu mematikan seluruh
situs. Kalau env var-nya kosong, `createServerClient` melempar
`Your project's URL and Key are required to create a Supabase client!`

Perhatikan: `/api/ping` **juga lewat middleware**. Jadi route keep-alive ini
tidak bisa dipakai sebagai kanari mandiri kalau middleware-nya sendiri rusak —
gejalanya menyerupai Supabase tak terjangkau, padahal bukan.

Urutan memeriksa:

1. Vercel → Settings → **Environment Variables**. Ketiga variabel harus ada,
   dengan environment yang benar (lihat tabel di langkah 3).
2. **Redeploy tanpa cache.** Deployment Vercel bersifat *immutable*: menambah
   env var **tidak** mengubah deployment yang sudah jadi. Deployments →
   deployment teratas → ⋯ → Redeploy → hilangkan centang **Use existing Build
   Cache**.
3. Ulangi `curl` ke `/api/ping` sampai statusnya 200.

Kalau `/api/ping` sudah 200 tapi halaman lain masih 500, penyebabnya berbeda —
laporkan pesan galatnya, jangan mengulang langkah yang sama.

---

## 5. Verifikasi setelah deploy

Uji berurutan dari yang paling murah:

**Mulai dari langkah 0, bukan langkah 1.** Setelah pengosongan, halaman publik
memang menampilkan semua angka 0 — dan itu **gejala yang sama persis** dengan
env var yang salah isi. Kalau Anda mulai dari langkah 1, "semua nol" tidak
membuktikan apa pun: bisa jadi benar, bisa jadi database tak pernah tersentuh.

0. **`/api/ping` — kanari env var.** Buka `https://<domain>/api/ping` di
   browser. Harus mengembalikan `{"ok":true,"waktu":"..."}`.

   Ini satu-satunya pemeriksaan yang memisahkan dua keadaan itu, karena route
   ini **tidak** membungkam galat: `src/lib/supabase/public.ts` memanggil
   `createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, ...)`, dan bila nilainya
   kosong `createClient` melempar `supabaseUrl is required.` Route menangkapnya
   dan mengembalikan **HTTP 500**.

   Jadi: `{"ok":true}` = env var benar dan database terjangkau. HTTP 500 dengan
   pesan `supabaseUrl is required` = env var salah → perbaiki di Settings →
   Environment Variables, lalu **redeploy** (bukan restart). Selama langkah ini
   belum hijau, jangan percaya pemeriksaan mana pun di bawahnya.

1. **`/` (halaman publik)** — muat tanpa galat, semua kartu bernilai 0, label
   "data diperbarui" kosong. Kosong di sini **benar**, bukan bug — tetapi baru
   bermakna setelah langkah 0 hijau.
2. **Buka `/dashboard` sebagai tamu** — harus dialihkan ke
   `/masuk?lanjut=/dashboard`. Ini membuktikan middleware bekerja.
3. **`/masuk`** — masuk dengan akun yang dipertahankan. Arahannya sesuai peran:
   `petugas → /laporan-saya`, `admin_pusat → /admin/akun`, lainnya `→ /dashboard`.
4. **`/admin/wilayah`** (sebagai `admin_pusat`) — input satu lokasi Pos SAPA
   resmi beserta koordinatnya. Tanpa ini petugas tidak bisa mengisi apa pun.
   Lokasi akan muncul di `/peta`.
5. **`/laporan-saya`** (sebagai `petugas`) — sel lokasi × periode mulai muncul.
   Isi satu laporan, kirim, pastikan tampil baca-saja (terkunci).
6. **`/verifikasi`** (sebagai admin) — laporan tadi muncul di antrean;
   verifikasi sampai berstatus `terverifikasi`.
7. **`/api/ekspor?jenis=ringkasan`** — unduh berkas `.xlsx`. Ini kanari
   perbaikan `xlsx`: galat 500 berarti modulnya tidak ikut terbundel. Harus
   terunduh sebagai `Pos-SAPA_ringkasan_<tanggal>.xlsx` dan terbuka di Excel.
   Route ini butuh login (memakai sesi cookie), jadi buka dalam keadaan masuk.
8. **`/admin/audit`** — mencatat aksi langkah 4–6.
9. **`/` lagi** — dalam ≤ 300 detik agregat publik terisi.

---

## 6. Setelah semuanya jalan

1. **Tambah periode Desember.** Periode seed berakhir **3 Desember 2026**.
   Setelah itu petugas tidak punya sel periode untuk diisi. Tambahkan lewat
   `/admin/periode` sebagai Admin Pusat — jangan menunggu sampai kosong di
   tengah operasional.

2. **Cron keep-alive sudah otomatis.** `vercel.json` memanggil `/api/ping`
   sekali sehari (`0 1 * * *`) untuk mencegah project Supabase Free di-pause
   setelah 7 hari tanpa aktivitas. Verifikasi di Vercel → Project → **Cron Jobs**.
   Cek juga hasil panggilannya: `https://<domain>/api/ping` harus mengembalikan
   `{"ok":true,...}`.

   Dua batasan paket Hobby yang perlu diketahui (terverifikasi di dokumentasi
   Vercel "Usage & Pricing for Cron Jobs"):

   - **Minimum interval = sekali per hari.** Ekspresi yang lebih sering
     (mis. `0 * * * *` per jam) **akan menggagalkan deploy**, bukan sekadar
     diabaikan. Jadi `0 1 * * *` ini tepat di batas yang diizinkan — jangan
     dirapatkan, dan jangan tergoda menambah cron kedua yang lebih sering.
   - **Ketepatan waktu per jam (±59 menit).** `0 1 * * *` bisa menyala kapan
     saja antara 01:00 dan 01:59. Untuk keep-alive ini tidak masalah.

   Batas jumlah cron adalah 100 per project, jadi satu job jauh dari batas.

3. **Jadwalkan `pg_dump` mingguan.** Paket Free tidak punya backup, jadi ini
   wajib (README "Operasional wajib"). Ulangi perintah di bagian 1 Jalur A
   secara berkala, simpan di luar Supabase, dan **uji sekali prosedur
   pemulihannya** ke project Supabase percobaan.

4. **Catat jadwal kredensial.** `/admin/akun` menyimpan email; Admin Pusat
   dapat mengganti kata sandi kapan saja lewat menu *Ubah*. Pastikan setiap
   petugas sudah menerima kata sandi barunya.
