-- =============================================================================
-- Kunci laporan `terkirim` untuk petugas
--
-- KEPUTUSAN
--   Laporan berstatus `terkirim` terkunci bagi petugas: data tetap DAPAT
--   DILIHAT, tetapi tidak dapat diubah sampai Admin memverifikasi atau membuka
--   kuncinya. Perbaikan setelah terkirim hanya lewat `bukaKunciLaporan()`, yang
--   mengembalikan status ke `terkirim` sambil mengisi `catatan_buka_kunci`.
--
-- MASALAH YANG DITUTUP
--   Sejak Fase 4, `catatan_buka_kunci` dipakai UI sebagai penanda "laporan ini
--   sedang dibuka untuk diperbaiki", tetapi hanya itu — penanda tampilan.
--   Policy `laporan_ubah_petugas` (20261124000001) mengizinkan petugas mengubah
--   SETIAP baris berstatus `terkirim`, dan `boleh_tulis_laporan` (versi 00003)
--   mengizinkan petugas menulis seluruh tabel rincian untuk baris yang sama.
--
--   Akibatnya dua hal:
--     1. Admin dapat menekan "Verifikasi" atas isi yang sudah berubah sejak ia
--        membacanya — verifikasi kehilangan maknanya.
--     2. Penanda `catatan_buka_kunci` tidak menjaga apa pun: petugas dapat
--        mengubah laporan terkirim tanpa Admin pernah membuka kuncinya.
--
-- KENAPA LEWAT `USING`, BUKAN `WITH CHECK`
--   Klausa WITH CHECK menguji baris HASIL, bukan baris LAMA. Menaruh syarat
--   "baris lama belum terkirim" di sana mustahil: baris hasil `terkirim` tidak
--   dapat dibedakan antara "baru saja dikirim dari draf" (sah) dan "terkirim
--   yang sedang diubah" (terlarang). Karena itu pembatasannya ada di USING,
--   yang memang melihat baris lama. WITH CHECK tetap dipakai untuk apa yang
--   memang bisa dinilai dari baris hasil: status tidak boleh naik ke
--   `terverifikasi` (celah verifikasi mandiri, 20261124000001).
--
--   Trigger `laporan_cek_kunci_petugas` ditambahkan sebagai lapisan kedua untuk
--   satu hal yang tetap tidak dapat dinyatakan RLS: petugas TIDAK boleh
--   mengosongkan `catatan_buka_kunci`. Tanpa itu, petugas dapat menutup penanda
--   buka kunci sendiri, lalu — karena baris hasilnya kini `terkirim` tanpa
--   catatan — USING kembali mengizinkannya mengubah baris itu. RLS sendirian
--   tidak cukup karena perbandingan nilai lama/baru bukan urusan `USING`.
-- =============================================================================

-- =============================================================================
-- 1. HAK TULIS TABEL RINCIAN
-- =============================================================================
--
-- `boleh_tulis_laporan` adalah satu-satunya penentu hak TULIS kelima tabel
-- rincian (dipasang sebagai `using` DAN `with check` pada policy tulis masing-
-- masing). Cukup diperbarui di sini — tidak ada policy per tabel yang perlu
-- ditulis ulang.

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
        -- Petugas: hanya draf, atau terkirim yang kuncinya sedang dibuka Admin.
        -- Terverifikasi tidak pernah dapat ditulis petugas.
        (auth_peran() = 'petugas'
          and ps.wilayah_id = auth_wilayah_id()
          and (
            l.status = 'draf'
            or (l.status = 'terkirim' and l.catatan_buka_kunci is not null)
          ))
        or (auth_peran() = 'admin_kabkota'
          and ps.wilayah_id = auth_wilayah_id())
        or auth_peran() = 'admin_pusat'
      )
  );
$$;

comment on function boleh_tulis_laporan(uuid) is
  'Hak tulis tabel rincian. Petugas: draf, atau terkirim yang sudah dibuka '
  'kunci oleh Admin (catatan_buka_kunci terisi). Terverifikasi selalu terkunci.';

revoke execute on function boleh_tulis_laporan from public;
grant execute on function boleh_tulis_laporan to authenticated;

-- =============================================================================
-- 2. POLICY UBAH LAPORAN INDUK
-- =============================================================================

drop policy if exists laporan_ubah_petugas on laporan;

create policy laporan_ubah_petugas on laporan
  for update to authenticated
  -- Baris LAMA yang boleh disentuh petugas: draf, atau terkirim yang kuncinya
  -- sudah dibuka Admin. Inilah penegakan utama aturan ini.
  using (
    auth_peran() = 'petugas'
    and (
      status = 'draf'
      or (status = 'terkirim' and catatan_buka_kunci is not null)
    )
    and exists (
      select 1 from pos_sapa ps
      where ps.id = laporan.pos_id
        and ps.wilayah_id = auth_wilayah_id()
    )
  )
  with check (
    auth_peran() = 'petugas'
    -- Baris hasil tetap draf/terkirim: petugas tidak dapat menaikkan statusnya
    -- sendiri menjadi terverifikasi (celah 20261124000001).
    and status in ('draf', 'terkirim')
    and exists (
      select 1 from pos_sapa ps
      where ps.id = laporan.pos_id
        and ps.wilayah_id = auth_wilayah_id()
    )
  );

-- =============================================================================
-- 3. TRIGGER LAPISAN KEDUA — PENANDA BUKA KUNCI TIDAK DAPAT DIPALSUKAN PETUGAS
-- =============================================================================
--
-- Yang tidak dapat dinyatakan RLS: perbandingan antara baris LAMA dan baris
-- HASIL. Ada dua hal yang perlu dijaga di sana:
--
--   a. Petugas tidak boleh MEMBUAT penanda buka kunci. Policy memakai
--      `catatan_buka_kunci is not null` sebagai syarat boleh mengubah, jadi
--      petugas yang dapat mengisinya sendiri akan mengangkat kuncinya:
--      laporan terkirimnya menjadi dapat diubah sesuka hati, dan di layar ia
--      tampil seolah Admin yang membuka.
--
--   b. Petugas tidak boleh MENGUBAH teks penanda. Bila Admin menulis alasan
--      perbaikan, mengubahnya menghapus instruksi yang harus ia ikuti.
--
-- MENGOSONGKAN penanda justru SAH dan memang diharapkan: `simpanLaporan`
-- mengosongkannya saat laporan dikirim ulang (actions.ts), sebab catatan itu
-- menandai "kunci sedang dibuka" dan tidak lagi berlaku setelah kiriman baru.
-- Karena itu yang dilarang adalah (a) dan (b), bukan pengosongan.
--
-- Hanya berlaku untuk peran 'petugas'. Admin dan service role (auth.uid() NULL,
-- mis. migrasi atau seed) tidak terpengaruh.

create or replace function laporan_cek_kunci_petugas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth_peran() <> 'petugas' then
    return new;
  end if;

  -- INSERT: policy `laporan_tulis_petugas` tidak memeriksa catatan_buka_kunci,
  -- jadi tanpa penjagaan ini petugas dapat menyisipkan baris BARU berstatus
  -- terkirim yang sudah membawa catatan buka kunci palsu — di layar ia tampil
  -- seolah Admin yang membukanya. Kiriman pertama lewat simpanLaporan tidak
  -- pernah mengisi kolom ini, jadi menolaknya tidak menghalangi alur normal.
  if tg_op = 'INSERT' then
    if new.catatan_buka_kunci is not null then
      raise exception
        'Hanya Admin yang dapat membuat catatan buka kunci.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- Laporan terverifikasi tidak dapat disentuh petugas dalam bentuk apa pun.
  -- RLS sudah menolaknya lewat USING; dijaga di sini agar pesannya jelas.
  if old.status = 'terverifikasi' then
    raise exception
      'Laporan sudah terverifikasi dan terkunci. Minta Admin membuka kuncinya.'
      using errcode = '42501';
  end if;

  -- (a) Membuat penanda buka kunci sendiri — mengangkat kunci tanpa Admin.
  if old.catatan_buka_kunci is null and new.catatan_buka_kunci is not null then
    raise exception
      'Hanya Admin yang dapat membuat catatan buka kunci.' using errcode = '42501';
  end if;

  -- (b) Mengubah teks penanda yang ditulis Admin. Mengosongkannya (kirim ulang)
  --     tetap diizinkan.
  if old.catatan_buka_kunci is not null
     and new.catatan_buka_kunci is not null
     and new.catatan_buka_kunci <> old.catatan_buka_kunci
  then
    raise exception
      'Catatan buka kunci hanya dapat diubah oleh Admin.' using errcode = '42501';
  end if;

  -- Laporan terkirim yang belum dibuka kuncinya: tidak ada perubahan isi yang
  -- sah. (Draf -> terkirim memiliki old.status = 'draf', jadi kiriman pertama
  -- tidak terkena aturan ini.)
  if old.status = 'terkirim'
     and old.catatan_buka_kunci is null
     and new.status = 'terkirim'
  then
    raise exception
      'Laporan yang sudah terkirim terkunci. Minta Admin membuka kuncinya '
      'sebelum memperbaiki.' using errcode = '42501';
  end if;

  -- Terkirim tidak boleh diturunkan kembali menjadi draf: itu menghapus
  -- penanda buka kunci dan mengeluarkan laporan dari antrean verifikasi tanpa
  -- persetujuan Admin.
  if old.status = 'terkirim' and new.status = 'draf' then
    raise exception
      'Laporan terkirim tidak dapat dikembalikan menjadi draf.' using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function laporan_cek_kunci_petugas() is
  'Menolak petugas membuat/mengubah catatan_buka_kunci dan mengubah laporan '
  'terkirim yang terkunci. Mengosongkan penanda saat kirim ulang tetap sah. '
  'Lapisan kedua setelah RLS.';

drop trigger if exists laporan_cek_kunci_petugas on laporan;
create trigger laporan_cek_kunci_petugas
  before insert or update on laporan
  for each row execute function laporan_cek_kunci_petugas();

-- =============================================================================
-- 4. VERIFIKASI
-- =============================================================================

do $$
declare
  v_def    text;
  v_jumlah integer;
begin
  -- Policy ubah petugas harus menyebut draf DAN catatan_buka_kunci.
  select pg_get_expr(polqual, polrelid)
  into v_def
  from pg_policy
  where polname = 'laporan_ubah_petugas'
    and polrelid = 'laporan'::regclass;

  if v_def is null then
    raise exception 'Policy laporan_ubah_petugas tidak ditemukan';
  end if;
  if position('catatan_buka_kunci' in v_def) = 0 then
    raise exception
      'USING laporan_ubah_petugas belum menyebut catatan_buka_kunci — '
      'laporan terkirim masih dapat diubah tanpa buka kunci: %', v_def;
  end if;

  -- WITH CHECK harus tetap membatasi status (celah verifikasi mandiri).
  select pg_get_expr(polwithcheck, polrelid)
  into v_def
  from pg_policy
  where polname = 'laporan_ubah_petugas'
    and polrelid = 'laporan'::regclass;
  if position('terkirim' in v_def) = 0 then
    raise exception
      'WITH CHECK laporan_ubah_petugas kehilangan pembatasan status: %', v_def;
  end if;

  -- Hak tulis rincian harus ikut memakai penanda buka kunci.
  select pg_get_functiondef('boleh_tulis_laporan(uuid)'::regprocedure)
  into v_def;

  if position('catatan_buka_kunci' in v_def) = 0 then
    raise exception
      'boleh_tulis_laporan belum memakai catatan_buka_kunci — petugas masih '
      'dapat menulis rincian laporan terkirim yang terkunci';
  end if;

  -- Trigger lapisan kedua harus terpasang.
  select count(*) into v_jumlah
  from pg_trigger
  where tgname = 'laporan_cek_kunci_petugas'
    and not tgisinternal;
  if v_jumlah <> 1 then
    raise exception 'Trigger laporan_cek_kunci_petugas tidak terpasang';
  end if;

  raise notice 'Kunci terkirim: policy dan trigger selesai.';
end;
$$;
