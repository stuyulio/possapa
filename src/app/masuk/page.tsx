import { Suspense } from "react";
import { MasukForm } from "./masuk-form";
import { LogoKemenPPPA } from "@/components/brand/logo";

export const metadata = {
  title: "Masuk — Dashboard Pos SAPA",
};

export default function HalamanMasuk() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <LogoKemenPPPA className="h-16 w-16" />
          </div>
          <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-3 py-1 rounded-full mb-4">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-[11px] font-semibold tracking-wider uppercase text-amber-300">
              KemenPPPA RI
            </span>
          </div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900">
            Dashboard Pos SAPA
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Masuk untuk mengelola laporan capaian kinerja
          </p>
        </div>

        <Suspense
          fallback={
            <div className="bg-white rounded-2xl border border-slate-200 p-6 h-64 animate-pulse" />
          }
        >
          <MasukForm />
        </Suspense>

        <p className="text-center text-[11px] text-slate-400 mt-8">
          Sekretariat Deputi Bidang Perlindungan Khusus Anak — KemenPPPA RI
        </p>
        <p className="text-center text-[11px] text-slate-400 mt-1 flex items-center justify-center gap-1.5">
          <LogoKemenPPPA className="h-4 w-4 shrink-0" />
          <span>
            Powered by{" "}
            <strong className="text-slate-600">
              Biro Data dan Informasi KemenPPPA
            </strong>
          </span>
        </p>
      </div>
    </main>
  );
}
