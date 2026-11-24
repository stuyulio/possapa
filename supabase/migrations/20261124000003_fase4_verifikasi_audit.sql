-- =============================================================================
-- Fase 4 — Penyempurnaan (PRD §12)
--   1. Verifikasi berjenjang: satu langkah + buka kunci
--   2. Audit log: trigger database (bukan hanya server action)
--   3. Penandaan anomali: dihitung saat dibaca + catatan verifikasi
-- =============================================================================
--
-- KEPUTUSAN DESAIN (dikonfirmasi bersama pemilik produk)
-- -----------------------------------------------------------------------------
-- Verifikasi
--   Satu langkah: Admin Kab/Kota memverifikasi laporan di wilayahnya, Admin
--   Pusat memverifikasi semua. Tidak ada enum status baru — `terverifikasi`
--   sudah cukup. "Buka kunci" mengembalikan status ke `terkirim` supaya
--   petugas dapat memperbaiki, tanpa melepas jejak audit.
--
-- Anomali
--   Dihitung saat dibaca lewat view `anomali_laporan`, BUKAN disimpan sebagai
--   kolom. Alasannya: kolom tersimpan bisa basi (stale) bila data diperbaiki
--   lewat jalur yang melewati trigger. Anomali yang dihitung otomatis hilang
--   begitu angkanya konsisten. Kolom `catatan_verifikasi` dipakai admin untuk
--   mencatat alasan saat menyetujui laporan yang beranomali.
--
-- Audit
--   Trigger di database, bukan panggilan dari server action. Perubahan lewat
--   SQL Editor atau klien lain tetap terekam — celah audit yang justru
--   berbahaya untuk data kasus (PRD §9).
-- =============================================================================

-- =============================================================================
-- 1. KOLOM BARU PADA `laporan`
-- =============================================================================

alter table laporan
  add column if not exists catatan_verifikasi text,
  add column if not exists catatan_buka_kunci text;

comment on column laporan.catatan_verifikasi is
  'Catatan Admin saat memverifikasi — dipakai menjelaskan anomali yang '
  'disetujui apa adanya.';
comment on column laporan.catatan_buka_kunci is
  'Alasan Admin membuka kunci laporan terverifikasi agar petugas memperbaiki.';

-- =============================================================================
-- 2. PERBAIKAN POLICY: BATASI TRANSISI STATUS SAAT VERIFIKASI
-- =============================================================================
--
-- Policy `laporan_verifikasi_admin_kab` (migrasi 20261118000002) tidak
-- membatasi status sama sekali, sehingga Admin Kab/Kota secara teknis dapat
-- melompati alur (mis. mengembalikan laporan ke `draf`). Policy ini
-- mempersempitnya ke dua transisi yang memang diizinkan:
--
--   terkirim      -> terverifikasi   (verifikasi)
--   terverifikasi -> terkirim        (buka kunci)
--
-- Policy petugas (`laporan_ubah_petugas`, migrasi 20261124000001) sudah
-- benar: WITH CHECK-nya mensyaratkan status hasil ubahan tetap draf/terkirim,
-- sehingga petugas tidak dapat memverifikasi laporannya sendiri.

drop policy if exists laporan_verifikasi_admin_kab on laporan;

create policy laporan_verifikasi_admin_kab on laporan
  for update to authenticated
  using (
    auth_peran() = 'admin_kabkota'
    and status in ('draf', 'terkirim', 'terverifikasi')
    and exists (
      select 1 from pos_sapa p
      where p.id = laporan.pos_id
        and p.wilayah_id = auth_wilayah_id()
    )
  )
  with check (
    auth_peran() = 'admin_kabkota'
    -- Hanya verifikasi dan buka kunci; bukan lompatan status lain.
    and status in ('terkirim', 'terverifikasi')
    and exists (
      select 1 from pos_sapa p
      where p.id = laporan.pos_id
        and p.wilayah_id = auth_wilayah_id()
    )
  );

-- Verifikasi: pastikan klausa status ikut terbawa di WITH CHECK.
do $$
declare
  v_check text;
begin
  select pg_get_expr(polwithcheck, polrelid)
  into v_check
  from pg_policy
  where polname = 'laporan_verifikasi_admin_kab'
    and polrelid = 'laporan'::regclass;

  if v_check is null then
    raise exception 'Policy laporan_verifikasi_admin_kab tidak ditemukan';
  end if;
  if position('terverifikasi' in v_check) = 0 then
    raise exception
      'WITH CHECK verifikasi admin kab belum membatasi status: %', v_check;
  end if;
end;
$$;

-- =============================================================================
-- 3. AUDIT LOG — TRIGGER DI DATABASE
-- =============================================================================
--
-- Yang direkam: hanya kolom yang BENAR-BENAR berubah. Upsert draf yang tidak
-- mengubah apa pun (mis. menyimpan ulang draf yang sama) tidak menghasilkan
-- baris audit — tanpa ini, tabel audit_log akan penuh derau.
--
-- Teks panjang dipotong 200 karakter. Alasannya: `laporan_kasus` menyimpan
-- narasi sensitif (kebutuhan korban, hambatan). Menyalinnya utuh ke tabel
-- kedua menggandakan permukaan data pribadi tanpa manfaat audit — yang perlu
-- terbukti adalah SIAPA mengubah APA dan KAPAN, bukan salinan narasinya.

create or replace function potong_nilai_audit(p jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_object_agg(
      t.k,
      case
        when jsonb_typeof(t.v) = 'string' and length(t.v #>> '{}') > 200
          then to_jsonb(left(t.v #>> '{}', 200) || '…')
        else t.v
      end
    ),
    '{}'::jsonb
  )
  from jsonb_each(p) as t(k, v);
$$;

comment on function potong_nilai_audit(jsonb) is
  'Potong nilai teks > 200 karakter sebelum disimpan ke audit_log.';

create or replace function catat_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pk      text;
  v_sebelum jsonb := '{}'::jsonb;
  v_sesudah jsonb := '{}'::jsonb;
  v_baru    jsonb;
  v_lama    jsonb;
  v_kolom   text;
begin
  -- auth.uid() NULL bila perubahan datang dari SQL Editor / service role.
  -- Baris audit tetap ditulis dengan aktor NULL — jejaknya tetap ada.

  if tg_op = 'INSERT' then
    v_baru := to_jsonb(new);
    v_pk   := v_baru ->> tg_argv[0];
    v_sesudah := potong_nilai_audit(v_baru - 'updated_at');

  elsif tg_op = 'DELETE' then
    v_lama := to_jsonb(old);
    v_pk   := v_lama ->> tg_argv[0];
    v_sebelum := potong_nilai_audit(v_lama - 'updated_at');

  else
    v_baru := to_jsonb(new);
    v_lama := to_jsonb(old);
    v_pk   := v_baru ->> tg_argv[0];

    -- Hanya kolom yang nilainya berbeda. `is distinct from` dipakai supaya
    -- NULL vs nilai terhitung sebagai perubahan, bukan dianggap sama.
    for v_kolom in
      select t.k
      from jsonb_each(v_baru) as t(k, v)
      where t.k <> 'updated_at'
        and v_baru -> t.k is distinct from v_lama -> t.k
    loop
      v_sebelum := v_sebelum || jsonb_build_object(v_kolom, v_lama -> v_kolom);
      v_sesudah := v_sesudah || jsonb_build_object(v_kolom, v_baru -> v_kolom);
    end loop;

    -- Tidak ada perubahan berarti (mis. upsert draf yang identik).
    if v_sesudah = '{}'::jsonb then
      return null;
    end if;

    v_sebelum := potong_nilai_audit(v_sebelum);
    v_sesudah := potong_nilai_audit(v_sesudah);
  end if;

  insert into audit_log (aktor_id, entitas, entitas_id, aksi, perubahan)
  values (
    auth.uid(),
    tg_table_name,
    v_pk,
    case tg_op
      when 'INSERT' then 'tambah'
      when 'UPDATE' then 'ubah'
      else 'hapus'
    end,
    jsonb_strip_nulls(
      jsonb_build_object(
        'sebelum', nullif(v_sebelum, '{}'::jsonb),
        'sesudah', nullif(v_sesudah, '{}'::jsonb)
      )
    )
  );

  -- AFTER trigger: nilai kembalian diabaikan.
  return null;
end;
$$;

comment on function catat_audit() is
  'Trigger audit generik. Argumen pertama = nama kolom primary key tabel. '
  'security definer agar dapat menulis ke audit_log yang ber-RLS tanpa '
  'membuka policy INSERT untuk peran mana pun.';

-- Trigger dipasang AFTER (bukan BEFORE) supaya mencatat nilai AKHIR setelah
-- trigger set_updated_at / set_submitted_at selesai mengubah baris.
drop trigger if exists laporan_audit on laporan;
create trigger laporan_audit
  after insert or update or delete on laporan
  for each row execute function catat_audit('id');

drop trigger if exists laporan_anak_audit on laporan_anak;
create trigger laporan_anak_audit
  after insert or update or delete on laporan_anak
  for each row execute function catat_audit('laporan_id');

drop trigger if exists laporan_perempuan_audit on laporan_perempuan;
create trigger laporan_perempuan_audit
  after insert or update or delete on laporan_perempuan
  for each row execute function catat_audit('laporan_id');

drop trigger if exists laporan_rekap_audit on laporan_rekap_pengaduan;
create trigger laporan_rekap_audit
  after insert or update or delete on laporan_rekap_pengaduan
  for each row execute function catat_audit('laporan_id');

drop trigger if exists laporan_kasus_audit on laporan_kasus;
create trigger laporan_kasus_audit
  after insert or update or delete on laporan_kasus
  for each row execute function catat_audit('laporan_id');

drop trigger if exists laporan_publikasi_audit on laporan_publikasi;
create trigger laporan_publikasi_audit
  after insert or update or delete on laporan_publikasi
  for each row execute function catat_audit('laporan_id');

-- Data master juga diaudit: perubahan koordinat dan status lokasi mengubah
-- peta publik, dan perubahan peran mengubah hak akses.
drop trigger if exists pos_sapa_audit on pos_sapa;
create trigger pos_sapa_audit
  after insert or update or delete on pos_sapa
  for each row execute function catat_audit('id');

drop trigger if exists pengguna_audit on pengguna;
create trigger pengguna_audit
  after insert or update or delete on pengguna
  for each row execute function catat_audit('id');

-- Indeks untuk pencarian per aktor di halaman /admin/audit.
create index if not exists audit_log_aktor_idx on audit_log(aktor_id);

-- =============================================================================
-- 4. VIEW ANOMALI
-- =============================================================================
--
-- security_invoker = TRUE (berbeda dari view publik).
-- View ini menyentuh data per laporan — kode kasus, angka per lokasi — jadi
-- RLS tabel dasar HARUS tetap berlaku. Dengan security_invoker, petugas hanya
-- melihat anomali di wilayahnya; Admin Kab/Kota seluruh wilayah (sesuai
-- keputusan PRD §15 №3); pimpinan dan admin pusat semuanya.
--
-- Kalau view ini dibuat security_invoker = false seperti view publik, setiap
-- pengguna login akan melihat anomali seluruh Indonesia. Jangan diubah.

create or replace view anomali_laporan
with (security_invoker = true)
as
with dasar as (
  select
    l.id                as laporan_id,
    l.status,
    l.jenis_laporan,
    l.sumber_input,
    l.catatan_verifikasi,
    l.catatan_buka_kunci,
    l.submitted_at,
    l.updated_at,
    ps.id               as pos_id,
    ps.nama_lokasi,
    ps.wilayah_id,
    w.kab_kota,
    w.provinsi,
    pr.id               as periode_id,
    pr.label            as periode_label,
    pr.tanggal_mulai,
    pr.tanggal_selesai
  from laporan l
  join pos_sapa ps on ps.id = l.pos_id
  join periode  pr on pr.id = l.periode_id
  left join wilayah w on w.id = ps.wilayah_id
)
-- ---------------------------------------------------------------------------
-- A1. Distribusi usia tidak sama dengan jumlah per jenis kelamin.
--     Inilah kerusakan tersembunyi B1 (PRD §6.5): prototipe menutupinya
--     dengan max(sumUsia, sumGender) sehingga total tampak benar padahal
--     rinciannya salah. Di sini selisihnya DITANDAI, bukan ditutupi.
-- ---------------------------------------------------------------------------
select
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'distribusi_usia'::text as kode,
  'sedang'::text as tingkat,
  'Jumlah per kelompok usia (' || (a.usia_0_5 + a.usia_6_12 + a.usia_13_17)
    || ') tidak sama dengan jumlah per jenis kelamin ('
    || (a.laki_laki + a.perempuan) || ')' as keterangan
from dasar d
join laporan_anak a on a.laporan_id = d.laporan_id
where (a.usia_0_5 + a.usia_6_12 + a.usia_13_17)
   <> (a.laki_laki + a.perempuan)

union all
-- ---------------------------------------------------------------------------
-- A2. Subkelompok peserta perempuan melebihi total peserta.
--     Subkelompok boleh tumpang tindih (kepala keluarga bisa juga lansia),
--     jadi yang diperiksa adalah masing-masing terhadap total — bukan
--     jumlahnya terhadap total.
-- ---------------------------------------------------------------------------
select
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'subkelompok_perempuan'::text,
  'sedang'::text,
  'Subkelompok terbesar ('
    || greatest(p.kepala_keluarga, p.hamil_menyusui, p.lansia, p.disabilitas)
    || ') melebihi total peserta (' || p.total_ikut || ')'
from dasar d
join laporan_perempuan p on p.laporan_id = d.laporan_id
where p.total_ikut < greatest(
        p.kepala_keluarga, p.hamil_menyusui, p.lansia, p.disabilitas)

union all
-- ---------------------------------------------------------------------------
-- A3. Rincian kategori aduan tidak menjumlah sama dengan aduan masuk.
--     Constraint database hanya mencegah kategori MELEBIHI total; kurang dari
--     total lolos tanpa terdeteksi.
-- ---------------------------------------------------------------------------
select
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'rekap_kategori'::text,
  'sedang'::text,
  'Jumlah kategori ('
    || (r.kekerasan_perempuan + r.kekerasan_anak
        + r.non_kekerasan_perempuan + r.non_kekerasan_anak)
    || ') tidak sama dengan aduan masuk (' || r.aduan_masuk || ')'
from dasar d
join laporan_rekap_pengaduan r on r.laporan_id = d.laporan_id
where r.status_bulan = 'Ada aduan'
  and (r.kekerasan_perempuan + r.kekerasan_anak
       + r.non_kekerasan_perempuan + r.non_kekerasan_anak) <> r.aduan_masuk

union all
-- ---------------------------------------------------------------------------
-- A4. Status "Nihil" tetapi masih ada hitungan.
--     Sudah dijaga constraint `rekap_nihil_nol`; dipertahankan sebagai
--     lapisan kedua karena data masuk juga lewat impor manual (PRD §15.2).
-- ---------------------------------------------------------------------------
select
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'rekap_nihil'::text,
  'tinggi'::text,
  'Status Nihil tetapi masih ada hitungan aduan'
from dasar d
join laporan_rekap_pengaduan r on r.laporan_id = d.laporan_id
where r.status_bulan = 'Nihil'
  and (r.aduan_masuk <> 0 or r.sudah_ditindaklanjuti <> 0
       or r.tercatat_simfoni <> 0
       or (r.kekerasan_perempuan + r.kekerasan_anak
           + r.non_kekerasan_perempuan + r.non_kekerasan_anak) <> 0)

union all
-- ---------------------------------------------------------------------------
-- A5. Kelengkapan SIMFONI tidak konsisten dengan statusnya.
-- ---------------------------------------------------------------------------
select
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'kasus_simfoni'::text,
  'tinggi'::text,
  case
    when k.sudah_simfoni then
      'Ditandai sudah tercatat SIMFONI tetapi '
        || concat_ws(', ',
             case when k.no_registrasi_simfoni is null
                  then 'nomor registrasi kosong' end,
             case when k.tanggal_input_simfoni is null
                  then 'tanggal input kosong' end,
             case when k.penginput_simfoni is null
                  then 'penginput kosong' end)
        || ' belum diisi'
    else 'Belum tercatat SIMFONI tetapi alasan belum diisi'
  end
from dasar d
join laporan_kasus k on k.laporan_id = d.laporan_id
where (k.sudah_simfoni
        and (k.no_registrasi_simfoni is null
             or k.tanggal_input_simfoni is null
             or k.penginput_simfoni is null))
   or (not k.sudah_simfoni and k.alasan_belum_simfoni is null)

union all
-- ---------------------------------------------------------------------------
-- A6. Laporan non-draf tanpa baris rincian.
--     Risiko nyata dari penyimpanan dua langkah di `simpanLaporan`: bila
--     upsert rincian gagal setelah induk tersimpan, yang tersisa adalah
--     laporan kosong yang tetap terhitung dalam matriks kepatuhan.
-- ---------------------------------------------------------------------------
select
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'detail_hilang'::text,
  'tinggi'::text,
  'Laporan berstatus ' || d.status || ' tetapi rinciannya tidak ada'
from dasar d
where d.status <> 'draf'
  and not exists (
    select 1 from laporan_anak a            where a.laporan_id = d.laporan_id
    union all
    select 1 from laporan_perempuan p       where p.laporan_id = d.laporan_id
    union all
    select 1 from laporan_rekap_pengaduan r where r.laporan_id = d.laporan_id
    union all
    select 1 from laporan_kasus k           where k.laporan_id = d.laporan_id
    union all
    select 1 from laporan_publikasi b       where b.laporan_id = d.laporan_id
  )

union all
-- ---------------------------------------------------------------------------
-- A7. Dua periode yang rentang tanggalnya tumpang tindih pada lokasi sama.
--     PRD §6.4 mensyaratkan periode tidak tumpang tindih untuk lokasi yang
--     sama. Unique (pos, periode, jenis) tidak mencegahnya karena periode-nya
--     berbeda.
-- ---------------------------------------------------------------------------
select distinct
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'periode_tumpang_tindih'::text,
  'sedang'::text,
  'Lokasi ini juga melapor pada periode ' || pr2.label
    || ' yang rentang tanggalnya tumpang tindih'
from dasar d
join laporan l2 on l2.pos_id = d.pos_id
               and l2.id <> d.laporan_id
               and l2.status <> 'draf'
join periode pr2 on pr2.id = l2.periode_id
where d.status <> 'draf'
  and d.tanggal_mulai <= pr2.tanggal_selesai
  and pr2.tanggal_mulai <= d.tanggal_selesai;

comment on view anomali_laporan is
  'Anomali data dihitung saat dibaca (PRD §6.4). Satu baris = satu anomali. '
  'security_invoker = true supaya RLS tabel dasar tetap berlaku.';

revoke all on anomali_laporan from anon;
grant select on anomali_laporan to authenticated;

-- =============================================================================
-- 5. VERIFIKASI AKHIR
-- =============================================================================

do $$
declare
  v_jumlah integer;
begin
  -- Kolom baru harus ada.
  select count(*) into v_jumlah
  from information_schema.columns
  where table_name = 'laporan'
    and column_name in ('catatan_verifikasi', 'catatan_buka_kunci');
  if v_jumlah <> 2 then
    raise exception
      'Kolom catatan verifikasi/buka kunci belum lengkap (%)', v_jumlah;
  end if;

  -- Trigger audit harus terpasang di delapan tabel.
  select count(*) into v_jumlah
  from pg_trigger
  where tgname in ('laporan_audit', 'laporan_anak_audit',
                   'laporan_perempuan_audit', 'laporan_rekap_audit',
                   'laporan_kasus_audit', 'laporan_publikasi_audit',
                   'pos_sapa_audit', 'pengguna_audit')
    and not tgisinternal;
  if v_jumlah <> 8 then
    raise exception 'Trigger audit terpasang % dari 8', v_jumlah;
  end if;

  -- View anomali harus security_invoker (bukan melewati RLS).
  select count(*) into v_jumlah
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'anomali_laporan'
    and 'security_invoker=true' = any(c.reloptions);
  if v_jumlah <> 1 then
    raise exception
      'anomali_laporan harus security_invoker = true; tanpa itu setiap '
      'pengguna login melihat anomali seluruh wilayah';
  end if;

  -- audit_log TIDAK boleh punya policy INSERT: penulisan hanya lewat trigger
  -- security definer, supaya entri audit tidak dapat dipalsukan dari klien.
  select count(*) into v_jumlah
  from pg_policies
  where tablename = 'audit_log' and cmd in ('INSERT', 'ALL');
  if v_jumlah <> 0 then
    raise exception
      'audit_log memiliki % policy INSERT/ALL; audit harus ditulis hanya '
      'lewat trigger agar tidak dapat dipalsukan', v_jumlah;
  end if;

  raise notice 'Fase 4: migrasi verifikasi, audit, dan anomali selesai.';
end;
$$;
