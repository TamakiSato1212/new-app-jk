"use client";
import React, { useState } from "react";
import { CanvasSticker } from "@/types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  albumStickers: CanvasSticker[];
  onAddFromAlbum: (sticker: CanvasSticker) => void;
  onToggleFavorite: (sticker: CanvasSticker, e: React.MouseEvent) => void;
  onTogglePublish: (sticker: CanvasSticker, e: React.MouseEvent) => void;
  onDeleteFromAlbum: (id: string, e: React.MouseEvent) => void;
  onSimulateTrade: () => void;
};

export const AlbumModal = ({ isOpen, onClose, albumStickers, onAddFromAlbum, onToggleFavorite, onTogglePublish, onDeleteFromAlbum, onSimulateTrade }: Props) => {
  const [albumTab, setAlbumTab] = useState<"mine" | "exchange">("mine"); 
  const [isAlbumEditMode, setIsAlbumEditMode] = useState(false);
  const [albumSort, setAlbumSort] = useState<"newest" | "most_used" | "recently_used">("newest");
  const [albumFilterFav, setAlbumFilterFav] = useState(false);

  if (!isOpen) return null;

  const processedAlbumStickers = [...albumStickers]
    .filter(s => albumFilterFav ? s.isFavorite : true)
    .filter(s => albumTab === "exchange" ? s.isPublished : true)
    .sort((a, b) => {
      if (albumSort === "most_used") return (b.usageCount || 0) - (a.usageCount || 0);
      if (albumSort === "recently_used") return (b.lastUsed || 0) - (a.lastUsed || 0);
      const timeA = parseInt(a.id.split('-')[1]) || 0; const timeB = parseInt(b.id.split('-')[1]) || 0; return timeB - timeA;
    });

  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex flex-col items-center p-4 pt-10 font-sans" onClick={() => { onClose(); setIsAlbumEditMode(false); }}>
      <div className="w-full max-w-md bg-[#faf8ef] rounded-3xl overflow-hidden flex flex-col max-h-[80vh] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="pt-4 px-4 bg-white border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">📦 マイアルバム</h2>
            <div className="flex gap-2 items-center">
              {albumTab === "mine" && <button onClick={() => setIsAlbumEditMode(!isAlbumEditMode)} className={`px-3 py-1 rounded-full text-xs font-bold transition ${isAlbumEditMode ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{isAlbumEditMode ? "完了" : "🗑️ 整理(削除)"}</button>}
              <button onClick={() => { onClose(); setIsAlbumEditMode(false); }} className="text-gray-500 font-bold bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
            </div>
          </div>
          <div className="flex gap-6 w-full px-2">
             <button onClick={() => { setAlbumTab("mine"); setIsAlbumEditMode(false); }} className={`pb-2 text-sm transition-all ${albumTab === "mine" ? "border-b-4 border-amber-500 font-bold text-amber-600" : "text-gray-400 font-bold"}`}>自分のシール</button>
             <button onClick={() => { setAlbumTab("exchange"); setIsAlbumEditMode(false); }} className={`pb-2 text-sm transition-all ${albumTab === "exchange" ? "border-b-4 border-blue-500 font-bold text-blue-600" : "text-gray-400 font-bold"}`}>🌍 交換所</button>
          </div>
        </div>

        {albumTab === "mine" && (
          <>
            <div className="px-4 pt-3 flex justify-between items-center gap-2 bg-[#faf8ef]">
              <select value={albumSort} onChange={(e) => setAlbumSort(e.target.value as any)} className="bg-white border border-gray-200 rounded-lg px-2 py-1 outline-none text-xs font-bold text-gray-700 focus:border-amber-400">
                <option value="newest">追加順</option><option value="recently_used">最近使った順</option><option value="most_used">使用回数が多い順</option>
              </select>
              <button onClick={() => setAlbumFilterFav(!albumFilterFav)} className={`px-3 py-1 rounded-lg text-xs font-bold transition border ${albumFilterFav ? "bg-pink-50 border-pink-200 text-pink-600" : "bg-white border-gray-200 text-gray-600"}`}>
                {albumFilterFav ? "❤️ お気に入りのみ" : "🤍 すべて表示"}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 relative">
              {processedAlbumStickers.length === 0 ? <div className="text-center text-gray-400 font-bold mt-10">シールが見つかりません。</div>
              : (
                <div className="grid grid-cols-3 gap-3">
                  {processedAlbumStickers.map(sticker => (
                    <div key={sticker.id} className={`relative bg-white border rounded-xl overflow-hidden aspect-square flex flex-col items-center justify-center p-2 transition ${isAlbumEditMode ? 'border-red-300 animate-pulse cursor-default' : 'border-gray-200 hover:border-amber-400 cursor-pointer shadow-sm group'}`} onClick={() => !isAlbumEditMode && onAddFromAlbum(sticker)}>
                      <img src={sticker.src} alt={sticker.name} className="w-full h-full object-contain drop-shadow-sm group-hover:scale-110 transition-transform" />
                      {!isAlbumEditMode && (
                        <>
                          <button onClick={(e) => onToggleFavorite(sticker, e)} className="absolute top-1 right-1 z-10 text-lg drop-shadow-sm transition-transform active:scale-150">{sticker.isFavorite ? '❤️' : '🤍'}</button>
                          <button onClick={(e) => onTogglePublish(sticker, e)} className="absolute top-1 left-1 z-10 text-lg drop-shadow-sm transition-transform active:scale-150 bg-white/60 rounded-full w-6 h-6 flex items-center justify-center" title={sticker.isPublished ? "公開中" : "公開する"}>{sticker.isPublished ? '🌍' : '🏠'}</button>
                        </>
                      )}
                      {isAlbumEditMode && <button onClick={(e) => onDeleteFromAlbum(sticker.id, e)} className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full text-sm font-bold shadow-md flex items-center justify-center z-10">✕</button>}
                      <div className="absolute bottom-1 right-1 text-[10px] font-black text-gray-500/60 z-10 px-1 bg-white/40 rounded backdrop-blur-sm">{sticker.usageCount || 0}回</div>
                      {sticker.name && <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm text-[10px] font-bold text-center py-0.5 text-gray-600 truncate px-1 border-t border-gray-100">{sticker.name}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {albumTab === "exchange" && (
          <div className="flex-1 overflow-y-auto p-4 bg-blue-50/50 flex flex-col">
            <button onClick={onSimulateTrade} className="w-full bg-blue-500 text-white rounded-2xl py-4 font-bold mb-6 flex flex-col items-center justify-center shadow-md hover:bg-blue-600 transition">
              <span className="text-3xl mb-1">🔄</span>誰かからリクエストをもらう<br/><span className="text-[10px] opacity-80 font-normal">（※公開中のシールが必要です）</span>
            </button>
            <h3 className="font-bold text-gray-700 mb-3 text-sm">🌍 あなたが公開（出品）中のシール</h3>
            <div className="grid grid-cols-3 gap-3">
              {albumStickers.filter(s => s.isPublished).length === 0 ? <div className="col-span-3 text-center text-gray-400 font-bold mt-4 text-xs">「自分のシール」タブで左上の「🏠」を押して<br/>お気に入りを公開してみよう！</div>
              : albumStickers.filter(s => s.isPublished).map(sticker => (
                  <div key={sticker.id} className="relative bg-white border border-blue-200 rounded-xl overflow-hidden aspect-square flex flex-col items-center justify-center p-2 shadow-sm opacity-80">
                    <img src={sticker.src} className="w-full h-full object-contain drop-shadow-sm" />
                    <button onClick={(e) => onTogglePublish(sticker, e)} className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition text-white font-bold text-xs backdrop-blur-sm">公開をやめる</button>
                  </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};