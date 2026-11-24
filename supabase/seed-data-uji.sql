-- =============================================================================
-- Seed: DATA UJI (dummy) — Pos SAPA + laporan 5 jenis + detail
--
-- Tujuan: mengisi database dengan data palsu yang aman dipakai untuk mencoba
--         dashboard, monitoring kepatuhan, checklist, ekspor, dan halaman
--         publik sebelum masuk ke PRD Fase 2.
--
-- SIFAT DATA
--   * Tidak memuat identitas nyata. Kasus hanya memakai kode (KS-UJI-...),
--     tanpa nama korban — sesuai PRD §5.12.
--   * Semua Pos SAPA dan laporan ditandai lewat kode_pos berawalan 'UJI-',
--     sehingga mudah dicari dan dibersihkan (lihat bagian 6).
--   * Koordinat sengaja NULL: pengisian koordinat adalah pekerjaan Fase 3
--     (digitasi manual oleh Admin Pusat).
--
-- CARA PAKAI
--   1. Jalankan di Supabase Studio -> SQL Editor (role postgres).
--   2. Prasyarat: migrasi 20261118000001..3 sudah dijalankan, dan seed.sql +
--      seed-periode.sql sudah dijalankan (18 wilayah + 6 periode).
--   3. Jalankan seluruh berkas. Aman diulang: semua insert memakai
--      "on conflict do nothing" / "not exists".
--
-- RINGKASAN ISI (setelah berhasil)
--   * 5 akun uji (admin pusat, pimpinan, 3 admin kab/kota)
--   * 36 Pos SAPA uji (2 per kabupaten/kota)
--   * 684 laporan induk (5 jenis, 6 periode)
--   * 684 baris detail (180 anak, 144 perempuan, 144 rekap, 108 kasus,
--     108 publikasi)
--
-- URUTAN BAGIAN
--   1. Akun uji (opsional, dilewati bila email sudah ada)
--   2. Pos SAPA uji
--   3. Laporan induk
--   4. Detail 5 jenis laporan
--   5. Query verifikasi
--   6. Cara membersihkan data uji (dikomentari)
-- =============================================================================

-- =============================================================================
-- 1. AKUN UJI
--    Ditulis langsung ke auth.users + auth.identities + public.pengguna.
--    Dilewati bila email sudah ada. Gagal di satu akun tidak menghentikan
--    bagian lain (tiap akun punya penanganan galat sendiri).
--
--    PERINGATAN: kata sandi seragam & mudah ditebak — hanya untuk data uji.
--    Wajib diganti (reset password) sebelum dipakai produksi.
-- =============================================================================
do $$
declare
  akun            record;
  v_wilayah       uuid;
  v_id            uuid;
  ada_provider_id boolean;
begin
  -- Skema auth.identities lama belum punya kolom provider_id.
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name   = 'identities'
      and column_name  = 'provider_id'
  ) into ada_provider_id;

  for akun in
    select *
    from (values
      ('adminpusat@kemenpppa.go.id',            'adminpusatpossapa',            'Admin Pusat Uji',           'admin_pusat',   null::text),
      ('pimpinan@kemenpppa.go.id',              'pimpinanpossapa',              'Pimpinan Uji',              'pimpinan',      null::text),
      ('adminkab.acehtamiang@kemenpppa.go.id',  'adminkabacehtamiangpossapa',   'Admin Kab/Kota Uji — Aceh Tamiang', 'admin_kabkota', 'Aceh Tamiang'),
      ('adminkab.langkat@kemenpppa.go.id',      'adminkablangkatpossapa',       'Admin Kab/Kota Uji — Langkat',      'admin_kabkota', 'Langkat'),
      ('adminkab.agam@kemenpppa.go.id',         'adminkabagampossapa',          'Admin Kab/Kota Uji — Agam',         'admin_kabkota', 'Agam')
    ) as v(email, sandi, nama, peran, kab_kota)
  loop
    -- Pemeriksaan awal di luar blok exception: "continue" tidak dipakai di
    -- dalam blok BEGIN ... EXCEPTION.
    if exists (select 1 from auth.users where email = akun.email) then
      raise notice 'Lewati akun %: sudah ada', akun.email;
      continue;
    end if;

    v_wilayah := null;
    if akun.kab_kota is not null then
      select id into v_wilayah from wilayah where kab_kota = akun.kab_kota;
      if v_wilayah is null then
        raise notice 'Lewati akun %: wilayah % tidak ditemukan', akun.email, akun.kab_kota;
        continue;
      end if;
    end if;

    v_id := gen_random_uuid();

    begin
      -- 1a. Akun auth. Email langsung dikonfirmasi agar bisa dipakai masuk.
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000',
        v_id,
        'authenticated',
        'authenticated',
        akun.email,
        crypt(akun.sandi, gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('nama', akun.nama),
        '', '', '', ''
      );

      -- 1b. Identitas provider email — wajib ada agar login email/password jalan.
      if ada_provider_id then
        insert into auth.identities (
          id, provider_id, user_id, identity_data, provider,
          last_sign_in_at, created_at, updated_at
        ) values (
          gen_random_uuid(),
          v_id::text,
          v_id,
          jsonb_build_object('sub', v_id::text, 'email', akun.email, 'email_verified', true),
          'email',
          now(), now(), now()
        );
      else
        insert into auth.identities (
          id, user_id, identity_data, provider,
          last_sign_in_at, created_at, updated_at
        ) values (
          v_id::text,
          v_id,
          jsonb_build_object('sub', v_id::text, 'email', akun.email, 'email_verified', true),
          'email',
          now(), now(), now()
        );
      end if;

      -- 1c. Profil pengguna.
      insert into public.pengguna (id, nama, email, peran, wilayah_id)
      values (v_id, akun.nama, akun.email, akun.peran::peran_t, v_wilayah)
      on conflict (id) do nothing;

      raise notice 'Dibuat akun % (peran %, password %)', akun.email, akun.peran, akun.sandi;
    exception when others then
      raise notice 'Akun % gagal dibuat: %', akun.email, sqlerrm;
    end;
  end loop;
end $$;

-- =============================================================================
-- 2. POS SAPA UJI — 2 lokasi per kabupaten/kota (36 lokasi)
--    Nama dan kode_pos memakai penanda "Uji" / "UJI-" agar mudah dibersihkan.
--    Koordinat NULL; lihat contoh pengisian di bagian akhir berkas.
-- =============================================================================
insert into pos_sapa (
  wilayah_id, nama_lokasi, kode_pos, jenis_hunian, penanggung_jawab, status_aktif
)
select
  w.id,
  'Pos SAPA Uji ' || w.kab_kota || ' ' || i.n,
  'UJI-' || lpad((row_number() over (order by w.provinsi, w.kab_kota, i.n))::text, 2, '0'),
  case i.n when 1 then 'huntap'::jenis_hunian_t else 'huntara'::jenis_hunian_t end,
  'Penanggung Jawab Uji ' || i.n,
  case when row_number() over (order by w.provinsi, w.kab_kota, i.n) = 36
       then false else true end
from wilayah w
cross join (values (1), (2)) as i(n)
on conflict (wilayah_id, nama_lokasi) do nothing;

-- =============================================================================
-- 3. LAPORAN INDUK
--    Pola kepatuhan (36 pos, 6 periode):
--      * pos ke-5, 11, 17, ... (n % 6 = 5)  -> tidak pernah melapor
--      * pos genap                          -> lengkap 5 jenis tiap periode
--      * pos kelipatan 3 (ganjil)           -> 3 jenis (anak, perempuan, rekap)
--      * sisanya (ganjil)                   -> 1 jenis (aktivitas anak)
--    Status: sebagian draf di periode terakhir, sebagian terverifikasi.
--    sumber_input 'google_form' untuk sebagian pos, menguji badge transisi.
--
--    Bila belum ada akun admin_pusat, status terverifikasi otomatis turun
--    menjadi terkirim (kolom verified_by wajib terisi untuk terverifikasi).
-- =============================================================================
with verifikator as (
  -- Selalu menghasilkan tepat satu baris; id bernilai NULL bila belum ada
  -- admin pusat. Dengan begitu cross join di bawah tidak menghapus baris.
  select (
    select id from pengguna where peran = 'admin_pusat' order by email limit 1
  ) as id
),
pos_uji as (
  select id, kode_pos, wilayah_id, row_number() over (order by kode_pos) as n
  from pos_sapa
  where kode_pos like 'UJI-%'
),
periode_urut as (
  select id, tanggal_mulai, label, row_number() over (order by tanggal_mulai) as n
  from periode
),
daftar_jenis as (
  select * from (values
    (1, 'aktivitas_anak'::jenis_laporan_t),
    (2, 'aktivitas_perempuan'::jenis_laporan_t),
    (3, 'rekap_pengaduan'::jenis_laporan_t),
    (4, 'tindak_lanjut_kasus'::jenis_laporan_t),
    (5, 'publikasi'::jenis_laporan_t)
  ) as v(urut, jenis)
),
baris as (
  select
    p.id  as pos_id,
    pr.id as periode_id,
    dj.jenis as jenis_laporan,
    case
      when p.n % 4 = 0 and pr.n = 6 then 'draf'::status_laporan_t
      when p.n % 5 = 0           then 'terverifikasi'::status_laporan_t
      else                            'terkirim'::status_laporan_t
    end as status,
    case when p.n % 7 = 0 then 'google_form'::sumber_input_t
         else 'form_internal'::sumber_input_t end as sumber_input,
    case when p.n % 3 = 0
         then 'https://drive.google.com/drive/folders/uji-' || p.kode_pos || '-' || pr.n
    end as link_dokumentasi,
    p.wilayah_id
  from pos_uji p
  cross join periode_urut pr
  cross join daftar_jenis dj
  where case
    when p.n % 6 = 5 then false
    when p.n % 2 = 0 then true
    when p.n % 3 = 0 then dj.urut <= 3
    else dj.urut <= 1
  end
)
insert into laporan (
  pos_id, periode_id, jenis_laporan, status, sumber_input,
  link_dokumentasi, submitted_by, verified_by
)
select
  b.pos_id, b.periode_id, b.jenis_laporan,
  -- Tanpa verifikator, status terverifikasi diturunkan jadi terkirim.
  case when b.status = 'terverifikasi' and vf.id is null
       then 'terkirim'::status_laporan_t else b.status end,
  b.sumber_input,
  b.link_dokumentasi,
  (
    select pg.id from pengguna pg
    where pg.peran = 'petugas' and pg.wilayah_id = b.wilayah_id and pg.aktif
    order by pg.email limit 1
  ),
  case when b.status = 'terverifikasi' then vf.id end
from baris b
cross join verifikator vf
on conflict (pos_id, periode_id, jenis_laporan) do nothing;

-- =============================================================================
-- 4. DETAIL LAPORAN
-- =============================================================================

-- 4.1 Aktivitas anak (Bermain & Psikososial)
with baris as (
  select l.id, row_number() over (order by l.pos_id, l.periode_id) as n
  from laporan l
  join pos_sapa p on p.id = l.pos_id
  where l.jenis_laporan = 'aktivitas_anak'
    and p.kode_pos like 'UJI-%'
    and not exists (select 1 from laporan_anak a where a.laporan_id = l.id)
),
hitung as (
  select
    id, n,
    (3 + (n % 5))::int as usia_0_5,
    (3 + (n % 4))::int as usia_6_12,
    (2 + (n % 3))::int as usia_13_17
  from baris
)
insert into laporan_anak (
  laporan_id, jumlah_kegiatan, nama_kegiatan, jenis_kegiatan,
  usia_0_5, usia_6_12, usia_13_17, laki_laki, perempuan,
  disabilitas, perlu_layanan_lanjutan, temuan, tindak_lanjut
)
select
  id,
  (1 + (n % 2))::int,
  case n % 3
    when 0 then 'Ruang Sahabat Anak & Edukasi Perlindungan Diri'
    when 1 then 'Bermain Bersama & Trauma Healing'
    else        'Kegiatan Fisik & Seni'
  end,
  case n % 3
    when 0 then array['Edukasi', 'Bermain Bersama']
    when 1 then array['Trauma Healing', 'Kegiatan Fisik']
    else        array['Bermain Bersama', 'Lainnya']
  end,
  usia_0_5, usia_6_12, usia_13_17,
  (usia_0_5 + usia_6_12 + usia_13_17) / 2,
  (usia_0_5 + usia_6_12 + usia_13_17) - ((usia_0_5 + usia_6_12 + usia_13_17) / 2),
  (n % 3)::int,
  (n % 4)::int,
  case when n % 4 <> 0 then 'Anak membutuhkan pendampingan lanjutan' end,
  case when n % 4 <> 0 then 'Dirujuk ke layanan psikososial kabupaten/kota' end
from hitung;

-- 4.2 Aktivitas perempuan (Pemberdayaan & Psikososial)
with baris as (
  select l.id, row_number() over (order by l.pos_id, l.periode_id) as n
  from laporan l
  join pos_sapa p on p.id = l.pos_id
  where l.jenis_laporan = 'aktivitas_perempuan'
    and p.kode_pos like 'UJI-%'
    and not exists (select 1 from laporan_perempuan x where x.laporan_id = l.id)
),
hitung as (
  select id, n, (12 + (n % 5))::int as total_ikut from baris
)
insert into laporan_perempuan (
  laporan_id, jumlah_kegiatan, nama_kegiatan, jenis_kegiatan,
  total_ikut, kepala_keluarga, hamil_menyusui, lansia, disabilitas, manfaat
)
select
  id,
  (1 + (n % 2))::int,
  case n % 3
    when 0 then 'Pelatihan Keterampilan & Pemberdayaan Ekonomi'
    when 1 then 'Pendampingan Psikososial Kelompok Perempuan'
    else        'Pertemuan Kelompok & Dukungan Sesama'
  end,
  case n % 3
    when 0 then 'Pemberdayaan Ekonomi'
    when 1 then 'Pendampingan Psikososial'
    else        'Dukungan Kelompok'
  end,
  total_ikut,
  total_ikut / 2,
  (n % 4)::int,
  (n % 5)::int,
  (n % 3)::int,
  'Peserta memperoleh pengetahuan dan dukungan sosial'
from hitung;

-- 4.3 Rekapitulasi layanan pengaduan
with baris as (
  select l.id, row_number() over (order by l.pos_id, l.periode_id) as n
  from laporan l
  join pos_sapa p on p.id = l.pos_id
  where l.jenis_laporan = 'rekap_pengaduan'
    and p.kode_pos like 'UJI-%'
    and not exists (select 1 from laporan_rekap_pengaduan x where x.laporan_id = l.id)
),
hitung as (
  select
    id, n,
    case when n % 5 = 0 then 'Nihil' else 'Ada aduan' end as status_bulan,
    case when n % 5 = 0 then 0 else (4 + (n % 4))::int end as aduan_masuk
  from baris
)
insert into laporan_rekap_pengaduan (
  laporan_id, status_bulan, aduan_masuk,
  kekerasan_perempuan, kekerasan_anak, non_kekerasan_perempuan, non_kekerasan_anak,
  sudah_ditindaklanjuti, tercatat_simfoni, tindak_lanjut_umum, pihak_terlibat
)
select
  id, status_bulan, aduan_masuk,
  case when aduan_masuk = 0 then 0 else 1 end,
  case when aduan_masuk = 0 then 0 else 1 end,
  case when aduan_masuk = 0 then 0 else 1 end,
  case when aduan_masuk = 0 then 0 else aduan_masuk - 3 end,
  case when aduan_masuk = 0 then 0 else aduan_masuk - (n % 2)::int end,
  case when aduan_masuk = 0 then 0 else aduan_masuk / 2 end,
  case when aduan_masuk = 0 then null else 'Ditindaklanjuti bersama UPTD PPA' end,
  case when aduan_masuk = 0 then null else 'Puskesmas, UPTD PPA, pemerintah gampong' end
from hitung;

-- 4.4 Rincian tindak lanjut kasus
with baris as (
  select l.id, row_number() over (order by l.pos_id, l.periode_id) as n,
         p.kode_pos, pr.tanggal_mulai
  from laporan l
  join pos_sapa p on p.id = l.pos_id
  join periode pr on pr.id = l.periode_id
  where l.jenis_laporan = 'tindak_lanjut_kasus'
    and p.kode_pos like 'UJI-%'
    and not exists (select 1 from laporan_kasus x where x.laporan_id = l.id)
)
insert into laporan_kasus (
  laporan_id, kode_kasus, tanggal_aduan, kategori, jenis_kasus, jumlah_korban,
  jenis_kelamin, kelompok_usia, disabilitas, kebutuhan_korban, tindak_lanjut,
  status_penanganan, sudah_simfoni, no_registrasi_simfoni, tanggal_input_simfoni,
  penginput_simfoni, alasan_belum_simfoni, hambatan
)
select
  id,
  'KS-' || kode_pos || '-' || to_char(tanggal_mulai, 'MMDD'),
  tanggal_mulai + (n % 7)::int,
  case when n % 2 = 0 then 'kekerasan'::kategori_kasus_t
       else 'non_kekerasan'::kategori_kasus_t end,
  case n % 3
    when 0 then 'Kekerasan psikis'
    when 1 then 'KDRT'
    else        'Penelantaran anak'
  end,
  (1 + (n % 2))::int,
  case when n % 2 = 0 then 'Perempuan' else 'Laki-Laki' end,
  case n % 3
    when 0 then '0-5 tahun'
    when 1 then '6-12 tahun'
    else        '13-17 tahun'
  end,
  (n % 4 = 0),
  'Pendampingan psikologis dan rujukan layanan',
  'Didampingi oleh pendamping Pos SAPA',
  case n % 3
    when 0 then 'dalam_proses'::status_penanganan_t
    when 1 then 'dirujuk'::status_penanganan_t
    else        'selesai'::status_penanganan_t
  end,
  (n % 3 = 0),
  case when n % 3 = 0
       then 'SIMFONI-' || kode_pos || '-' || to_char(tanggal_mulai, 'MMDD') end,
  case when n % 3 = 0 then tanggal_mulai + 2 end,
  case when n % 3 = 0 then 'Petugas Uji' end,
  case when n % 3 <> 0
       then 'Belum diinput karena kendala jaringan dan antrean verifikasi' end,
  case when n % 3 <> 0 then 'Kendala jaringan' end
from baris;

-- 4.5 Publikasi media sosial
with baris as (
  select l.id, row_number() over (order by l.pos_id, l.periode_id) as n,
         p.kode_pos, pr.tanggal_mulai
  from laporan l
  join pos_sapa p on p.id = l.pos_id
  join periode pr on pr.id = l.periode_id
  where l.jenis_laporan = 'publikasi'
    and p.kode_pos like 'UJI-%'
    and not exists (select 1 from laporan_publikasi x where x.laporan_id = l.id)
)
insert into laporan_publikasi (
  laporan_id, tanggal_publikasi, kegiatan, platform, nama_akun, link_publikasi, file_publikasi
)
select
  id,
  tanggal_mulai + (n % 5)::int,
  'Dokumentasi kegiatan Pos SAPA',
  case n % 6
    when 0 then 'Instagram'
    when 1 then 'Facebook'
    when 2 then 'Tik Tok'
    when 3 then 'YouTube'
    when 4 then 'Website Resmi'
    else        'Lainnya'
  end,
  '@possapa_uji_' || lower(kode_pos),
  'https://contoh.go.id/publikasi/' || lower(kode_pos) || '-' || to_char(tanggal_mulai, 'MMDD'),
  null
from baris;

-- =============================================================================
-- 5. VERIFIKASI
-- =============================================================================

-- 5.1 Jumlah laporan per jenis dan status
select jenis_laporan, status, count(*) as jumlah
from laporan l
join pos_sapa p on p.id = l.pos_id
where p.kode_pos like 'UJI-%'
group by jenis_laporan, status
order by jenis_laporan, status;

-- 5.2 Kepatuhan per periode (hanya pos aktif ber-kode UJI)
select
  pr.label,
  count(*) as total_pos,
  count(*) filter (where coalesce(jml.jenis_terkirim, 0) = 5) as lengkap,
  count(*) filter (where coalesce(jml.jenis_terkirim, 0) between 1 and 4) as sebagian,
  count(*) filter (where coalesce(jml.jenis_terkirim, 0) = 0) as belum_melapor
from periode pr
cross join pos_sapa p
left join (
  select pos_id, periode_id, count(*) as jenis_terkirim
  from laporan
  where status <> 'draf'
  group by pos_id, periode_id
) jml on jml.pos_id = p.id and jml.periode_id = pr.id
where p.status_aktif and p.kode_pos like 'UJI-%'
group by pr.id, pr.label, pr.tanggal_mulai
order by pr.tanggal_mulai;

-- 5.3 Pos yang belum melapor pada periode terakhir
select w.provinsi, w.kab_kota, p.nama_lokasi
from pos_sapa p
join wilayah w on w.id = p.wilayah_id
where p.kode_pos like 'UJI-%'
  and p.status_aktif
  and not exists (
    select 1 from laporan l
    where l.pos_id = p.id
      and l.status <> 'draf'
      and l.periode_id = (select id from periode order by tanggal_mulai desc limit 1)
  )
order by w.provinsi, w.kab_kota, p.nama_lokasi;

-- 5.4 Cuplikan view publik (dipakai halaman beranda)
select provinsi, kab_kota, jumlah_pos_aktif, jumlah_pos_melapor,
       total_anak, total_perempuan, total_aduan
from publik_ringkasan
order by provinsi, kab_kota;

-- 5.5 Akun uji yang tersedia
select p.email, p.peran, w.kab_kota, p.aktif
from pengguna p
left join wilayah w on w.id = p.wilayah_id
where p.email like '%@kemenpppa.go.id'
order by p.peran, p.email;

-- 5.6 Pemeriksaan integritas: setiap laporan uji wajib punya baris detail.
--     Bila gagal, insert detail di bagian 4 tidak lengkap — jalankan ulang
--     berkas ini (semua insert aman diulang).
do $$
declare
  v_hilang integer;
begin
  select count(*) into v_hilang
  from laporan l
  join pos_sapa p on p.id = l.pos_id
  where p.kode_pos like 'UJI-%'
    and (
      (l.jenis_laporan = 'aktivitas_anak'
        and not exists (select 1 from laporan_anak x where x.laporan_id = l.id))
      or (l.jenis_laporan = 'aktivitas_perempuan'
        and not exists (select 1 from laporan_perempuan x where x.laporan_id = l.id))
      or (l.jenis_laporan = 'rekap_pengaduan'
        and not exists (select 1 from laporan_rekap_pengaduan x where x.laporan_id = l.id))
      or (l.jenis_laporan = 'tindak_lanjut_kasus'
        and not exists (select 1 from laporan_kasus x where x.laporan_id = l.id))
      or (l.jenis_laporan = 'publikasi'
        and not exists (select 1 from laporan_publikasi x where x.laporan_id = l.id))
    );

  if v_hilang <> 0 then
    raise exception 'Seed data uji gagal: % laporan tidak punya baris detail', v_hilang;
  end if;
end $$;

-- =============================================================================
-- 6. MEMBERSIHKAN DATA UJI (jalankan manual bila sudah tidak diperlukan)
--    Detail laporan ikut terhapus lewat "on delete cascade".
--    JANGAN jalankan bila ada Pos SAPA asli yang memakai kode_pos berawalan UJI-.
-- =============================================================================
-- delete from laporan
-- where pos_id in (select id from pos_sapa where kode_pos like 'UJI-%');
--
-- delete from pos_sapa where kode_pos like 'UJI-%';
--
-- delete from auth.users where email in (
--   'adminpusat@kemenpppa.go.id',
--   'pimpinan@kemenpppa.go.id',
--   'adminkab.acehtamiang@kemenpppa.go.id',
--   'adminkab.langkat@kemenpppa.go.id',
--   'adminkab.agam@kemenpppa.go.id'
-- );

-- =============================================================================
-- CONTOH PENGISIAN KOORDINAT (Fase 3)
-- Ambil lat,lng dari Google Maps: klik kanan titik -> klik angka koordinat.
-- =============================================================================
-- update pos_sapa set lat = 5.1801, lng = 97.1503
-- where kode_pos = 'UJI-01';
