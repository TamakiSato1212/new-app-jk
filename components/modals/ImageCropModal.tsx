"use client";
import React, { useState, useRef, useEffect } from "react";
import { CropShape } from "@/types";

type ImageCropModalProps = {
  imageSrc: string | null;
  onClose: () => void;
  // 親（page.tsx）に「切り抜いた結果」を返すためのバケツリレー
  onAddSticker: (newStickerData: any, saveToAlbum: boolean) => void;
};

export const ImageCropModal = ({ imageSrc, onClose, onAddSticker }: ImageCropModalProps) => {
  const [maskPos, setMaskPos] = useState({ x: 150, y: 150 });
  const [maskRadius, setMaskRadius] = useState(80);
  const [dragMode, setDragMode] = useState<"move" | "resize" | "draw" | null>(null);
  const [cropShape, setCropShape] = useState<CropShape>("circle");
  const [pathPoints, setPathPoints] = useState<{ x: number, y: number }[]>([]);
  const [stickerName, setStickerName] = useState("");
  const [saveToAlbumAlso, setSaveToAlbumAlso] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // 画像が変わったら設定をリセットする
  useEffect(() => {
    if (imageSrc) {
      setMaskPos({ x: 150, y: 150 }); setMaskRadius(80); setPathPoints([]); 
      setStickerName(""); setSaveToAlbumAlso(false); setDragMode(null); setCropShape("circle");
    }
  }, [imageSrc]);

  const handleCropPointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    if (cropShape === "free") { setDragMode("draw"); setPathPoints([{ x, y }]); } 
    else { const d = Math.sqrt(Math.pow(x - maskPos.x, 2) + Math.pow(y - maskPos.y, 2)); if (d > maskRadius - 20 && d < maskRadius + 10) setDragMode("resize"); else if (d <= maskRadius - 20) setDragMode("move"); }
    e.stopPropagation();
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragMode || !containerRef.current || !imageRef.current) return;
      const rect = containerRef.current.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top;
      if (dragMode === "draw") setPathPoints(prev => [...prev, { x, y }]);
      else if (dragMode === "move") setMaskPos({ x, y });
      else if (dragMode === "resize") { const d = Math.sqrt(Math.pow(x - maskPos.x, 2) + Math.pow(y - maskPos.y, 2)); const maxR = Math.min(imageRef.current.clientWidth, imageRef.current.clientHeight) / 2; setMaskRadius(Math.max(30, Math.min(d, maxR))); }
    };
    const up = () => setDragMode(null);
    if (dragMode) { window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); }
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [dragMode, maskPos]);

  const handleCrop = async () => {
    if (!imageRef.current) return;
    const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d"); if (!ctx) return;
    const sX = imageRef.current.naturalWidth / imageRef.current.width; const sY = imageRef.current.naturalHeight / imageRef.current.height; let finalW, finalH;

    if (cropShape === "free" && pathPoints.length > 2) {
      const minX = Math.min(...pathPoints.map(p => p.x)); const maxX = Math.max(...pathPoints.map(p => p.x)); const minY = Math.min(...pathPoints.map(p => p.y)); const maxY = Math.max(...pathPoints.map(p => p.y));
      finalW = maxX - minX; finalH = maxY - minY; const padding = 16; canvas.width = finalW + padding * 2; canvas.height = finalH + padding * 2; const ox = padding - minX; const oy = padding - minY;
      ctx.save(); ctx.beginPath(); ctx.moveTo(pathPoints[0].x + ox, pathPoints[0].y + oy); pathPoints.forEach(p => ctx.lineTo(p.x + ox, p.y + oy)); ctx.closePath(); ctx.lineWidth = 6; ctx.strokeStyle = "white"; ctx.stroke(); ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4; ctx.fill(); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.moveTo(pathPoints[0].x + ox, pathPoints[0].y + oy); pathPoints.forEach(p => ctx.lineTo(p.x + ox, p.y + oy)); ctx.closePath(); ctx.clip(); ctx.drawImage(imageRef.current, minX * sX, minY * sY, finalW * sX, finalH * sY, padding, padding, finalW, finalH); ctx.restore();
    } else {
      const aspectW = (cropShape === "rect") ? 1.4 : 1.0; finalW = maskRadius * 2 * aspectW; finalH = maskRadius * 2; const padding = 16; canvas.width = finalW + padding * 2; canvas.height = finalH + padding * 2; const cx = canvas.width / 2; const cy = canvas.height / 2;
      ctx.save(); ctx.beginPath(); if (cropShape === "circle") ctx.arc(cx, cy, maskRadius + 6, 0, Math.PI * 2); else ctx.rect(cx - (maskRadius + 6) * aspectW, cy - (maskRadius + 6), (maskRadius + 6) * 2 * aspectW, (maskRadius + 6) * 2); ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4; ctx.fillStyle = "white"; ctx.fill(); ctx.restore();
      ctx.save(); ctx.beginPath(); if (cropShape === "circle") ctx.arc(cx, cy, maskRadius, 0, Math.PI * 2); else ctx.rect(cx - maskRadius * aspectW, cy - maskRadius, maskRadius * 2 * aspectW, maskRadius * 2); ctx.clip(); ctx.drawImage(imageRef.current, (maskPos.x - maskRadius * aspectW) * sX, (maskPos.y - maskRadius) * sY, (maskRadius * 2 * aspectW) * sX, (maskRadius * 2) * sY, cx - maskRadius * aspectW, cy - maskRadius, maskRadius * 2 * aspectW, maskRadius * 2); ctx.restore();
    }

    const MAX_SIZE = 300; const scale = finalW > MAX_SIZE ? MAX_SIZE / finalW : 1; let finalSrcUrl;
    if (scale < 1) { const resizeCanvas = document.createElement("canvas"); resizeCanvas.width = canvas.width * scale; resizeCanvas.height = canvas.height * scale; resizeCanvas.getContext("2d")?.drawImage(canvas, 0, 0, resizeCanvas.width, resizeCanvas.height); finalSrcUrl = resizeCanvas.toDataURL("image/png"); } else finalSrcUrl = canvas.toDataURL("image/png");

    // 親（page.tsx）にデータを渡して閉じる
    onAddSticker({ src: finalSrcUrl, width: finalW > MAX_SIZE ? MAX_SIZE : finalW, height: finalH > MAX_SIZE ? finalH * scale : finalH, name: stickerName }, saveToAlbumAlso);
  };

  if (!imageSrc) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] overflow-y-auto" onClick={onClose}>
      <div className="min-h-screen flex items-center justify-center p-4 py-10">
        <div className="bg-white p-6 rounded-3xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
          <h3 className="text-center font-bold text-gray-700 mb-4">シールを切り抜く</h3>
          <div className="mb-4">
            <input type="text" value={stickerName} onChange={(e) => setStickerName(e.target.value)} placeholder="シールの名前 (検索・アルバム用)" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none text-gray-700 focus:border-blue-400 font-bold text-sm" />
          </div>
          <div className="flex justify-center gap-2 mb-6 flex-wrap">
            <button onClick={() => {setCropShape("circle"); setPathPoints([]);}} className={`px-4 py-2 rounded-full text-xs font-bold transition ${cropShape === "circle" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500"}`}>● 丸</button>
            <button onClick={() => {setCropShape("square"); setPathPoints([]);}} className={`px-4 py-2 rounded-full text-xs font-bold transition ${cropShape === "square" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500"}`}>■ 正方形</button>
            <button onClick={() => {setCropShape("rect"); setPathPoints([]);}} className={`px-4 py-2 rounded-full text-xs font-bold transition ${cropShape === "rect" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500"}`}>▬ 長方形</button>
            <button onClick={() => {setCropShape("free"); setPathPoints([]);}} className={`px-4 py-2 rounded-full text-xs font-bold transition ${cropShape === "free" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500"}`}>✍️ 自由になぞる</button>
          </div>
          <div ref={containerRef} className="relative inline-block touch-none rounded-2xl overflow-hidden bg-gray-200 w-full" onPointerDown={handleCropPointerDown}>
            <img ref={imageRef} src={imageSrc} alt="" className="w-full h-auto pointer-events-none" draggable="false" />
            {cropShape === "free" ? <svg className="absolute inset-0 w-full h-full pointer-events-none"><polyline points={pathPoints.map(p => `${p.x},${p.y}`).join(" ")} fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="4" strokeDasharray="8,4" /></svg>
            : <div className="absolute flex items-center justify-center pointer-events-none" style={{ width: maskRadius * 2 * (cropShape === "rect" ? 1.4 : 1.0), height: maskRadius * 2, top: maskPos.y - maskRadius, left: maskPos.x - maskRadius * (cropShape === "rect" ? 1.4 : 1.0) }}><div className={`w-full h-full border-4 border-dashed border-white bg-white/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] ${cropShape === "circle" ? "rounded-full" : "rounded-none"}`} /></div>}
          </div>
          <label className="flex items-center gap-2 mt-6 justify-center cursor-pointer">
            <input type="checkbox" checked={saveToAlbumAlso} onChange={(e) => setSaveToAlbumAlso(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
            <span className="text-sm font-bold text-gray-600">切り抜きと同時に「アルバム」にも保存する</span>
          </label>
          <div className="flex flex-col gap-3 mt-4">
            <button onClick={handleCrop} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-md">貼る</button>
            <button onClick={onClose} className="w-full bg-gray-100 text-gray-500 py-3 rounded-2xl font-bold">キャンセル</button>
          </div>
        </div>
      </div>
    </div>
  );
};