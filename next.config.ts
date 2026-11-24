import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Memungkinkan `next build` berjalan tanpa mengganggu `next dev` yang sedang
  // aktif. Keduanya memakai folder `.next` yang sama dan akan saling merusak
  // bila dijalankan bersamaan.
  //   npm run dev                                  -> .next
  //   NEXT_DIST_DIR=.next-build npx next build     -> .next-build
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
