"""
Siapkan foto asli untuk landing page.

Sumber: subfolder mentah di `public/foto/` (berkas kamera 6000-6240 px,
5-16 MB, ber-EXIF GPS). Subfolder itu diabaikan git.
Keluaran: `public/foto/beranda/` dalam WebP ±150-400 KB, tanpa EXIF.

Jalankan dari akar repo:  python -I scripts/siapkan-foto-landing.py
"""

import os

from PIL import Image, ImageOps

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUMBER = os.path.join(AKAR, "public", "foto")
TUJUAN = os.path.join(AKAR, "public", "foto", "beranda")

# (folder sumber, berkas sumber, nama keluaran, lebar maksimum)
PETA = [
    ("hero utama", "IMG_4679.JPG", "hero-utama.webp", 2000),
    ("aktivitas anak", "IMG_4210.JPG", "aktivitas-anak-1.webp", 1600),
    ("aktivitas anak", "8.png", "aktivitas-anak-2.webp", 1600),
    ("aktivitas anak", "_UNK4496.JPG", "aktivitas-anak-3.webp", 1600),
    ("aktivitas anak", "IMG_4286.JPG", "aktivitas-anak-4.webp", 1600),
    ("aktivitas perempuan", "_UNK4557.JPG", "aktivitas-perempuan-1.webp", 1600),
    ("aktivitas perempuan", "_UNK4551.JPG", "aktivitas-perempuan-2.webp", 1600),
    ("aktivitas perempuan", "_UNK4548.JPG", "aktivitas-perempuan-3.webp", 1600),
    ("aktivitas perempuan", "_UNK4549.JPG", "aktivitas-perempuan-4.webp", 1600),
    ("aktivitas edu", "IMG_4200.JPG", "aktivitas-edu-1.webp", 1600),
    ("aktivitas edu", "IMG_4197.JPG", "aktivitas-edu-2.webp", 1600),
    ("hero utama", "IMG_4667.JPG", "pintu-warga-1.webp", 1600),
    ("aktivitas anak", "_UNK4503.JPG", "pintu-warga-2.webp", 1600),
    ("pintu petugas", "5.png", "pintu-petugas-1.webp", 1600),
    ("pintu petugas", "_UNK4477.JPG", "pintu-petugas-2.webp", 1600),
    ("pintu petugas", "_UNK4488.JPG", "pintu-petugas-3.webp", 1600),
    ("pintu mitra", "IMG_9390.JPG", "pintu-mitra-1.webp", 1600),
    ("aktivitas anak", "IMG_4216.JPG", "mandat.webp", 1600),
]


def main() -> None:
    os.makedirs(TUJUAN, exist_ok=True)
    for folder, berkas, keluaran, lebar in PETA:
        asal = os.path.join(SUMBER, folder, berkas)
        if not os.path.exists(asal):
            raise SystemExit(f"Sumber tidak ada: {asal}")

        im = Image.open(asal)
        im = ImageOps.exif_transpose(im).convert("RGB")
        if im.width > lebar:
            tinggi = round(im.height * lebar / im.width)
            im = im.resize((lebar, tinggi), Image.LANCZOS)

        tujuan = os.path.join(TUJUAN, keluaran)
        # Tanpa parameter exif/icc_profile: PIL tidak menyertakan EXIF, jadi
        # GPS dan data kamera tidak ikut terbit.
        im.save(tujuan, "WEBP", quality=82, method=6)
        print(f"{berkas:16s} -> {keluaran:26s} {im.size[0]}x{im.size[1]} "
              f"{os.path.getsize(tujuan) // 1024} KB")


if __name__ == "__main__":
    main()
