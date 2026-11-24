-- =============================================================================
-- Dashboard Capaian Kinerja Pos SAPA — Skema Awal
-- Fase 0
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- ENUM
-- =============================================================================
create type jenis_laporan_t as enum (
  'aktivitas_anak',
  'aktivitas_perempuan',
  'rekap_pengaduan',
  'tindak_lanjut_kasus',
  'publikasi'
);

create type peran_t as enum (
  'petugas',
  'admin_kabkota',
  'admin_pusat',
  'pimpinan'
);

create type status_laporan_t as enum (
  'draf',
  'terkirim',
  'terverifikasi'
);

create type sumber_input_t as enum (
  'form_internal',
  'google_form'
);

create type jenis_hunian_t as enum (
  'huntap',
  'huntara'
);

create type kategori_kasus_t as enum (
  'kekerasan',
  'non_kekerasan'
);

create type status_penanganan_t as enum (
  'dalam_proses',
  'dirujuk',
  'selesai'
);

-- =============================================================================
-- DATA MASTER
-- =============================================================================

create table wilayah (
  id               uuid primary key default gen_random_uuid(),
  provinsi         text not null,
  kab_kota         text not null,
  kode_kemendagri  text,
  created_at       timestamptz not null default now(),
  unique (provinsi, kab_kota)
);

comment on table wilayah is
  '18 kabupaten/kota sasaran. Referensi tetap, bukan input bebas.';

create table pos_sapa (
  id                uuid primary key default gen_random_uuid(),
  wilayah_id        uuid not null references wilayah(id) on delete restrict,
  nama_lokasi       text not null,
  kode_pos          text,
  jenis_hunian      jenis_hunian_t,
  lat               double precision,
  lng               double precision,
  status_aktif      boolean not null default true,
  penanggung_jawab  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (wilayah_id, nama_lokasi),
  constraint pos_sapa_koordinat_lengkap check (
    (lat is null and lng is null) or (lat is not null and lng is not null)
  ),
  constraint pos_sapa_lat_valid check (lat is null or lat between -11 and 6),
  constraint pos_sapa_lng_valid check (lng is null or lng between 95 and 141)
);

comment on table pos_sapa is
  'Lokasi Pos SAPA di kawasan Huntap/Huntara. Diisi manual oleh admin pusat.';

create table periode (
  id             uuid primary key default gen_random_uuid(),
  tanggal_mulai  date not null,
  tanggal_selesai date not null,
  -- Label dibangun dari extract(), BUKAN to_char().
  -- to_char bergantung pada locale (lc_time) sehingga hanya STABLE,
  -- sedangkan generated column mensyaratkan ekspresi IMMUTABLE.
  label          text generated always as (
                   lpad(extract(year  from tanggal_mulai)::int::text, 4, '0') || '-' ||
                   lpad(extract(month from tanggal_mulai)::int::text, 2, '0') || '-' ||
                   lpad(extract(day   from tanggal_mulai)::int::text, 2, '0') || ' s/d ' ||
                   lpad(extract(year  from tanggal_selesai)::int::text, 4, '0') || '-' ||
                   lpad(extract(month from tanggal_selesai)::int::text, 2, '0') || '-' ||
                   lpad(extract(day   from tanggal_selesai)::int::text, 2, '0')
                 ) stored,
  created_at     timestamptz not null default now(),
  constraint periode_urutan check (tanggal_mulai <= tanggal_selesai),
  unique (tanggal_mulai, tanggal_selesai)
);

comment on table periode is
  'Periode pelaporan disimpan sebagai tanggal, bukan teks bebas. '
  'Label diturunkan otomatis untuk tampilan.';

-- =============================================================================
-- PENGGUNA — profil melengkapi auth.users
-- =============================================================================

create table pengguna (
  id          uuid primary key references auth.users(id) on delete cascade,
  nama        text not null,
  email       text not null,
  peran       peran_t not null default 'petugas',
  pos_id      uuid references pos_sapa(id) on delete set null,
  wilayah_id  uuid references wilayah(id) on delete set null,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- petugas wajib terikat ke satu lokasi
  constraint pengguna_petugas_punya_pos check (
    peran <> 'petugas' or pos_id is not null
  ),
  -- admin kab/kota wajib terikat ke satu wilayah
  constraint pengguna_admin_kab_punya_wilayah check (
    peran <> 'admin_kabkota' or wilayah_id is not null
  )
);

create index pengguna_pos_idx on pengguna(pos_id);
create index pengguna_wilayah_idx on pengguna(wilayah_id);
create index pengguna_peran_idx on pengguna(peran);

-- =============================================================================
-- LAPORAN — induk untuk lima jenis laporan
-- =============================================================================

create table laporan (
  id                uuid primary key default gen_random_uuid(),
  pos_id            uuid not null references pos_sapa(id) on delete restrict,
  periode_id        uuid not null references periode(id) on delete restrict,
  jenis_laporan     jenis_laporan_t not null,
  status            status_laporan_t not null default 'draf',
  sumber_input      sumber_input_t not null default 'form_internal',
  link_dokumentasi  text,
  submitted_by      uuid references pengguna(id) on delete set null,
  submitted_at      timestamptz,
  verified_by       uuid references pengguna(id) on delete set null,
  verified_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (pos_id, periode_id, jenis_laporan),

  constraint laporan_terkirim_punya_waktu check (
    status = 'draf' or submitted_at is not null
  ),
  constraint laporan_terverifikasi_punya_verifikator check (
    status <> 'terverifikasi' or verified_by is not null
  )
);

create index laporan_pos_idx on laporan(pos_id);
create index laporan_periode_idx on laporan(periode_id);
create index laporan_jenis_idx on laporan(jenis_laporan);
create index laporan_status_idx on laporan(status);

-- =============================================================================
-- LIMA TABEL DETAIL
-- =============================================================================

create table laporan_anak (
  laporan_id              uuid primary key references laporan(id) on delete cascade,
  jumlah_kegiatan         integer not null default 1 check (jumlah_kegiatan >= 1),
  nama_kegiatan           text not null,
  jenis_kegiatan          text[] not null default '{}',
  usia_0_5                integer not null default 0 check (usia_0_5 >= 0),
  usia_6_12               integer not null default 0 check (usia_6_12 >= 0),
  usia_13_17              integer not null default 0 check (usia_13_17 >= 0),
  laki_laki               integer not null default 0 check (laki_laki >= 0),
  perempuan               integer not null default 0 check (perempuan >= 0),
  disabilitas             integer not null default 0 check (disabilitas >= 0),
  perlu_layanan_lanjutan  integer not null default 0 check (perlu_layanan_lanjutan >= 0),
  temuan                  text,
  tindak_lanjut           text
);

create table laporan_perempuan (
  laporan_id       uuid primary key references laporan(id) on delete cascade,
  jumlah_kegiatan  integer not null default 1 check (jumlah_kegiatan >= 1),
  nama_kegiatan    text not null,
  jenis_kegiatan   text,
  total_ikut       integer not null default 0 check (total_ikut >= 0),
  kepala_keluarga  integer not null default 0 check (kepala_keluarga >= 0),
  hamil_menyusui   integer not null default 0 check (hamil_menyusui >= 0),
  lansia           integer not null default 0 check (lansia >= 0),
  disabilitas      integer not null default 0 check (disabilitas >= 0),
  manfaat          text
);

create table laporan_rekap_pengaduan (
  laporan_id                uuid primary key references laporan(id) on delete cascade,
  status_bulan              text not null check (status_bulan in ('Ada aduan', 'Nihil')),
  aduan_masuk               integer not null default 0 check (aduan_masuk >= 0),
  kekerasan_perempuan       integer not null default 0 check (kekerasan_perempuan >= 0),
  kekerasan_anak            integer not null default 0 check (kekerasan_anak >= 0),
  non_kekerasan_perempuan   integer not null default 0 check (non_kekerasan_perempuan >= 0),
  non_kekerasan_anak        integer not null default 0 check (non_kekerasan_anak >= 0),
  sudah_ditindaklanjuti     integer not null default 0 check (sudah_ditindaklanjuti >= 0),
  tercatat_simfoni          integer not null default 0 check (tercatat_simfoni >= 0),
  tindak_lanjut_umum        text,
  pihak_terlibat            text,

  -- status Nihil berarti seluruh hitungan nol
  constraint rekap_nihil_nol check (
    status_bulan <> 'Nihil' or (
      aduan_masuk = 0 and kekerasan_perempuan = 0 and kekerasan_anak = 0
      and non_kekerasan_perempuan = 0 and non_kekerasan_anak = 0
      and sudah_ditindaklanjuti = 0 and tercatat_simfoni = 0
    )
  ),
  -- rincian kategori tidak boleh melebihi total
  constraint rekap_kategori_konsisten check (
    aduan_masuk >= kekerasan_perempuan + kekerasan_anak
      + non_kekerasan_perempuan + non_kekerasan_anak
  ),
  -- tidak mungkin menindaklanjuti lebih dari yang masuk
  constraint rekap_tl_tidak_melebihi check (sudah_ditindaklanjuti <= aduan_masuk),
  constraint rekap_simfoni_tidak_melebihi check (tercatat_simfoni <= aduan_masuk)
);

create table laporan_kasus (
  laporan_id             uuid primary key references laporan(id) on delete cascade,
  kode_kasus             text not null,
  tanggal_aduan          date not null,
  kategori               kategori_kasus_t not null,
  jenis_kasus            text not null,
  jumlah_korban          integer not null default 1 check (jumlah_korban >= 1),
  jenis_kelamin          text not null,
  kelompok_usia          text not null,
  disabilitas            boolean not null default false,
  kebutuhan_korban       text,
  tindak_lanjut          text,
  status_penanganan      status_penanganan_t not null default 'dalam_proses',
  sudah_simfoni          boolean not null default false,
  no_registrasi_simfoni  text,
  tanggal_input_simfoni  date,
  penginput_simfoni      text,
  alasan_belum_simfoni   text,
  hambatan               text,

  -- bila sudah tercatat, tiga field wajib terisi
  constraint kasus_simfoni_lengkap check (
    sudah_simfoni = false or (
      no_registrasi_simfoni is not null and
      tanggal_input_simfoni is not null and
      penginput_simfoni is not null
    )
  ),
  -- bila belum tercatat, alasan wajib terisi
  constraint kasus_belum_simfoni_alasan check (
    sudah_simfoni = true or alasan_belum_simfoni is not null
  )
);

create table laporan_publikasi (
  laporan_id        uuid primary key references laporan(id) on delete cascade,
  tanggal_publikasi date not null,
  kegiatan          text not null,
  platform          text not null check (platform in (
                      'Instagram', 'Facebook', 'Tik Tok', 'YouTube',
                      'Website Resmi', 'Lainnya'
                    )),
  nama_akun         text not null,
  link_publikasi    text not null,
  file_publikasi    text,

  constraint publikasi_link_https check (link_publikasi ~ '^https://')
);

-- =============================================================================
-- AUDIT LOG
-- =============================================================================

create table audit_log (
  id          bigserial primary key,
  aktor_id    uuid references pengguna(id) on delete set null,
  entitas     text not null,
  entitas_id  text not null,
  aksi        text not null,
  perubahan   jsonb,
  waktu       timestamptz not null default now()
);

create index audit_log_entitas_idx on audit_log(entitas, entitas_id);
create index audit_log_waktu_idx on audit_log(waktu desc);

-- =============================================================================
-- TRIGGER updated_at
-- =============================================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pos_sapa_updated_at  before update on pos_sapa
  for each row execute function set_updated_at();
create trigger pengguna_updated_at  before update on pengguna
  for each row execute function set_updated_at();
create trigger laporan_updated_at  before update on laporan
  for each row execute function set_updated_at();

-- =============================================================================
-- TANDAI WAKTU SUBMIT OTOMATIS
-- =============================================================================

create or replace function set_submitted_at()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'draf' and new.submitted_at is null then
    new.submitted_at = now();
  end if;
  if new.status = 'terverifikasi' and new.verified_at is null then
    new.verified_at = now();
  end if;
  return new;
end;
$$;

create trigger laporan_submitted_at before insert or update on laporan
  for each row execute function set_submitted_at();
