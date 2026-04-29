import React from 'react';
import { Minus, Plus, Check, Loader2 } from 'lucide-react';

interface SelectionCardProps {
  icon: React.ReactNode;
  title: string;
  selected: boolean;
  onClick: () => void;
}

export function SelectionCard({ icon, title, selected, onClick }: SelectionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`p-4 rounded-[1.5rem] flex flex-col items-center justify-center gap-3 transition-all border-2 ${
        selected
          ? 'bg-[#f0f4fa] border-[#1a56db] text-[#1a56db]'
          : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
      }`}
    >
      <div className={selected ? 'text-[#1a56db]' : 'text-slate-400'}>{icon}</div>
      <span className="text-sm font-semibold">{title}</span>
    </button>
  );
}

interface CounterProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}

export function Counter({ label, value, onChange, min = 0, max = 99 }: CounterProps) {
  return (
    <div className="flex flex-col items-center gap-2 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Disminuir ${label}`}
          disabled={value <= min}
          className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Minus size={14} />
        </button>
        <span className="text-lg font-bold w-4 text-center" aria-live="polite">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`Aumentar ${label}`}
          disabled={value >= max}
          className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

interface LoadingItemProps {
  text: string;
  active: boolean;
  done: boolean;
}

export function LoadingItem({ text, active, done }: LoadingItemProps) {
  return (
    <div className={`flex items-center gap-3 text-sm font-medium transition-all duration-300 ${active ? 'text-slate-800' : 'text-slate-300'} ${done ? 'opacity-70' : ''}`}>
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
          done ? 'bg-emerald-100 text-emerald-500' : active ? 'bg-blue-100 text-[#1a56db]' : 'bg-slate-100 text-slate-300'
        }`}
        aria-hidden="true"
      >
        {done ? <Check size={12} strokeWidth={3} /> : active ? <Loader2 size={12} className="animate-spin" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>}
      </div>
      {text}
    </div>
  );
}