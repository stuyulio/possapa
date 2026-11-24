-- =============================================================================
-- Seed: data master wilayah sasaran (18 kabupaten/kota)
-- Sumber: KAK Dashboard Capaian Kinerja Pos SAPA
-- Lokasi Pos SAPA sengaja TIDAK di-seed — diisi manual oleh Admin Pusat.
-- =============================================================================

insert into wilayah (provinsi, kab_kota, kode_kemendagri) values
  ('Aceh',           'Pidie Jaya',        '11.18'),
  ('Aceh',           'Aceh Timur',        '11.03'),
  ('Aceh',           'Aceh Utara',        '11.08'),
  ('Aceh',           'Bener Meriah',      '11.17'),
  ('Aceh',           'Aceh Tengah',       '11.04'),
  ('Aceh',           'Gayo Lues',         '11.13'),
  ('Aceh',           'Nagan Raya',        '11.15'),
  ('Aceh',           'Aceh Tamiang',      '11.16'),

  ('Sumatera Utara', 'Langkat',           '12.05'),
  ('Sumatera Utara', 'Tapanuli Selatan',  '12.03'),
  ('Sumatera Utara', 'Tapanuli Tengah',   '12.01'),
  ('Sumatera Utara', 'Tapanuli Utara',    '12.02'),
  ('Sumatera Utara', 'Kota Sibolga',      '12.73'),

  ('Sumatera Barat', 'Agam',              '13.06'),
  ('Sumatera Barat', 'Padang Pariaman',   '13.05'),
  ('Sumatera Barat', 'Tanah Datar',       '13.04'),
  ('Sumatera Barat', 'Solok',             '13.02'),
  ('Sumatera Barat', 'Kota Padang',       '13.71')
on conflict (provinsi, kab_kota) do nothing;

-- Verifikasi: harus 18 baris
do $$
declare
  jumlah integer;
begin
  select count(*) into jumlah from wilayah;
  if jumlah <> 18 then
    raise exception 'Seed wilayah gagal: % baris, seharusnya 18', jumlah;
  end if;
end;
$$;
