"use client";
import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { PageData } from "@/types";

export default function MapContent({ pages, onJump }: { pages: PageData[], onJump: (page: PageData) => void }) {
  // ★ 同じ場所（緯度・経度）のシールをまとめる
  const locationGroups: Record<string, { lat: number, lng: number, src: string, usages: { page: PageData, name: string }[] }> = {};

  pages.forEach(page => {
    page.items.forEach(item => {
      if (item.type === "sticker" && item.location) {
        // 小数点5桁（約1mの精度）で丸めて、同じ場所判定にする
        const key = `${item.location.lat.toFixed(5)},${item.location.lng.toFixed(5)}`;
        if (!locationGroups[key]) {
          locationGroups[key] = { lat: item.location.lat, lng: item.location.lng, src: item.src, usages: [] };
        }
        // 同じ日の重複を防ぐ
        if (!locationGroups[key].usages.some(u => u.page.id === page.id)) {
           locationGroups[key].usages.push({ page: page, name: item.name || "シール" });
        }
      }
    });
  });

  const markers = Object.values(locationGroups);
  const center = markers.length > 0 ? [markers[markers.length - 1].lat, markers[markers.length - 1].lng] : [35.681236, 139.767125];

  return (
    <MapContainer center={center as [number, number]} zoom={6} style={{ height: "100%", width: "100%", borderRadius: "1rem" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {markers.map((group, idx) => {
        const icon = L.divIcon({
          className: "custom-icon",
          html: `<div style="width: 44px; height: 44px; background-image: url('${group.src}'); background-size: cover; background-position: center; border-radius: 8px; background-color: white; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transform: rotate(${Math.random() * 20 - 10}deg);"></div>`,
          iconSize: [44, 44],
          iconAnchor: [22, 44],
        });

        return (
          <Marker key={idx} position={[group.lat, group.lng]} icon={icon}>
            <Popup>
              <div className="text-center min-w-[140px] p-1">
                <div className="font-bold text-gray-500 text-[10px] mb-2 border-b border-gray-200 pb-1">📍 思い出の記録</div>
                <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto px-1">
                  {/* ★ 日付ボタンをリスト表示 */}
                  {group.usages.map((usage, i) => (
                    <button 
                      key={i} 
                      onClick={() => onJump(usage.page)} 
                      className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1.5 rounded-lg hover:bg-blue-100 transition shadow-sm font-bold flex items-center justify-between gap-2 w-full"
                    >
                      <span>{usage.page.date.split('（')[0]}</span>
                      <span>📝</span>
                    </button>
                  ))}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}