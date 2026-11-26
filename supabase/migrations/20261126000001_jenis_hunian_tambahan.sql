-- =============================================================================
-- Jenis hunian Pos SAPA: tambah Dinas PPPA, UPTD PPPA, dan Lainnya
--
-- KEPUTUSAN
--   Pos SAPA tidak hanya berdiri di kawasan huntap/huntara. Sebagian titik
--   berada di kantor Dinas PPPA atau UPTD PPPA, dan masih mungkin ada jenis
--   lain yang belum terpikirkan sekarang. Ketiganya ditambahkan ke pilihan
--   `jenis_hunian`; "Lainnya" membuka isian bebas yang disimpan di kolom
--   `jenis_hunian_lainnya`.
--
-- KENAPA ENUM DIGANTI TEXT + CHECK
--   `jenis_hunian_t` hanya dapat berisi nilai tetap, sehingga teks bebas untuk
--   "Lainnya" tidak mungkin disimpan di sana. Menambah nilai enum memang bisa
--   (`ALTER TYPE ... ADD VALUE`), tetapi nilai baru itu tidak boleh dipakai
--   dalam transaksi yang sama — dan SQL Editor Supabase menjalankan satu berkas
--   sebagai satu transaksi. Memeriksa constraint yang menyebut 'lainnya' akan
--   gagal dengan "unsafe use of new value of enum type".
--
--   Text + CHECK memberi daftar nilai yang sama ketatnya, tetapi dapat diubah
--   (dan diuji) dalam satu transaksi, serta memudahkan penambahan jenis
--   berikutnya. Daftar nilai di aplikasi ada di src/lib/lokasi/jenis-hunian.ts;
--   kedua tempat harus ditambah bersamaan.
--
--   Tidak ada objek lain yang bergantung pada tipe enum ini (hanya kolom
--   `pos_sapa.jenis_hunian`), jadi tipe lama aman dihapus.
--
-- DATA LAMA
--   Baris huntap/huntara tetap sah: nilainya sudah berupa teks yang sama.
--   `jenis_hunian_lainnya` wajib NULL untuk semua baris lama — constraint
--   kedua di bawah menegakkannya.
-- =============================================================================

-- 1. Isian bebas untuk "Lainnya".
alter table pos_sapa add column if not exists jenis_hunian_lainnya text;

-- 2. Enum -> text (nilai lama dipertahankan apa adanya).
alter table pos_sapa
  alter column jenis_hunian type text using jenis_hunian::text;

drop type if exists jenis_hunian_t;

-- 3. Daftar nilai yang dikenal.
alter table pos_sapa drop constraint if exists pos_sapa_jenis_hunian_dikenal;
alter table pos_sapa add constraint pos_sapa_jenis_hunian_dikenal check (
  jenis_hunian is null
  or jenis_hunian in ('huntap', 'huntara', 'dinas_pppa', 'uptd_pppa', 'lainnya')
);

-- 4. Isian bebas hanya boleh ada bila jenisnya "lainnya", dan wajib terisi
--    (bukan spasi kosong) supaya "Lainnya" tidak pernah berarti apa pun.
alter table pos_sapa drop constraint if exists pos_sapa_jenis_hunian_lainnya_lengkap;
alter table pos_sapa add constraint pos_sapa_jenis_hunian_lainnya_lengkap check (
  (
    jenis_hunian = 'lainnya'
    and nullif(btrim(jenis_hunian_lainnya), '') is not null
  )
  or (
    jenis_hunian is distinct from 'lainnya'
    and jenis_hunian_lainnya is null
  )
);

comment on column pos_sapa.jenis_hunian is
  'huntap | huntara | dinas_pppa | uptd_pppa | lainnya. '
  'Daftar nilai di aplikasi: src/lib/lokasi/jenis-hunian.ts.';
comment on column pos_sapa.jenis_hunian_lainnya is
  'Isian bebas bila jenis_hunian = lainnya; selain itu harus NULL.';
comment on table pos_sapa is
  'Lokasi Pos SAPA: kawasan huntap/huntara maupun kantor Dinas/UPTD PPPA.';
