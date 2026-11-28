"use client";

import { useCallback, useRef, useState } from "react";

import { Gambar } from "./gambar";
import type { Foto } from "./konvensi";

/**
 * Galeri geser untuk slot yang punya lebih dari satu foto.
 *
 * Satu foto → render langsung seperti `Gambar`. Nol foto → placeholder
 * bergradien `Gambar` (bukan kotak kosong). Lebih dari satu → jalur horizontal
 * yang bisa digeser di ponsel (swipe native, tanpa pustaka) dan memakai tombol
 * panah di layar lebar.
 *
 * Kartu Pintu seluruhnya berupa `<a href="#...">`. `type="button"` saja TIDAK
 * cukup di situ: klik tetap naik ke tautan induk dan halaman melompat ke
 * anchor kartu. Karena itu setiap tombol galeri memanggil `hentikan()` —
 * `preventDefault()` membatalkan navigasi anchor, `stopPropagation()`
 * mencegah tautan induk ikut terpicu.
 */
export function Galeri({
  foto,
  alt,
  className = "",
  prioritas = false,
  ukuran = "besar",
  label,
}: {
  foto: Foto[];
  /** Alt placeholder dan nama grup galeri untuk pembaca layar. */
  alt: string;
  className?: string;
  /** True untuk foto pertama di atas lipatan: eager + fetchPriority tinggi. */
  prioritas?: boolean;
  /** Ukuran slot placeholder — lihat `Gambar`. */
  ukuran?: "besar" | "sedang" | "strip";
  label?: string;
}) {
  const jalur = useRef<HTMLDivElement | null>(null);
  const [aktif, setAktif] = useState(0);
  const jumlah = foto.length;

  const ke = useCallback(
    (i: number) => {
      const el = jalur.current;
      if (!el || jumlah === 0) return;
      const j = (i + jumlah) % jumlah;
      el.scrollTo({ left: j * el.clientWidth, behavior: "smooth" });
      setAktif(j);
    },
    [jumlah]
  );

  /** Hentikan klik di tombol agar tidak diteruskan ke `<a>` pembungkus kartu. */
  const hentikan = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  if (jumlah === 0) {
    return (
      <Gambar src={undefined} alt={alt} ukuran={ukuran} className={className} />
    );
  }

  if (jumlah === 1) {
    return (
      <Gambar
        src={foto[0].src}
        alt={foto[0].alt}
        prioritas={prioritas}
        className={className}
      />
    );
  }

  return (
    <div
      role="group"
      aria-roledescription="galeri"
      aria-label={label ?? alt}
      className={`relative h-full w-full ${className}`}
    >
      <div
        ref={jalur}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth === 0) return;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          setAktif(i >= 0 && i < jumlah ? i : 0);
        }}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {foto.map((f, i) => (
          <div
            key={f.src}
            role="group"
            aria-roledescription="foto"
            aria-label={`${i + 1} dari ${jumlah}`}
            className="h-full w-full shrink-0 snap-center"
          >
            <Gambar
              src={f.src}
              alt={f.alt}
              prioritas={prioritas && i === 0}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label="Foto sebelumnya"
        onClick={(e) => {
          hentikan(e);
          ke(aktif - 1);
        }}
        className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-md transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        <span aria-hidden="true">←</span>
      </button>
      <button
        type="button"
        aria-label="Foto berikutnya"
        onClick={(e) => {
          hentikan(e);
          ke(aktif + 1);
        }}
        className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-md transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        <span aria-hidden="true">→</span>
      </button>

      <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5">
        {foto.map((f, i) => (
          <button
            key={f.src}
            type="button"
            aria-label={`Tampilkan foto ${i + 1}`}
            aria-current={i === aktif}
            onClick={(e) => {
              hentikan(e);
              ke(i);
            }}
            className={`h-2 rounded-full shadow-sm transition-all ${
              i === aktif ? "w-5 bg-white" : "w-2 bg-white/60 hover:bg-white/85"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
