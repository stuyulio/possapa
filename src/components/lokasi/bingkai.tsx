import { createClient } from "@/lib/supabase/server";

/** Hitung jumlah laporan per pos untuk kolom "Laporan" pada tabel lokasi. */
export async function hitungLaporanPerPos(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("laporan").select("pos_id");

  const hitung = new Map<string, number>();
  for (const l of (data ?? []) as { pos_id: string }[]) {
    hitung.set(l.pos_id, (hitung.get(l.pos_id) ?? 0) + 1);
  }
  return hitung;
}
