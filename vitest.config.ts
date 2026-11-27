import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Sama dengan `paths` di tsconfig.json: modul di src/ saling mengimpor lewat
  // "@/...", dan itu juga dipakai modul murni yang diuji di sini.
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    // Hanya uji murni di src/. Skrip di scripts/ adalah alat sekali pakai yang
    // berbicara ke database sungguhan (butuh service_role dan menyentuh data
    // nyata), jadi tidak boleh ikut `npm test`.
    include: ["src/**/*.test.ts"],
  },
});
