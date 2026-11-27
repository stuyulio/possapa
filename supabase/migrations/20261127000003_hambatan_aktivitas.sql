-- =============================================================================
-- Hambatan/Kendala pada Aktivitas Anak dan Aktivitas Perempuan
-- =============================================================================
--
-- Permintaan pemilik produk (27 Nov 2026): kedua jenis laporan itu ditutup
-- dengan satu kolom teks bebas "Hambatan/Kendala", seperti yang sudah ada pada
-- Tindak Lanjut Kasus.
--
-- OPSIONAL DAN TANPA CONSTRAINT ISI. Petugas yang tidak menemui kendala memang
-- tidak punya apa pun untuk ditulis; memaksa mengisi akan menghasilkan "-" yang
-- tidak membedakan "tidak ada hambatan" dari "tidak diperiksa".
--
-- TIDAK MASUK VIEW ANOMALI. Kolom ini narasi, bukan hitungan, jadi tidak ada
-- yang bisa diperiksa silang. View `anomali_laporan` sengaja tidak disentuh.
--
-- IDEMPOTEN. Menjalankan ulang hanya menambahkan 0 kolom.

alter table laporan_anak      add column if not exists hambatan text;
alter table laporan_perempuan add column if not exists hambatan text;

comment on column laporan_anak.hambatan is
  'Hambatan/kendala yang dihadapi selama kegiatan anak. Opsional; NULL untuk '
  'laporan sebelum 27 Nov 2026 dan baris impor Google Form.';
comment on column laporan_perempuan.hambatan is
  'Hambatan/kendala yang dihadapi selama kegiatan perempuan. Opsional; NULL '
  'untuk laporan sebelum 27 Nov 2026 dan baris impor Google Form.';

-- Migrasi yang "sukses" tetapi kolomnya tidak ada akan membuat penyimpanan
-- ditolak, dan gejalanya baru terlihat saat petugas mengirim laporan.
do $$
declare
  v_jumlah integer;
begin
  select count(*) into v_jumlah
  from information_schema.columns
  where table_schema = 'public'
    and column_name = 'hambatan'
    and table_name in ('laporan_anak', 'laporan_perempuan');

  if v_jumlah <> 2 then
    raise exception 'Kolom hambatan belum lengkap di laporan_anak/laporan_perempuan (%)', v_jumlah;
  end if;
end $$;
