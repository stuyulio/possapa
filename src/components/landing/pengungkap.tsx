"use client";

import { useEffect, useRef } from "react";

/**
 * Pembungkus scroll-reveal berbasis IntersectionObserver.
 *
 * Prinsip anti-flicker: CSS hanya menyembunyikan `.publik-rv` bila
 * `<html>` punya atribut `data-rv="on"`. Atribut itu baru dipasang dari efek
 * klien ini. Akibatnya:
 *   - tanpa JS, konten tetap terlihat penuh (tidak ada halaman kosong);
 *   - tidak ada kedipan, karena kelas sembunyi tidak pernah aktif sebelum
 *     hidrasi;
 *   - `prefers-reduced-motion` dilewati total — atribut tidak dipasang.
 *
 * Komponen ini hanya membungkus markup server; isi `children` tidak ikut
 * masuk bundle klien.
 */

let sudahPasang = false;

export function Pengungkap({
  children,
  className = "",
  jeda = 0,
  sebagai: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** Indeks berjenjang; CSS memakai `--d` untuk menunda transisi. */
  jeda?: number;
  sebagai?: "div" | "section" | "article" | "li";
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const kurangiGerak = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (kurangiGerak || !("IntersectionObserver" in window)) {
      el.classList.add("in");
      return;
    }

    // Penanda dipasang sekali saja, setelah yakin animasi akan berjalan.
    if (!sudahPasang) {
      document.documentElement.setAttribute("data-rv", "on");
      sudahPasang = true;
    }

    const pengamat = new IntersectionObserver(
      (entri) => {
        for (const e of entri) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            pengamat.unobserve(e.target);
          }
        }
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
    );

    pengamat.observe(el);
    return () => pengamat.disconnect();
  }, []);

  return (
    <Tag
      // Ref lintas elemen: union type ini tidak bisa di-infer sendiri oleh TS.
      ref={ref as React.RefObject<never>}
      className={`publik-rv ${className}`}
      style={{ "--d": `${jeda * 70}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}
