import { describe, expect, it } from "vitest";
import { bacaTautanPublikasi } from "./tautan-publikasi";

/**
 * Tautan di sini disalin dari data sungguhan (impor Google Form 27 Nov 2026)
 * supaya bentuk yang benar-benar tersimpan — bukan URL ideal — yang diuji.
 */
describe("bacaTautanPublikasi — YouTube", () => {
  it("mengenali tautan pendek youtu.be", () => {
    const t = bacaTautanPublikasi("https://youtu.be/9hXF4QbXycg");
    expect(t.jenis).toBe("youtube");
    expect(t.id).toBe("9hXF4QbXycg");
    expect(t.sematan).toBe("https://www.youtube-nocookie.com/embed/9hXF4QbXycg");
    expect(t.bentuk).toBe("video");
  });

  it("mengenali /watch?v= dan membuang parameter lain", () => {
    const t = bacaTautanPublikasi(
      "https://www.youtube.com/watch?v=olXrsAv0lWY&t=42s"
    );
    expect(t.id).toBe("olXrsAv0lWY");
  });

  it("mengenali /shorts/ dan /live/", () => {
    expect(
      bacaTautanPublikasi("https://youtube.com/shorts/AbC123xyz").id
    ).toBe("AbC123xyz");
    expect(
      bacaTautanPublikasi("https://www.youtube.com/live/AbC123xyz").id
    ).toBe("AbC123xyz");
  });

  it("halaman tanpa ID tetap punya tautan buka, tanpa sematan", () => {
    const t = bacaTautanPublikasi("https://www.youtube.com/");
    expect(t.jenis).toBe("youtube");
    expect(t.sematan).toBeNull();
    expect(t.halaman).toBe("https://www.youtube.com/");
  });
});

describe("bacaTautanPublikasi — Instagram", () => {
  it("mengubah kiriman menjadi alamat embed", () => {
    const t = bacaTautanPublikasi(
      "https://www.instagram.com/p/DeipNKRpfuK/?bqrl=ZmtwMXh1dWNtdW05"
    );
    expect(t.jenis).toBe("instagram");
    expect(t.id).toBe("DeipNKRpfuK");
    expect(t.sematan).toBe("https://www.instagram.com/p/DeipNKRpfuK/embed/");
    expect(t.bentuk).toBe("persegi");
    // Halaman asli tetap utuh, termasuk parameternya, untuk dibuka di tab baru.
    expect(t.halaman).toContain("bqrl=");
  });

  it("reels dan reels jamak menuju bentuk embed yang sama", () => {
    expect(
      bacaTautanPublikasi("https://www.instagram.com/reel/DfmxKmxzL6z/").sematan
    ).toBe("https://www.instagram.com/reel/DfmxKmxzL6z/embed/");
    expect(
      bacaTautanPublikasi("https://instagram.com/reels/DfmxKmxzL6z/").sematan
    ).toBe("https://www.instagram.com/reel/DfmxKmxzL6z/embed/");
  });

  it("profil tanpa kode kiriman tidak disematkan", () => {
    const t = bacaTautanPublikasi("https://www.instagram.com/");
    expect(t.jenis).toBe("instagram");
    expect(t.sematan).toBeNull();
    expect(t.halaman).toBe("https://www.instagram.com/");
  });
});

describe("bacaTautanPublikasi — Facebook", () => {
  it("video memakai plugin video", () => {
    const asli =
      "https://www.facebook.com/yafsindonesia/videos/2236679057198097/?rdid=x";
    const t = bacaTautanPublikasi(asli);
    expect(t.jenis).toBe("facebook");
    expect(t.sematan).toContain("/plugins/video.php?href=");
    expect(t.sematan).toContain(encodeURIComponent(asli));
  });

  it("kiriman biasa memakai plugin post", () => {
    expect(
      bacaTautanPublikasi("https://www.facebook.com/yafsi/posts/123456").sematan
    ).toContain("/plugins/post.php?href=");
  });
});

describe("bacaTautanPublikasi — TikTok dan Drive", () => {
  it("TikTok memakai pemutar v1 bila ada ID video", () => {
    const t = bacaTautanPublikasi(
      "https://www.tiktok.com/@akun/video/7300000000000000000"
    );
    expect(t.sematan).toBe(
      "https://www.tiktok.com/player/v1/7300000000000000000"
    );
  });

  it("Drive menerima bentuk /file/d/ dan ?id=", () => {
    expect(
      bacaTautanPublikasi("https://drive.google.com/file/d/1AbC-d_ef/preview")
        .sematan
    ).toBe("https://drive.google.com/file/d/1AbC-d_ef/preview");
    expect(
      bacaTautanPublikasi("https://drive.google.com/open?id=1AbC-d_ef").sematan
    ).toBe("https://drive.google.com/file/d/1AbC-d_ef/preview");
  });
});

describe("bacaTautanPublikasi — situs berita dan masukan tidak sah", () => {
  it("situs berita ditanam apa adanya dengan domain sebagai label", () => {
    const t = bacaTautanPublikasi(
      "https://medan.inews.id/read/724461/tak-perlu-bingung"
    );
    expect(t.jenis).toBe("situs");
    expect(t.bentuk).toBe("halaman");
    expect(t.sematan).toBe("https://medan.inews.id/read/724461/tak-perlu-bingung");
    expect(t.label).toBe("medan.inews.id");
  });

  it("kosong dan tak terbaca menghasilkan halaman null", () => {
    for (const nilai of [null, undefined, "", "   ", "bukan url"]) {
      const t = bacaTautanPublikasi(nilai);
      expect(t.halaman).toBeNull();
      expect(t.sematan).toBeNull();
    }
  });

  it("protokol selain http(s) ditolak", () => {
    // Kalau ini lolos, `halaman` akan masuk ke href dan menjadi celah XSS.
    expect(bacaTautanPublikasi("javascript:alert(1)").halaman).toBeNull();
    expect(bacaTautanPublikasi("data:text/html,<b>x").halaman).toBeNull();
  });
});
