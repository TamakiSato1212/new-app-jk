"use client";

import React, { useRef, useEffect } from "react";

export const InlineScratch = ({ text }: { text: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      setTimeout(() => {
        if (typeof window !== "undefined") (window as any).isScratching = false;
      }, 50);
    };
    window.addEventListener("pointerup", handleGlobalPointerUp);
    return () => window.removeEventListener("pointerup", handleGlobalPointerUp);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    for(let i = -rect.width; i < rect.width * 2; i += 6) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - rect.height, rect.height); ctx.stroke();
    }

    ctx.font = "bold 10px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SCRATCH", rect.width / 2, rect.height / 2);
  }, [text]);

  const handleScratch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    if (e.buttons !== 1 && e.pointerType !== 'touch') return;

    if (typeof window !== "undefined") (window as any).isScratching = true;

    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    const ctx = canvas.getContext("2d"); if (!ctx) return;

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
  };

  return (
    <span
      ref={containerRef}
      // ★ ここに「scratch-area」という目印を追加！
      className="scratch-area relative inline-block mx-[2px] px-1 rounded select-none cursor-pointer"
      onClick={e => { e.stopPropagation(); e.preventDefault(); }}
      onPointerDown={e => e.stopPropagation()}
    >
      <span className="relative z-0 px-1 text-gray-800">{text}</span>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-10 touch-none rounded"
        onPointerMove={handleScratch}
        onPointerDown={handleScratch}
        onClick={e => { e.stopPropagation(); e.preventDefault(); }}
      />
    </span>
  );
};

export const ScratchCard = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      setTimeout(() => {
        if (typeof window !== "undefined") (window as any).isScratching = false;
      }, 50);
    };
    window.addEventListener("pointerup", handleGlobalPointerUp);
    return () => window.removeEventListener("pointerup", handleGlobalPointerUp);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#cbd5e1"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 2;
    for(let i = -canvas.width; i < canvas.width * 2; i+=15) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - canvas.height, canvas.height); ctx.stroke(); }
    ctx.font = "bold 28px sans-serif"; ctx.fillStyle = "#64748b"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("SCRATCH!", canvas.width / 2, canvas.height / 2);
  }, []);

  const handleScratch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    if (e.buttons !== 1 && e.pointerType !== 'touch') return;

    if (typeof window !== "undefined") (window as any).isScratching = true;

    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX; const y = (e.clientY - rect.top) * scaleY;
    const ctx = canvas.getContext("2d"); if (!ctx) return;

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath(); ctx.arc(x, y, 25, 0, Math.PI * 2); ctx.fill();
  };

  return (
    <canvas 
      ref={canvasRef} 
      width={200} 
      height={200} 
      className="absolute inset-0 w-full h-full z-50 cursor-pointer touch-none rounded-xl" 
      style={{ filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.1))" }} 
      onPointerMove={handleScratch} 
      onPointerDown={handleScratch} 
      onClick={e => e.stopPropagation()} 
    />
  );
};