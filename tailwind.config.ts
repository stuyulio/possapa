import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-plus-jakarta)", "system-ui", "sans-serif"],
      },
      colors: {
        navy: {
          DEFAULT: "#1e293b",
          dark: "#0f172a",
          light: "#334155",
        },
        amber: {
          DEFAULT: "#f59e0b",
          dark: "#d97706",
          light: "#fef3c7",
        },
      },
    },
  },
  plugins: [],
};

export default config;
