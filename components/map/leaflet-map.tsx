"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { LatLng, LeafletMap, LeafletMarker, LeafletGlobal } from '@/types';

interface LeafletMapProps {
  initialLocation: LatLng;
  onLocationChange: (loc: LatLng) => void;
}

export default function LeafletMapComponent({ initialLocation, onLocationChange }: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const initialLocationRef = useRef(initialLocation);
  const onLocationChangeRef = useRef(onLocationChange);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    let cancelled = false;

    const ensureLeaflet = (): Promise<LeafletGlobal> =>
      new Promise((resolve, reject) => {
        const w = window as unknown as { L?: LeafletGlobal };
        if (w.L) { resolve(w.L); return; }

        // Migrado a Cloudflare (cdnjs) para evitar bloqueos locales y firewalls
        if (!document.getElementById('leaflet-css')) {
          const link = document.createElement('link');
          link.id = 'leaflet-css';
          link.rel = 'stylesheet';
          link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
          document.head.appendChild(link);
        }
        
        const existingScript = document.getElementById('leaflet-js');
        
        if (!existingScript) {
          const script = document.createElement('script');
          script.id = 'leaflet-js';
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
          script.onload = () => {
            const L = (window as unknown as { L: LeafletGlobal }).L;
            resolve(L);
          };
          script.onerror = () => reject(new Error('No se pudo cargar Leaflet desde CDN'));
          document.head.appendChild(script);
        } else {
          // Manejo robusto a prueba de React Strict Mode (Next.js App Router)
          const check = setInterval(() => {
            const w2 = window as unknown as { L?: LeafletGlobal };
            if (w2.L) { clearInterval(check); resolve(w2.L); }
          }, 100);
          setTimeout(() => { clearInterval(check); reject(new Error('Timeout Leaflet')); }, 8000);
        }
      });

    const initMap = async () => {
      try {
        const L = await ensureLeaflet();
        if (cancelled || !mapContainerRef.current || mapRef.current) return;

        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        });

        const initial = initialLocationRef.current;
        const map = L.map(mapContainerRef.current).setView([initial.lat, initial.lng], 15);

        L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          attribution: '&copy; Google Maps',
          maxZoom: 20,
        }).addTo(map);

        const marker = L.marker([initial.lat, initial.lng]).addTo(map);

        map.on('click', (e: any) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          onLocationChangeRef.current({ lat, lng });
        });

        mapRef.current = map;
        markerRef.current = marker;
      } catch (err) {
        console.error('Error inicializando mapa:', err);
      }
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ', Ecuador')}`
      );
      const data: Array<{ lat: string; lon: string }> = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (mapRef.current && markerRef.current) {
          mapRef.current.setView([lat, lng], 16);
          markerRef.current.setLatLng([lat, lng]);
        }
        onLocationChangeRef.current({ lat, lng });
      }
    } catch (error) {
      console.error('Error buscando dirección:', error);
    }
    setIsSearching(false);
  };

  return (
    <div className="w-full h-full relative">
      <form
        onSubmit={handleSearch}
        role="search"
        className="absolute top-3 left-1/2 transform -translate-x-1/2 z-[400] w-11/12 max-w-sm flex items-center gap-2 bg-white/95 backdrop-blur-md px-4 py-3 rounded-full shadow-md border border-slate-100/50 transition-all focus-within:shadow-xl focus-within:bg-white"
      >
        <Search size={16} className="text-[#1a56db]" aria-hidden="true" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Busca tu calle o dirección..."
          aria-label="Buscar dirección"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 font-medium text-slate-700"
        />
        {isSearching && <Loader2 size={16} className="text-[#1a56db] animate-spin" aria-label="Buscando" />}
      </form>
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-slate-100" role="application" aria-label="Mapa interactivo" />
    </div>
  );
}