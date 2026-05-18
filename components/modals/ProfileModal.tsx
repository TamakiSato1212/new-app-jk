"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
// ★ 追加：先ほど作った地図の許可システム用の関数をインポート
import { grantMapPermission, getPermittedFriends, revokeMapPermission } from "@/lib/db";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  user: any;
};

export const ProfileModal = ({ isOpen, onClose, user }: Props) => {
  // --- 👤 プロフィール用のステート ---
  const [displayName, setDisplayName] = useState("");
  const [searchId, setSearchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);

  // --- 🗺️ 地図共有（許可証）用のステート ---
  const [friendIdInput, setFriendIdInput] = useState("");
  const [permittedFriends, setPermittedFriends] = useState<any[]>([]);
  const [permLoading, setPermLoading] = useState(false);
  const [permMsg, setPermMsg] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      loadProfile();
      loadPermissions(); // ★ 画面が開いた時に、許可を出している人のリストも読み込む
    }
  }, [isOpen, user]);

  const loadProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (data) {
      setDisplayName(data.display_name);
      setSearchId(data.search_id);
    }
  };

  const loadPermissions = async () => {
    try {
      const friends = await getPermittedFriends();
      setPermittedFriends(friends);
    } catch (err) {
      console.error("許可リストの読み込みエラー:", err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErrorMsg(null); setSuccessMsg(false);

    if (!/^[a-zA-Z0-9_]+$/.test(searchId)) {
      setErrorMsg("検索IDは半角英数字とアンダーバー(_)のみ使えます");
      setLoading(false); return;
    }

    try {
      const { error } = await supabase.from("profiles").upsert({ id: user.id, display_name: displayName, search_id: searchId });
      if (error) throw error;
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 2000); // 閉じずにメッセージだけ消す
    } catch (err: any) {
      if (err.code === '23505') setErrorMsg("この検索IDはすでに他の人が使っています🙇‍♂️");
      else setErrorMsg(err.message || "保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // ★ 許可証を発行する処理
  const handleGrantPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendIdInput.trim()) return;
    setPermLoading(true); setPermMsg(null);
    try {
      const friendName = await grantMapPermission(friendIdInput);
      setPermMsg({ type: 'success', text: `${friendName}さんに地図の閲覧を許可しました！🗺️` });
      setFriendIdInput(""); // 入力欄をリセット
      loadPermissions();    // リストを最新にする
    } catch (err: any) {
      setPermMsg({ type: 'error', text: err.message });
    } finally {
      setPermLoading(false);
    }
  };

  // ★ 許可証を没収（削除）する処理
  const handleRevokePermission = async (viewerId: string, name: string) => {
    if (!confirm(`${name}さんの閲覧許可を取り消しますか？\n（相手はあなたの地図を見られなくなります）`)) return;
    try {
      await revokeMapPermission(viewerId);
      loadPermissions(); // リストを最新にする
    } catch (err: any) {
      alert("解除エラー: " + err.message);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 font-sans" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        
        {/* ヘッダー */}
        <div className="sticky top-0 bg-white/95 backdrop-blur z-10 flex justify-between items-center border-b border-gray-100 p-5 rounded-t-3xl">
          <h2 className="text-xl font-black text-gray-800 tracking-wider">⚙️ 設定</h2>
          <button onClick={onClose} className="w-8 h-8 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-400 transition">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-6">
          {/* ========================================== */}
          {/* 👤 プロフィール設定セクション */}
          {/* ========================================== */}
          <section className="flex flex-col gap-3">
            <h3 className="font-bold text-gray-700 border-b border-purple-100 pb-1">👤 マイプロフィール</h3>
            
            {errorMsg && <div className="bg-red-50 border border-red-200 text-red-500 rounded-xl p-3 text-xs font-bold">⚠️ {errorMsg}</div>}
            {successMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl p-3 text-xs font-bold">✨ プロフィールを保存しました！</div>}

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 pl-1">表示名（ニックネーム）</label>
                <input type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="例：たまき" className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-400 font-medium transition text-gray-800" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 pl-1">検索用ID</label>
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus-within:border-purple-400 transition">
                  <span className="text-gray-400 font-bold mr-1">@</span>
                  <input type="text" required value={searchId} onChange={e => setSearchId(e.target.value)} placeholder="tamaki_diary" className="bg-transparent text-sm outline-none font-medium text-gray-800 w-full" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl shadow-md shadow-purple-100 transition mt-1 disabled:opacity-50 text-sm">
                {loading ? "保存中..." : "プロフィールを保存"}
              </button>
            </form>
          </section>

          {/* ========================================== */}
          {/* 🗺️ 地図の共有設定（パスポート管理）セクション */}
          {/* ========================================== */}
          <section className="flex flex-col gap-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
            <h3 className="font-bold text-blue-800 border-b border-blue-200 pb-1 flex items-center gap-1">🗺️ 地図の共有設定 <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">プライバシー</span></h3>
            <p className="text-[10px] text-gray-500 font-bold leading-relaxed">
              ここで許可を出した人だけが、あなたの TravelMap（位置情報付きシール）を見ることができます。
            </p>

            {permMsg && (
              <div className={`border rounded-xl p-3 text-xs font-bold ${permMsg.type === 'error' ? 'bg-red-50 border-red-200 text-red-500' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                {permMsg.type === 'error' ? '⚠️ ' : ''}{permMsg.text}
              </div>
            )}

            {/* 許可の追加フォーム */}
            <form onSubmit={handleGrantPermission} className="flex gap-2">
              <input type="text" required value={friendIdInput} onChange={e => setFriendIdInput(e.target.value)} placeholder="許可する相手のID (@不要)" className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-400 font-medium transition text-gray-800" />
              <button type="submit" disabled={permLoading} className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-4 py-2 rounded-xl transition shadow-sm disabled:opacity-50 text-xs whitespace-nowrap">
                追加
              </button>
            </form>

            {/* 許可している人のリスト */}
            <div className="flex flex-col gap-2 mt-2">
              <div className="text-xs font-bold text-gray-500 pl-1">現在許可している人 ({permittedFriends.length}人)</div>
              {permittedFriends.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-300 rounded-xl p-4 text-center text-xs text-gray-400 font-bold">
                  現在、誰にも許可を出していません🔒<br/>（あなた以外は地図を見られません）
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {permittedFriends.map(friend => (
                    <li key={friend.id} className="bg-white border border-gray-200 rounded-xl p-3 flex justify-between items-center shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-800">{friend.display_name}</span>
                        <span className="text-[10px] font-bold text-gray-400">@{friend.search_id}</span>
                      </div>
                      <button onClick={() => handleRevokePermission(friend.id, friend.display_name)} className="bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 px-3 py-1.5 rounded-lg text-xs font-bold transition">
                        解除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};