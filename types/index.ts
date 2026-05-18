export type CanvasSticker = { 
  id: string; src: string; x: number; y: number; width: number; height: number; 
  type: "sticker"; name?: string; usageCount?: number; lastUsed?: number; 
  isFavorite?: boolean; decoration?: string; rotation?: number; animation?: string;
  isSecret?: boolean; isPublished?: boolean; location?: { lat: number; lng: number }; 
};
export type CanvasText = { id: string; content: string; x: number; y: number; fontSize: number; rotation: number; color: string; fontFamily: string; type: "text"; isSecret?: boolean; };
export type CanvasDrawing = { id: string; points: { x: number; y: number }[]; color: string; width: number; type: "drawing"; isEraser?: boolean; };
export type CanvasItem = CanvasSticker | CanvasText | CanvasDrawing;

export type PageData = { id: string; dateId: string; items: CanvasItem[]; diaryText: string; date: string; };
export type CollectionPage = { id: string; title: string; bgClass: string; items: CanvasItem[]; };

export type ExchangeDiary = {
  id: string; title: string; partnerName: string; currentTurn: "me" | "partner"; 
  bgClass: string; category: "lover" | "friend" | "family"; items: CanvasItem[]; diaryText: string;
};

export type CropShape = "circle" | "square" | "rect" | "free";
export type HistoryState = { pages: PageData[]; currentPageIndex: number; };