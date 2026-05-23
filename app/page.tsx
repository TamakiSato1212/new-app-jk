"use client";

import React, { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";
// ★ 地図（Leaflet）のエラーを防ぐための「ダイナミックインポート」を追加！
import dynamic from 'next/dynamic';

import { CanvasSticker, CanvasText, CanvasDrawing, CanvasItem, PageData, CollectionPage, ExchangeDiary, CropShape, HistoryState } from "@/types";
import { supabase } from "@/lib/supabase"; // ★ ログイン状態を復元するために追加
import { saveMonthData, loadMonthData, saveAlbumSticker, loadAlbumStickersFromDB, deleteAlbumSticker, saveCollectionPage, loadCollectionPages, deleteCollectionPageDB, saveExchangeDiary, loadExchangeDiaries, deleteExchangeDiary, searchAllMonths, savePage, getPage, sendTradeRequest, getPendingTrades, respondToTrade } from "@/lib/db";
import { InlineScratch, ScratchCard } from "@/components/common/Scratch";
import { SearchModal } from "@/components/modals/SearchModal";
import { ImageCropModal } from "@/components/modals/ImageCropModal";
import { NewExchangeModal } from "@/components/modals/NewExchangeModal";
import { TradeRequestModal } from "@/components/modals/TradeRequestModal";
import { AlbumModal } from "@/components/modals/AlbumModal";
import { AuthModal } from "@/components/modals/AuthModal";
import { ProfileModal } from "@/components/modals/ProfileModal";

// ★ SSRの罠を回避！TravelMapModalをクライアント側（画面がある場所）でのみ読み込む魔法
const TravelMapModal = dynamic(() => import('@/components/modals/TravelMapModal').then(mod => mod.TravelMapModal), { ssr: false });

const GRID_SIZE = 24;
const getDateString = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const BG_OPTIONS = [ { name: "アイボリー", class: "bg-[#faf8ef]" }, { name: "パステルピンク", class: "bg-pink-50" }, { name: "パステルブルー", class: "bg-blue-50" }, { name: "ミントグリーン", class: "bg-emerald-50" }, { name: "ラベンダー", class: "bg-purple-50" }, { name: "ダークモード", class: "bg-gray-800" } ];
const DECORATIONS = [ { id: "none", icon: "✨", label: "なし" }, { id: "polaroid", icon: "🖼️", label: "チェキ" }, { id: "diecut", icon: "✂️", label: "白フチ" }, { id: "stamp", icon: "📮", label: "切手" }, { id: "film", icon: "🎞️", label: "フィルム" }, { id: "tape", icon: "🎀", label: "マステ" }, { id: "pin", icon: "📌", label: "ピン" }, { id: "memo", icon: "📝", label: "メモ" }, { id: "torn", icon: "📄", label: "ちぎり" }, { id: "texture", icon: "🎨", label: "画用紙" }, { id: "neon", icon: "🌟", label: "ネオン" } ];
const ANIMATIONS = [ { id: "none", icon: "⏹️", label: "なし" }, { id: "float", icon: "🎈", label: "フワフワ" }, { id: "shake", icon: "🥶", label: "ブルブル" }, { id: "heartbeat", icon: "💓", label: "ドキドキ" }, { id: "swing", icon: "🔔", label: "ゆらゆら" }, { id: "flash", icon: "🌟", label: "キラキラ" } ];

export default function StickerMaker() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"calendar" | "editor" | "collections" | "collection_editor" | "exchange_list" | "exchange_editor">("calendar");
  
  const [pages, setPages] = useState<PageData[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [collectionPages, setCollectionPages] = useState<CollectionPage[]>([]);
  const [currentCollectionId, setCurrentCollectionId] = useState<string | null>(null);

  const [exchangeDiaries, setExchangeDiaries] = useState<ExchangeDiary[]>([]);
  const [currentExchangeId, setCurrentExchangeId] = useState<string | null>(null);

  const [showPreviews, setShowPreviews] = useState(true);
  const [history, setHistory] = useState<HistoryState[]>([]);
  
  const [isNewExchangeModalOpen, setIsNewExchangeModalOpen] = useState(false);
  const [isAlbumOpen, setIsAlbumOpen] = useState(false);
  const [albumStickers, setAlbumStickers] = useState<CanvasSticker[]>([]);
  const [tradeRequest, setTradeRequest] = useState<{offerStickerSrc: string, targetStickerId: string, partnerName: string, tradeId?: string, sticker?: any} | null>(null);

  const [isTravelMapOpen, setIsTravelMapOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PageData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isGridMode, setIsGridMode] = useState(false); 
  const [isPenMode, setIsPenMode] = useState(false);
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [penColor, setPenColor] = useState("#ef4444");
  const [penSize, setPenSize] = useState(4); 
  const [eraserSize, setEraserSize] = useState(25);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef(false);

  const [isEditingText, setIsEditingText] = useState(false);
  const [selectedTextRange, setSelectedTextRange] = useState<{start: number, end: number} | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [pendingLocation, setPendingLocation] = useState<{lat: number, lng: number} | null>(null);
  const diaryRef = useRef<HTMLDivElement>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [initialPositions, setInitialPositions] = useState<Record<string, {x: number, y: number}>>({});
  const selectedId = selectedIds.length === 1 && !isMultiSelectMode ? selectedIds[0] : null;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeOp, setActiveOp] = useState<"move" | "resize" | "rotate" | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [initialVal, setInitialVal] = useState(0);
  const [startPointerPos, setStartPointerPos] = useState({ x: 0, y: 0 });

  const snap = (value: number) => isGridMode ? Math.round(value / GRID_SIZE) * GRID_SIZE : value;

  // ★ リロード時にログイン状態を復元する処理を追加
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    checkUser();

    // ログイン状態が変わった時の監視もセット
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  // ★ ログアウト処理を追加（画面のデータもリセット）
  const handleLogout = async () => {
    if (confirm("ログアウトしますか？")) {
      await supabase.auth.signOut();
      setUser(null);
      // 画面に残っているデータをカラッポにする！
      setPages([]);
      setAlbumStickers([]);
      setCollectionPages([]);
      setExchangeDiaries([]);
      setViewMode("calendar");
      // 新しい月として再読み込み（空のデータになります）
      const mKey = getMonthKey(currentMonth);
      setPages(await loadMonthData(mKey));
      alert("ログアウトしました");
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const mKey = getMonthKey(currentMonth);
        setPages(await loadMonthData(mKey));
        setAlbumStickers(await loadAlbumStickersFromDB());
        setCollectionPages(await loadCollectionPages());
        setExchangeDiaries(await loadExchangeDiaries());
      } catch(e) { console.error(e); }
      setIsLoaded(true);
    };
    loadData();
  }, [currentMonth, user]); // ★ user（ログイン状態）が変わった時も再読み込みする

  useEffect(() => { 
    if (isLoaded) {
      saveMonthData(getMonthKey(currentMonth), pages).catch(e => console.error(e)); 
      
      if (user && viewMode === "editor") {
        const activePage = pages[currentPageIndex];
        if (activePage) {
          savePage(activePage.dateId, activePage.date, activePage.diaryText || "", activePage.items)
            .catch(e => console.error("クラウド保存エラー:", e));
        }
      }
    }
  }, [pages, isLoaded, currentMonth, user, viewMode, currentPageIndex]);

  useEffect(() => { if (isLoaded && currentCollectionId) { const target = collectionPages.find(c => c.id === currentCollectionId); if (target) saveCollectionPage(target).catch(e => console.error(e)); } }, [collectionPages, isLoaded, currentCollectionId]);
  useEffect(() => { if (isLoaded && currentExchangeId) { const target = exchangeDiaries.find(e => e.id === currentExchangeId); if (target) saveExchangeDiary(target).catch(e => console.error(e)); } }, [exchangeDiaries, isLoaded, currentExchangeId]);

  const currentPage = viewMode === "editor" ? pages[currentPageIndex] : null;
  const currentCollection = viewMode === "collection_editor" ? collectionPages.find(c => c.id === currentCollectionId) : null;
  const currentExchange = viewMode === "exchange_editor" ? exchangeDiaries.find(e => e.id === currentExchangeId) : null;
  
  const currentItems = (viewMode === "editor" ? currentPage?.items : (viewMode === "collection_editor" ? currentCollection?.items : (viewMode === "exchange_editor" ? currentExchange?.items : []))) || [];
  const currentText = viewMode === "editor" ? currentPage?.diaryText : (viewMode === "exchange_editor" ? currentExchange?.diaryText : "");

  const updateCurrentPage = (newData: Partial<PageData>) => { setPages(prev => prev.map((p, i) => i === currentPageIndex ? { ...p, ...newData } : p)); };
  
  const updateCurrentItems = (newItems: CanvasItem[]) => {
    if (viewMode === "editor") setPages(prev => prev.map((p, i) => i === currentPageIndex ? { ...p, items: newItems } : p));
    else if (viewMode === "collection_editor" && currentCollectionId) setCollectionPages(prev => prev.map(c => c.id === currentCollectionId ? { ...c, items: newItems } : c));
    else if (viewMode === "exchange_editor" && currentExchangeId) setExchangeDiaries(prev => prev.map(e => e.id === currentExchangeId ? { ...e, items: newItems } : e));
  };

  const updateCurrentText = (text: string) => { 
    if (viewMode === "editor") updateCurrentPage({ diaryText: text });
    else if (viewMode === "exchange_editor" && currentExchangeId) setExchangeDiaries(prev => prev.map(e => e.id === currentExchangeId ? { ...e, diaryText: text } : e)); 
  };

  const saveHistory = () => {
    if (viewMode !== "editor") return; 
    setHistory(prev => { if (prev.length > 0 && JSON.stringify(prev[prev.length - 1].pages) === JSON.stringify(pages)) return prev; return [...prev.slice(-29), { pages: JSON.parse(JSON.stringify(pages)), currentPageIndex }]; });
  };

  const undo = () => { if (history.length === 0) return; const previousState = history[history.length - 1]; setPages(previousState.pages); setCurrentPageIndex(previousState.currentPageIndex); setHistory(prev => prev.slice(0, -1)); setSelectedIds([]); };

  const moveUp = (id: string) => {
    if (!currentItems) return;
    const index = currentItems.findIndex(i => i.id === id);
    if (index < 0) return;
    let nextIndex = -1;
    for (let i = index + 1; i < currentItems.length; i++) {
      if (currentItems[i].type !== "drawing") { nextIndex = i; break; }
    }
    if (nextIndex === -1) {
      if (index !== currentItems.length - 1) {
        saveHistory();
        const newItems = [...currentItems];
        const [target] = newItems.splice(index, 1);
        newItems.push(target);
        updateCurrentItems(newItems);
      }
      return; 
    }
    saveHistory();
    const newItems = [...currentItems];
    [newItems[index], newItems[nextIndex]] = [newItems[nextIndex], newItems[index]];
    updateCurrentItems(newItems);
  };

  const moveDown = (id: string) => {
    if (!currentItems) return;
    const index = currentItems.findIndex(i => i.id === id);
    if (index <= 0) return;
    let prevIndex = -1;
    for (let i = index - 1; i >= 0; i--) {
      if (currentItems[i].type !== "drawing") { prevIndex = i; break; }
    }
    if (prevIndex === -1) {
      if (index !== 0) {
        saveHistory();
        const newItems = [...currentItems];
        const [target] = newItems.splice(index, 1);
        newItems.unshift(target);
        updateCurrentItems(newItems);
      }
      return; 
    }
    saveHistory();
    const newItems = [...currentItems];
    [newItems[index], newItems[prevIndex]] = [newItems[prevIndex], newItems[index]];
    updateCurrentItems(newItems);
  };

  const deleteSelected = () => {
    if (!currentItems || selectedIds.length === 0) return;
    saveHistory();
    updateCurrentItems(currentItems.filter(i => !selectedIds.includes(i.id)));
    setSelectedIds([]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setImageSrc(event.target?.result as string);
      reader.readAsDataURL(file);
      import('exifr').then(exifr => {
        exifr.default.gps(file).then(gps => {
          if (gps) setPendingLocation({ lat: gps.latitude, lng: gps.longitude });
          else setPendingLocation(null);
        }).catch(() => setPendingLocation(null));
      }).catch(() => setPendingLocation(null));
    }
    e.target.value = ""; 
  };

  const handleCropComplete = async (newStickerData: any, saveToAlbum: boolean) => {
    // ... (中略) ...
    const newS: CanvasSticker = { 
      id: "s-" + Date.now(), type: "sticker", src: newStickerData.src, x: snap(40), y: snap(150), 
      width: snap(newStickerData.width), height: newStickerData.height, name: newStickerData.name,
      usageCount: 0, lastUsed: Date.now(), isFavorite: false, decoration: "none", animation: "none", rotation: 0, isSecret: false, isPublished: false, 
      // 🚀 変更：GPSがない画像でも、仮で緯度経度（会津周辺）をセットして地図に表示させる！
      location: pendingLocation || { lat: 37.5274, lng: 139.9396 }
    };

  const handleApplySecretToText = () => {
    if (!selectedTextRange || currentText === undefined) return;
    const { start, end } = selectedTextRange; const textStr = currentText || "";
    const before = textStr.substring(0, start); const selected = textStr.substring(start, end); const after = textStr.substring(end);
    updateCurrentText(`${before}[[SECRET:${selected}]]${after}`); setSelectedTextRange(null); setIsEditingText(false); 
  };

  const renderParsedText = (text: string | undefined) => {
    if (!text) return null;
    const parts = text.split(/(\[\[SECRET:.*?\]\])/g);
    return parts.map((part, i) => {
      if (part.startsWith("[[SECRET:") && part.endsWith("]]")) { const secretContent = part.slice(9, -2); return <InlineScratch key={i} text={secretContent} />; }
      return <span key={i}>{part}</span>;
    });
  };

  const getDeleteLabel = () => {
    if (selectedIds.length > 0) return `削除 (${selectedIds.length})`;
    if (viewMode === "editor") return "ページ削除";
    if (viewMode === "collection_editor") return "コレクション削除";
    if (viewMode === "exchange_editor") return "交換日記削除";
    return "削除";
  };

  const handleDelete = async () => {
    if (selectedIds.length > 0) {
      deleteSelected();
    } else {
      if (viewMode === "editor") { if(confirm("このページを削除しますか？")) deletePage(currentPageIndex); } 
      else if (viewMode === "collection_editor" && currentCollectionId) { if(confirm("このコレクションを削除しますか？")) { await deleteCollectionPageDB(currentCollectionId); setCollectionPages(await loadCollectionPages()); setViewMode("collections"); } } 
      else if (viewMode === "exchange_editor" && currentExchangeId) { if(confirm("この交換日記を削除しますか？")) { await deleteExchangeDiary(currentExchangeId); setExchangeDiaries(await loadExchangeDiaries()); setViewMode("exchange_list"); } }
    }
  };

  const createNewCollection = async () => { const newPage: CollectionPage = { id: "c-" + Date.now(), title: "新しいコレクション", bgClass: "bg-[#faf8ef]", items: [] }; await saveCollectionPage(newPage); setCollectionPages(await loadCollectionPages()); setCurrentCollectionId(newPage.id); setViewMode("collection_editor"); };
  const handleCreateExchangeSubmit = async (partnerName: string, category: "lover" | "friend" | "family") => { let bg = "bg-pink-50"; if (category === "friend") bg = "bg-blue-50"; if (category === "family") bg = "bg-amber-50"; const newDiary: ExchangeDiary = { id: "e-" + Date.now(), title: `${partnerName} との交換日記`, partnerName: partnerName, currentTurn: "me", bgClass: bg, category: category, items: [], diaryText: "" }; await saveExchangeDiary(newDiary); setExchangeDiaries(await loadExchangeDiaries()); setCurrentExchangeId(newDiary.id); setViewMode("exchange_editor"); setIsNewExchangeModalOpen(false); };
  const handlePassNotebook = async () => { if(!currentExchangeId) return; if(confirm("ノートを相手に渡しますか？\n（相手から返ってくるまで書き込めなくなります）")) { setExchangeDiaries(prev => prev.map(e => e.id === currentExchangeId ? { ...e, currentTurn: "partner" } : e)); setSelectedIds([]); setIsEditingText(false); alert("ノートを渡しました！相手からの返事を待ちましょう⏳"); } };
  const handleReturnNotebook = async () => { if(!currentExchangeId) return; setExchangeDiaries(prev => prev.map(e => e.id === currentExchangeId ? { ...e, currentTurn: "me" } : e)); alert("相手からノートが返ってきました！✨"); };

  const getExchangeHeaderBorderClass = (cat?: string) => { if (cat === "friend") return "border-blue-300"; if (cat === "family") return "border-amber-300"; return "border-pink-300"; };

 const openDiary = async (y: number, m: number, d: number) => {
    const targetDateId = getDateString(y, m, d); 
    let existingIndex = pages.findIndex(p => p.dateId === targetDateId);
    
    if (existingIndex >= 0) {
      setCurrentPageIndex(existingIndex);
    } else {
      const dateObj = new Date(y, m, d); const displayDate = dateObj.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
      const newPage: PageData = { id: "p-" + Date.now(), dateId: targetDateId, items: [], diaryText: "", date: displayDate };
      const newPages = [...pages, newPage]; setPages(newPages); setCurrentPageIndex(newPages.length - 1);
      existingIndex = newPages.length - 1; 
    }
    
    setViewMode("editor"); setIsPenMode(false); setIsEraserMode(false); setSelectedIds([]); setIsEditingText(false); setIsMultiSelectMode(false);

    if (user) {
      const cloudData = await getPage(targetDateId);
      if (cloudData) {
        setPages(prev => {
          const newPages = [...prev];
          if (newPages[existingIndex]) {
            newPages[existingIndex] = {
              ...newPages[existingIndex],
              diaryText: cloudData.diary_text || "",
              items: cloudData.items || []
            };
          }
          return newPages;
        });
      }
    }
  };

  const addNewPage = () => {
    if (!currentPage) return; saveHistory();
    const newPage: PageData = { id: "p-" + Date.now(), dateId: currentPage.dateId, items: [], diaryText: "", date: currentPage.date };
    const newPages = [...pages, newPage]; setPages(newPages); setCurrentPageIndex(newPages.length - 1); setSelectedIds([]); setShowPreviews(false); setIsEditingText(false);
  };

  const deletePage = (index: number) => {
    if (!currentPage) return; const targetDateId = currentPage.dateId; saveHistory();
    const newPages = pages.filter((_, i) => i !== index); setPages(newPages);
    const remainingInDate = newPages.filter(p => p.dateId === targetDateId);
    if (remainingInDate.length === 0) setViewMode("calendar");
    else { const nextIndex = newPages.findIndex(p => p.dateId === targetDateId); setCurrentPageIndex(nextIndex >= 0 ? nextIndex : 0); }
    setSelectedIds([]);
  };

  const saveAsImage = async () => {
    if (!diaryRef.current) return;
    setSelectedIds([]); setShowPreviews(false); setIsEditingText(false); setIsMultiSelectMode(false);
    setTimeout(async () => {
      try {
        const dataUrl = await toPng(diaryRef.current!, { cacheBust: true }); const link = document.createElement("a");
        if (viewMode === "editor" && currentPage) link.download = `diary-${currentPage.date}-${Date.now()}.png`;
        else if (viewMode === "collection_editor" && currentCollection) link.download = `collection-${currentCollection.title}-${Date.now()}.png`;
        else if (viewMode === "exchange_editor" && currentExchange) link.download = `exchange-${currentExchange.title}-${Date.now()}.png`;
        link.href = dataUrl; link.click();
      } catch (err) { console.error(err); }
    }, 100);
  };

  const handleMonthChange = async (offset: number) => { const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1); setCurrentMonth(newDate); setIsLoaded(false); const mKey = getMonthKey(newDate); setPages(await loadMonthData(mKey)); setHistory([]); setIsLoaded(true); };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value; setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query.trim()) { setSearchResults([]); return; }
    searchTimeoutRef.current = setTimeout(async () => { setIsSearching(true); try { const matched = await searchAllMonths(query); matched.sort((a, b) => b.dateId.localeCompare(a.dateId)); setSearchResults(matched); } catch(e) { console.error(e); } finally { setIsSearching(false); } }, 300);
  };

  const handleJumpToSearchResult = async (targetPage: PageData) => {
    setIsSearchOpen(false); setSearchQuery(""); setSearchResults([]);
    const [y, m] = targetPage.dateId.split('-'); const targetDate = new Date(parseInt(y), parseInt(m) - 1, 1);
    if (getMonthKey(targetDate) !== getMonthKey(currentMonth)) {
      setCurrentMonth(targetDate); setIsLoaded(false); const mKey = getMonthKey(targetDate); setPages(await loadMonthData(mKey));
      const index = (await loadMonthData(mKey)).findIndex(p => p.id === targetPage.id); setCurrentPageIndex(Math.max(0, index)); setIsLoaded(true);
    } else { const index = pages.findIndex(p => p.id === targetPage.id); setCurrentPageIndex(Math.max(0, index)); }
    setViewMode("editor"); setIsEditingText(false);
  };

  const handleAddFromAlbum = async (albumSticker: CanvasSticker) => {
    if (!currentItems) return; saveHistory();
    const updatedSticker = { ...albumSticker, usageCount: (albumSticker.usageCount || 0) + 1, lastUsed: Date.now() }; await saveAlbumSticker(updatedSticker); setAlbumStickers(await loadAlbumStickersFromDB());
    const newS: CanvasSticker = { ...albumSticker, id: "s-" + Date.now(), x: snap(100), y: snap(200), decoration: "none", animation: "none", rotation: 0, isSecret: false };
    updateCurrentItems([...currentItems, newS]); setIsAlbumOpen(false); setSelectedIds([newS.id]); setIsMultiSelectMode(false);
  };

  const toggleFavorite = async (sticker: CanvasSticker, e: React.MouseEvent) => { e.stopPropagation(); const updatedSticker = { ...sticker, isFavorite: !sticker.isFavorite }; await saveAlbumSticker(updatedSticker); setAlbumStickers(await loadAlbumStickersFromDB()); };
  const togglePublish = async (sticker: CanvasSticker, e: React.MouseEvent) => { e.stopPropagation(); const updatedSticker = { ...sticker, isPublished: !sticker.isPublished }; await saveAlbumSticker(updatedSticker); setAlbumStickers(await loadAlbumStickersFromDB()); };
  const handleDeleteFromAlbum = async (id: string, e: React.MouseEvent) => { e.stopPropagation(); if(confirm("アルバムから完全に削除しますか？")) { await deleteAlbumSticker(id); setAlbumStickers(await loadAlbumStickersFromDB()); } };

  const simulateTradeRequest = async () => {
    const published = albumStickers.filter(s => s.isPublished);
    if (published.length === 0) { 
      alert("まずは「自分のシール」タブで、シールを地球マーク🌍にして公開してね！"); 
      return; 
    }
    
    const targetSticker = published[Math.floor(Math.random() * published.length)];
    const targetId = window.prompt("送りたい相手の検索ID（@不要）を入力してください\n例：test_kun");
    if (!targetId) return;

    try {
      const receiverName = await sendTradeRequest(targetId, targetSticker);
      alert(`大成功！🎉\n${receiverName}さんにシールを送信しました！\n（裏側でGPS情報は完全に削除されています！）`);
    } catch (err: any) {
      alert("🚨 エラー: " + err.message);
    }
  };

  const checkMailbox = async () => {
    try {
      const trades = await getPendingTrades();
      if (trades.length > 0) {
        const t = trades[0];
        setTradeRequest({
          tradeId: t.id,
          offerStickerSrc: t.offered_sticker.src,
          targetStickerId: "", 
          partnerName: t.sender_name,
          sticker: t.offered_sticker
        });
      } else {
        alert("ポストは空っぽです📭 新しいシールは届いていません。");
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const acceptTrade = async () => {
    if (!tradeRequest) return;
    
    if (tradeRequest.tradeId && tradeRequest.sticker) {
      await respondToTrade(tradeRequest.tradeId, true);
      const newSticker: CanvasSticker = { 
        ...tradeRequest.sticker, 
        id: "s-" + Date.now(), 
        name: `${tradeRequest.partnerName}からの贈り物`, 
        usageCount: 0, lastUsed: Date.now(), isFavorite: true, isPublished: false, decoration: "none", animation: "none", rotation: 0 
      };
      await saveAlbumSticker(newSticker);
    } else {
      const newSticker: CanvasSticker = { id: "s-" + Date.now(), type: "sticker", src: tradeRequest.offerStickerSrc, x: 100, y: 100, width: 200, height: 200, name: `${tradeRequest.partnerName}からの贈り物`, usageCount: 0, lastUsed: Date.now(), isFavorite: true, isPublished: false, decoration: "none", animation: "none", rotation: 0 };
      await saveAlbumSticker(newSticker); 
    }
    
    setAlbumStickers(await loadAlbumStickersFromDB()); 
    setTradeRequest(null); 
    alert("交換が成立しました！🎉 マイアルバムをチェックしてね！");
  };

  const declineTrade = async () => {
    if (tradeRequest?.tradeId) {
      await respondToTrade(tradeRequest.tradeId, false);
    }
    setTradeRequest(null);
  };

  const addText = () => {
    if (!currentItems) return; saveHistory();
    const newT: CanvasText = { id: "t-" + Date.now(), type: "text", content: "", x: snap(100), y: snap(200), fontSize: 24, rotation: 0, color: "#374151", fontFamily: "serif", isSecret: false };
    updateCurrentItems([...currentItems, newT]); setSelectedIds([newT.id]); setIsPenMode(false); setIsEraserMode(false); setIsMultiSelectMode(false);
  };

  const handleItemPointerDown = (e: React.PointerEvent, id: string, op: "move" | "resize" | "rotate") => {
    if (isPenMode || isEraserMode || !currentItems) return;
    if (viewMode === "exchange_editor" && currentExchange?.currentTurn === "partner") return;

    e.stopPropagation(); saveHistory(); 

    if (isMultiSelectMode) {
      if (op === "move" && !selectedIds.includes(id)) setSelectedIds(prev => [...prev, id]);
    } else {
      if (!selectedIds.includes(id)) setSelectedIds([id]);
    }

    setActiveId(id); setActiveOp(op); setStartPointerPos({ x: e.clientX, y: e.clientY });
    const item = currentItems.find(i => i.id === id)!;
    
   if (op === "move") { 
        setDragOffset({ x: e.clientX - (item as any).x, y: e.clientY - (item as any).y });
        const inits: Record<string, {x: number, y: number}> = {};
        currentItems.forEach(i => { inits[i.id] = {x: (i as any).x, y: (i as any).y}; });
        setInitialPositions(inits);
    }
    if (op === "resize" && item.type !== "drawing") setInitialVal(item.type === "sticker" ? item.width : item.fontSize);
    if (op === "rotate" && item.type !== "drawing") setInitialVal(item.rotation || 0);
    e.currentTarget.setPointerCapture(e.pointerId); setShowPreviews(false); setIsEditingText(false);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (viewMode === "exchange_editor" && currentExchange?.currentTurn === "partner") return;
    const rect = e.currentTarget.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top;

    if (isPenMode || isEraserMode) { setCursorPos({ x, y }); if (isDrawingRef.current) setCurrentPath(prev => [...prev, { x, y }]); return; }
    if (!activeId || !activeOp || !currentItems) return;
    
    const dx = e.clientX - startPointerPos.x; const dy = e.clientY - startPointerPos.y;
    
    updateCurrentItems(currentItems.map(item => {
      if (activeOp === "move" && selectedIds.includes(item.id) && selectedIds.includes(activeId)) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return item;
        const initial = initialPositions[item.id] || { x: (item as any).x, y: (item as any).y };
        return { ...item, x: snap(initial.x + dx), y: snap(initial.y + dy) };
      }
      
      if (item.id !== activeId) return item;
      
      if (activeOp === "resize" && item.type !== "drawing") {
        if (item.type === "sticker") { const ratio = item.height / item.width; const newWidth = Math.max(40, initialVal + (dx + dy) / 2); const snappedWidth = snap(newWidth); return { ...item, width: snappedWidth, height: snappedWidth * ratio }; }
        if (item.type === "text") return { ...item, fontSize: Math.max(12, initialVal + (dx + dy) / 4) };
      }
      if (activeOp === "rotate" && item.type !== "drawing") return { ...item, rotation: initialVal - dy };
      return item;
    }));
  };

  const handleDiaryPointerDown = (e: React.PointerEvent) => {
    if (viewMode === "exchange_editor" && currentExchange?.currentTurn === "partner") return;
    if (!isPenMode && !isEraserMode) { setSelectedIds([]); setIsEditingText(false); setIsMultiSelectMode(false); return; }
    const rect = e.currentTarget.getBoundingClientRect(); isDrawingRef.current = true; setCurrentPath([{ x: e.clientX - rect.left, y: e.clientY - rect.top }]); e.currentTarget.setPointerCapture(e.pointerId); 
  };

  const handleDiaryPointerUp = (e?: React.PointerEvent) => {
    if ((isPenMode || isEraserMode) && currentItems) {
      if (isDrawingRef.current && currentPath.length >= 2) {
        const newDrawing: CanvasDrawing = { id: "d-" + Date.now(), points: currentPath, color: isEraserMode ? "#000" : penColor, width: isEraserMode ? eraserSize : penSize, type: "drawing", isEraser: isEraserMode };
        updateCurrentItems([...currentItems, newDrawing]);
      }
      isDrawingRef.current = false; setCurrentPath([]);
      if (e && e.currentTarget && e.pointerId !== undefined) { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(err) {} }
    }
  };

  const handleDiaryPointerLeave = () => { setCursorPos(null); if (isDrawingRef.current) handleDiaryPointerUp(); };
  const handleItemPointerUp = (e: React.PointerEvent) => { setActiveId(null); setActiveOp(null); e.currentTarget.releasePointerCapture(e.pointerId); };

  const getAnimationClass = (animId?: string) => {
    switch(animId) {
      case "float": return "animate-float"; case "shake": return "animate-shake";
      case "heartbeat": return "animate-heartbeat"; case "swing": return "animate-swing";
      case "flash": return "animate-flash"; default: return "";
    }
  };

  const handleSaveToAlbumDirect = async (item: CanvasSticker) => {
    const newAlbumSticker = { ...item, decoration: "none", animation: "none", usageCount: item.usageCount || 0, lastUsed: item.lastUsed || Date.now(), isFavorite: item.isFavorite || false, isPublished: false };
    await saveAlbumSticker(newAlbumSticker); setAlbumStickers(await loadAlbumStickersFromDB()); alert("シールをアルバムに保存しました！📦");
  };

  const renderDecoratedSticker = (item: CanvasSticker, isSelected: boolean, isPartnerTurn: boolean) => {
    const dec = item.decoration || "none"; const src = item.src;
    let content = <img src={src} className="w-full h-full object-contain pointer-events-none" draggable="false" />;
    
    if (dec === "polaroid") content = <div className="w-full h-full bg-white p-[6%] pb-[24%] shadow-md flex flex-col pointer-events-none border border-gray-100"><div className="flex-1 bg-gray-100 relative overflow-hidden"><img src={src} className="absolute inset-0 w-full h-full object-cover" draggable="false" /></div></div>;
    else if (dec === "diecut") content = <img src={src} className="w-full h-full object-contain pointer-events-none" style={{ filter: 'drop-shadow(0px 1.5px 0px white) drop-shadow(0px -1.5px 0px white) drop-shadow(1.5px 0px 0px white) drop-shadow(-1.5px 0px 0px white) drop-shadow(0px 2px 3px rgba(0,0,0,0.3))' }} draggable="false" />;
    else if (dec === "stamp") content = <div className="w-full h-full bg-white p-[4%] shadow-sm pointer-events-none relative flex items-center justify-center" style={{ maskImage: 'radial-gradient(circle at 4px 4px, transparent 2.5px, black 3px)', maskSize: '8px 8px', maskPosition: '-4px -4px', WebkitMaskImage: 'radial-gradient(circle at 4px 4px, transparent 2.5px, black 3px)', WebkitMaskSize: '8px 8px', WebkitMaskPosition: '-4px -4px' }}><img src={src} className="w-full h-full object-cover" draggable="false" /></div>;
    else if (dec === "film") content = <div className="w-full h-full bg-gray-900 p-[4%] py-[8%] flex flex-col justify-center relative pointer-events-none shadow-md overflow-hidden"><div className="absolute top-0 left-0 right-0 h-3 border-b-[4px] border-dotted border-white/50 opacity-70" /><div className="absolute bottom-0 left-0 right-0 h-3 border-t-[4px] border-dotted border-white/50 opacity-70" /><img src={src} className="w-full h-full object-cover bg-black" draggable="false" /></div>;
    else if (dec === "tape") content = <div className="w-full h-full relative pointer-events-none drop-shadow-sm flex items-center justify-center"><div className="absolute -top-[8%] left-1/2 -translate-x-1/2 w-[40%] h-[15%] bg-pink-400/60 -rotate-3 z-10 mix-blend-multiply shadow-sm" style={{ borderLeft: '2px dotted rgba(255,255,255,0.5)', borderRight: '2px dotted rgba(255,255,255,0.5)' }} /><img src={src} className="w-full h-full object-contain" draggable="false" /></div>;
    else if (dec === "pin") content = <div className="w-full h-full relative pointer-events-none drop-shadow-sm flex items-center justify-center pt-[5%]"><div className="absolute top-0 left-1/2 -translate-x-1/2 w-[12%] aspect-square min-w-[12px] max-w-[20px] rounded-full bg-red-500 shadow-sm border border-red-600 z-10"><div className="w-[30%] h-[30%] bg-white/70 rounded-full absolute top-[10%] left-[10%]" /></div><img src={src} className="w-full h-full object-contain" draggable="false" /></div>;
    else if (dec === "memo") content = <div className="w-full h-full bg-white pl-[10%] p-[3%] relative shadow-md pointer-events-none flex items-center justify-center"><div className="absolute top-0 bottom-0 left-0 w-[8%] min-w-[12px] border-r border-gray-200" style={{ backgroundImage: 'radial-gradient(circle at 30% center, transparent 25%, #f3f4f6 30%, white 35%)', backgroundSize: '100% 16px' }} /><img src={src} className="w-full h-full object-contain" draggable="false" /></div>;
    else if (dec === "torn") content = <div className="w-full h-full bg-white p-[1%] shadow-sm pointer-events-none flex items-center justify-center" style={{ filter: 'url(#torn-edge)' }}><img src={src} className="w-full h-full object-cover" draggable="false" /></div>;
    else if (dec === "texture") content = <div className="w-full h-full relative pointer-events-none drop-shadow-sm flex items-center justify-center"><img src={src} className="w-full h-full object-contain" draggable="false" /><div className="absolute inset-0 mix-blend-overlay opacity-40" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E")' }} /></div>;
    else if (dec === "neon") content = <div className="w-full h-full pointer-events-none flex items-center justify-center" style={{ filter: 'drop-shadow(0 0 6px #f472b6) drop-shadow(0 0 12px #38bdf8)' }}><img src={src} className="w-full h-full object-contain" draggable="false" /></div>;

    return (
      <div className={`absolute ${isSelected ? (isMultiSelectMode ? "ring-4 ring-purple-400 rounded-lg" : "ring-4 ring-blue-400 rounded-lg") : ""}`} style={{ left: item.x, top: item.y, width: `${item.width}px`, height: `${item.height}px`, transform: `rotate(${item.rotation || 0}deg)`, zIndex: 5 }}>
        <div className={`w-full h-full ${getAnimationClass(item.animation)}`}>
          {content}
          {item.isSecret && <ScratchCard />}
        </div>
      </div>
    );
  };

  const renderCanvasItems = (items: CanvasItem[], maskIdPrefix: string) => {
    const isPartnerTurn = viewMode === "exchange_editor" && currentExchange?.currentTurn === "partner";

    return (
      <>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
          <defs>
            {items.map((item, index) => {
              if (item.type === "drawing" && !item.isEraser) {
                const subsequentErasers = items.slice(index + 1).filter(i => i.type === "drawing" && i.isEraser) as CanvasDrawing[];
                if (subsequentErasers.length > 0 || isEraserMode) {
                  return (
                    <mask key={`mask-${maskIdPrefix}-${item.id}`} id={`mask-${maskIdPrefix}-${item.id}`}>
                      <rect x="-10%" y="-10%" width="120%" height="120%" fill="white" />
                      {subsequentErasers.map(eraser => <polyline key={eraser.id} points={eraser.points.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="black" strokeWidth={eraser.width} strokeLinecap="round" strokeLinejoin="round" />)}
                      {isEraserMode && currentPath.length > 0 && <polyline points={currentPath.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="black" strokeWidth={eraserSize} strokeLinecap="round" strokeLinejoin="round" />}
                    </mask>
                  );
                }
              }
              return null;
            })}
          </defs>
          {items.map((item, index) => {
            if (item.type === "drawing" && !item.isEraser) {
              const subsequentErasers = items.slice(index + 1).filter(i => i.type === "drawing" && i.isEraser);
              const hasMask = subsequentErasers.length > 0 || isEraserMode;
              return <g key={item.id} mask={hasMask ? `url(#mask-${maskIdPrefix}-${item.id})` : undefined}><polyline points={item.points.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke={item.color} strokeWidth={item.width} strokeLinecap="round" strokeLinejoin="round" /></g>;
            }
            return null;
          })}
          {isPenMode && currentPath.length > 0 && <polyline points={currentPath.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke={penColor} strokeWidth={penSize} strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
        
        {items.map((item) => {
          if (item.type === "sticker") return <React.Fragment key={item.id}>{renderDecoratedSticker(item as CanvasSticker, selectedIds.includes(item.id), isPartnerTurn)}</React.Fragment>;
          if (item.type === "text") {
            return (
              <div key={item.id} className="absolute flex flex-col items-center" style={{ left: item.x, top: item.y, transform: `rotate(${item.rotation || 0}deg)`, zIndex: 5 }}>
                <div className={`p-2 border-2 ${selectedIds.includes(item.id) ? (isMultiSelectMode ? "border-dashed border-purple-400" : "border-dashed border-emerald-400") : "border-transparent"} relative w-full h-full`}>
                  {item.isSecret && <ScratchCard />}
                  <span className="text-center whitespace-pre block" style={{ fontSize: `${item.fontSize}px`, color: item.color, fontFamily: item.fontFamily, lineHeight: '1.2' }}>{item.content}</span>
                </div>
              </div>
            );
          }
          return null;
        })}
      </>
    );
  };

  const renderActiveItemControls = (items: CanvasItem[]) => {
    if (viewMode === "exchange_editor" && currentExchange?.currentTurn === "partner") return null;

    return items.map((item) => {
      if (item.type === "drawing") return null;

      return (
        <div key={"ui-"+item.id} className="absolute pointer-events-auto" 
             style={item.type === "sticker" ? { left: item.x, top: item.y, width: `${item.width}px`, height: `${item.height}px`, transform: `rotate(${item.rotation || 0}deg)` } : { left: item.x, top: item.y, transform: `rotate(${item.rotation || 0}deg)` }}
             onPointerDown={(e) => handleItemPointerDown(e, item.id, "move")} onPointerUp={handleItemPointerUp}
             onClick={(e) => { 
               if (isPenMode || isEraserMode) return;
               e.stopPropagation(); 
               if (isMultiSelectMode) {
                 setSelectedIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]);
               } else {
                 setSelectedIds([item.id]); 
               }
               setShowPreviews(false); setIsEditingText(false);
             }}>
          
          {item.type === "sticker" && selectedId === item.id && (
            <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 flex flex-col gap-2 bg-white p-3 rounded-2xl shadow-2xl border border-gray-100 w-[280px] z-[100] cursor-default" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
              
              <div className="flex justify-between items-center bg-gray-50 p-1.5 rounded-xl border border-gray-200">
                <div className="flex gap-1">
                  <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); moveUp(item.id); }} className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 shadow-sm hover:bg-blue-50 hover:border-blue-300 rounded-lg text-lg transition" title="1つ手前(上)へ">⬆️</button>
                  <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); moveDown(item.id); }} className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 shadow-sm hover:bg-blue-50 hover:border-blue-300 rounded-lg text-lg transition" title="1つ奥(下)へ">⬇️</button>
                </div>
                <div className="flex gap-1">
                  <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); const target = items.find(i => i.id === item.id); if(target) { const newItem = { ...target, id: "s-" + Date.now(), x: (target as any).x + 20, y: (target as any).y + 20 }; updateCurrentItems([...items, newItem]); setSelectedIds([newItem.id]); } }} className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 shadow-sm hover:bg-green-50 hover:border-green-300 rounded-lg text-lg transition" title="複製">👯</button>
                  <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); updateCurrentItems(items.filter(i => i.id !== item.id)); setSelectedIds([]); }} className="w-9 h-9 flex items-center justify-center bg-white border border-red-200 shadow-sm hover:bg-red-50 text-red-500 rounded-lg text-lg transition" title="削除">🗑️</button>
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <input type="text" value={item.name || ""} onChange={(e) => updateCurrentItems(items.map(i => i.id === item.id ? { ...i, name: e.target.value } as CanvasItem : i))} placeholder="シールの名前" className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 outline-none text-xs text-gray-700 focus:border-pink-400 font-bold" />
                <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); updateCurrentItems(items.map(i => i.id === item.id ? { ...i, isSecret: !(i as any).isSecret } as CanvasItem : i)); }} className={`w-9 h-9 flex items-center justify-center rounded-lg text-lg transition border ${item.isSecret ? "bg-purple-100 border-purple-300" : "bg-gray-50 border-gray-200 hover:bg-gray-100"}`} title="スクラッチ（秘密にする）">{item.isSecret ? '🔒' : '🔓'}</button>
              </div>

              <div className="text-[10px] font-bold text-gray-500 mb-[-4px]">🎨 デコレーション</div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 snap-x" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {DECORATIONS.map(d => <button key={d.id} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); updateCurrentItems(items.map(i => i.id === item.id ? { ...i, decoration: d.id } as CanvasItem : i)); }} className={`shrink-0 flex flex-col items-center justify-center p-1 w-12 h-12 rounded-lg border snap-start transition ${item.decoration === d.id || (!item.decoration && d.id === 'none') ? 'bg-pink-50 border-pink-400 text-pink-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}><span className="text-base leading-none">{d.icon}</span><span className="text-[8px] mt-1 font-bold whitespace-nowrap leading-none">{d.label}</span></button>)}
              </div>

              <div className="text-[10px] font-bold text-gray-500 mt-1 mb-[-4px]">✨ 動き（アニメ）</div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 snap-x" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {ANIMATIONS.map(a => <button key={a.id} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); updateCurrentItems(items.map(i => i.id === item.id ? { ...i, animation: a.id } as CanvasItem : i)); }} className={`shrink-0 flex flex-col items-center justify-center p-1 w-12 h-12 rounded-lg border snap-start transition ${item.animation === a.id || (!item.animation && a.id === 'none') ? 'bg-blue-50 border-blue-400 text-blue-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}><span className="text-base leading-none">{a.icon}</span><span className="text-[8px] mt-1 font-bold whitespace-nowrap leading-none">{a.label}</span></button>)}
              </div>

              <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); handleSaveToAlbumDirect(item as CanvasSticker); }} className="w-full bg-amber-50 text-amber-600 font-bold py-1.5 rounded-lg text-xs hover:bg-amber-100 transition border border-amber-200 shadow-sm mt-1">📦 アルバムに保存</button>
            </div>
          )}

          {item.type === "text" && selectedId === item.id && (
            <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 flex flex-col gap-2 bg-white p-3 rounded-2xl shadow-2xl border border-gray-100 min-w-[240px] z-[100] cursor-default" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
              
              <div className="flex justify-between items-center bg-gray-50 p-1.5 rounded-xl border border-gray-200 mb-1">
                <div className="flex gap-1">
                  <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); moveUp(item.id); }} className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 shadow-sm hover:bg-blue-50 hover:border-blue-300 rounded-lg text-lg transition" title="1つ手前(上)へ">⬆️</button>
                  <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); moveDown(item.id); }} className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 shadow-sm hover:bg-blue-50 hover:border-blue-300 rounded-lg text-lg transition" title="1つ奥(下)へ">⬇️</button>
                </div>
                <div className="flex gap-1">
                  <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); updateCurrentItems(items.map(i => i.id === item.id ? { ...i, isSecret: !(i as any).isSecret } as CanvasItem : i)); }} className={`w-9 h-9 flex items-center justify-center bg-white border shadow-sm rounded-lg text-lg transition ${item.isSecret ? "border-purple-300 bg-purple-50 text-purple-600" : "border-gray-200"}`} title="スクラッチ（秘密にする）">{item.isSecret ? '🔒' : '🔓'}</button>
                  <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); const target = items.find(i => i.id === item.id); if(target) { const newItem = { ...target, id: "t-" + Date.now(), x: (target as any).x + 20, y: (target as any).y + 20 }; updateCurrentItems([...items, newItem]); setSelectedIds([newItem.id]); } }} className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 shadow-sm hover:bg-green-50 hover:border-green-300 rounded-lg text-lg transition" title="複製">👯</button>
                  <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); updateCurrentItems(items.filter(i => i.id !== item.id)); setSelectedIds([]); }} className="w-9 h-9 flex items-center justify-center bg-white border border-red-200 shadow-sm hover:bg-red-50 text-red-500 rounded-lg text-lg transition" title="削除">🗑️</button>
                </div>
              </div>

              <div className="flex gap-2 text-xs items-center justify-center">
                <input type="color" value={item.color} onChange={(e) => updateCurrentItems(items.map(i => i.id === item.id ? { ...i, color: e.target.value } as CanvasItem : i))} className="w-8 h-8 rounded border-none cursor-pointer" />
                <select value={item.fontFamily} onChange={(e) => updateCurrentItems(items.map(i => i.id === item.id ? { ...i, fontFamily: e.target.value } as CanvasItem : i))} className="flex-1 bg-gray-100 rounded-lg px-2 py-2 outline-none font-bold text-gray-700">
                  <option value="serif">明朝体</option>
                  <option value="sans-serif">ゴシック体</option>
                  <option value="cursive">手書き風</option>
                </select>
              </div>
            </div>
          )}

          {item.type === "text" && (
            <div className={`p-2 border-2 ${selectedIds.includes(item.id) ? (isMultiSelectMode ? "border-dashed border-purple-400" : "border-dashed border-emerald-400") : "border-transparent"} rounded-lg relative flex flex-col items-center w-full h-full`}>
              <input type="text" value={item.content} autoFocus={selectedId === item.id} placeholder="文字を入力..." 
                onChange={(e) => updateCurrentItems(items.map(i => i.id === item.id ? { ...i, content: e.target.value } as CanvasItem : i))} 
                onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} 
                className={`bg-transparent outline-none text-center ${selectedIds.includes(item.id) ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} 
                style={{ fontSize: `${item.fontSize}px`, color: item.color, fontFamily: item.fontFamily, width: `${(item.content.length || 4) + 1}em`, caretColor: item.color, lineHeight: '1.2' }} 
              />
              {!selectedIds.includes(item.id) && <div className="absolute inset-0 cursor-pointer" title="タップして選択" />}
            </div>
          )}

          {selectedIds.includes(item.id) && (
            <>
              <div className="absolute bottom-0 right-0 w-16 h-16 z-50 flex items-center justify-center translate-x-1/3 translate-y-1/3 cursor-nwse-resize group" onPointerDown={(e) => handleItemPointerDown(e, item.id, "resize")} onPointerUp={handleItemPointerUp}>
                <div className={`w-8 h-8 bg-white border-2 ${item.type === 'sticker' ? 'border-blue-500' : 'border-emerald-500'} rounded-full shadow-lg flex items-center justify-center pointer-events-none`}>⤡</div>
              </div>
              
              {(item.type === "text" || item.type === "sticker") && (
                <div className="absolute bottom-0 left-0 w-16 h-16 z-50 flex items-center justify-center -translate-x-1/3 translate-y-1/3 cursor-pointer group" onPointerDown={(e) => handleItemPointerDown(e, item.id, "rotate")} onPointerUp={handleItemPointerUp}>
                  <div className="w-8 h-8 bg-white border-2 border-orange-500 rounded-full shadow-lg flex items-center justify-center pointer-events-none">🔄</div>
                </div>
              )}
            </>
          )}

          {item.isSecret && <div className="absolute -top-3 -right-3 bg-purple-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-md pointer-events-none">秘密</div>}
        </div>
      );
    });
  };

  if (!isLoaded) return <div className="min-h-screen bg-pink-50 flex items-center justify-center"><p className="text-gray-500 font-bold animate-pulse">読み込み中...</p></div>;

  return (
    <>
      <svg className="absolute w-0 h-0 pointer-events-none"><defs><filter id="torn-edge" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" /></filter></defs></svg>
      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } } .animate-float { animation: float 3s ease-in-out infinite; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-3px) rotate(-3deg); } 75% { transform: translateX(3px) rotate(3deg); } } .animate-shake { animation: shake 0.5s ease-in-out infinite; }
        @keyframes heartbeat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } } .animate-heartbeat { animation: heartbeat 1s ease-in-out infinite; }
        @keyframes swing { 0%, 100% { transform: rotate(0deg); } 20% { transform: rotate(5deg); } 40% { transform: rotate(-5deg); } 60% { transform: rotate(3deg); } 80% { transform: rotate(-3deg); } } .animate-swing { animation: swing 2s ease-in-out infinite; }
        @keyframes flash { 0%, 100% { opacity: 1; filter: brightness(1); } 50% { opacity: 0.7; filter: brightness(1.2); } } .animate-flash { animation: flash 1.5s ease-in-out infinite; }
        @keyframes fade-in-up { 0% { opacity: 0; transform: translate(-50%, 20px); } 100% { opacity: 1; transform: translate(-50%, 0); } } .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
      `}</style>

      {selectedTextRange && isEditingText && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[500] animate-bounce">
          <button onClick={handleApplySecretToText} className="bg-purple-600 text-white px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-2 border-2 border-white">🔒 選択部分をスクラッチにする</button>
        </div>
      )}

      {selectedIds.length > 1 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900/95 backdrop-blur-md text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-5 z-[500] animate-fade-in-up border border-gray-700">
          <span className="font-bold text-sm whitespace-nowrap text-purple-300">{selectedIds.length}個 選択中</span>
          <div className="w-px h-6 bg-gray-600" />
          <button onClick={deleteSelected} className="text-xs font-bold text-red-400 hover:text-red-300 transition flex flex-col items-center gap-1"><span className="text-xl leading-none">🗑️</span>まとめて削除</button>
          <button onClick={() => { setSelectedIds([]); setIsMultiSelectMode(false); }} className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center font-bold ml-2 transition">✕</button>
        </div>
      )}

      <TradeRequestModal tradeRequest={tradeRequest} albumStickers={albumStickers} onClose={declineTrade} onAccept={acceptTrade} />
      <NewExchangeModal isOpen={isNewExchangeModalOpen} onClose={() => setIsNewExchangeModalOpen(false)} onSubmit={handleCreateExchangeSubmit} />
      <AlbumModal isOpen={isAlbumOpen} onClose={() => setIsAlbumOpen(false)} albumStickers={albumStickers} onAddFromAlbum={handleAddFromAlbum} onToggleFavorite={toggleFavorite} onTogglePublish={togglePublish} onDeleteFromAlbum={handleDeleteFromAlbum} onSimulateTrade={simulateTradeRequest} />
      <ImageCropModal imageSrc={imageSrc} onClose={() => setImageSrc(null)} onAddSticker={handleCropComplete} />
      <TravelMapModal isOpen={isTravelMapOpen} onClose={() => setIsTravelMapOpen(false)} pages={pages} onJump={handleJumpToSearchResult} />
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} searchQuery={searchQuery} onSearchChange={handleSearchChange} isSearching={isSearching} searchResults={searchResults} onJump={handleJumpToSearchResult} />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onSuccess={(loggedInUser) => setUser(loggedInUser)} />
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} />
      
      {/* 1. カレンダーモード */}
      {viewMode === "calendar" && (
        <div className="min-h-screen bg-pink-50 font-sans select-none overflow-hidden relative flex flex-col">
         {/* ★ ヘッダー（ログイン・ログアウトボタンを追加） */}
          <div className="w-full max-w-md mx-auto px-4 pt-2 flex justify-end gap-2 items-center">
            {user ? (
              <>
                <button onClick={checkMailbox} className="text-[10px] font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1 rounded-full border border-amber-200 transition shadow-sm">
                  📬 ポスト
                </button>
                <button onClick={() => setIsProfileModalOpen(true)} className="text-[10px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1 rounded-full border border-purple-200 transition">
                  ⚙️ 設定
                </button>
                {/* ★ ログアウトボタンを追加 */}
                <button onClick={handleLogout} className="text-[10px] font-bold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-full border border-red-200 transition">
                  🚪 ログアウト
                </button>
              </>
            ) : (
              <button onClick={() => setIsAuthModalOpen(true)} className="text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1 rounded-full border border-purple-200 transition">
                🔑 ログインして同期する
              </button>
            )}
          </div>

          <div className="flex items-center justify-between w-full max-w-md mx-auto px-4 pt-4 pb-2">
            <div className="flex gap-2">
              <button onClick={() => setViewMode("collections")} className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-full shadow-sm text-gray-600 hover:bg-gray-50 transition" title="コレクション帳">📕</button>
              <button onClick={() => setViewMode("exchange_list")} className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-full shadow-sm text-gray-600 hover:bg-gray-50 transition" title="交換日記">💌</button>
            </div>
            <h1 className="text-center text-xl font-bold text-gray-800 tracking-wider">Sticker Diary</h1>
            <div className="flex gap-2">
              <button onClick={() => setIsTravelMapOpen(true)} className="w-10 h-10 flex items-center justify-center bg-white border border-blue-200 rounded-full shadow-sm text-blue-500 hover:bg-blue-50 transition shadow-blue-100" title="旅の思い出">🗺️</button>
              <button onClick={() => setIsSearchOpen(true)} className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-full shadow-sm text-gray-600 hover:bg-gray-50 transition">🔍</button>
            </div>
          </div>
          <div className="w-full max-w-md mx-auto p-4 flex flex-col h-screen">
            <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mt-2">
              <button onClick={() => handleMonthChange(-1)} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-600 font-bold transition">◀</button>
              <h2 className="text-xl font-black text-gray-800 tracking-wider">{currentMonth.toLocaleDateString("ja-JP", { year: "numeric", month: "long" })}</h2>
              <button onClick={() => handleMonthChange(1)} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-600 font-bold transition">▶</button>
            </div>
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-gray-400">
              <div className="text-red-400">日</div><div>月</div><div>火</div><div>水</div><div>木</div><div>金</div><div className="text-blue-400">土</div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() }).map((_, i) => <div key={`empty-${i}`} className="p-2" />)}
              {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate() }).map((_, i) => {
                const d = i + 1; const dateId = getDateString(currentMonth.getFullYear(), currentMonth.getMonth(), d);
                const dayPages = pages.filter(p => p.dateId === dateId); const firstPage = dayPages[0];
                let pText = ""; let pImg = null;
                if (firstPage) {
                  if (firstPage.diaryText.trim()) pText = firstPage.diaryText.trim().split('\n')[0].replace(/\[\[SECRET:.*?\]\]/g, "🔒秘密");
                  const s = firstPage.items.find(item => item.type === "sticker") as CanvasSticker; if (s) pImg = s.src;
                }
                const hasContent = dayPages.length > 0 && (firstPage.diaryText.trim() !== "" || firstPage.items.length > 0);
                return (
                  <button key={d} onClick={() => openDiary(currentMonth.getFullYear(), currentMonth.getMonth(), d)} className="relative flex flex-col items-center justify-start w-full aspect-square bg-white border border-gray-100 rounded-xl hover:bg-pink-50 transition-all shadow-sm group p-1 overflow-hidden">
                    <span className="text-gray-700 font-bold text-xs group-hover:text-pink-600 z-10 mb-0.5">{d}</span>
                    <div className="flex-1 w-full flex flex-col items-center justify-center gap-0.5 overflow-hidden">
                      {pImg && <img src={pImg} alt="" className="w-8 h-8 object-contain drop-shadow-sm opacity-90" />}
                      {pText && !pImg && <span className="text-[8px] text-gray-500 w-full text-center break-words leading-tight px-0.5 line-clamp-2">{pText}</span>}
                      {hasContent && !pImg && !pText && <div className="w-1.5 h-1.5 bg-pink-400 rounded-full" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 交換日記一覧モード */}
      {viewMode === "exchange_list" && (
        <div className="min-h-screen bg-[#faf8ef] font-sans select-none overflow-hidden relative flex flex-col">
          <div className="flex items-center justify-between w-full max-w-md mx-auto px-4 pt-6 pb-4 border-b border-gray-200">
            <button onClick={() => setViewMode("calendar")} className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-full shadow-sm text-gray-600 font-bold">◀</button>
            <h1 className="text-center text-xl font-bold text-gray-800 tracking-wider">💌 交換日記</h1>
            <div className="w-10"></div>
          </div>
          <div className="w-full max-w-md mx-auto p-4 flex-1 overflow-y-auto flex flex-col gap-4">
            <button onClick={() => setIsNewExchangeModalOpen(true)} className="w-full bg-white border-2 border-dashed border-gray-300 rounded-2xl py-6 flex flex-col items-center justify-center hover:bg-gray-50 transition text-gray-500 font-bold shadow-sm"><span className="text-3xl mb-2">＋</span>新しい交換日記をはじめる</button>
            {exchangeDiaries.map(diary => (
              <div key={diary.id} className={`relative w-full rounded-2xl shadow-md border border-gray-100 overflow-hidden flex flex-col ${diary.bgClass}`}>
                <button onClick={() => { setCurrentExchangeId(diary.id); setViewMode("exchange_editor"); setIsEditingText(false); }} className="w-full text-left p-5 flex flex-col gap-3 hover:bg-white/50 transition">
                  <div className="flex justify-between items-start w-full">
                    <h3 className="font-bold text-gray-800 text-lg">{diary.title}</h3>
                    {diary.currentTurn === "me" ? <span className="bg-pink-500 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-sm animate-bounce">あなたの番！</span> : <span className="bg-white/80 text-gray-600 text-[10px] font-bold px-2 py-1 rounded-full border border-gray-200">⏳ 相手を待っています</span>}
                  </div>
                  <div className="text-xs text-gray-600 font-bold">{diary.category === 'lover' ? '💑' : diary.category === 'friend' ? '🤝' : '🏡'} 相手: {diary.partnerName}</div>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 交換日記エディタモード */}
      {viewMode === "exchange_editor" && currentExchange && (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center py-6 px-4 font-sans select-none overflow-hidden" onClick={() => { setSelectedIds([]); setIsEditingText(false); setIsMultiSelectMode(false); }}>
          <div className="flex items-center justify-between w-full max-w-md mb-4 px-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewMode("exchange_list")} className="px-4 py-2 bg-white border border-gray-300 rounded-full shadow-sm text-sm text-gray-700 font-bold">◀ 戻る</button>
            
            <div className="flex gap-2">
              {currentExchange.currentTurn === "me" ? <button onClick={handlePassNotebook} className="px-3 py-2 bg-pink-500 text-white rounded-full shadow-md text-xs font-bold animate-pulse hover:bg-pink-600 transition">📤 渡す</button> : <button onClick={handleReturnNotebook} className="px-3 py-2 bg-gray-200 text-gray-600 border border-gray-300 rounded-full shadow-sm text-xs font-bold hover:bg-gray-300 transition">🔄 返信をもらう</button>}
              <button onClick={handleDelete} className="px-3 py-2 bg-red-50 border border-red-200 text-red-500 rounded-full shadow-sm text-xs font-bold">🗑️ {getDeleteLabel()}</button>
            </div>
          </div>

          {currentExchange.currentTurn === "me" ? (
            <div className="flex gap-2 mb-4 flex-wrap justify-center w-full max-w-md" onClick={e => e.stopPropagation()}>
              <label className="cursor-pointer bg-blue-500 text-white px-3 py-2 rounded-full shadow-md font-bold text-xs">📸 シール <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} /></label>
              <button onClick={() => setIsAlbumOpen(true)} className="bg-amber-500 text-white px-3 py-2 rounded-full shadow-md font-bold text-xs">📦 アルバム</button>
              <button onClick={addText} className="bg-emerald-500 text-white px-3 py-2 rounded-full shadow-md font-bold text-xs">✍️ 文字</button>
              <button onClick={(e) => { e.stopPropagation(); setIsMultiSelectMode(!isMultiSelectMode); if(isMultiSelectMode) setSelectedIds([]); }} className={`px-3 py-2 rounded-full shadow-md transition font-bold flex items-center gap-1 text-xs ${isMultiSelectMode ? "bg-purple-500 text-white" : "bg-white text-gray-600 border border-gray-200"}`}>✅ 複数選択</button>
              <button onClick={() => setIsGridMode(!isGridMode)} className={`px-3 py-2 rounded-full shadow-md transition font-bold flex items-center gap-1 text-xs ${isGridMode ? "bg-teal-500 text-white" : "bg-white text-gray-600 border border-gray-200"}`}>📏 グリッド</button>
              <div className="flex items-center gap-1 bg-white p-1 rounded-full shadow-md">
                <button onClick={() => { setIsPenMode(!isPenMode); setIsEraserMode(false); setSelectedIds([]); setIsEditingText(false); setIsMultiSelectMode(false); }} className={`px-3 py-1.5 rounded-full font-bold text-xs ${isPenMode ? "bg-red-500 text-white" : "bg-gray-100"}`}>🖊️</button>
                <button onClick={() => { setIsEraserMode(!isEraserMode); setIsPenMode(false); setSelectedIds([]); setIsEditingText(false); setIsMultiSelectMode(false); }} className={`px-3 py-1.5 rounded-full font-bold text-xs ${isEraserMode ? "bg-indigo-500 text-white" : "bg-gray-100"}`}>🧹</button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-md mb-4 bg-white/80 backdrop-blur-md rounded-2xl py-3 px-4 shadow-sm text-center border border-gray-200 flex items-center justify-center gap-2"><span className="font-bold text-gray-600 text-sm">⏳ {currentExchange.partnerName} さんが書いています...</span><span className="text-xs text-gray-400">（スクラッチは削れます）</span></div>
          )}

          <div ref={diaryRef} className={`w-full max-w-md relative rounded-3xl shadow-xl border border-gray-200 transition-all ${currentExchange.bgClass} ${(isPenMode || isEraserMode) ? "cursor-none ring-2 " + (isPenMode ? "ring-red-400" : "ring-indigo-400") : ""}`} style={{ height: "600px", touchAction: "none" }} onPointerDown={handleDiaryPointerDown} onPointerMove={handleCanvasPointerMove} onPointerUp={handleDiaryPointerUp} onPointerLeave={handleDiaryPointerLeave} onClick={e => { e.stopPropagation(); setSelectedIds([]); setIsEditingText(false); setIsMultiSelectMode(false); }}>
            {currentExchange.currentTurn === "partner" && <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px] z-40 rounded-3xl flex flex-col items-center justify-center pointer-events-none"></div>}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-10">
              <div className="absolute inset-0 opacity-30 transition-all" style={isGridMode ? { backgroundImage: "radial-gradient(#9ca3af 2px, transparent 2px)", backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px` } : { backgroundImage: "linear-gradient(transparent 95%, #cbd5e1 95%)", backgroundSize: "100% 2.5rem", marginTop: "4.5rem" }} />
              <div className="absolute top-0 left-0 right-0 px-6 pt-6 pb-2 bg-white/60 backdrop-blur-md z-20 pointer-events-none border-b border-transparent"><span className={`text-2xl font-serif text-gray-700 border-b-2 ${getExchangeHeaderBorderClass(currentExchange.category)} pb-1 inline-block pointer-events-auto`}>{currentExchange.title}</span></div>
              <div className="absolute inset-0 pt-[5rem] px-6 pb-6 pointer-events-auto z-10">
                {isEditingText && currentExchange.currentTurn === "me" ? (
                  <textarea ref={textareaRef} autoFocus value={currentText} onChange={(e) => updateCurrentText(e.target.value)} onFocus={() => { setIsPenMode(false); setIsEraserMode(false); setSelectedIds([]); }} onBlur={(e) => { if (!selectedTextRange) setIsEditingText(false); }} onSelect={(e) => { const target = e.target as HTMLTextAreaElement; if (target.selectionStart !== target.selectionEnd) setSelectedTextRange({start: target.selectionStart, end: target.selectionEnd}); else setSelectedTextRange(null); }} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} placeholder={(isPenMode || isEraserMode) ? "" : "ここをタップして交換日記を書こう..."} className="w-full h-full bg-transparent resize-none outline-none text-gray-800" style={{ lineHeight: "2.5rem" }} />
                ) : (
                  <div onClick={(e) => { e.stopPropagation(); if (typeof window !== "undefined" && (window as any).isScratching) return; if ((e.target as HTMLElement).closest('.scratch-area')) return; if(currentExchange.currentTurn === "me" && !isPenMode && !isEraserMode) setIsEditingText(true); }} className={`w-full h-full whitespace-pre-wrap break-words text-gray-800 ${currentExchange.currentTurn === "me" ? "cursor-text" : ""}`} style={{ lineHeight: "2.5rem" }}>
                    {renderParsedText(currentText)} {currentExchange.currentTurn === "me" && !currentText && <span className="text-gray-400">ここをタップして書き始める...</span>}
                  </div>
                )}
              </div>
              {renderCanvasItems(currentExchange.items, "exc")}
              {(isPenMode || isEraserMode) && cursorPos && currentExchange.currentTurn === "me" && <div className={`absolute pointer-events-none z-50 rounded-full border-2 transform -translate-x-1/2 -translate-y-1/2 ${isEraserMode ? 'border-gray-400 bg-white/30 backdrop-invert-[.1]' : 'border-black/20'}`} style={{ left: cursorPos.x, top: cursorPos.y, width: isEraserMode ? eraserSize : penSize, height: isEraserMode ? eraserSize : penSize, backgroundColor: isPenMode ? penColor : undefined, opacity: isPenMode ? 0.5 : 1 }} />}
            </div>
            <div className="absolute inset-0 z-30 pointer-events-none">{currentExchange.currentTurn === "me" && renderActiveItemControls(currentExchange.items)}</div>
          </div>
        </div>
      )}

      {/* 2. 日記エディタモード */}
      {viewMode === "editor" && currentPage && (
        <div className="min-h-screen bg-pink-50 flex flex-col items-center py-6 px-4 font-sans select-none overflow-hidden" onClick={() => { setSelectedIds([]); setShowPreviews(true); setIsEditingText(false); setIsMultiSelectMode(false); }}>
          <div className="flex items-center justify-between w-full max-w-md mb-4 px-2" onClick={e => e.stopPropagation()}>
            <div className="flex gap-2">
              <button onClick={() => setViewMode("calendar")} className="px-4 py-2 bg-white border border-gray-300 rounded-full shadow-sm text-sm text-gray-700 font-bold">◀ カレンダー</button>
              <button onClick={(e) => { e.stopPropagation(); addNewPage(); }} className="px-3 py-2 bg-white border border-gray-300 rounded-full shadow-sm text-sm font-bold text-gray-600">＋ 追加</button>
            </div>
            <div className="flex gap-2">
              <button onClick={undo} disabled={history.length === 0} className="px-3 py-2 bg-white border border-gray-300 rounded-full shadow-sm text-sm text-gray-700 font-bold disabled:opacity-40">↩️ 戻る</button>
              <button onClick={handleDelete} className="px-3 py-2 bg-red-50 border border-red-200 text-red-500 rounded-full shadow-sm text-sm font-bold flex items-center gap-1">🗑️ {getDeleteLabel()}</button>
            </div>
          </div>

          <div className="flex gap-2 mb-4 flex-wrap justify-center w-full max-w-md" onClick={e => e.stopPropagation()}>
            <label className="cursor-pointer bg-blue-500 text-white px-3 py-2 rounded-full shadow-md font-bold text-xs">📸 シール <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} /></label>
            <button onClick={() => setIsAlbumOpen(true)} className="bg-amber-500 text-white px-3 py-2 rounded-full shadow-md font-bold text-xs">📦 アルバム</button>
            <button onClick={addText} className="bg-emerald-500 text-white px-3 py-2 rounded-full shadow-md font-bold text-xs">✍️ 文字</button>
            <button onClick={(e) => { e.stopPropagation(); setIsMultiSelectMode(!isMultiSelectMode); if(isMultiSelectMode) setSelectedIds([]); }} className={`px-3 py-2 rounded-full shadow-md transition font-bold flex items-center gap-1 text-xs ${isMultiSelectMode ? "bg-purple-500 text-white" : "bg-white text-gray-600 border border-gray-200"}`}>✅ 複数選択</button>
            <button onClick={() => setIsGridMode(!isGridMode)} className={`px-3 py-2 rounded-full shadow-md font-bold text-xs ${isGridMode ? "bg-teal-500 text-white" : "bg-white text-gray-600"}`}>📏 グリッド</button>
            <div className="flex items-center gap-1 bg-white p-1 rounded-full shadow-md">
              <button onClick={() => { setIsPenMode(!isPenMode); setIsEraserMode(false); setSelectedIds([]); setIsEditingText(false); setIsMultiSelectMode(false); }} className={`px-3 py-1.5 rounded-full font-bold text-xs ${isPenMode ? "bg-red-500 text-white" : "bg-gray-100"}`}>🖊️ ペン</button>
              <button onClick={() => { setIsEraserMode(!isEraserMode); setIsPenMode(false); setSelectedIds([]); setIsEditingText(false); setIsMultiSelectMode(false); }} className={`px-3 py-1.5 rounded-full font-bold text-xs ${isEraserMode ? "bg-indigo-500 text-white" : "bg-gray-100"}`}>🧹 消しゴム</button>
            </div>
            <button onClick={saveAsImage} className="bg-orange-500 text-white px-3 py-2 rounded-full shadow-md font-bold text-xs">💾 保存</button>
          </div>

          <div ref={diaryRef} className={`w-full max-w-md relative rounded-3xl shadow-xl bg-[#faf8ef] border border-gray-200 transition-all ${(isPenMode || isEraserMode) ? "cursor-none ring-2 " + (isPenMode ? "ring-red-400" : "ring-indigo-400") : ""}`} style={{ height: "600px", touchAction: "none" }} onPointerDown={handleDiaryPointerDown} onPointerMove={handleCanvasPointerMove} onPointerUp={handleDiaryPointerUp} onPointerLeave={handleDiaryPointerLeave} onClick={e => { e.stopPropagation(); setShowPreviews(false); setSelectedIds([]); setIsEditingText(false); setIsMultiSelectMode(false); }}>
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-10">
              <div className="absolute inset-0 opacity-30 transition-all" style={isGridMode ? { backgroundImage: "radial-gradient(#9ca3af 2px, transparent 2px)", backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px` } : { backgroundImage: "linear-gradient(transparent 95%, #cbd5e1 95%)", backgroundSize: "100% 2.5rem", marginTop: "4.5rem" }} />
              <div className="absolute top-0 left-0 right-0 px-6 pt-6 pb-2 bg-[#faf8ef]/95 backdrop-blur-sm z-20 pointer-events-none border-b border-transparent"><span className="text-2xl font-serif text-gray-700 border-b-2 border-red-300 pb-1 inline-block pointer-events-auto">{currentPage.date}</span></div>
              <div className="absolute inset-0 pt-[5rem] px-6 pb-6 pointer-events-auto z-10">
                {isEditingText ? (
                  <textarea ref={textareaRef} autoFocus value={currentText} onChange={(e) => updateCurrentText(e.target.value)} onFocus={() => { saveHistory(); setIsPenMode(false); setIsEraserMode(false); setSelectedIds([]); setIsMultiSelectMode(false); setShowPreviews(false); }} onBlur={() => { if (!selectedTextRange) setIsEditingText(false); }} onSelect={(e) => { const target = e.target as HTMLTextAreaElement; if (target.selectionStart !== target.selectionEnd) setSelectedTextRange({start: target.selectionStart, end: target.selectionEnd}); else setSelectedTextRange(null); }} onClick={e => { e.stopPropagation(); setShowPreviews(false); }} onPointerDown={e => e.stopPropagation()} placeholder={(isPenMode || isEraserMode) ? "" : "ここをタップして日記を書こう..."} className="w-full h-full bg-transparent resize-none outline-none text-gray-800" style={{ lineHeight: "2.5rem" }} />
                ) : (
                  <div onClick={(e) => { e.stopPropagation(); setShowPreviews(false); if (typeof window !== "undefined" && (window as any).isScratching) return; if ((e.target as HTMLElement).closest('.scratch-area')) return; if(!isPenMode && !isEraserMode) setIsEditingText(true); }} className="w-full h-full whitespace-pre-wrap break-words text-gray-800 cursor-text" style={{ lineHeight: "2.5rem" }}>
                    {renderParsedText(currentText)} {!currentText && <span className="text-gray-400">ここをタップして書き始める...</span>}
                  </div>
                )}
              </div>
              {renderCanvasItems(currentPage.items, "diary")}
              {(isPenMode || isEraserMode) && cursorPos && <div className={`absolute pointer-events-none z-50 rounded-full border-2 transform -translate-x-1/2 -translate-y-1/2 ${isEraserMode ? 'border-gray-400 bg-white/30 backdrop-invert-[.1]' : 'border-black/20'}`} style={{ left: cursorPos.x, top: cursorPos.y, width: isEraserMode ? eraserSize : penSize, height: isEraserMode ? eraserSize : penSize, backgroundColor: isPenMode ? penColor : undefined, opacity: isPenMode ? 0.5 : 1 }} />}
            </div>
            <div className="absolute inset-0 z-30 pointer-events-none">{renderActiveItemControls(currentPage.items)}</div>
          </div>
        </div>
      )}

      {/* 3. コレクション一覧モード */}
      {viewMode === "collections" && (
        <div className="min-h-screen bg-[#faf8ef] font-sans select-none overflow-hidden relative flex flex-col">
          <div className="flex items-center justify-between w-full max-w-md mx-auto px-4 pt-6 pb-4 border-b border-gray-200">
            <button onClick={() => setViewMode("calendar")} className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-full shadow-sm text-gray-600 font-bold">◀</button>
            <h1 className="text-center text-xl font-bold text-gray-800 tracking-wider">📕 コレクション</h1>
            <div className="w-10"></div>
          </div>
          <div className="w-full max-w-md mx-auto p-4 flex-1 overflow-y-auto grid grid-cols-2 gap-4 content-start">
            <button onClick={createNewCollection} className="aspect-[3/4] flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl hover:bg-white transition text-gray-500 font-bold"><span className="text-3xl mb-2">＋</span>新しいページ</button>
            {collectionPages.map(page => (
                <button key={page.id} onClick={() => { setCurrentCollectionId(page.id); setViewMode("collection_editor"); }} className="relative aspect-[3/4] flex flex-col border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden p-0 bg-white">
                  <div className={`relative w-full flex-1 overflow-hidden ${page.bgClass}`}><div className="absolute top-0 left-0 w-[400px] h-[600px] origin-top-left pointer-events-none" style={{ transform: 'scale(0.4)' }}>{renderCanvasItems(page.items, `prev-col-${page.id}`)}</div></div>
                  <div className="w-full bg-white/90 backdrop-blur-sm py-2 px-2 text-center text-xs font-bold text-gray-700 truncate border-t border-gray-100 z-10 relative">{page.title}</div>
                </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. コレクションエディタモード */}
      {viewMode === "collection_editor" && currentCollection && (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center py-6 px-4 font-sans select-none overflow-hidden" onClick={() => { setSelectedIds([]); setIsEditingText(false); setIsMultiSelectMode(false); }}>
          <div className="flex items-center justify-between w-full max-w-md mb-4 px-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewMode("collections")} className="px-4 py-2 bg-white border border-gray-300 rounded-full shadow-sm text-sm text-gray-700 font-bold">◀ 戻る</button>
            <div className="flex gap-2">
              <select value={currentCollection.bgClass} onChange={(e) => setCollectionPages(prev => prev.map(c => c.id === currentCollection.id ? { ...c, bgClass: e.target.value } : c))} className="bg-white border border-gray-300 rounded-full px-3 py-2 text-xs font-bold text-gray-700 outline-none shadow-sm">{BG_OPTIONS.map(opt => <option key={opt.class} value={opt.class}>{opt.name}</option>)}</select>
              <button onClick={handleDelete} className="px-3 py-2 bg-red-50 border border-red-200 text-red-500 rounded-full shadow-sm text-xs font-bold">🗑️ {getDeleteLabel()}</button>
            </div>
          </div>
          <div className="flex gap-2 mb-4 flex-wrap justify-center w-full max-w-md" onClick={e => e.stopPropagation()}>
            <label className="cursor-pointer bg-blue-500 text-white px-3 py-2 rounded-full shadow-md font-bold text-xs">📸 シール <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} /></label>
            <button onClick={() => setIsAlbumOpen(true)} className="bg-amber-500 text-white px-3 py-2 rounded-full shadow-md font-bold text-xs">📦 アルバム</button>
            <button onClick={addText} className="bg-emerald-500 text-white px-3 py-2 rounded-full shadow-md font-bold text-xs">✍️ 文字</button>
            <button onClick={(e) => { e.stopPropagation(); setIsMultiSelectMode(!isMultiSelectMode); if(isMultiSelectMode) setSelectedIds([]); }} className={`px-3 py-2 rounded-full shadow-md transition font-bold flex items-center gap-1 text-xs ${isMultiSelectMode ? "bg-purple-500 text-white" : "bg-white text-gray-600 border border-gray-200"}`}>✅ 複数選択</button>
            <button onClick={(e) => { e.stopPropagation(); setIsGridMode(!isGridMode); }} className={`px-3 py-2 rounded-full shadow-md transition font-bold flex items-center gap-1 text-xs ${isGridMode ? "bg-teal-500 text-white" : "bg-white text-gray-600 border border-gray-200"}`}>📏 グリッド</button>
            <div className="flex items-center gap-1 bg-white p-1 rounded-full shadow-md">
              <button onClick={() => { setIsPenMode(!isPenMode); setIsEraserMode(false); setSelectedIds([]); setIsEditingText(false); setIsMultiSelectMode(false); }} className={`px-3 py-1.5 rounded-full font-bold text-xs ${isPenMode ? "bg-red-500 text-white" : "bg-gray-100"}`}>🖊️</button>
              <button onClick={() => { setIsEraserMode(!isEraserMode); setIsPenMode(false); setSelectedIds([]); setIsEditingText(false); setIsMultiSelectMode(false); }} className={`px-3 py-1.5 rounded-full font-bold text-xs ${isEraserMode ? "bg-indigo-500 text-white" : "bg-gray-100"}`}>🧹</button>
            </div>
            <button onClick={saveAsImage} className="bg-orange-500 text-white px-3 py-2 rounded-full shadow-md font-bold text-xs">💾 保存</button>
          </div>

          <div ref={diaryRef} className={`w-full max-w-md relative rounded-3xl shadow-xl border border-gray-200 transition-all ${currentCollection.bgClass} ${(isPenMode || isEraserMode) ? "cursor-none ring-2 " + (isPenMode ? "ring-red-400" : "ring-indigo-400") : ""}`} style={{ height: "600px", touchAction: "none" }} onPointerDown={handleDiaryPointerDown} onPointerMove={handleCanvasPointerMove} onPointerUp={handleDiaryPointerUp} onPointerLeave={handleDiaryPointerLeave} onClick={e => { e.stopPropagation(); setSelectedIds([]); setIsEditingText(false); setIsMultiSelectMode(false); }}>
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-10">
              <div className="absolute inset-0 opacity-30 transition-all pointer-events-none" style={isGridMode ? { backgroundImage: "radial-gradient(#9ca3af 2px, transparent 2px)", backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px` } : {}} />
              <div className="absolute top-0 left-0 right-0 px-6 pt-6 pb-2 backdrop-blur-sm z-20 pointer-events-none">
                <input type="text" value={currentCollection.title} onChange={e => setCollectionPages(prev => prev.map(c => c.id === currentCollection.id ? { ...c, title: e.target.value } : c))} className="w-full text-2xl font-bold text-gray-800 bg-transparent outline-none border-b-2 border-gray-300 focus:border-pink-400 pb-1 pointer-events-auto" placeholder="コレクションのタイトル" />
              </div>
              <div className="absolute inset-0 pt-[5rem] px-6 pb-6 pointer-events-auto z-10"><div onClick={(e) => { e.stopPropagation(); if(!isPenMode && !isEraserMode) setIsEditingText(true); }} className="w-full h-full cursor-text" /></div>
              {renderCanvasItems(currentCollection.items, "col")}
              {(isPenMode || isEraserMode) && cursorPos && <div className={`absolute pointer-events-none z-50 rounded-full border-2 transform -translate-x-1/2 -translate-y-1/2 ${isEraserMode ? 'border-gray-400 bg-white/30 backdrop-invert-[.1]' : 'border-black/20'}`} style={{ left: cursorPos.x, top: cursorPos.y, width: isEraserMode ? eraserSize : penSize, height: isEraserMode ? eraserSize : penSize, backgroundColor: isPenMode ? penColor : undefined, opacity: isPenMode ? 0.5 : 1 }} />}
            </div>
            <div className="absolute inset-0 z-30 pointer-events-none">{renderActiveItemControls(currentCollection.items)}</div>
          </div>
        </div>
      )}

      {/* ページ一覧プレビューバー（日記モード時のみ） */}
      {viewMode === "editor" && (
        <div className={`fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-200 p-4 overflow-x-auto z-[50] transition-transform duration-300 ${showPreviews && currentPage ? "translate-y-0" : "translate-y-full"}`} onClick={e => e.stopPropagation()}>
          <div className="flex gap-4 min-w-max px-4 items-center">
            {pages.map((page, index) => {
              if (!currentPage || page.dateId !== currentPage.dateId) return null;
              return (
                <div key={page.id} className="relative group">
                  <button onClick={() => { setCurrentPageIndex(index); setSelectedIds([]); setShowPreviews(false); setIsPenMode(false); setIsEraserMode(false); setCursorPos(null); setIsMultiSelectMode(false); }} className={`relative w-24 h-32 rounded-xl border-2 transition-all flex flex-col items-center justify-between p-2 shadow-sm ${currentPageIndex === index ? "border-blue-500 bg-blue-50 scale-105 shadow-md" : "border-gray-200 bg-white opacity-70"}`}>
                    <div className="text-[10px] font-bold text-gray-500 truncate w-full text-center">{page.date.split('（')[0]}</div>
                    <div className="w-full flex-1 bg-[#faf8ef] rounded mt-1 border border-gray-100 relative overflow-hidden flex items-center justify-center text-[8px] text-gray-400">Page</div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
}