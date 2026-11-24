import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Hanya uji murni di src/. Skrip di scripts/ adalah alat sekali pakai yang
    // berbicara ke database sungguhan (butuh service_role dan menyentuh data
    // nyata), jadi tidak boleh ikut `npm test`.
    include: ["src/**/*.test.ts"],
  },
});
