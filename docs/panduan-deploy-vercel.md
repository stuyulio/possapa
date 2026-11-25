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

$data = "C:/Users/Restu/backup-possapa-${STAMP}-data.sql"
"baris data : " + @(Select-String -Path $data -Pattern '^(INSERT INTO|COPY )').Count
"auth.users : " + @(Select-String -Path $data -Pattern 'auth\.users').Count
```

**Git Bash:**

```bash
STAMP=$(date +%Y%m%d)

npx supabase db dump --remote -f "C:/Users/Restu/backup-possapa-$STAMP-schema.sql"
npx supabase db dump --remote --data-only -f "C:/Users/Restu/backup-possapa-$STAMP-data.sql"

ls -lh "C:/Users/Restu/backup-possapa-$STAMP-"*.sql
grep -c "^INSERT INTO\|^COPY " "C:/Users/Restu/backup-possapa-$STAMP-data.sql"
```

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
| 4 lokasi Pos SAPA **non-uji** | **input manual, tidak ada di seed mana pun** | **Tidak** |
| 4 laporan pada lokasi non-uji itu | **input manual / impor Google Form** | **Tidak** |
| 2 periode tumpang tindih | **input manual** | **Tidak** |
| 18 kab/kota | `supabase/seed.sql` | Ya |
| 6 periode resmi | `supabase/seed-periode.sql` | Ya |
| 18 akun petugas + 7 akun lain | seed + manual | Sebagian |

Ada data yang **tidak** bisa dibangkitkan dari repo — termasuk 4 laporan
sungguhan (3 di antaranya impor Google Form) dan 4 lokasi yang dibuat manual
pada 18–23 Nov 2026. Karena itu Jalur B **tidak boleh** diandalkan, dan Jalur A
menjadi wajib. Backup 2026-11-25 sudah diambil dan memuat semuanya.

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
2. Buka berkas `supabase/reset-data-produksi.sql` di repo, **salin seluruh
   isinya**, tempel ke SQL Editor.
3. Jalankan (Run). Ini berjalan sebagai role `postgres`, jadi RLS tidak
   menghalangi dan `audit_log` bisa dibersihkan.

Yang akan terjadi: skrip berjalan dalam satu transaksi. Ia menghapus seluruh
laporan + detailnya, seluruh lokasi Pos SAPA, dua periode tumpang tindih, lalu
`audit_log` terakhir.

**Anda akan melihat tabel ringkasan** berisi kolom `tabel`, `sebelum`, `sesudah`,
`dihapus`. Angka `sebelum` di bawah terukur dari database Anda (dibaca dari dump
backup 2026-11-25); `sesudah` adalah hasil yang diharapkan.

| tabel | sebelum | sesudah |
|---|---|---|
| `laporan` | 921 | 0 |
| `laporan_anak` | 245 | 0 |
| `laporan_perempuan` | 194 | 0 |
| `laporan_rekap_pengaduan` | 194 | 0 |
| `laporan_kasus` | 144 | 0 |
| `laporan_publikasi` | 144 | 0 |
| `audit_log` | ratusan | 0 |
| `pos_sapa` | **40** | 0 |
| `wilayah` | 18 | 18 |
| `periode` | **8** | **6** |
| `pengguna` | 25 | **25 — tidak berubah** |
| `auth.users` | 25 | **25 — tidak berubah** |

Dua baris **memang** turun, sesuai keputusan Anda:

- **`pos_sapa` 40 → 0.** Keempat puluh lokasi dihapus, bukan hanya yang berkode
  `UJI-`. Empat di antaranya bukan data uji melainkan lokasi yang dibuat manual
  pada 18–23 Nov 2026, dan memuat 4 laporan sungguhan (3 impor Google Form,
  1 dikirim lewat aplikasi). Semuanya ikut terhapus dan hanya bisa dipulihkan
  dari backup.
- **`periode` 8 → 6.** Dua periode tumpang tindih dihapus karena beririsan
  dengan periode resmi, sehingga petugas sempat melihat dua sel untuk minggu
  yang sama. Yang tersisa keenam periode resmi dari `seed-periode.sql`,
  berakhir `2026-12-03`.

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

Skripnya belum pernah dijalankan pada database produksi Anda, tetapi sudah
diuji pada Postgres 16 sekali pakai di mesin lokal, dengan 9 migrasi repo dan
keempat berkas seed diterapkan apa adanya. Basis data uji itu **sengaja
dibentuk menyerupai produksi**: 40 lokasi (36 berkode `UJI-` + 4 lokasi manual
non-uji) dan 8 periode (6 resmi + 2 tumpang tindih). Yang terbukti:

| Yang diuji | Hasil |
|---|---|
| Skrip berjalan utuh sampai `COMMIT` | Lulus, exit code 0 |
| Keadaan akhir: `laporan` 0, `pos_sapa` 0, `audit_log` 0 | Lulus |
| Keadaan akhir: `wilayah` 18, `periode` 6, akun utuh | Lulus |
| Keenam periode resmi masih lengkap setelah wipe | Lulus |
| Idempoten (dijalankan tiga kali) | Lulus, dua jalan terakhir menghapus 0 baris |
| **Penjaga AKUN** — jumlah `pengguna` berubah saat transaksi berjalan | Menyala: `BATAL: jumlah baris pengguna berubah (23 -> 0)` |
| **Penjaga WILAYAH** — jumlah `wilayah` berubah saat transaksi berjalan | Menyala: `BATAL: jumlah baris wilayah berubah (18 -> 19)` |
| **Penjaga PERIODE** — ada periode asing saat transaksi berjalan | Menyala: `BATAL: periode resmi tidak genap 6, tersisa 7` |
| **Penjaga TUMPANG TINDIH** — langkah `delete from periode` dihapus dari skrip | Menyala: `BATAL: periode tumpang tindih masih ada` |
| **Penjaga SISA TRANSAKSIONAL** — baris muncul kembali di `audit_log` | Menyala: `BATAL: masih ada 5662 baris transaksional` |
| Kegagalan penjaga membatalkan **seluruh** transaksi | Terbukti — `laporan` tetap 688 baris utuh setelah `BATAL` |
| `delete from pos_sapa` sebelum `laporan` | Ditolak `RESTRICT`, sesuai dugaan |
| `DELETE` memicu trigger audit (`aksi='hapus'`) | Terbukti — karena itu `audit_log` dibersihkan terakhir |
| Semua nama tabel + `audit_log_id_seq` benar-benar ada | Terverifikasi |

Untuk membuktikan penjaga-penjaga itu benar-benar menyala, jumlah baris harus
berubah **selagi** transaksi berjalan — karena itu pengujiannya memakai trigger
sementara yang menempel pada penghapusan `pos_sapa`. Uji "hapus satu baris dulu,
lalu jalankan skrip" **tidak sah** di sini: snapshot pembanding diambil di dalam
transaksi, jadi penjaganya memang tidak seharusnya menyala pada cara itu.

Catatan tambahan: `pengguna.pos_id → pos_sapa` adalah `ON DELETE SET NULL`, dan
tidak ada batasan apa pun dari `pos_sapa` yang mengarah ke akun. Jadi menghapus
seluruh lokasi **tidak mungkin** menghapus atau mengunci akun. Penjaga di skrip
tetap ada sebagai pengaman tambahan.

Harness ujinya memakai data seed, sehingga pengujian ini **tidak** menghilangkan
kewajiban backup di bagian 1 — 4 laporan sungguhan hanya ada di backup.

### Verifikasi setelah pengosongan

Jalankan di SQL Editor:

```sql
-- Akun utuh? (harus 25, sama seperti sebelum wipe)
select peran, count(*) from pengguna group by peran;
select count(*) as jumlah_auth_users from auth.users;

-- Data bersih? Harus 0 / 0 / 0 / 18 / 6
select
  (select count(*) from laporan)   as laporan,
  (select count(*) from pos_sapa)  as pos_sapa,
  (select count(*) from audit_log) as audit_log,
  (select count(*) from wilayah)   as wilayah,
  (select count(*) from periode)   as periode;

-- Periode tumpang tindih harus benar-benar hilang.
-- Diharapkan: 0 baris.
select tanggal_mulai, tanggal_selesai
from periode
where (tanggal_mulai, tanggal_selesai) in (
  (date '2026-11-01', date '2026-11-07'),
  (date '2026-11-08', date '2026-11-14')
);

-- Keenam periode resmi harus lengkap. Diharapkan: 6 baris.
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

2. **Set Node.js Version ke 22.x** (Project Settings → General). Repo ini
   memakai Next.js 15.5.29; `package.json` sudah menyatakan `engines.node: 22.x`.

3. **Environment Variables** (Project Settings → Environment Variables):

   | Nama | Production | Preview | Development |
   |---|---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ |
   | `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **jangan** | ✅ |

   Nilai ketiganya dari Supabase → Project Settings → **API** (di dashboard
   terbaru kadang berlabel *API Keys*). Tandai `SUPABASE_SERVICE_ROLE_KEY`
   sebagai **Sensitive**.

   **Jangan** menyetel `NEXT_DIST_DIR` di Vercel — variabel itu hanya untuk
   pemakaian lokal, dan menyetelnya akan membuat Vercel mencari hasil build di
   folder yang salah.

   `SUPABASE_SERVICE_ROLE_KEY` sengaja tidak dipasang di Preview: Supabase hanya
   punya satu project, jadi preview menunjuk database produksi. Tanpa kunci itu
   di preview, `/admin/akun` hanya menampilkan pesan "belum dikonfigurasi"
   alih-alih bisa membuat atau menghapus akun sungguhan.

4. **Deploy.** Setelah selesai, Vercel memberi domain seperti
   `https://possapa.vercel.app`. Kembali ke langkah 2.1 dan isi *Site URL*
   dengan domain itu (kalau tadi diisi placeholder).

Catatan: dua variabel `NEXT_PUBLIC_*` disisipkan saat build. Kalau nilainya
diubah, harus **redeploy**, bukan sekadar restart.

---

## 5. Verifikasi setelah deploy

Uji berurutan dari yang paling murah:

1. **`/` (halaman publik)** — muat tanpa galat, semua kartu bernilai 0, label
   "data diperbarui" kosong. Kosong di sini **benar**, bukan bug.
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
   sekali sehari untuk mencegah project Supabase Free di-pause setelah 7 hari
   tanpa aktivitas. Verifikasi di Vercel → Project → Cron Jobs. Cek juga hasil
   panggilannya: `https://<domain>/api/ping` harus mengembalikan
   `{"ok":true,...}`.

3. **Jadwalkan `pg_dump` mingguan.** Paket Free tidak punya backup, jadi ini
   wajib (README "Operasional wajib"). Ulangi perintah di bagian 1 Jalur A
   secara berkala, simpan di luar Supabase, dan **uji sekali prosedur
   pemulihannya** ke project Supabase percobaan.

4. **Catat jadwal kredensial.** `/admin/akun` menyimpan email; Admin Pusat
   dapat mengganti kata sandi kapan saja lewat menu *Ubah*. Pastikan setiap
   petugas sudah menerima kata sandi barunya.
