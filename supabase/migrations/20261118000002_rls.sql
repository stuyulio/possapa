-- =============================================================================
-- Row Level Security
-- Aturan akses dipaksakan di database, bukan di UI.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: membaca profil pengguna aktif tanpa memicu rekursi RLS pada `pengguna`
-- security definer menjalankan fungsi sebagai pemilik, melewati RLS.
-- -----------------------------------------------------------------------------
create or replace function auth_peran()
returns peran_t
language sql
stable
security definer
set search_path = public
as $$
  select peran from pengguna where id = auth.uid() and aktif = true;
$$;

create or replace function auth_pos_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select pos_id from pengguna where id = auth.uid() and aktif = true;
$$;

create or replace function auth_wilayah_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select wilayah_id from pengguna where id = auth.uid() and aktif = true;
$$;

revoke execute on function auth_peran, auth_pos_id, auth_wilayah_id from public;
grant execute on function auth_peran, auth_pos_id, auth_wilayah_id to authenticated;

-- -----------------------------------------------------------------------------
-- Aktifkan RLS
-- -----------------------------------------------------------------------------
alter table wilayah                 enable row level security;
alter table pos_sapa                enable row level security;
alter table periode                 enable row level security;
alter table pengguna                enable row level security;
alter table laporan                 enable row level security;
alter table laporan_anak            enable row level security;
alter table laporan_perempuan       enable row level security;
alter table laporan_rekap_pengaduan enable row level security;
alter table laporan_kasus           enable row level security;
alter table laporan_publikasi       enable row level security;
alter table audit_log               enable row level security;

-- =============================================================================
-- DATA MASTER
-- =============================================================================

-- wilayah: semua orang boleh membaca (dipakai untuk filter & peta publik)
create policy wilayah_baca_semua on wilayah
  for select using (true);

create policy wilayah_kelola_admin_pusat on wilayah
  for all to authenticated
  using (auth_peran() = 'admin_pusat')
  with check (auth_peran() = 'admin_pusat');

-- pos_sapa: publik boleh membaca yang aktif; admin pusat mengelola
create policy pos_sapa_baca_aktif on pos_sapa
  for select using (status_aktif = true);

create policy pos_sapa_kelola_admin_pusat on pos_sapa
  for all to authenticated
  using (auth_peran() = 'admin_pusat')
  with check (auth_peran() = 'admin_pusat');

-- periode: semua boleh membaca; admin pusat mengelola
create policy periode_baca_semua on periode
  for select using (true);

create policy periode_kelola_admin_pusat on periode
  for all to authenticated
  using (auth_peran() = 'admin_pusat')
  with check (auth_peran() = 'admin_pusat');

-- =============================================================================
-- PENGGUNA
-- =============================================================================

-- pengguna melihat profilnya sendiri
create policy pengguna_baca_diri on pengguna
  for select to authenticated
  using (id = auth.uid());

-- admin pusat melihat dan mengelola semua pengguna
create policy pengguna_kelola_admin_pusat on pengguna
  for all to authenticated
  using (auth_peran() = 'admin_pusat')
  with check (auth_peran() = 'admin_pusat');

-- admin kab/kota melihat pengguna di wilayahnya
create policy pengguna_baca_wilayah on pengguna
  for select to authenticated
  using (
    auth_peran() = 'admin_kabkota'
    and wilayah_id = auth_wilayah_id()
  );

-- =============================================================================
-- LAPORAN
-- =============================================================================
-- Matriks hak:
--   petugas        : CRUD laporan milik pos-nya sendiri
--   admin_kabkota  : baca semua; verifikasi & ubah laporan di wilayahnya
--   admin_pusat    : semua
--   pimpinan       : baca semua (read-only)
--   anon / publik  : tidak boleh membaca tabel mentah sama sekali

create policy laporan_baca_petugas on laporan
  for select to authenticated
  using (auth_peran() = 'petugas' and pos_id = auth_pos_id());

create policy laporan_tulis_petugas on laporan
  for insert to authenticated
  with check (
    auth_peran() = 'petugas'
    and pos_id = auth_pos_id()
    and status in ('draf', 'terkirim')
  );

create policy laporan_ubah_petugas on laporan
  for update to authenticated
  using (
    auth_peran() = 'petugas'
    and pos_id = auth_pos_id()
    and status in ('draf', 'terkirim')
  )
  with check (
    auth_peran() = 'petugas'
    and pos_id = auth_pos_id()
  );

-- Admin Kab/Kota boleh MEMBACA laporan seluruh wilayah (keputusan PRD §15 №3),
-- tetapi hanya boleh MEMVERIFIKASI/ MENGUBAH laporan di wilayahnya sendiri.
create policy laporan_baca_admin_kab on laporan
  for select to authenticated
  using (auth_peran() = 'admin_kabkota');

create policy laporan_verifikasi_admin_kab on laporan
  for update to authenticated
  using (
    auth_peran() = 'admin_kabkota'
    and exists (
      select 1 from pos_sapa p
      where p.id = laporan.pos_id
        and p.wilayah_id = auth_wilayah_id()
    )
  )
  with check (
    auth_peran() = 'admin_kabkota'
    and exists (
      select 1 from pos_sapa p
      where p.id = laporan.pos_id
        and p.wilayah_id = auth_wilayah_id()
    )
  );

create policy laporan_penuh_admin_pusat on laporan
  for all to authenticated
  using (auth_peran() = 'admin_pusat')
  with check (auth_peran() = 'admin_pusat');

create policy laporan_baca_pimpinan on laporan
  for select to authenticated
  using (auth_peran() = 'pimpinan');

-- =============================================================================
-- TABEL DETAIL — hak mengikuti laporan induknya
-- =============================================================================

-- Baca detail: petugas (pos sendiri), admin_kabkota (SEMUA wilayah),
--               admin_pusat & pimpinan (semua)
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
    where l.id = target_laporan_id
      and (
        (auth_peran() = 'petugas' and l.pos_id = auth_pos_id())
        or auth_peran() in ('admin_kabkota', 'admin_pusat', 'pimpinan')
      )
  );
$$;

-- Tulis detail: petugas (pos sendiri & laporan belum terverifikasi),
--               admin_kabkota (hanya wilayahnya), admin_pusat (semua).
--               pimpinan TIDAK boleh menulis.
create or replace function boleh_tulis_laporan(target_laporan_id uuid)
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
        (auth_peran() = 'petugas'
          and l.pos_id = auth_pos_id()
          and l.status in ('draf', 'terkirim'))
        or (auth_peran() = 'admin_kabkota'
          and p.wilayah_id = auth_wilayah_id())
        or auth_peran() = 'admin_pusat'
      )
  );
$$;

revoke execute on function boleh_baca_laporan, boleh_tulis_laporan from public;
grant execute on function boleh_baca_laporan, boleh_tulis_laporan to authenticated;

create policy anak_baca on laporan_anak
  for select to authenticated
  using (boleh_baca_laporan(laporan_id));

create policy anak_tulis on laporan_anak
  for all to authenticated
  using (boleh_tulis_laporan(laporan_id))
  with check (boleh_tulis_laporan(laporan_id));

create policy perempuan_baca on laporan_perempuan
  for select to authenticated
  using (boleh_baca_laporan(laporan_id));

create policy perempuan_tulis on laporan_perempuan
  for all to authenticated
  using (boleh_tulis_laporan(laporan_id))
  with check (boleh_tulis_laporan(laporan_id));

create policy rekap_baca on laporan_rekap_pengaduan
  for select to authenticated
  using (boleh_baca_laporan(laporan_id));

create policy rekap_tulis on laporan_rekap_pengaduan
  for all to authenticated
  using (boleh_tulis_laporan(laporan_id))
  with check (boleh_tulis_laporan(laporan_id));

-- kasus: pimpinan boleh baca, tidak boleh ubah (sudah ditangani boleh_tulis_laporan)
create policy kasus_baca on laporan_kasus
  for select to authenticated
  using (boleh_baca_laporan(laporan_id));

create policy kasus_tulis on laporan_kasus
  for all to authenticated
  using (boleh_tulis_laporan(laporan_id))
  with check (boleh_tulis_laporan(laporan_id));

create policy publikasi_baca on laporan_publikasi
  for select to authenticated
  using (boleh_baca_laporan(laporan_id));

create policy publikasi_tulis on laporan_publikasi
  for all to authenticated
  using (boleh_tulis_laporan(laporan_id))
  with check (boleh_tulis_laporan(laporan_id));

-- =============================================================================
-- AUDIT LOG — hanya admin pusat yang membaca; penulisan lewat fungsi server
-- =============================================================================

create policy audit_baca_admin_pusat on audit_log
  for select to authenticated
  using (auth_peran() = 'admin_pusat');

-- =============================================================================
-- VIEW PUBLIK — agregat tanpa data sensitif
-- =============================================================================

-- View dijalankan dengan hak pemilik sehingga melewati RLS tabel dasar.
-- Hanya kolom agregat yang diekspos, tanpa kode kasus maupun narasi korban.
create or replace view publik_ringkasan
with (security_invoker = false)
as
select
  w.provinsi,
  w.kab_kota,
  count(distinct ps.id) filter (where ps.status_aktif)              as jumlah_pos_aktif,
  count(distinct l.pos_id) filter (where l.status <> 'draf')        as jumlah_pos_melapor,
  coalesce(sum(la.usia_0_5 + la.usia_6_12 + la.usia_13_17), 0)      as total_anak,
  coalesce(sum(lp.total_ikut), 0)                                   as total_perempuan,
  coalesce(sum(la.disabilitas), 0)                                  as total_anak_disabilitas,
  coalesce(sum(lr.aduan_masuk), 0)                                  as total_aduan,
  coalesce(sum(lr.sudah_ditindaklanjuti), 0)                        as total_aduan_ditindaklanjuti,
  coalesce(sum(lr.tercatat_simfoni), 0)                             as total_aduan_simfoni,
  count(distinct lpub.laporan_id)                                   as total_publikasi
from wilayah w
left join pos_sapa ps      on ps.wilayah_id = w.id
-- Laporan berstatus draf tidak dihitung dalam capaian publik.
left join laporan l        on l.pos_id = ps.id and l.status <> 'draf'
left join laporan_anak la        on la.laporan_id = l.id
left join laporan_perempuan lp   on lp.laporan_id = l.id
left join laporan_rekap_pengaduan lr on lr.laporan_id = l.id
left join laporan_publikasi lpub on lpub.laporan_id = l.id
group by w.provinsi, w.kab_kota;

revoke all on publik_ringkasan from anon, authenticated;
grant select on publik_ringkasan to anon, authenticated;
