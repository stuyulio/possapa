"use client";

import { useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  LayersControl,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { StatusPeta, TitikPeta } from "@/lib/data/peta";

const WARNA: Record<StatusPeta, string> = {
  melapor_lengkap: "#059669", // emerald-600
  melapor_sebagian: "#f59e0b", // amber-500
  belum_melapor: "#e11d48", // rose-600
  tanpa_koordinat: "#94a3b8", // slate-400
};

const LABEL: Record<StatusPeta, string> = {
  melapor_lengkap: "Melapor lengkap",
  melapor_sebagian: "Melapor sebagian",
  belum_melapor: "Belum melapor",
  tanpa_koordinat: "Koordinat belum diisi",
};

// Pusat awal: Aceh–Sumatera Utara–Sumatera Barat.
const PUSAT: [number, number] = [3.4, 98.6];
const ZOOM_AWAL = 6;

export function PetaSebaran({
  titik,
  periodeLabel,
}: {
  titik: TitikPeta[];
  periodeLabel: string | null;
}) {
  const [filterStatus, setFilterStatus] = useState<StatusPeta | "semua">("semua");

  const berkoordinat = useMemo(
    () => titik.filter((t) => t.lat !== null && t.lng !== null),
    [titik]
  );

  const tampil = useMemo(
    () =>
      filterStatus === "semua"
        ? berkoordinat
        : berkoordinat.filter((t) => t.status === filterStatus),
    [berkoordinat, filterStatus]
  );

  const tanpaKoordinat = titik.filter((t) => t.lat === null || t.lng === null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button
          type="button"
          onClick={() => setFilterStatus("semua")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
            filterStatus === "semua"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
          }`}
        >
          Semua ({berkoordinat.length})
        </button>
        {(Object.keys(LABEL) as StatusPeta[]).map((s) => {
          const jumlah = berkoordinat.filter((t) => t.status === s).length;
          if (jumlah === 0) return null;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition inline-flex items-center gap-1.5 ${
                filterStatus === s
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: WARNA[s] }}
                aria-hidden="true"
              />
              {LABEL[s]} ({jumlah})
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
        <MapContainer
          center={PUSAT}
          zoom={ZOOM_AWAL}
          scrollWheelZoom
          style={{ height: "520px", width: "100%" }}
          className="z-0"
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Peta jalan">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Citra satelit">
              <TileLayer
                attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          {tampil.map((t) => (
            <CircleMarker
              key={t.id}
              center={[t.lat as number, t.lng as number]}
              radius={9}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: WARNA[t.status],
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <div className="text-sm space-y-1.5" style={{ minWidth: 200 }}>
                  <p className="font-bold text-slate-900 m-0">{t.nama_lokasi}</p>
                  <p className="text-xs text-slate-600 m-0">
                    {t.kab_kota}, {t.provinsi}
                  </p>
                  <p className="text-xs m-0">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                      style={{ backgroundColor: WARNA[t.status] }}
                      aria-hidden="true"
                    />
                    <strong>{LABEL[t.status]}</strong>
                  </p>
                  <ul className="text-xs text-slate-700 m-0 pl-4 space-y-0.5">
                    <li>
                      {t.jenisTerkirim} dari 5 jenis laporan
                      {periodeLabel ? ` (${periodeLabel})` : ""}
                    </li>
                    <li>
                      Penerima manfaat:{" "}
                      <strong>{t.penerimaManfaat.toLocaleString("id-ID")}</strong>
                    </li>
                    <li>
                      Laporan terakhir: {t.periodeTerakhir ?? "belum ada"}
                    </li>
                    {t.kode_pos && <li>Kode: {t.kode_pos}</li>}
                    {!t.status_aktif && (
                      <li className="text-rose-700 font-semibold">
                        Lokasi nonaktif
                      </li>
                    )}
                  </ul>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {tanpaKoordinat.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <p className="font-semibold mb-1">
            {tanpaKoordinat.length} lokasi belum punya koordinat
          </p>
          <p className="mb-2">
            Lokasi berikut tidak tampil di peta. Isi <code>lat</code> dan{" "}
            <code>lng</code> lewat menu Admin → Wilayah &amp; Lokasi.
          </p>
          <ul className="list-disc pl-5 space-y-0.5">
            {tanpaKoordinat.slice(0, 12).map((t) => (
              <li key={t.id}>
                {t.nama_lokasi} — {t.kab_kota}, {t.provinsi}
              </li>
            ))}
            {tanpaKoordinat.length > 12 && (
              <li>… dan {tanpaKoordinat.length - 12} lokasi lain</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
