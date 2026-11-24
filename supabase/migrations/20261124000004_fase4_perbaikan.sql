-- =============================================================================
-- Fase 4 — Perbaikan setelah diuji terhadap data nyata
--
-- Dua perbaikan, keduanya ditemukan dengan menjalankan view anomali dan
-- membaca tabel rincian memakai kredensial aplikasi.
-- =============================================================================

-- =============================================================================
-- PERBAIKAN 1 — Anomali `periode_tumpang_tindih` dikeluarkan dari view
--
-- MASALAH
--   View menandai 849 dari 871 laporan non-draf (97,5%) sebagai beranomali.
--   Penyebabnya data nyata: periode historis memang tumpang tindih. Skrip
--   migrasi mereproduksi persis inkonsistensi PRD §6.5 — nilai "2026-11"
--   menjadi 1–30 November, sedangkan "5 - 19 November 2026" menjadi 5–19
--   November, sehingga keduanya beririsan.
--
--   Akibatnya nyata: laporan beranomali WAJIB disertai catatan verifikasi,
--   jadi hampir setiap verifikasi laporan historis memaksa admin menulis alasan
--   atas masalah yang bukan pada laporan itu. Catatan yang wajib diisi terus
--   menerus akan berhenti bermakna — persis yang ingin dicegah pemeriksaan ini.
--
-- KENAPA DI SINI SALAH TEMPAT
--   PRD §6.4 menempatkan "Periode valid dan tidak tumpang tindih untuk lokasi
--   yang sama" di bagian ATURAN VALIDASI DATA — bersama "lokasi harus merujuk
--   data master" dan "kode kasus unik per wilayah", yang semuanya adalah aturan
--   master data, bukan ciri sebuah laporan. Anomali per laporan yang lain di
--   §6.4 memang berbicara tentang isi laporan ("total tidak boleh kurang dari
--   jumlah subkelompok").
--
--   Pemeriksaan periode kini ada di halaman /admin/periode, tempat periode
--   memang dikelola, sebagai peringatan yang tidak memblokir.
-- =============================================================================

-- =============================================================================
-- PERBAIKAN 2 — Petugas tidak dapat membaca tabel rincian (celah wilayah)
--
-- MASALAH
--   Migrasi 20261118000003 memindahkan penugasan petugas dari `pos_id` ke
--   `wilayah_id` dan men-NULL-kan `pos_id` untuk semua peran:
--
--     update pengguna set pos_id = null where pos_id is not null;
--
--   Policy `laporan` di migrasi itu ikut diperbarui memakai
--   `ps.wilayah_id = auth_wilayah_id()`. Tetapi `boleh_baca_laporan` —
--   satu-satunya penentu hak BACA pada kelima tabel rincian — masih memakai:
--
--     auth_peran() = 'petugas' and l.pos_id = auth_pos_id()
--
--   Karena `pos_id` kini NULL, `auth_pos_id()` mengembalikan NULL, dan
--   perbandingan itu tidak pernah benar. Petugas TIDAK dapat membaca satu pun
--   baris `laporan_anak`, `laporan_perempuan`, `laporan_rekap_pengaduan`,
--   `laporan_kasus`, atau `laporan_publikasi` — termasuk laporannya sendiri.
--
--   Celah ini tidak terlihat selama ini karena belum ada kode yang membaca
--   rincian: `simpanLaporan` hanya menulis, dan `/laporan-saya` hanya membaca
--   kolom `laporan` induk. Perbaikan Fase 4 ("buka kunci" lalu petugas
--   memperbaiki) adalah pembaca pertama, sehingga celah ini harus ditutup.
--
--   `boleh_tulis_laporan` sudah benar sejak migrasi 00003 — hanya versi baca
--   yang terlewat. Jadi selama ini: petugas bisa MENULIS rincian tetapi tidak
--   bisa MEMBACANYA kembali.
-- =============================================================================

create or replace function boleh_baca_laporan(target_laporan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from laporan l
    join pos_sapa p on p.id = l.pos_id
    where l.id = target_laporan_id
      and (
        -- Petugas: seluruh wilayah penugasannya. Tidak dibatasi status —
        -- membaca rincian laporan yang sudah terverifikasi tidak membocorkan
        -- apa pun di luar kabupaten/kotanya sendiri.
        (auth_peran() = 'petugas'
          and p.wilayah_id = auth_wilayah_id())
        or auth_peran() in ('admin_kabkota', 'admin_pusat', 'pimpinan')
      )
  );
$$;

comment on function boleh_baca_laporan(uuid) is
  'Hak baca tabel rincian. Petugas terikat wilayah_id (sejak migrasi '
  '20261118000003), bukan pos_id.';

revoke execute on function boleh_baca_laporan from public;
grant execute on function boleh_baca_laporan to authenticated;

-- =============================================================================
-- PERBAIKAN 1 (lanjutan) — view anomali tanpa cabang periode
-- =============================================================================
--
-- Ditulis ulang seluruhnya (bukan `create or replace view` sebagian) agar
-- definisinya dapat diperiksa: PostgreSQL menolak `create or replace view`
-- yang mengubah nama/tipe kolom, dan kita ingin struktur yang sama.
--
-- security_invoker = true tetap dipertahankan. Mengubahnya menjadi false akan
-- membuat setiap pengguna login melihat anomali seluruh Indonesia.

create or replace view anomali_laporan
with (security_invoker = true)
as
with dasar as (
  select
    l.id                as laporan_id,
    l.status,
    l.jenis_laporan,
    l.sumber_input,
    l.catatan_verifikasi,
    l.catatan_buka_kunci,
    l.submitted_at,
    l.updated_at,
    ps.id               as pos_id,
    ps.nama_lokasi,
    ps.wilayah_id,
    w.kab_kota,
    w.provinsi,
    pr.id               as periode_id,
    pr.label            as periode_label
  from laporan l
  join pos_sapa ps on ps.id = l.pos_id
  join periode  pr on pr.id = l.periode_id
  left join wilayah w on w.id = ps.wilayah_id
)
-- ---------------------------------------------------------------------------
-- A1. Distribusi usia tidak sama dengan jumlah per jenis kelamin.
--     Inilah kerusakan tersembunyi B1 (PRD §6.5): prototipe menutupinya
--     dengan max(sumUsia, sumGender) sehingga total tampak benar padahal
--     rinciannya salah. Di sini selisihnya DITANDAI, bukan ditutupi.
-- ---------------------------------------------------------------------------
select
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'distribusi_usia'::text as kode,
  'sedang'::text as tingkat,
  'Jumlah per kelompok usia (' || (a.usia_0_5 + a.usia_6_12 + a.usia_13_17)
    || ') tidak sama dengan jumlah per jenis kelamin ('
    || (a.laki_laki + a.perempuan) || ')' as keterangan
from dasar d
join laporan_anak a on a.laporan_id = d.laporan_id
where (a.usia_0_5 + a.usia_6_12 + a.usia_13_17)
   <> (a.laki_laki + a.perempuan)

union all
-- ---------------------------------------------------------------------------
-- A2. Subkelompok peserta perempuan melebihi total peserta.
--     Subkelompok boleh tumpang tindih (kepala keluarga bisa juga lansia),
--     jadi yang diperiksa adalah masing-masing terhadap total — bukan
--     jumlahnya terhadap total.
-- ---------------------------------------------------------------------------
select
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'subkelompok_perempuan'::text,
  'sedang'::text,
  'Subkelompok terbesar ('
    || greatest(p.kepala_keluarga, p.hamil_menyusui, p.lansia, p.disabilitas)
    || ') melebihi total peserta (' || p.total_ikut || ')'
from dasar d
join laporan_perempuan p on p.laporan_id = d.laporan_id
where p.total_ikut < greatest(
        p.kepala_keluarga, p.hamil_menyusui, p.lansia, p.disabilitas)

union all
-- ---------------------------------------------------------------------------
-- A3. Rincian kategori aduan tidak menjumlah sama dengan aduan masuk.
--     Constraint database hanya mencegah kategori MELEBIHI total; kurang dari
--     total lolos tanpa terdeteksi.
-- ---------------------------------------------------------------------------
select
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'rekap_kategori'::text,
  'sedang'::text,
  'Jumlah kategori ('
    || (r.kekerasan_perempuan + r.kekerasan_anak
        + r.non_kekerasan_perempuan + r.non_kekerasan_anak)
    || ') tidak sama dengan aduan masuk (' || r.aduan_masuk || ')'
from dasar d
join laporan_rekap_pengaduan r on r.laporan_id = d.laporan_id
where r.status_bulan = 'Ada aduan'
  and (r.kekerasan_perempuan + r.kekerasan_anak
       + r.non_kekerasan_perempuan + r.non_kekerasan_anak) <> r.aduan_masuk

union all
-- ---------------------------------------------------------------------------
-- A4. Status "Nihil" tetapi masih ada hitungan.
--     Sudah dijaga constraint `rekap_nihil_nol`; dipertahankan sebagai
--     lapisan kedua karena data masuk juga lewat impor manual (PRD §15.2).
-- ---------------------------------------------------------------------------
select
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'rekap_nihil'::text,
  'tinggi'::text,
  'Status Nihil tetapi masih ada hitungan aduan'
from dasar d
join laporan_rekap_pengaduan r on r.laporan_id = d.laporan_id
where r.status_bulan = 'Nihil'
  and (r.aduan_masuk <> 0 or r.sudah_ditindaklanjuti <> 0
       or r.tercatat_simfoni <> 0
       or (r.kekerasan_perempuan + r.kekerasan_anak
           + r.non_kekerasan_perempuan + r.non_kekerasan_anak) <> 0)

union all
-- ---------------------------------------------------------------------------
-- A5. Kelengkapan SIMFONI tidak konsisten dengan statusnya.
-- ---------------------------------------------------------------------------
select
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'kasus_simfoni'::text,
  'tinggi'::text,
  case
    when k.sudah_simfoni then
      'Ditandai sudah tercatat SIMFONI tetapi '
        || concat_ws(', ',
             case when k.no_registrasi_simfoni is null
                  then 'nomor registrasi kosong' end,
             case when k.tanggal_input_simfoni is null
                  then 'tanggal input kosong' end,
             case when k.penginput_simfoni is null
                  then 'penginput kosong' end)
        || ' belum diisi'
    else 'Belum tercatat SIMFONI tetapi alasan belum diisi'
  end
from dasar d
join laporan_kasus k on k.laporan_id = d.laporan_id
where (k.sudah_simfoni
        and (k.no_registrasi_simfoni is null
             or k.tanggal_input_simfoni is null
             or k.penginput_simfoni is null))
   or (not k.sudah_simfoni and k.alasan_belum_simfoni is null)

union all
-- ---------------------------------------------------------------------------
-- A6. Laporan non-draf tanpa baris rincian.
--     Risiko nyata dari penyimpanan dua langkah di `simpanLaporan`: bila
--     upsert rincian gagal setelah induk tersimpan, yang tersisa adalah
--     laporan kosong yang tetap terhitung dalam matriks kepatuhan.
-- ---------------------------------------------------------------------------
select
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'detail_hilang'::text,
  'tinggi'::text,
  'Laporan berstatus ' || d.status || ' tetapi rinciannya tidak ada'
from dasar d
where d.status <> 'draf'
  and not exists (
    select 1 from laporan_anak a            where a.laporan_id = d.laporan_id
    union all
    select 1 from laporan_perempuan p       where p.laporan_id = d.laporan_id
    union all
    select 1 from laporan_rekap_pengaduan r where r.laporan_id = d.laporan_id
    union all
    select 1 from laporan_kasus k           where k.laporan_id = d.laporan_id
    union all
    select 1 from laporan_publikasi b       where b.laporan_id = d.laporan_id
  );

comment on view anomali_laporan is
  'Anomali data dihitung saat dibaca (PRD §6.4). Satu baris = satu anomali. '
  'security_invoker = true supaya RLS tabel dasar tetap berlaku. '
  'Tumpang tindih periode TIDAK termasuk — itu aturan master data (§6.4), '
  'diperiksa di /admin/periode.';

revoke all on anomali_laporan from anon;
grant select on anomali_laporan to authenticated;

-- =============================================================================
-- VERIFIKASI
-- =============================================================================

do $$
declare
  v_def     text;
  v_jumlah  integer;
begin
  -- Cabang periode harus benar-benar hilang dari definisi view.
  select pg_get_viewdef('anomali_laporan'::regclass)
  into v_def;

  if position('periode_tumpang_tindih' in v_def) > 0 then
    raise exception 'View anomali masih memuat cabang periode_tumpang_tindih';
  end if;
  -- Enam cabang harus tersisa (A1–A6).
  select count(*) into v_jumlah
  from unnest(array[
    'distribusi_usia', 'subkelompok_perempuan', 'rekap_kategori',
    'rekap_nihil', 'kasus_simfoni', 'detail_hilang'
  ]) as k
  where position(k in v_def) > 0;
  if v_jumlah <> 6 then
    raise exception 'View anomali hanya memuat % dari 6 cabang', v_jumlah;
  end if;

  -- security_invoker harus tetap menyala.
  select count(*) into v_jumlah
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'anomali_laporan'
    and 'security_invoker=true' = any(c.reloptions);
  if v_jumlah <> 1 then
    raise exception
      'anomali_laporan kehilangan security_invoker = true';
  end if;

  -- boleh_baca_laporan harus memakai wilayah_id, bukan pos_id.
  select pg_get_functiondef('boleh_baca_laporan(uuid)'::regprocedure)
  into v_def;

  if position('auth_wilayah_id' in v_def) = 0 then
    raise exception
      'boleh_baca_laporan belum memakai auth_wilayah_id — petugas tetap '
      'tidak dapat membaca rincian laporan di wilayahnya';
  end if;
  if position('auth_pos_id' in v_def) > 0 then
    raise exception
      'boleh_baca_laporan masih memakai auth_pos_id, padahal kolom pos_id '
      'sudah NULL untuk semua peran sejak migrasi 20261118000003';
  end if;

  raise notice 'Fase 4 perbaikan: view anomali dan hak baca rincian selesai.';
end;
$$;
