-- =============================================================================
-- reset-data-laporan-20261127.sql
--
-- Membersihkan DATA LAPORAN dan satu Pos SAPA uji dari basis data produksi.
-- Ditulis 27 Nov 2026, menggantikan reset-data-produksi.sql yang sudah usang
-- (lihat "MENGAPA BUKAN SKRIP LAMA" di bawah).
--
-- DIHAPUS:
--   * laporan                         4 baris
--   * laporan_anak                    2 baris
--   * laporan_perempuan               1 baris
--   * laporan_publikasi               1 baris
--   * laporan_rekap_pengaduan         0 baris (dihapus juga, untuk kepastian)
--   * laporan_kasus                   0 baris (dihapus juga, untuk kepastian)
--   * pos_sapa id = 4b48f71c-718b-4763-93f9-1f5777b989a6
--       nama_lokasi = 'Huntara Agam', kode_pos = '1234456'
--   * audit_log yang entitasnya 'laporan' dan kelima tabel rinciannya,
--     plus satu-satunya entri untuk pos Huntara Agam itu.
--
-- DIPERTAHANKAN:
--   * 4 Pos SAPA lainnya (Beutong Ateuh, Tunyang, Linge, Rigeb) beserta
--     entri audit-nya. Ini lokasi sungguhan dengan nama pengurus nyata,
--     bukan sisa seed 'UJI-'.
--   * wilayah (18 kabupaten/kota)
--   * periode (7 baris, termasuk periode 4-10 Des)
--   * pengguna (25 akun) dan auth.users
--
-- MENGAPA BUKAN SKRIP LAMA
--   supabase/reset-data-produksi.sql disusun 25 Nov untuk keadaan basis data
--   yang sudah tidak ada lagi:
--     - penjaganya menuntut tepat 6 periode, sedangkan sekarang ada 7
--       (periode 2026-12-04 s/d 2026-12-10 ditambahkan 25 Nov) -> rollback;
--     - skrip itu menghapus SELURUH pos_sapa, padahal 5 pos yang ada sekarang
--       adalah lokasi sungguhan, bukan 36 baris 'UJI-' dari seed-data-uji;
--     - skrip itu menghapus dua periode tumpang tindih yang sudah tidak ada.
--   Menjalankannya akan menggagalkan transaksi setelah melewati tahap hapus,
--   dan bila penjaganya dilonggarkan, ia menghapus jauh lebih banyak daripada
--   yang diminta.
--
-- CARA PAKAI
--   Supabase Dashboard -> SQL Editor, jalankan sebagai role postgres.
--   Tidak bisa lewat klien JS: service_role tidak dapat membungkus seluruh
--   operasi dalam satu transaksi.
--
-- SIFAT
--   * Idempoten: aman dijalankan berulang. Bila baris sudah tidak ada,
--     skrip selesai tanpa mengubah apa pun.
--   * Satu transaksi: bila verifikasi gagal -> rollback otomatis.
--   * audit_log dibersihkan TERAKHIR, karena trigger catat_audit menyala pada
--     setiap DELETE di tabel di atasnya dan akan mengisi ulang tabel itu.
--   * Nomor urut audit_log TIDAK direset: entri pos_sapa lainnya tetap ada,
--     jadi me-reset sequence akan membuat nomor lama bertabrakan.
--
-- PERINGATAN
--   Tindakan ini tidak dapat dibatalkan. Isi keempat laporan sudah dicatat di
--   bawah (bagian 0) supaya dapat direkonstruksi bila ternyata dibutuhkan.
-- =============================================================================

begin;

drop table if exists _sebelum;
drop table if exists _sesudah;

-- -----------------------------------------------------------------------------
-- 0. Sasaran, dalam bentuk yang dapat dibaca ulang setelah penghapusan.
--    Dicetak di awal agar jejak isi laporan tetap ada di riwayat SQL Editor
--    meskipun baris-barisnya sudah hilang.
-- -----------------------------------------------------------------------------
select l.id            as laporan_id,
       l.jenis_laporan,
       l.status,
       l.sumber_input,
       l.created_at,
       l.submitted_at,
       pe.label        as periode,
       ps.nama_lokasi  as pos
from laporan l
join periode pe on pe.id = l.periode_id
join pos_sapa ps on ps.id = l.pos_id
order by l.created_at;

-- -----------------------------------------------------------------------------
-- 1. Snapshot jumlah baris SEBELUM
-- -----------------------------------------------------------------------------
create temporary table _sebelum (tabel text primary key, n bigint);
insert into _sebelum (tabel, n) values
  ('laporan',                 (select count(*) from laporan)),
  ('laporan_anak',            (select count(*) from laporan_anak)),
  ('laporan_perempuan',       (select count(*) from laporan_perempuan)),
  ('laporan_rekap_pengaduan', (select count(*) from laporan_rekap_pengaduan)),
  ('laporan_kasus',           (select count(*) from laporan_kasus)),
  ('laporan_publikasi',       (select count(*) from laporan_publikasi)),
  ('audit_log',               (select count(*) from audit_log)),
  ('pos_sapa',                (select count(*) from pos_sapa)),
  ('wilayah',                 (select count(*) from wilayah)),
  ('periode',                 (select count(*) from periode)),
  ('pengguna',                (select count(*) from pengguna));

-- -----------------------------------------------------------------------------
-- 2. PENJAGA SASARAN — abort sebelum menghapus apa pun bila UUID ternyata
--    menunjuk pos lain, atau bila ada laporan di luar pos itu.
--
--    UUID disalin dari hasil pemeriksaan 27 Nov 2026. Nama dan kode pos
--    diperiksa ulang di sini supaya salah tempel UUID (atau basis data yang
--    berbeda dari yang diperiksa) tidak menghapus lokasi yang salah.
--    Bila barisnya sudah tidak ada — mis. skrip dijalankan ulang — pemeriksaan
--    nama dilewati, sehingga skrip tetap idempoten.
-- -----------------------------------------------------------------------------
do $$
declare
  v_id    constant uuid := '4b48f71c-718b-4763-93f9-1f5777b989a6';
  v_nama  text;
  v_kode  text;
  v_lain  bigint;
begin
  select nama_lokasi, kode_pos into v_nama, v_kode
  from pos_sapa where id = v_id;

  if v_nama is not null then
    if v_nama <> 'Huntara Agam' or v_kode <> '1234456' then
      raise exception
        'BATAL: UUID sasaran bukan Huntara Agam (nama=%, kode=%)', v_nama, v_kode;
    end if;
  end if;

  -- Laporan milik pos lain tidak boleh ikut terhapus tanpa disadari. Bila
  -- muncul laporan baru sejak pemeriksaan, hentikan dan periksa dulu — lebih
  -- baik gagal di sini daripada kehilangan data yang belum ditinjau.
  select count(*) into v_lain from laporan where pos_id <> v_id;
  if v_lain <> 0 then
    raise exception
      'BATAL: ada % laporan di luar Pos Huntara Agam; periksa dulu sebelum menghapus', v_lain;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Transaksional: anak dulu, lalu induk.
--    `delete from laporan` saja sebenarnya cukup (kelima tabel rincian
--    ON DELETE CASCADE), tetapi dihapus eksplisit supaya hitungan per tabel
--    dapat diverifikasi operator.
-- -----------------------------------------------------------------------------
delete from laporan_anak;
delete from laporan_perempuan;
delete from laporan_rekap_pengaduan;
delete from laporan_kasus;
delete from laporan_publikasi;
delete from laporan;

-- -----------------------------------------------------------------------------
-- 4. pos_sapa sasaran.
--    RESTRICT pada laporan.pos_id aman karena laporan sudah kosong di langkah 3.
--    pengguna.pos_id -> pos_sapa ON DELETE SET NULL, tetapi kolom itu NULL
--    untuk semua baris (migrasi 20261118000003 memindahkan penugasan ke
--    wilayah_id), jadi tidak ada data akun yang hilang.
-- -----------------------------------------------------------------------------
delete from pos_sapa where id = '4b48f71c-718b-4763-93f9-1f5777b989a6';

-- -----------------------------------------------------------------------------
-- 5. audit_log TERAKHIR. Trigger di atas sudah menulis entri 'hapus' ke sini;
--    entri itu memang ikut dibuang. Entri pos_sapa lain DIPERTAHANKAN.
-- -----------------------------------------------------------------------------
delete from audit_log
where entitas in (
        'laporan',
        'laporan_anak',
        'laporan_perempuan',
        'laporan_rekap_pengaduan',
        'laporan_kasus',
        'laporan_publikasi'
      )
   or (entitas = 'pos_sapa'
       and entitas_id = '4b48f71c-718b-4763-93f9-1f5777b989a6');

-- -----------------------------------------------------------------------------
-- 6. VERIFIKASI — abort (rollback) bila data yang wajib lestari berubah,
--    atau masih ada sisa data yang seharusnya terhapus.
-- -----------------------------------------------------------------------------
do $$
declare
  v_sebelum bigint;
  v_sesudah bigint;
  v_sisa    bigint;
begin
  -- Yang wajib lestari.
  select n into v_sebelum from _sebelum where tabel = 'wilayah';
  select count(*) into v_sesudah from wilayah;
  if v_sesudah <> v_sebelum then
    raise exception 'BATAL: jumlah baris wilayah berubah (% -> %)', v_sebelum, v_sesudah;
  end if;

  select n into v_sebelum from _sebelum where tabel = 'periode';
  select count(*) into v_sesudah from periode;
  if v_sesudah <> v_sebelum then
    raise exception 'BATAL: jumlah baris periode berubah (% -> %)', v_sebelum, v_sesudah;
  end if;

  select n into v_sebelum from _sebelum where tabel = 'pengguna';
  select count(*) into v_sesudah from pengguna;
  if v_sesudah <> v_sebelum then
    raise exception 'BATAL: jumlah baris pengguna berubah (% -> %)', v_sebelum, v_sesudah;
  end if;

  -- Yang harus hilang.
  select count(*) into v_sisa from (
    select 1 from laporan                union all
    select 1 from laporan_anak           union all
    select 1 from laporan_perempuan      union all
    select 1 from laporan_rekap_pengaduan union all
    select 1 from laporan_kasus          union all
    select 1 from laporan_publikasi
  ) t;
  if v_sisa <> 0 then
    raise exception 'BATAL: masih ada % baris laporan/rincian', v_sisa;
  end if;

  if exists (select 1 from pos_sapa where id = '4b48f71c-718b-4763-93f9-1f5777b989a6') then
    raise exception 'BATAL: Pos Huntara Agam masih ada setelah penghapusan';
  end if;

  if exists (
    select 1 from audit_log
    where entitas in (
            'laporan',
            'laporan_anak',
            'laporan_perempuan',
            'laporan_rekap_pengaduan',
            'laporan_kasus',
            'laporan_publikasi'
          )
       or (entitas = 'pos_sapa'
           and entitas_id = '4b48f71c-718b-4763-93f9-1f5777b989a6')
  ) then
    raise exception 'BATAL: masih ada entri audit untuk laporan / pos Huntara Agam';
  end if;

  -- Empat Pos SAPA lain harus utuh. Diperiksa per UUID, bukan jumlah, supaya
  -- terhapusnya pos yang salah tetap ketahuan.
  select count(*) into v_sesudah
  from pos_sapa
  where id in (
    '49901948-4635-4915-84ea-1e3ca765d363',  -- Beutong Ateuh, Nagan Raya
    '9bc79966-dc73-412d-962c-3b82f67826bd',  -- Tunyang, Bener Meriah
    '83b08760-e5a9-445b-a69c-cfc9fc93bee2',  -- Kec. Linge, Aceh Tengah
    '501aca46-3de4-42d6-ad08-af039b052a3e'   -- Rigeb, Gayo Lues
  );
  if v_sesudah <> 4 then
    raise exception 'BATAL: Pos SAPA lain tidak utuh, tersisa % dari 4', v_sesudah;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Laporan SEBELUM/SESUDAH untuk diperiksa operator
-- -----------------------------------------------------------------------------
create temporary table _sesudah (tabel text primary key, n bigint);
insert into _sesudah (tabel, n) values
  ('laporan',                 (select count(*) from laporan)),
  ('laporan_anak',            (select count(*) from laporan_anak)),
  ('laporan_perempuan',       (select count(*) from laporan_perempuan)),
  ('laporan_rekap_pengaduan', (select count(*) from laporan_rekap_pengaduan)),
  ('laporan_kasus',           (select count(*) from laporan_kasus)),
  ('laporan_publikasi',       (select count(*) from laporan_publikasi)),
  ('audit_log',               (select count(*) from audit_log)),
  ('pos_sapa',                (select count(*) from pos_sapa)),
  ('wilayah',                 (select count(*) from wilayah)),
  ('periode',                 (select count(*) from periode)),
  ('pengguna',                (select count(*) from pengguna));

select s.tabel, s.n as sebelum, a.n as sesudah, s.n - a.n as dihapus
from _sebelum s join _sesudah a using (tabel)
order by (s.n - a.n) desc, s.tabel;

drop table if exists _sebelum;
drop table if exists _sesudah;

commit;
