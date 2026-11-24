import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dashboard Capaian Kinerja Pos SAPA",
  description:
    "Dashboard capaian kinerja penyelenggaraan Pos Sahabat Perempuan dan Anak (Pos SAPA) — Kementerian Pemberdayaan Perempuan dan Perlindungan Anak RI",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={`${inter.variable} ${plusJakarta.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
