// components/ui/features-selector.tsx
"use client";

import React from 'react';
import { 
  Calendar, ArrowUpDown, Eye, Layers, Compass, Car,
  Dumbbell, Waves, ShieldCheck, Trees, Sofa, Building, Building2, Check,
  Package, Flame, Wifi, PawPrint, Baby, Coffee, BedDouble, Wind, User, Home
} from 'lucide-react';
import { ViewType, Orientation, ParkingType, PropertyData } from '@/types';

interface FeaturesSelectorProps {
  data: PropertyData;
  onChange: (updates: Partial<PropertyData>) => void;
}

const VIEWS: ViewType[] = ['Sin vista', 'Vista a la ciudad', 'Vista a montaña', 'Vista al valle', 'Vista al mar', 'Vista panorámica'];
const ORIENTATIONS: Orientation[] = ['Norte', 'Sur', 'Este', 'Oeste', 'No sé'];
const PARKING_TYPES: ParkingType[] = ['Sin parqueo', 'Subterráneo', 'Cubierto', 'Descubierto'];

const BUILDING_AMENITIES = [
  { key: 'hasElevator', label: 'Ascensor', icon: ArrowUpDown },
  { key: 'hasGym', label: 'Gimnasio', icon: Dumbbell },
  { key: 'hasPool', label: 'Piscina', icon: Waves },
  { key: 'hasSecurity24h', label: 'Seguridad 24/7', icon: ShieldCheck },
  { key: 'hasCommonAreas', label: 'Áreas comunales', icon: Trees },
  { key: 'hasPlayground', label: 'Juegos infantiles', icon: Baby },
  { key: 'hasBBQArea', label: 'Zona BBQ', icon: Flame },
  { key: 'hasCoworking', label: 'Coworking', icon: Coffee },
  { key: 'hasReception', label: 'Recepción', icon: User },
  { key: 'bodega', label: 'Bodega', icon: Package },
] as const;

const PROPERTY_FEATURES = [
  { key: 'isFurnished', label: 'Amoblado', icon: Sofa },
  { key: 'hasTerrace', label: 'Terraza', icon: Trees },
  { key: 'hasBalcon', label: 'Balcón', icon: Wind },
  { key: 'hasGarden', label: 'Jardín privado', icon: Trees },
  { key: 'hasJacuzzi', label: 'Jacuzzi', icon: Waves },
  { key: 'hasFireplace', label: 'Chimenea', icon: Flame },
  { key: 'hasWalkInCloset', label: 'Walk-in closet', icon: BedDouble },
  { key: 'hasMaidRoom', label: 'Cuarto servicio', icon: User },
  { key: 'hasLaundryRoom', label: 'Cuarto lavado', icon: Home },
] as const;

const SERVICES = [
  { key: 'hasInternet', label: 'Internet incluido', icon: Wifi },
  { key: 'hasNaturalGas', label: 'Gas centralizado', icon: Flame },
  { key: 'petsAllowed', label: 'Acepta mascotas', icon: PawPrint },
] as const;

export default function FeaturesSelector({ data, onChange }: FeaturesSelectorProps) {
  const currentYear = new Date().getFullYear();
  const showFloorOption = data.type === 'Departamento' || data.type === 'Suite';
  
  return (
    <div className="flex flex-col gap-5">
      {/* Año de construcción */}
      <div>
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <Calendar size={14} className="text-slate-400" />
          Año de construcción <span className="text-xs font-normal text-slate-400">(opcional)</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="1900"
            max={currentYear}
            value={data.yearBuilt || ''}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              onChange({ yearBuilt: isNaN(val) ? undefined : val });
            }}
            placeholder={`Ej. ${currentYear - 10}`}
            className="flex-1 bg-white border border-slate-200 focus:border-[#1a56db] rounded-full py-3 px-4 text-sm outline-none transition-all placeholder:text-slate-400"
          />
          {data.yearBuilt && (
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full whitespace-nowrap">
              {currentYear - data.yearBuilt} años
            </span>
          )}
        </div>
      </div>

      {/* Piso MANUAL + Pisos del edificio (solo deptos/suites) */}
      {showFloorOption && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
              <Layers size={14} className="text-slate-400" />
              Piso del inmueble
            </label>
            <input
              type="text"
              placeholder='Ej. 5, PB, PH...'
              value={data.floor !== undefined ? String(data.floor) : ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  onChange({ floor: undefined });
                } else {
                  const num = parseInt(val, 10);
                  onChange({ floor: isNaN(num) ? val : num });
                }
              }}
              className="w-full bg-white border border-slate-200 focus:border-[#1a56db] rounded-full py-3 px-4 text-sm outline-none transition-all placeholder:text-slate-400"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
              <Building2 size={14} className="text-slate-400" />
              Pisos del edificio
            </label>
            <input
              type="number"
              placeholder="Ej. 12"
              min="1"
              max="100"
              value={data.totalFloors || ''}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                onChange({ totalFloors: val });
              }}
              className="w-full bg-white border border-slate-200 focus:border-[#1a56db] rounded-full py-3 px-4 text-sm outline-none transition-all placeholder:text-slate-400"
            />
          </div>
        </div>
      )}

      {/* Vista */}
      <div>
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <Eye size={14} className="text-slate-400" />
          Vista
        </label>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {VIEWS.map(v => (
            <button
              key={v}
              type="button"
              onClick={() => onChange({ view: v })}
              aria-pressed={data.view === v}
              className={`py-2.5 px-3 rounded-full text-xs font-medium transition-all border ${
                data.view === v
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Orientación */}
      <div>
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <Compass size={14} className="text-slate-400" />
          Orientación
        </label>
        <div className="grid grid-cols-5 gap-2" role="radiogroup">
          {ORIENTATIONS.map(o => (
            <button
              key={o}
              type="button"
              onClick={() => onChange({ orientation: o })}
              aria-pressed={data.orientation === o}
              className={`py-2.5 px-2 rounded-full text-xs font-medium transition-all border ${
                data.orientation === o
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      {/* Tipo de parqueo */}
      <div>
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <Car size={14} className="text-slate-400" />
          Tipo de parqueo
        </label>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {PARKING_TYPES.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => onChange({ parkingType: p })}
              aria-pressed={data.parkingType === p}
              className={`py-2.5 px-3 rounded-full text-xs font-medium transition-all border ${
                data.parkingType === p
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Amenities del edificio */}
      <div>
        <label className="text-sm font-semibold text-slate-700 mb-3 block">
          Amenities del edificio <span className="text-xs font-normal text-slate-400">(suma valor)</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {BUILDING_AMENITIES.map(({ key, label, icon: Icon }) => {
            const isActive = !!data[key as keyof PropertyData];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange({ [key]: !isActive } as Partial<PropertyData>)}
                aria-pressed={isActive}
                className={`flex items-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-medium transition-all border ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {isActive ? (
                  <div className="w-4 h-4 rounded-full bg-[#1a56db] flex items-center justify-center shrink-0">
                    <Check size={10} className="text-white" strokeWidth={3} />
                  </div>
                ) : (
                  <Icon size={14} className="text-slate-400 shrink-0" />
                )}
                <span className="text-left truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Características del inmueble */}
      <div>
        <label className="text-sm font-semibold text-slate-700 mb-3 block">
          Características del inmueble
        </label>
        <div className="grid grid-cols-2 gap-2">
          {PROPERTY_FEATURES.map(({ key, label, icon: Icon }) => {
            const isActive = !!data[key as keyof PropertyData];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange({ [key]: !isActive } as Partial<PropertyData>)}
                aria-pressed={isActive}
                className={`flex items-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-medium transition-all border ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {isActive ? (
                  <div className="w-4 h-4 rounded-full bg-[#1a56db] flex items-center justify-center shrink-0">
                    <Check size={10} className="text-white" strokeWidth={3} />
                  </div>
                ) : (
                  <Icon size={14} className="text-slate-400 shrink-0" />
                )}
                <span className="text-left truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Servicios */}
      <div>
        <label className="text-sm font-semibold text-slate-700 mb-3 block">
          Servicios
        </label>
        <div className="grid grid-cols-2 gap-2">
          {SERVICES.map(({ key, label, icon: Icon }) => {
            const isActive = !!data[key as keyof PropertyData];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange({ [key]: !isActive } as Partial<PropertyData>)}
                aria-pressed={isActive}
                className={`flex items-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-medium transition-all border ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {isActive ? (
                  <div className="w-4 h-4 rounded-full bg-[#1a56db] flex items-center justify-center shrink-0">
                    <Check size={10} className="text-white" strokeWidth={3} />
                  </div>
                ) : (
                  <Icon size={14} className="text-slate-400 shrink-0" />
                )}
                <span className="text-left truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}