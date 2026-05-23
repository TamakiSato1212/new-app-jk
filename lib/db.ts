import { supabase } from './supabase';
import { PageData, CanvasSticker, CollectionPage, ExchangeDiary } from "../types";

const DB_NAME = "StickerDiaryDB";
const STORE_NAME = "monthly_pages";
const ALBUM_STORE = "my_stickers";
const COLLECTION_STORE = "collection_pages";
const EXCHANGE_STORE = "exchange_diaries"; 
const DB_VERSION = 8; 

// ==========================================
// 📦 パソコン内保存（IndexedDB）の機能
// シール帳、交換日記などは今まで通りローカルに保存します
// ==========================================

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      if (!db.objectStoreNames.contains(ALBUM_STORE)) db.createObjectStore(ALBUM_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(COLLECTION_STORE)) db.createObjectStore(COLLECTION_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(EXCHANGE_STORE)) db.createObjectStore(EXCHANGE_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function saveMonthData(monthKey: string, pages: PageData[]): Promise<void> { return initDB().then(db => new Promise((resolve, reject) => { const tx = db.transaction(STORE_NAME, "readwrite"); tx.objectStore(STORE_NAME).put(pages, monthKey); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); })); }
export const loadMonthData = async (monthKey: string): Promise<PageData[]> => {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // 1. ログイン中なら、クラウド（Supabase）からその月のページを全部取得！
    // date_id が "YYYY-MM" で始まるものをすべて引っ張ります
    const { data, error } = await supabase
      .from('pages')
      .select('*')
      .eq('user_id', user.id)
      .like('date_id', `${monthKey}%`);

    if (!error && data) {
      // データベースの形式をフロントエンドの PageData 形式に変換
      return data.map(row => ({
        id: row.id,
        dateId: row.date_id,
        date: row.date_text,
        diaryText: row.diary_text || "",
        items: row.items || []
      }));
    }
  }

  // 2. ログインしていない（または圏外）なら、今まで通りパソコンの中のデータを取得
  return initDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(monthKey);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  }));
};
// ==========================================
// 📦☁️ アルバム機能（ローカル ＋ クラウドのハイブリッド同期）
// ==========================================

export const saveAlbumSticker = async (sticker: CanvasSticker): Promise<void> => {
  // 1. パソコン（IndexedDB）に爆速で保存
  await initDB().then(db => new Promise<void>((resolve, reject) => { const tx = db.transaction(ALBUM_STORE, "readwrite"); tx.objectStore(ALBUM_STORE).put(sticker); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }));

  // 2. 裏側でコッソリ、クラウド（Supabase）にもバックアップ！
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('album_stickers').upsert({ id: sticker.id, user_id: user.id, sticker_data: sticker });
  }
};

export const loadAlbumStickersFromDB = async (): Promise<CanvasSticker[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    // 1. ログイン中なら、クラウドから最新のシール帳を取得
    const { data, error } = await supabase.from('album_stickers').select('sticker_data').eq('user_id', user.id);
    if (!error && data) return data.map(row => row.sticker_data);
  }
  
  // 2. ログインしていない（または圏外）なら、パソコンの中のシール帳を取得
  return initDB().then(db => new Promise((resolve, reject) => { const tx = db.transaction(ALBUM_STORE, "readonly"); const request = tx.objectStore(ALBUM_STORE).getAll(); request.onsuccess = () => resolve(request.result || []); request.onerror = () => reject(request.error); }));
};

export const deleteAlbumSticker = async (id: string): Promise<void> => {
  // 1. パソコンから削除
  await initDB().then(db => new Promise<void>((resolve, reject) => { const tx = db.transaction(ALBUM_STORE, "readwrite"); tx.objectStore(ALBUM_STORE).delete(id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }));

  // 2. クラウドからも削除
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('album_stickers').delete().eq('id', id).eq('user_id', user.id);
  }
};
// ==========================================
// 📕☁️ コレクション機能（ローカル ＋ クラウドのハイブリッド同期）
// ==========================================

export const saveCollectionPage = async (page: CollectionPage): Promise<void> => {
  // 1. パソコン（IndexedDB）に保存
  await initDB().then(db => new Promise<void>((resolve, reject) => { const tx = db.transaction(COLLECTION_STORE, "readwrite"); tx.objectStore(COLLECTION_STORE).put(page); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }));

  // 2. クラウド（Supabase）にもバックアップ
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('collection_pages').upsert({ id: page.id, user_id: user.id, page_data: page });
  }
};

export const loadCollectionPages = async (): Promise<CollectionPage[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    // 1. ログイン中ならクラウドから取得
    const { data, error } = await supabase.from('collection_pages').select('page_data').eq('user_id', user.id);
    if (!error && data) return data.map(row => row.page_data);
  }
  
  // 2. ログインしていない時はパソコンの中のデータを取得
  return initDB().then(db => new Promise((resolve, reject) => { const tx = db.transaction(COLLECTION_STORE, "readonly"); const request = tx.objectStore(COLLECTION_STORE).getAll(); request.onsuccess = () => resolve(request.result || []); request.onerror = () => reject(request.error); }));
};

export const deleteCollectionPageDB = async (id: string): Promise<void> => {
  // 1. パソコンから削除
  await initDB().then(db => new Promise<void>((resolve, reject) => { const tx = db.transaction(COLLECTION_STORE, "readwrite"); tx.objectStore(COLLECTION_STORE).delete(id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }));

  // 2. クラウドからも削除
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('collection_pages').delete().eq('id', id).eq('user_id', user.id);
  }
};
export const saveExchangeDiary = async (diary: ExchangeDiary): Promise<void> => {
  await initDB().then(db => new Promise<void>((resolve, reject) => { const tx = db.transaction(EXCHANGE_STORE, "readwrite"); tx.objectStore(EXCHANGE_STORE).put(diary); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }));
};
export const loadExchangeDiaries = async (): Promise<ExchangeDiary[]> => {
  return initDB().then(db => new Promise((resolve, reject) => { const tx = db.transaction(EXCHANGE_STORE, "readonly"); const request = tx.objectStore(EXCHANGE_STORE).getAll(); request.onsuccess = () => resolve(request.result || []); request.onerror = () => reject(request.error); }));
};
export const deleteExchangeDiary = async (id: string): Promise<void> => {
  await initDB().then(db => new Promise<void>((resolve, reject) => { const tx = db.transaction(EXCHANGE_STORE, "readwrite"); tx.objectStore(EXCHANGE_STORE).delete(id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }));
};

export function searchAllMonths(keyword: string): Promise<PageData[]> {
  return initDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const allMonthsData: PageData[][] = request.result || [];
      const kw = keyword.toLowerCase();
      const matched = allMonthsData.flat().filter(p => {
        if (p.diaryText && p.diaryText.toLowerCase().includes(kw)) return true;
        if (p.items.some(i => i.type === "text" && i.content.toLowerCase().includes(kw))) return true;
        if (p.items.some(i => i.type === "sticker" && i.name && i.name.toLowerCase().includes(kw))) return true;
        return false;
      });
      resolve(matched);
    };
    request.onerror = () => reject(request.error);
  })); 
}

// ==========================================
// ☁️ クラウド保存（Supabase）の機能
// メインの日記データはこちらに保存します
// ==========================================

export const savePage = async (dateId: string, dateText: string, text: string, items: any[]) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existingPage } = await supabase
    .from('pages')
    .select('id')
    .eq('user_id', user.id)
    .eq('date_id', dateId)
    .single();

  if (existingPage) {
    await supabase.from('pages').update({ date_text: dateText, diary_text: text, items: items }).eq('id', existingPage.id);
  } else {
    await supabase.from('pages').insert({ user_id: user.id, date_id: dateId, date_text: dateText, diary_text: text, items: items });
  }
};

export const getPage = async (dateId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from('pages').select('*').eq('user_id', user.id).eq('date_id', dateId).single();
  if (error && error.code !== 'PGRST116') console.error("🚨 読み込みエラー:", error.message);
  return data;
};

export const getAllSavedDateIds = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.from('pages').select('date_id').eq('user_id', user.id);
  if (error) return [];
  return data.map(row => row.date_id);
};

// ==========================================
// 🎁 クラウド通信：シール交換（トレード）機能
// ==========================================

/**
 * シールを他のユーザーに送信する（GPS情報は強制削除！）
 */
export const sendTradeRequest = async (targetSearchId: string, sticker: any) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  // 1. 相手のID（@あり・なし両対応）から相手の情報を探す
  const cleanId = targetSearchId.replace('@', '');
  const { data: receiverProfile } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('search_id', cleanId)
    .single();

  if (!receiverProfile) throw new Error("指定されたIDのユーザーが見つかりません🔍");
  if (receiverProfile.id === user.id) throw new Error("自分自身には送れません🙅‍♂️");

  // 2. 🛡️ 【最重要セキュリティ】位置情報（GPS）のサニタイズ（無害化）
  // 参照渡しを防ぐため、一度JSONにしてディープコピーを作成します
  const sanitizedSticker = JSON.parse(JSON.stringify(sticker));
  
  // 🚨 ここで location（GPSデータ）をオブジェクトから完全に消滅させます！
  delete sanitizedSticker.location; 

  // 3. 郵便局（tradesテーブル）にサニタイズ済みのデータを投函
  const { error } = await supabase.from('trades').insert({
    sender_id: user.id,
    receiver_id: receiverProfile.id,
    offered_sticker: sanitizedSticker
  });

  if (error) throw new Error("送信エラー: " + error.message);
  
  return receiverProfile.display_name; // 成功時、画面表示用に相手の名前を返す
};

/**
 * 自分宛てに届いているシールの確認
 */
export const getPendingTrades = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // 1. 自分宛ての「保留中(pending)」のトレードを取得
  const { data: trades, error } = await supabase
    .from('trades')
    .select('*')
    .eq('receiver_id', user.id)
    .eq('status', 'pending');

  if (error || !trades) return [];

  // 2. 送ってくれた人の「名前」を取得してデータに合体させる
  const tradesWithNames = await Promise.all(trades.map(async (trade) => {
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', trade.sender_id)
      .single();
      
    return {
      ...trade,
      sender_name: senderProfile?.display_name || "名無しさん"
    };
  }));

  return tradesWithNames;
};

/**
 * 届いたシールを受け取る（または拒否する）
 */
export const respondToTrade = async (tradeId: string, isAccepted: boolean) => {
  const { error } = await supabase
    .from('trades')
    .update({ status: isAccepted ? 'accepted' : 'rejected' })
    .eq('id', tradeId);

  if (error) throw new Error("処理に失敗しました");
};

// ==========================================
// 🗺️ クラウド通信：地図（TravelMap）承認システム
// ==========================================

/**
 * 友達に地図を見る許可（ゲストパス）を出す
 */
export const grantMapPermission = async (targetSearchId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const cleanId = targetSearchId.replace('@', '');
  
  // 1. 相手を探す
  const { data: friendProfile } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('search_id', cleanId)
    .single();

  if (!friendProfile) throw new Error("指定されたIDのユーザーが見つかりません🔍");
  if (friendProfile.id === user.id) throw new Error("自分自身には許可を出せません🙅‍♂️");

  // 2. 許可証を発行してデータベースに保存
  const { error } = await supabase
    .from('map_permissions')
    .insert({
      owner_id: user.id,
      viewer_id: friendProfile.id
    });

  // ユニーク制約違反（すでに許可済み）のエラーをキャッチ
  if (error && error.code === '23505') {
    throw new Error("その人にはすでに許可を出しています✅");
  } else if (error) {
    throw new Error("許可の処理に失敗しました: " + error.message);
  }

  return friendProfile.display_name; // 成功したら相手の名前を返す
};

/**
 * 現在、地図を見る許可を出している友達のリストを取得する
 */
export const getPermittedFriends = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // 1. 自分が許可を出した相手のIDをすべて取得
  const { data, error } = await supabase
    .from('map_permissions')
    .select('viewer_id')
    .eq('owner_id', user.id);

  if (error || !data) return [];

  const viewerIds = data.map(row => row.viewer_id);
  if (viewerIds.length === 0) return [];

  // 2. その相手の名前と検索IDを取得して合体させる
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, search_id')
    .in('id', viewerIds);

  return profiles || [];
};

/**
 * 地図を見る許可（ゲストパス）を没収（解除）する
 */
export const revokeMapPermission = async (viewerId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('map_permissions')
    .delete()
    .eq('owner_id', user.id)
    .eq('viewer_id', viewerId);

  if (error) throw new Error("解除に失敗しました");
};