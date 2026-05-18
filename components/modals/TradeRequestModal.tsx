"use client";
import React from "react";
import { CanvasSticker } from "@/types";

type Props = {
  tradeRequest: { offerStickerSrc: string; targetStickerId: string; partnerName: string } | null;
  albumStickers: CanvasSticker[];
  onClose: () => void;
  onAccept: () => void;
};

export const TradeRequestModal = ({ tradeRequest, albumStickers, onClose, onAccept }: Props) => {
  if (!tradeRequest) return null;

  return (
    <div className="absolute inset-0 bg-black/60 z-[300] flex items-center justify-center p-4" onClick={onClose}>
       <div className="bg-white rounded-3xl w-full max-w-sm p-6 flex flex-col items-center shadow-2xl" onClick={e => e.stopPropagation()}>
          <h3 className="font-bold text-lg text-gray-800 mb-2">💌 交換リクエスト！</h3>
          <p className="text-xs text-gray-600 mb-6 text-center">『{tradeRequest.partnerName}』ちゃんが、<br/>あなたのシールと交換したがっています！</p>
          
          <div className="flex items-center gap-4 w-full justify-center mb-8 bg-blue-50 py-4 rounded-xl border border-blue-100">
             <div className="flex flex-col items-center w-24">
                <span className="text-[10px] font-bold text-gray-500 mb-2">あなたのシール</span>
                <img src={albumStickers.find(s=>s.id===tradeRequest.targetStickerId)?.src} className="w-16 h-16 object-contain bg-white rounded-lg p-1 shadow-sm" />
             </div>
             <div className="text-2xl text-blue-400 font-bold animate-pulse">⇄</div>
             <div className="flex flex-col items-center w-24">
                <span className="text-[10px] font-bold text-blue-500 mb-2">相手のシール</span>
                <img src={tradeRequest.offerStickerSrc} className="w-16 h-16 object-contain drop-shadow-md" />
             </div>
          </div>

          <div className="flex gap-3 w-full">
             <button onClick={onAccept} className="flex-1 bg-blue-500 text-white py-3 rounded-xl font-bold shadow-md hover:bg-blue-600">交換する！</button>
             <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-bold hover:bg-gray-200">やめる</button>
          </div>
       </div>
    </div>
  );
};