-- =============================================================================
-- Seed: akun petugas untuk setiap kabupaten/kota sasaran
--
-- Satu akun petugas per wilayah (lihat migrasi 20261118000003_petugas_wilayah).
-- Akun dibuat langsung di auth.users + auth.identities + public.pengguna.
--
-- Format akun (slug = nama kab/kota huruf kecil tanpa spasi/tanda baca):
--   email    : <slug>@kemenpppa.go.id      contoh: kotapadang@kemenpppa.go.id
--   password : <slug>possapa               contoh: kotapadangpossapa
--
-- Contoh lain: Aceh Timur   -> acehtimur@kemenpppa.go.id  / acehtimurpossapa
--              Kota Sibolga -> kotasibolga@kemenpppa.go.id / kotasibolgapossapa
--
-- Script ini IDEMPOTEN: akun dengan email yang sudah ada akan dilewati.
--
-- CARA PAKAI
--   Jalankan di Supabase Studio -> SQL Editor (butuh role postgres).
--   Script ini menulis ke schema `auth`, jadi TIDAK bisa dijalankan lewat
--   Supabase JS client / service_role biasa.
--
-- PERINGATAN
--   Password seragam & mudah ditebak - hanya untuk data uji / distribusi awal.
--   Wajib diganti (reset password) sebelum dipakai produksi.
-- =============================================================================

do $$
declare
  w               record;
  v_slug          text;
  v_email         text;
  v_sandi         text;
  v_nama          text;
  v_id            uuid;
  ada_provider_id boolean;
begin
  -- Cek apakah auth.identities sudah punya kolom provider_id
  -- (skema Supabase lama belum punya).
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name   = 'identities'
      and column_name  = 'provider_id'
  ) into ada_provider_id;

  for w in
    select id, kab_kota
    from wilayah
    order by provinsi, kab_kota
  loop
    v_slug  := regexp_replace(lower(w.kab_kota), '[^a-z0-9]', '', 'g');
    v_email := v_slug || '@kemenpppa.go.id';
    v_sandi := v_slug || 'possapa';
    v_nama  := 'Petugas ' || w.kab_kota;

    -- Lewati bila email sudah terdaftar (idempoten)
    if exists (select 1 from auth.users where email = v_email) then
      raise notice 'Lewati %: sudah ada', v_email;
      continue;
    end if;

    v_id := gen_random_uuid();

    -- 1. Akun auth. Email langsung dikonfirmasi agar bisa dipakai masuk.
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_sandi, gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nama', v_nama),
      '', '', '', ''
    );

    -- 2. Identitas provider email - wajib ada agar login email/password jalan.
    if ada_provider_id then
      insert into auth.identities (
        id, provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(),
        v_id::text,
        v_id,
        jsonb_build_object(
          'sub', v_id::text,
          'email', v_email,
          'email_verified', true
        ),
        'email',
        now(), now(), now()
      );
    else
      insert into auth.identities (
        id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        v_id::text,
        v_id,
        jsonb_build_object(
          'sub', v_id::text,
          'email', v_email,
          'email_verified', true
        ),
        'email',
        now(), now(), now()
      );
    end if;

    -- 3. Profil pengguna - petugas terikat ke wilayah.
    insert into public.pengguna (id, nama, email, peran, wilayah_id)
    values (v_id, v_nama, v_email, 'petugas', w.id)
    on conflict (id) do nothing;

    raise notice 'Dibuat % (password: %)', v_email, v_sandi;
  end loop;
end $$;

-- =============================================================================
-- Verifikasi: setiap wilayah harus punya tepat satu petugas aktif.
-- Kolom `jumlah_petugas` yang bernilai 0 / lebih dari 1 perlu diperiksa.
-- =============================================================================
select
  w.provinsi,
  w.kab_kota,
  p.email,
  p.nama,
  p.aktif,
  count(p.id) over (partition by w.id) as jumlah_petugas
from wilayah w
left join pengguna p
  on p.wilayah_id = w.id
 and p.peran = 'petugas'
order by w.provinsi, w.kab_kota;

-- =============================================================================
-- Daftar email + password yang dipakai (untuk pencatatan)
-- =============================================================================
select
  regexp_replace(lower(kab_kota), '[^a-z0-9]', '', 'g') || '@kemenpppa.go.id' as email,
  regexp_replace(lower(kab_kota), '[^a-z0-9]', '', 'g') || 'possapa'          as password,
  kab_kota,
  provinsi
from wilayah
order by provinsi, kab_kota;
