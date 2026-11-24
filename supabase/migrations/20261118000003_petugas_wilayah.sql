-- =============================================================================
-- Revisi: satu akun petugas per kabupaten/kota
--
-- Sebelumnya petugas terikat ke satu Pos SAPA (pos_id).
-- Sekarang petugas terikat ke satu kabupaten/kota (wilayah_id) dan memilih
-- lokasi Pos SAPA saat menginput laporan. Satu wilayah boleh punya beberapa
-- lokasi Pos SAPA (Huntap/Huntara).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Pindahkan penugasan lama: pos_id -> wilayah_id
-- -----------------------------------------------------------------------------
update pengguna p
set wilayah_id = ps.wilayah_id
from pos_sapa ps
where p.peran = 'petugas'
  and p.pos_id = ps.id
  and p.wilayah_id is null;

-- -----------------------------------------------------------------------------
-- 2. Ganti constraint
-- -----------------------------------------------------------------------------
alter table pengguna drop constraint if exists pengguna_petugas_punya_pos;

-- petugas wajib terikat ke satu wilayah
alter table pengguna
  add constraint pengguna_petugas_punya_wilayah
  check (peran <> 'petugas' or wilayah_id is not null);

-- pos_id tidak lagi dipakai; pastikan NULL untuk semua peran.
-- (kolom dipertahankan agar riwayat tidak hilang, tetapi tidak dibaca kode.)
update pengguna set pos_id = null where pos_id is not null;

comment on column pengguna.pos_id is
  'Tidak dipakai sejak revisi 2026-11-18. Petugas terikat ke wilayah_id, '
  'bukan ke satu Pos SAPA. Kolom dipertahankan untuk kompatibilitas.';

-- -----------------------------------------------------------------------------
-- 3. Perbarui helper RLS
-- -----------------------------------------------------------------------------

-- Baca detail laporan: petugas hanya laporan di wilayahnya.
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
    join pos_sapa ps on ps.id = l.pos_id
    where l.id = target_laporan_id
      and (
        (auth_peran() = 'petugas' and ps.wilayah_id = auth_wilayah_id())
        or auth_peran() in ('admin_kabkota', 'admin_pusat', 'pimpinan')
      )
  );
$$;

-- Tulis detail laporan: petugas hanya pos di wilayahnya dan laporan belum
-- terverifikasi; admin kab/kota hanya wilayahnya; admin pusat semua.
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
    join pos_sapa ps on ps.id = l.pos_id
    where l.id = target_laporan_id
      and (
        (auth_peran() = 'petugas'
          and ps.wilayah_id = auth_wilayah_id()
          and l.status in ('draf', 'terkirim'))
        or (auth_peran() = 'admin_kabkota'
          and ps.wilayah_id = auth_wilayah_id())
        or auth_peran() = 'admin_pusat'
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- 4. Perbarui policy pada tabel laporan
-- -----------------------------------------------------------------------------
drop policy if exists laporan_baca_petugas  on laporan;
drop policy if exists laporan_tulis_petugas on laporan;
drop policy if exists laporan_ubah_petugas  on laporan;

-- petugas membaca laporan di wilayahnya
create policy laporan_baca_petugas on laporan
  for select to authenticated
  using (
    auth_peran() = 'petugas'
    and exists (
      select 1 from pos_sapa ps
      where ps.id = laporan.pos_id
        and ps.wilayah_id = auth_wilayah_id()
    )
  );

-- petugas membuat laporan untuk pos mana pun di wilayahnya
create policy laporan_tulis_petugas on laporan
  for insert to authenticated
  with check (
    auth_peran() = 'petugas'
    and status in ('draf', 'terkirim')
    and exists (
      select 1 from pos_sapa ps
      where ps.id = laporan.pos_id
        and ps.wilayah_id = auth_wilayah_id()
    )
  );

-- petugas mengubah laporan di wilayahnya selama belum terverifikasi
create policy laporan_ubah_petugas on laporan
  for update to authenticated
  using (
    auth_peran() = 'petugas'
    and status in ('draf', 'terkirim')
    and exists (
      select 1 from pos_sapa ps
      where ps.id = laporan.pos_id
        and ps.wilayah_id = auth_wilayah_id()
    )
  )
  with check (
    auth_peran() = 'petugas'
    and exists (
      select 1 from pos_sapa ps
      where ps.id = laporan.pos_id
        and ps.wilayah_id = auth_wilayah_id()
    )
  );
