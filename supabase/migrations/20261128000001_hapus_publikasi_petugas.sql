-- =============================================================================
-- Petugas boleh MENGHAPUS publikasi draf
-- =============================================================================
--
-- LATAR
--   Formulir publikasi sekarang memuat beberapa publikasi sekaligus (satu
--   baris `laporan` per publikasi, lihat migrasi 20261127000004). Tombol
--   "Hapus" di formulir bekerja dengan membuang baris lama yang id-nya tidak
--   dikirim lagi — lihat `idPublikasiDibuang` di src/lib/publikasi.ts.
--
--   Tanpa policy DELETE, penghapusan itu TIDAK menghasilkan galat: RLS
--   menyaring baris sehingga `delete` mengenai nol baris, dan petugas melihat
--   "berhasil tersimpan" padahal publikasinya masih ada. Karena itu policy ini
--   bukan pelengkap tampilan — tanpa ia tombolnya bohong.
--
-- BATASAN — SENGAJA KETAT
--   Hanya `draf`. Laporan yang sudah terkirim atau terverifikasi tidak boleh
--   dihapus lewat jalur petugas: laporan terkirim adalah bahan verifikasi
--   Admin, dan yang dihapus tidak dapat dipulihkan dari `audit_log` (trigger
--   hanya mencatat perubahan, bukan menyalin isinya).
--
--   Hanya `jenis_laporan = 'publikasi'`. Empat jenis lain tetap satu baris per
--   lokasi-periode dan tidak punya tombol hapus; membuka DELETE untuk mereka
--   melebarkan wewenang tanpa ada layar yang membutuhkannya.
--
--   Cakupan wilayah sama dengan policy lain: Pos SAPA di wilayah petugas.
--   ADMIN PUSAT sudah tercakup `laporan_penuh_admin_pusat` (for all), jadi
--   tidak perlu policy tambahan di sini.
--
--   Rincian `laporan_publikasi` ikut terhapus lewat `on delete cascade` pada
--   foreign key-nya. Aksi referensial berjalan dengan hak pemilik constraint,
--   jadi RLS tabel rincian tidak menghalangi cascade.
--
-- KAPAN DIJALANKAN
--   Setelah 20261127000004_publikasi_banyak.sql. Kalau migrasi itu belum
--   dijalankan, unique (pos_id, periode_id, jenis_laporan) masih berlaku dan
--   publikasi >1 tetap ditolak — policy ini tidak akan menolong.
--
-- IDEMPOTEN: `drop policy if exists` sebelum `create policy`, jadi aman
-- dijalankan berulang.
-- =============================================================================

drop policy if exists laporan_hapus_publikasi_petugas on laporan;

create policy laporan_hapus_publikasi_petugas on laporan
  for delete to authenticated
  using (
    auth_peran() = 'petugas'
    and jenis_laporan = 'publikasi'
    and status = 'draf'
    and exists (
      select 1 from pos_sapa ps
      where ps.id = laporan.pos_id
        and ps.wilayah_id = auth_wilayah_id()
    )
  );

comment on policy laporan_hapus_publikasi_petugas on laporan is
  'Petugas boleh menghapus publikasi yang masih draf di wilayahnya — mendukung '
  'tombol Hapus pada formulir publikasi banyak-baris. Laporan terkirim dan '
  'terverifikasi tidak dapat dihapus.';

-- =============================================================================
-- VERIFIKASI
-- =============================================================================
do $$
declare
  v_policy        integer;
  v_unique_lama   integer;
begin
  select count(*) into v_policy
  from pg_policies
  where schemaname = 'public'
    and tablename  = 'laporan'
    and policyname = 'laporan_hapus_publikasi_petugas';

  if v_policy <> 1 then
    raise exception 'Policy laporan_hapus_publikasi_petugas tidak terbentuk';
  end if;

  -- Peringatan, bukan kegagalan: policy DELETE sudah benar tanpa ini, tetapi
  -- publikasi >1 tidak akan dapat disimpan. Disebut di sini supaya urutan
  -- migrasi yang tertukar langsung terlihat, bukan muncul sebagai galat
  -- "multiple rows" saat petugas menyimpan.
  select count(*) into v_unique_lama
  from pg_constraint
  where conrelid = 'laporan'::regclass
    and conname = 'laporan_pos_id_periode_id_jenis_laporan_key';

  if v_unique_lama <> 0 then
    raise warning '%',
      'Migrasi 20261127000004_publikasi_banyak.sql belum dijalankan: publikasi ' ||
      'lebih dari satu masih akan ditolak unique (pos_id, periode_id, jenis_laporan).';
  end if;
end $$;
