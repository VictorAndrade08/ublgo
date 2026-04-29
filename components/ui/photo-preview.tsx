// components/ui/photo-preview.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon } from 'lucide-react';

interface PhotoPreviewProps {
  files: File[];
  onRemove: (idx: number) => void;
}

export default function PhotoPreview({ files, onRemove }: PhotoPreviewProps) {
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviews(urls);
    
    // Cleanup: liberar memoria de los blob URLs
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [files]);

  if (files.length === 0) return null;

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {files.map((file, idx) => (
        <div
          key={`${file.name}-${idx}`}
          className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 group shadow-sm"
        >
          {previews[idx] ? (
            <img
              src={previews[idx]}
              alt={`Foto ${idx + 1}: ${file.name}`}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-100">
              <ImageIcon size={24} className="text-slate-400" />
            </div>
          )}
          
          {/* Overlay con info al hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
            <p className="text-white text-[10px] font-medium truncate">
              {file.name}
            </p>
            <p className="text-white/70 text-[9px]">
              {(file.size / 1024).toFixed(0)} KB
            </p>
          </div>
          
          {/* Botón eliminar */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove(idx);
            }}
            aria-label={`Eliminar ${file.name}`}
            className="absolute top-1.5 right-1.5 w-6 h-6 bg-white/90 hover:bg-red-500 hover:text-white text-slate-600 rounded-full flex items-center justify-center shadow-sm transition-all opacity-0 group-hover:opacity-100"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
          
          {/* Número de foto */}
          <div className="absolute top-1.5 left-1.5 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
            {idx + 1}
          </div>
        </div>
      ))}
    </div>
  );
}