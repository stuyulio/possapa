-- =============================================================================
-- Seed: periode pelaporan mingguan
-- Pola: Jumat s/d Kamis (7 hari), mulai Jumat 23 Oktober 2026
--       sampai Kamis 3 Desember 2026.
--
--   #  tanggal_mulai  tanggal_selesai
--   1  2026-10-23     2026-10-29
--   2  2026-10-30     2026-11-05
--   3  2026-11-06     2026-11-12
--   4  2026-11-13     2026-11-19
--   5  2026-11-20     2026-11-26
--   6  2026-11-27     2026-12-03
--
-- Aman dijalankan berulang: unique (tanggal_mulai, tanggal_selesai) + do nothing.
-- =============================================================================

-- Sengaja memakai aritmetika integer pada type date (bukan generate_series
-- dengan interval), supaya tidak ada konversi ke timestamptz yang bergantung
-- pada setting TimeZone sesi.
insert into periode (tanggal_mulai, tanggal_selesai)
select
  date '2026-10-23' + n,       -- Jumat pertama + kelipatan 7 hari
  date '2026-10-23' + n + 6    -- Kamis (hari ke-7)
from generate_series(0, 35, 7) as n   -- 0,7,14,21,28,35 → 6 periode
on conflict (tanggal_mulai, tanggal_selesai) do nothing;

-- Verifikasi: hanya memeriksa 6 baris yang menjadi tanggung jawab seed ini.
-- Periode lain di rentang yang sama (mis. dibuat manual lewat admin) diabaikan.
do $$
declare
  hilang integer;
begin
  select count(*) into hilang
  from generate_series(0, 35, 7) as n
  where not exists (
    select 1
    from periode p
    where p.tanggal_mulai   = date '2026-10-23' + n
      and p.tanggal_selesai = date '2026-10-23' + n + 6
  );

  if hilang <> 0 then
    raise exception 'Seed periode gagal: % dari 6 periode tidak ditemukan', hilang;
  end if;
end;
$$;
