"use client";
import React, { useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (partner: string, category: "lover" | "friend" | "family") => void;
};

export const NewExchangeModal = ({ isOpen, onClose, onSubmit }: Props) => {
  const [partner, setPartner] = useState("");
  const [category, setCategory] = useState<"lover" | "friend" | "family">("lover");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex flex-col items-center p-4 pt-20 font-sans" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden flex flex-col shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">新しい交換日記をはじめる</h2>
        <label className="text-xs font-bold text-gray-500 mb-1 block">相手の名前</label>
        <input type="text" value={partner} onChange={e => setPartner(e.target.value)} placeholder="おともだち" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none text-gray-700 focus:border-pink-400 font-bold mb-4" autoFocus />
        <label className="text-xs font-bold text-gray-500 mb-1 block">相手との関係</label>
        <div className="flex gap-2 mb-6">
          <button onClick={() => setCategory("lover")} className={`flex-1 py-2 rounded-xl font-bold text-sm transition border ${category === "lover" ? "bg-pink-100 border-pink-300 text-pink-700" : "bg-white border-gray-200 text-gray-500"}`}>💑 恋人</button>
          <button onClick={() => setCategory("friend")} className={`flex-1 py-2 rounded-xl font-bold text-sm transition border ${category === "friend" ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-white border-gray-200 text-gray-500"}`}>🤝 友達</button>
          <button onClick={() => setCategory("family")} className={`flex-1 py-2 rounded-xl font-bold text-sm transition border ${category === "family" ? "bg-amber-100 border-amber-300 text-amber-700" : "bg-white border-gray-200 text-gray-500"}`}>🏡 家族</button>
        </div>
        <div className="flex flex-col gap-3">
          <button onClick={() => { onSubmit(partner, category); setPartner(""); }} disabled={!partner.trim()} className="w-full bg-pink-500 disabled:bg-gray-300 text-white py-3 rounded-2xl font-bold text-lg shadow-sm">はじめる</button>
          <button onClick={onClose} className="w-full bg-gray-100 text-gray-500 py-3 rounded-2xl font-bold hover:bg-gray-200">キャンセル</button>
        </div>
      </div>
    </div>
  );
};