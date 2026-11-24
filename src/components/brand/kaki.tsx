import { LogoKemenPPPA } from "./logo";

/**
 * Kaki halaman bersama untuk aplikasi Pos SAPA.
 *
 * Menampilkan institusi penyelenggara dan atribusi pengembang sistem,
 * sekaligus menjadi lokasi tunggal untuk kredit "Powered by" sehingga
 * tidak tersebar di setiap halaman.
 */
export function KakiHalaman({ gelap = true }: { gelap?: boolean }) {
  return (
    <footer
      className={`${
        gelap
          ? "bg-slate-900 text-slate-400 border-t-4 border-amber-500"
          : "bg-white text-slate-500 border-t border-slate-200"
      } py-4 no-print`}
    >
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-center sm:text-left">
        <p>
          Sekretariat Deputi Bidang Perlindungan Khusus Anak — KemenPPPA RI
        </p>
        <p className="flex items-center justify-center gap-1.5">
          <LogoKemenPPPA className="h-4 w-4 shrink-0" />
          <span>
            Powered by{" "}
            <strong className={gelap ? "text-slate-200" : "text-slate-700"}>
              Biro Data dan Informasi KemenPPPA
            </strong>
          </span>
        </p>
      </div>
    </footer>
  );
}
