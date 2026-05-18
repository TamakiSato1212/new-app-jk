"use client";
import React from "react";
// 親から「手帳のデータ」と「シールのデータ」の型を読み込む
import { PageData, CanvasSticker } from "@/types";

// ★ これが「バケツリレー（Props）」の受け取りリストです！
// 親（page.tsx）からこの部品に渡してもらうデータを定義しています。
type SearchModalProps = {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isSearching: boolean;
  searchResults: PageData[];
  onJump: (page: PageData) => void;
};

export const SearchModal = ({ isOpen, onClose, searchQuery, onSearchChange, isSearching, searchResults, onJump }: SearchModalProps) => {
  // もし開いていなければ何も表示しない
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex flex-col items-center p-4 pt-10 font-sans" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center gap-3 bg-gray-50">
          <span className="text-xl">🔍</span>
          <input autoFocus type="text" value={searchQuery} onChange={onSearchChange} placeholder="日記やシールの名前を検索..." className="flex-1 bg-white border border-gray-200 rounded-full px-4 py-2 outline-none text-gray-700 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition" />
          <button onClick={onClose} className="text-gray-500 font-bold p-2 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center transition">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 bg-gray-50">
          {isSearching && <div className="p-6 text-center text-gray-400 font-bold animate-pulse">検索中...</div>}
          {!isSearching && searchQuery && searchResults.length === 0 && <div className="p-6 text-center text-gray-400 font-bold">見つかりませんでした 😢</div>}
          {!isSearching && searchResults.map(p => {
             const matchedStickers = p.items.filter(i => i.type === "sticker" && i.name && i.name.toLowerCase().includes(searchQuery.toLowerCase())) as CanvasSticker[];
             return (
               <button key={p.id} onClick={() => onJump(p)} className="w-full text-left p-4 mb-2 bg-white hover:bg-pink-50 border border-gray-100 rounded-xl shadow-sm transition group">
                 <div className="font-bold text-pink-600 text-sm group-hover:text-pink-700">{p.date}</div>
                 <div className="text-xs text-gray-600 line-clamp-2 mt-2 leading-relaxed">{p.diaryText || p.items.filter(i => i.type === 'text').map((i: any) => i.content).join(" ")}</div>
                 {matchedStickers.length > 0 && <div className="mt-2 text-xs font-bold text-blue-500 flex gap-1 items-center">🏷️ シール: {matchedStickers.map(s => s.name).join(", ")}</div>}
               </button>
             );
          })}
        </div>
      </div>
    </div>
  );
};