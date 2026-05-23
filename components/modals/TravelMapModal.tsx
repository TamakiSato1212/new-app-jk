"use client";
import React from "react";
import dynamic from "next/dynamic";
import { PageData } from "@/types";

// 🚀 修正ポイント：dynamicインポートをコンポーネントの「外」に出しました！
// これがNext.jsの絶対ルールです。これでVercelがパニックを起こさなくなります。
const MapContent = dynamic(() => import("./MapContent"), { 
  ssr: false, 
  loading: () => <div className="flex-1 flex items-center justify-center text-blue-400 font-bold animate-pulse">地図を準備中...🗺️</div> 
});

type Props = {
  isOpen: boolean;
  onClose: () => void;
  pages: PageData[];
  onJump: (page: PageData) => void;
};

export const TravelMapModal = ({ isOpen, onClose, pages, onJump }: Props) => {
  // ※ useMemoのブロックは削除しました
console.log("Modalに届いたページデータ:", pages);
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex flex-col items-center p-4 pt-10 font-sans" onClick={onClose}>
      <div className="w-full max-w-3xl h-[80vh] bg-[#faf8ef] rounded-3xl overflow-hidden flex flex-col shadow-2xl border-4 border-white" onClick={e => e.stopPropagation()}>
        <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between shadow-sm z-10">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">🗺️ 旅の思い出マップ</h2>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-500 transition">✕</button>
        </div>
        <div className="flex-1 p-2 bg-blue-50 relative z-0">
           <MapContent pages={pages} onJump={(page) => { onClose(); onJump(page); }} />
        </div>
      </div>
    </div>
  );
};