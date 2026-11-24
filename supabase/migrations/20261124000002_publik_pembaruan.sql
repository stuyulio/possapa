-- =============================================================================
-- Timestamp pembaruan untuk halaman publik (PRD Fase 3)
--
-- Halaman publik memakai client anon dan tidak boleh membaca tabel `laporan`
-- secara langsung (RLS menolaknya). Untuk menampilkan "data diperbarui ...",
-- dibutuhkan satu angka agregat saja: waktu ubah terakhir laporan non-draf.
--
-- View ini security_invoker = false, sehingga berjalan dengan hak pemilik
-- (postgres) dan hanya membuka satu kolom agregat — tidak ada baris mentah,
-- tidak ada identitas, tidak ada data kasus.
-- =============================================================================

create or replace view publik_pembaruan
with (security_invoker = false)
as
select
  -- Hanya laporan non-draf: draf belum dipublikasikan, waktunya tidak boleh
  -- ikut terekspos ke anon.
  max(l.updated_at) filter (where l.status <> 'draf')      as terakhir_diperbarui,
  count(*) filter (where l.status <> 'draf')               as jumlah_laporan,
  count(*) filter (where l.status = 'terverifikasi')       as jumlah_terverifikasi
from laporan l;

revoke all on publik_pembaruan from anon, authenticated;
grant select on publik_pembaruan to anon, authenticated;

comment on view publik_pembaruan is
  'Satu baris agregat: waktu ubah laporan terakhir dan jumlah laporan. '
  'Dipakai halaman publik untuk menampilkan timestamp pembaruan.';
