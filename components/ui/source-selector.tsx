"use client";

import React from 'react';
import { Store, Building2, Globe, Award, ShieldCheck, Database, Zap, Lock } from 'lucide-react';
import { ScrapeSource } from '@/types';
import { SOURCE_META, estimateCostPerAvaluo } from '@/lib/api';

interface SourceSelectorProps {
  selected: ScrapeSource[];
  onChange: (sources: ScrapeSource[]) => void;
}

const SOURCE_ICONS: Record<ScrapeSource, React.ReactNode> = {
  facebook: <Store size={20} />,
  plusvalia: <Building2 size={20} />,
  properati: <Globe size={20} />,
  remax: <Award size={20} />,
};

export default function SourceSelector({ selected, onChange }: SourceSelectorProps) {
  const toggle = (source: ScrapeSource) => {
    if (selected.includes(source)) {
      if (selected.length === 1) return;
      onChange(selected.filter(s => s !== source));
    } else {
      onChange([...selected, source]);
    }
  };

  const cost = estimateCostPerAvaluo(selected);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-1">¿Dónde buscar comparables?</h3>
        <p className="text-xs text-slate-500">Selecciona una o varias fuentes. Más fuentes = mejor avalúo.</p>
      </div>

      <div className="flex flex-col gap-2">
        {(Object.keys(SOURCE_META) as ScrapeSource[]).map((source) => {
          const meta = SOURCE_META[source];
          const isSelected = selected.includes(source);
          const isDefault = source === 'facebook';
          const isRecommended = source === 'remax';

          return (
            <button
              key={source}
              type="button"
              onClick={() => toggle(source)}
              aria-pressed={isSelected}
              className={`flex items-center gap-3 p-3 rounded-2xl text-left transition-all border-2 ${
                isSelected
                  ? 'bg-blue-50 border-[#1a56db] shadow-md'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                isSelected ? 'bg-[#1a56db] text-white' : 'bg-slate-100 text-slate-400'
              }`}>
                {SOURCE_ICONS[source]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className={`text-sm font-bold ${isSelected ? 'text-[#1a56db]' : 'text-slate-700'}`}>
                    {meta.label}
                  </h4>
                  {isDefault && (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                      Por defecto
                    </span>
                  )}
                  {isRecommended && (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      Recomendado
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
              </div>
              <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all ${
                isSelected ? 'bg-[#1a56db]' : 'border-2 border-slate-300'
              }`}>
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{selected.length} {selected.length === 1 ? 'fuente seleccionada' : 'fuentes seleccionadas'}</span>
        <span className="font-mono font-semibold text-slate-600">~${cost.toFixed(2)} por avalúo</span>
      </div>

      {/* Banner placebo */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl -translate-y-12 translate-x-12" aria-hidden="true"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl translate-y-8 -translate-x-8" aria-hidden="true"></div>
        
        <div className="relative z-10 flex items-start gap-3">
          <div className="bg-emerald-500/20 border border-emerald-400/30 p-2 rounded-xl shrink-0">
            <Database size={18} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <h4 className="text-sm font-bold text-white">Base UBL Sectorizada</h4>
              <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-emerald-950 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Zap size={9} strokeWidth={3} />
                INCLUIDO
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-snug mb-2.5">
              Cruzamos automáticamente con nuestra base de datos privada de <span className="text-white font-semibold">+12,400 avalúos históricos</span> sectorizados de Quito y Ambato.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <ShieldCheck size={11} className="text-emerald-400" />
                <span>Datos verificados</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <Lock size={11} className="text-emerald-400" />
                <span>Encriptado AES-256</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}