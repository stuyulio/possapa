-- =============================================================================
-- Tutup celah: petugas bisa memverifikasi laporannya sendiri
--
-- MASALAH
--   Policy `laporan_ubah_petugas` (migrasi 20261118000003) membatasi baris
--   LAMA dengan `status in ('draf','terkirim')`, tetapi klausa WITH CHECK
--   untuk baris BARU tidak membatasi status. Akibatnya petugas dapat:
--
--     update laporan set status = 'terverifikasi',
--                         verified_by = <dirinya sendiri>
--     where id = <laporannya>;
--
--   dan RLS meloloskannya. Constraint database hanya mewajibkan
--   `verified_by is not null` — tidak memeriksa siapa pengisinya. Artinya
--   verifikasi mandiri tidak terdeteksi di lapisan mana pun.
--
-- PERBAIKAN
--   WITH CHECK kini mensyaratkan status hasil ubahan tetap 'draf' atau
--   'terkirim'. Petugas tidak bisa menaikkan status ke 'terverifikasi';
--   hanya admin_kabkota (wilayahnya) dan admin_pusat yang boleh.
--
-- CATATAN
--   Policy ini hanya berlaku untuk peran 'petugas'. Admin kab/kota dan admin
--   pusat memakai policy terpisah di 20261118000002_rls.sql, yang tidak
--   dibatasi status — memang demikian yang diinginkan.
--
--   Idempoten: `drop policy if exists` lalu `create policy`.
-- =============================================================================

drop policy if exists laporan_ubah_petugas on laporan;

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
    -- Baris hasil ubahan juga harus tetap draf/terkirim. Tanpa klausa ini,
    -- petugas dapat menaikkan statusnya sendiri menjadi terverifikasi.
    and status in ('draf', 'terkirim')
    and exists (
      select 1 from pos_sapa ps
      where ps.id = laporan.pos_id
        and ps.wilayah_id = auth_wilayah_id()
    )
  );

-- =============================================================================
-- Verifikasi: pastikan klausa status ikut terbawa di WITH CHECK.
-- =============================================================================
do $$
declare
  v_def text;
begin
  select pg_get_expr(polqual, polrelid) || ' | ' || pg_get_expr(polwithcheck, polrelid)
  into v_def
  from pg_policy
  where polname = 'laporan_ubah_petugas'
    and polrelid = 'laporan'::regclass;

  if v_def is null then
    raise exception 'Policy laporan_ubah_petugas tidak ditemukan';
  end if;

  -- WITH CHECK harus memuat pembatasan status; bila tidak, celah masih terbuka.
  if position('terkirim' in split_part(v_def, ' | ', 2)) = 0 then
    raise exception
      'WITH CHECK laporan_ubah_petugas belum membatasi status: %', v_def;
  end if;
end;
$$;
