-- =============================================================================
-- Petugas boleh mengelola lokasi Pos SAPA di kabupaten/kota-nya sendiri
--
-- Sebelumnya hanya Admin Pusat yang boleh menulis ke pos_sapa, sehingga
-- petugas tidak dapat menambahkan lokasi baru di wilayahnya dari dashboard.
-- Revisi ini memberi petugas hak CRUD lokasi TERBATAS pada wilayahnya.
--
-- Catatan:
--   - FK laporan.pos_id -> pos_sapa on delete restrict tetap mencegah lokasi
--     yang sudah punya laporan terhapus.
--   - Policy bersifat permissive (OR), jadi policy admin pusat tetap berlaku.
-- =============================================================================

-- Baca: petugas melihat semua lokasi di wilayahnya, termasuk yang nonaktif
-- (policy publik pos_sapa_baca_aktif hanya menampilkan yang aktif).
create policy pos_sapa_baca_petugas on pos_sapa
  for select to authenticated
  using (
    auth_peran() = 'petugas'
    and wilayah_id = auth_wilayah_id()
  );

-- Tambah: hanya untuk wilayah petugas sendiri.
create policy pos_sapa_tulis_petugas on pos_sapa
  for insert to authenticated
  with check (
    auth_peran() = 'petugas'
    and wilayah_id = auth_wilayah_id()
  );

-- Ubah: hanya lokasi di wilayah petugas, dan hasil ubahan tetap di wilayahnya
-- (mencegah pemindahan lokasi ke wilayah lain lewat update).
create policy pos_sapa_ubah_petugas on pos_sapa
  for update to authenticated
  using (
    auth_peran() = 'petugas'
    and wilayah_id = auth_wilayah_id()
  )
  with check (
    auth_peran() = 'petugas'
    and wilayah_id = auth_wilayah_id()
  );

-- Hapus: hanya lokasi di wilayah petugas sendiri.
create policy pos_sapa_hapus_petugas on pos_sapa
  for delete to authenticated
  using (
    auth_peran() = 'petugas'
    and wilayah_id = auth_wilayah_id()
  );
