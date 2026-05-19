"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
};

export const AuthModal = ({ isOpen, onClose, onSuccess }: Props) => {
  const [isSignUp, setIsSignUp] = useState(false); // 新規登録かログインかの切り替え
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (isSignUp) {
        // ★ Supabaseで新規アカウント作成
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("アカウントを作成しました！確認メールをチェックするか、そのままログインしてください。");
        if (data.user) onSuccess(data.user);
        onClose();
      } else {
        // ★ Supabaseでログイン
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) onSuccess(data.user);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    // 🚀 外枠：どんな画面サイズでも確実に中央に寄せる（Flexboxを使用）
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 p-4 font-sans" onClick={onClose}>
      
      {/* 🚀 内枠：最大幅をスマホサイズに制限し、はみ出しを防止 */}
      <div 
        className="w-full max-w-[340px] sm:max-w-md bg-white rounded-3xl p-5 shadow-2xl flex flex-col gap-4 animate-fade-in-up overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          {/* タイトルも少しコンパクトに調整 */}
          <h2 className="text-lg font-black text-gray-800 tracking-wider">
            {isSignUp ? "🔐 新規登録" : "🔑 ログイン"}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex-shrink-0 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-400 transition">✕</button>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-500 rounded-xl p-3 text-xs font-bold break-words">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500 pl-1">メールアドレス</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="example@email.com" className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-400 font-medium transition text-gray-800 w-full" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500 pl-1">パスワード</label>
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="6文字以上" className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-400 font-medium transition text-gray-800 w-full" />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl shadow-md shadow-purple-100 transition mt-2 disabled:opacity-50 text-sm">
            {loading ? "通信中..." : isSignUp ? "アカウントを作成する" : "ログインする"}
          </button>
        </form>

        <div className="text-center mt-2 border-t border-gray-100 pt-4">
          {/* 🚀 最重要ポイント：長い文字を折り返す（whitespace-normal break-words） */}
          <button type="button" onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(null); }} className="text-xs font-bold text-purple-500 hover:text-purple-600 underline transition whitespace-normal break-words leading-relaxed w-full">
            {isSignUp ? "すでにアカウントをお持ちの方はこちら" : "初めての方はこちら（新規登録）"}
          </button>
        </div>
      </div>
    </div>
  );
};