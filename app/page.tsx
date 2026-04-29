"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MapPin, Home, Building2, Map as MapIcon, UploadCloud,
  FileText, Mail, User, Phone, ArrowRight, ArrowLeft,
  Check, Sparkles, ShieldCheck, Info, FileDigit, Image as ImageIcon, AlertCircle,
  DollarSign, Key, Calendar, Eye, Layers, Dumbbell, Waves, Shield, Sofa, Trees, X as XIcon,
  Compass, Car, Package, Flame, Wifi, PawPrint, Baby, Coffee, BedDouble, Wind
} from 'lucide-react';

import { CONFIG } from '@/lib/config';
import { PropertyData, AvaluoResult, PropertyType, City, Condition, LatLng, ScrapeSource, ViewType, Orientation, ParkingType } from '@/types';
import { isValidEmail, isValidPhone, fileToBase64, scrapeWithApify, scrapeGoogleMaps, calculateWithGemini, fmtNum, fmtUSD, AvaluoError } from '@/lib/api';
import { SelectionCard, Counter, LoadingItem } from '../components/ui/form-elements';
import LeafletMapComponent from '@/components/map/leaflet-map';
import ReporteInline from '@/components/report/reporte-inline';
import SourceSelector from '@/components/ui/source-selector';

const PROPERTY_TYPES: PropertyType[] = ['Departamento', 'Casa', 'Suite', 'Terreno'];
const CITIES: City[] = ['Quito', 'Ambato'];
const CONDITIONS: Condition[] = ['Excelente', 'Bueno', 'Regular', 'A remodelar'];
const VIEW_TYPES: ViewType[] = ['Sin vista', 'Vista a la ciudad', 'Vista a montaña', 'Vista al valle', 'Vista al mar', 'Vista panorámica'];
const ORIENTATIONS: Orientation[] = ['Norte', 'Sur', 'Este', 'Oeste', 'No sé'];
const PARKING_TYPES: ParkingType[] = ['Sin parqueo', 'Subterráneo', 'Cubierto', 'Descubierto'];

const AmenityToggle: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all border ${
      active
        ? 'bg-[#1a56db] text-white border-[#1a56db] shadow-md'
        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
    }`}
  >
    <span className="shrink-0">{icon}</span>
    <span className="truncate">{label}</span>
  </button>
);

export default function App() {
  const [step, setStep] = useState(1);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<AvaluoResult | null>(null);
  const [reportId, setReportId] = useState('');

  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [showInlineMap, setShowInlineMap] = useState(false);

  const [sources, setSources] = useState<ScrapeSource[]>(['facebook']);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const [data, setData] = useState<PropertyData>({
    type: 'Departamento',
    city: 'Quito',
    sector: '',
    area: 120,
    rooms: 3,
    baths: 2,
    parking: 1,
    condition: 'Bueno',
    name: '',
    email: '',
    phone: '',
    operation: 'venta',
    view: 'Sin vista',
    orientation: 'No sé',
    parkingType: 'Sin parqueo',
  });

  const photoPreviews = useMemo(() => {
    return uploadedPhotos.map(file => ({
      file,
      url: URL.createObjectURL(file),
      name: file.name,
    }));
  }, [uploadedPhotos]);

  useEffect(() => {
    return () => {
      photoPreviews.forEach(p => URL.revokeObjectURL(p.url));
    };
  }, [photoPreviews]);

  const validateStep = useCallback((s: number): boolean => {
    if (s === 1 && (!data.lat || !data.lng)) {
      setMapError(true);
      setShowInlineMap(true);
      return false;
    }
    if (s === 3 && uploadedPhotos.length < CONFIG.MIN_PHOTOS) {
      setPhotoError(true);
      return false;
    }
    if (s === 4) {
      let valid = true;
      if (!data.email.trim() || !isValidEmail(data.email)) {
        setEmailError('Por favor ingresa un correo válido.');
        valid = false;
      } else setEmailError('');
      if (data.phone.trim() && !isValidPhone(data.phone)) {
        setPhoneError('El teléfono no tiene un formato válido.');
        valid = false;
      } else setPhoneError('');
      if (!valid) return false;
    }
    return true;
  }, [data, uploadedPhotos]);

  const nextStep = () => {
    if (!validateStep(step)) return;
    setMapError(false);
    setPhotoError(false);
    setStep(s => Math.min(s + 1, 6));
  };

  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setUploadedPhotos(prev => [...prev, ...Array.from(files)].slice(0, CONFIG.MAX_PHOTOS));
      setPhotoError(false);
    }
  };

  const handleRemovePhoto = (idx: number) => {
    setUploadedPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setUploadedDocs(prev => [...prev, ...Array.from(files)]);
    }
  };

  const handleReset = () => {
    setStep(1);
    setResult(null);
    setLoadingStep(0);
    setUploadedPhotos([]);
    setUploadedDocs([]);
    setShowInlineMap(false);
    setMapError(false);
    setPhotoError(false);
    setEmailError('');
    setPhoneError('');
    setReportId('');
    setSources(['facebook']);
    setErrorMessage(null);
    setErrorDetails(null);
    setData({
      type: 'Departamento', city: 'Quito', sector: '',
      area: 120, rooms: 3, baths: 2, parking: 1,
      condition: 'Bueno', name: '', email: '', phone: '',
      operation: 'venta', view: 'Sin vista', orientation: 'No sé', parkingType: 'Sin parqueo',
    });
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setErrorDetails(null);
    setLoadingStep(0);
    setStep(5);
  };

  useEffect(() => {
    if (step !== 5) return;
    const controller = new AbortController();
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const run = async () => {
      try {
        timeouts.push(setTimeout(() => {
          if (!controller.signal.aborted) setLoadingStep(1);
        }, 1000));

        const photoPromises = uploadedPhotos.map(async (file) => ({
          mimeType: file.type, data: await fileToBase64(file)
        }));
        const docPromises = uploadedDocs.map(async (file) => ({
          mimeType: file.type, data: await fileToBase64(file)
        }));

        const dataWithSources: PropertyData = { ...data, sources };

        const [scrapedData, mapsData, photosBase64, docsBase64] = await Promise.all([
          scrapeWithApify(dataWithSources, controller.signal),
          scrapeGoogleMaps(dataWithSources, controller.signal),
          Promise.all(photoPromises),
          Promise.all(docPromises)
        ]);

        if (controller.signal.aborted) return;
        setLoadingStep(2);

        const geminiData = await calculateWithGemini(
          dataWithSources, scrapedData, mapsData,
          [...photosBase64, ...docsBase64], controller.signal
        );

        if (controller.signal.aborted) return;
        setLoadingStep(3);

        timeouts.push(setTimeout(() => {
          if (!controller.signal.aborted) setLoadingStep(4);
        }, 1000));

        timeouts.push(setTimeout(() => {
          if (!controller.signal.aborted) {
            setResult(geminiData);
            setReportId(`UBL-AV-2026-${Math.floor(Math.random() * 90000) + 10000}`);
            setStep(6);
          }
        }, 2500));

      } catch (error: any) {
        if (controller.signal.aborted) return;
        console.error('Error en valoración:', error);
        if (error instanceof AvaluoError || error?.name === 'AvaluoError') {
          setErrorMessage(error.message);
          setErrorDetails(error.details || error.toString());
        } else {
          setErrorMessage('Error inesperado en el avalúo');
          setErrorDetails(error?.message || error?.toString() || 'Sin detalles');
        }
        setStep(7);
      }
    };

    run();
    return () => {
      controller.abort();
      timeouts.forEach(clearTimeout);
    };
  }, [step, data, uploadedPhotos, uploadedDocs, sources]);

  const mapInitialLocation: LatLng = data.lat && data.lng
    ? { lat: data.lat, lng: data.lng }
    : CONFIG.CITY_CENTERS[data.city];

  const operationLabel = data.operation === 'venta' ? 'venta' : 'arriendo';
  const operationLabelCap = data.operation === 'venta' ? 'Venta' : 'Arriendo';
  const showFloorOption = data.type === 'Departamento' || data.type === 'Suite';

  return (
    <div className="min-h-screen bg-[#f1f4f8] flex items-center justify-center p-4 font-sans text-slate-800 selection:bg-blue-100">
      <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 w-full max-w-2xl overflow-hidden flex flex-col min-h-[600px] relative transition-all duration-500">

        {step < 5 && (
          <header className="px-8 pt-8 pb-4 flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center transform rotate-45 shrink-0">
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                </div>
                <div>
                  <h2 className="font-bold text-lg leading-tight">Un Buen Lugar</h2>
                  <p className="text-xs text-slate-400">Motor de Avalúo IA</p>
                </div>
              </div>
              <div className="text-sm font-medium text-slate-400 bg-slate-50 px-4 py-1.5 rounded-full">
                Paso {step} de 4
              </div>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-[#1a56db]' : 'bg-slate-100'}`} />
              ))}
            </div>
          </header>
        )}

        <main className="flex-1 px-4 md:px-8 py-4 overflow-y-auto [&::-webkit-scrollbar]:hidden flex flex-col">

          {step === 1 && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight mb-2">¿Qué tipo de propiedad tienes?</h1>
                <p className="text-slate-500 text-sm">Comencemos con lo básico para analizar el mercado correcto.</p>
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-slate-700">¿Avalúo de venta o arriendo?</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setData(d => ({ ...d, operation: 'venta' }))}
                    className={`flex items-center gap-3 px-4 py-4 rounded-2xl text-sm font-medium transition-all border-2 ${
                      data.operation === 'venta'
                        ? 'bg-[#1a56db] text-white border-[#1a56db] shadow-md'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <DollarSign size={20} className="shrink-0" />
                    <div className="text-left">
                      <div className="font-semibold">Venta</div>
                      <div className={`text-[11px] ${data.operation === 'venta' ? 'text-blue-100' : 'text-slate-400'}`}>Precio total</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setData(d => ({ ...d, operation: 'arriendo' }))}
                    className={`flex items-center gap-3 px-4 py-4 rounded-2xl text-sm font-medium transition-all border-2 ${
                      data.operation === 'arriendo'
                        ? 'bg-[#1a56db] text-white border-[#1a56db] shadow-md'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Key size={20} className="shrink-0" />
                    <div className="text-left">
                      <div className="font-semibold">Arriendo</div>
                      <div className={`text-[11px] ${data.operation === 'arriendo' ? 'text-blue-100' : 'text-slate-400'}`}>Renta mensual</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {PROPERTY_TYPES.map(t => (
                  <SelectionCard
                    key={t}
                    icon={
                      t === 'Departamento' ? <Building2 size={24} /> :
                      t === 'Casa' ? <Home size={24} /> :
                      t === 'Suite' ? <Home size={20} /> :
                      <MapIcon size={24} />
                    }
                    title={t}
                    selected={data.type === t}
                    onClick={() => setData(d => ({ ...d, type: t }))}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-4 mt-2">
                <h3 className="text-sm font-semibold text-slate-700">Ubicación (MVP)</h3>
                <div className="flex gap-2">
                  {CITIES.map(city => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => setData(d => ({ ...d, city, lat: undefined, lng: undefined }))}
                      className={`flex-1 py-3 rounded-full text-sm font-medium transition-all border ${
                        data.city === city
                          ? 'bg-[#1a56db] text-white border-[#1a56db] shadow-md'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {city}
                    </button>
                  ))}
                </div>

                {!data.lat && (
                  <p className="text-xs text-slate-400 italic px-2 mt-1">
                    💡 Usa el botón "Ubicar" en el mapa para una precisión real del sector.
                  </p>
                )}

                <div className="relative mt-1">
                  <MapPin size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Ej. Cumbayá, La Carolina, Ficoa..."
                    value={data.sector}
                    onChange={(e) => setData(d => ({ ...d, sector: e.target.value }))}
                    className="w-full bg-slate-50 border border-transparent focus:border-[#1a56db] focus:bg-white rounded-full py-4 pl-12 pr-28 text-sm outline-none transition-all placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowInlineMap(s => !s)}
                    className={`absolute right-2 top-1/2 transform -translate-y-1/2 shadow-sm border px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 text-[10px] font-bold ${
                      data.lat && !showInlineMap
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'
                        : (showInlineMap ? 'bg-slate-900 text-white hover:bg-slate-800 border-slate-800' : 'bg-white border-slate-100 text-[#1a56db] hover:bg-slate-50')
                    }`}
                  >
                    {data.lat && !showInlineMap ? <Check size={12} strokeWidth={2.5} /> : <MapIcon size={12} strokeWidth={2.5} />}
                    {data.lat && !showInlineMap ? 'Ubicado' : (showInlineMap ? 'Cerrar Mapa' : 'Ubicar')}
                  </button>
                </div>

                {mapError && !data.lat && (
                  <p className="text-red-500 text-sm font-medium px-2 mt-1 flex items-center gap-2">
                    <AlertCircle size={14} />
                    Falta información: Es obligatorio ubicar la propiedad en el mapa.
                  </p>
                )}

                {showInlineMap && (
                  <div className="mt-2 h-[320px] w-full rounded-[1.5rem] overflow-hidden border border-slate-200 shadow-sm relative animate-in slide-in-from-top-2 fade-in duration-300">
                    <LeafletMapComponent
                      initialLocation={mapInitialLocation}
                      onLocationChange={(loc) => {
                        setData(d => ({ ...d, lat: loc.lat, lng: loc.lng }));
                        setMapError(false);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight mb-2">Detalles del inmueble</h1>
                <p className="text-slate-500 text-sm">Mientras más información ingreses, mejor el avalúo.</p>
              </div>

              {/* Área y básicos */}
              <div className="bg-slate-50 p-6 rounded-[1.5rem] flex flex-col gap-6">
                <div>
                  <div className="flex justify-between items-end mb-4">
                    <label className="text-sm font-semibold text-slate-700">Área construida</label>
                    <span className="text-2xl font-bold text-[#1a56db]">
                      {data.area} <span className="text-sm font-normal text-slate-400">m²</span>
                    </span>
                  </div>
                  <input
                    type="range" min="30" max="500" value={data.area}
                    onChange={(e) => setData(d => ({ ...d, area: parseInt(e.target.value, 10) }))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1a56db]"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Counter label="Habitaciones" value={data.rooms} onChange={v => setData(d => ({ ...d, rooms: v }))} />
                  <Counter label="Baños" value={data.baths} onChange={v => setData(d => ({ ...d, baths: v }))} />
                  <Counter label="Parqueos" value={data.parking} onChange={v => setData(d => ({ ...d, parking: v }))} />
                </div>
              </div>

              {/* Año de construcción */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Calendar size={14} className="text-slate-400" />
                  Año de construcción <span className="text-xs font-normal text-slate-400">(opcional)</span>
                </label>
                <div className="relative">
                  <input
                    type="number" placeholder="Ej. 2015" min="1900" max={new Date().getFullYear()}
                    value={data.yearBuilt || ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                      setData(d => ({ ...d, yearBuilt: val }));
                    }}
                    className="w-full bg-slate-50 border border-transparent focus:border-[#1a56db] focus:bg-white rounded-full py-3 px-5 text-sm outline-none transition-all placeholder:text-slate-400"
                  />
                  {data.yearBuilt && (
                    <span className="absolute right-5 top-1/2 transform -translate-y-1/2 text-xs font-medium text-slate-400">
                      {new Date().getFullYear() - data.yearBuilt} años
                    </span>
                  )}
                </div>
              </div>

              {/* Piso MANUAL */}
              {showFloorOption && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
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
                          setData(d => ({ ...d, floor: undefined }));
                        } else {
                          // Si es número, guardar como número; si no, string
                          const num = parseInt(val, 10);
                          setData(d => ({ ...d, floor: isNaN(num) ? val : num }));
                        }
                      }}
                      className="w-full bg-slate-50 border border-transparent focus:border-[#1a56db] focus:bg-white rounded-full py-3 px-5 text-sm outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Building2 size={14} className="text-slate-400" />
                      Pisos del edificio
                    </label>
                    <input
                      type="number" placeholder="Ej. 12" min="1" max="100"
                      value={data.totalFloors || ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                        setData(d => ({ ...d, totalFloors: val }));
                      }}
                      className="w-full bg-slate-50 border border-transparent focus:border-[#1a56db] focus:bg-white rounded-full py-3 px-5 text-sm outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>
              )}

              {/* Vista */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Eye size={14} className="text-slate-400" />
                  Vista
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {VIEW_TYPES.map(v => (
                    <button
                      key={v} type="button"
                      onClick={() => setData(d => ({ ...d, view: v }))}
                      className={`py-3 rounded-full text-xs font-medium transition-all border ${
                        data.view === v
                          ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orientación */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Compass size={14} className="text-slate-400" />
                  Orientación
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {ORIENTATIONS.map(o => (
                    <button
                      key={o} type="button"
                      onClick={() => setData(d => ({ ...d, orientation: o }))}
                      className={`py-2.5 rounded-full text-xs font-medium transition-all border ${
                        data.orientation === o
                          ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipo de parqueo */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Car size={14} className="text-slate-400" />
                  Tipo de parqueo
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PARKING_TYPES.map(p => (
                    <button
                      key={p} type="button"
                      onClick={() => setData(d => ({ ...d, parkingType: p }))}
                      className={`py-3 rounded-full text-xs font-medium transition-all border ${
                        data.parkingType === p
                          ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Estado */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-slate-700">Estado actual</label>
                <div className="grid grid-cols-2 gap-2">
                  {CONDITIONS.map(cond => (
                    <button
                      key={cond} type="button"
                      onClick={() => setData(d => ({ ...d, condition: cond }))}
                      className={`py-3 rounded-full text-xs font-medium transition-all border ${
                        data.condition === cond
                          ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {cond}
                    </button>
                  ))}
                </div>
              </div>

              {/* AMENITIES DEL EDIFICIO */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-slate-700">
                  Amenities del edificio <span className="text-xs font-normal text-slate-400">(suma valor)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <AmenityToggle icon={<ArrowRight size={14} className="rotate-[-90deg]" />} label="Ascensor" active={!!data.hasElevator} onClick={() => setData(d => ({ ...d, hasElevator: !d.hasElevator }))} />
                  <AmenityToggle icon={<Dumbbell size={14} />} label="Gimnasio" active={!!data.hasGym} onClick={() => setData(d => ({ ...d, hasGym: !d.hasGym }))} />
                  <AmenityToggle icon={<Waves size={14} />} label="Piscina" active={!!data.hasPool} onClick={() => setData(d => ({ ...d, hasPool: !d.hasPool }))} />
                  <AmenityToggle icon={<Shield size={14} />} label="Seguridad 24/7" active={!!data.hasSecurity24h} onClick={() => setData(d => ({ ...d, hasSecurity24h: !d.hasSecurity24h }))} />
                  <AmenityToggle icon={<Home size={14} />} label="Áreas comunales" active={!!data.hasCommonAreas} onClick={() => setData(d => ({ ...d, hasCommonAreas: !d.hasCommonAreas }))} />
                  <AmenityToggle icon={<Baby size={14} />} label="Juegos infantiles" active={!!data.hasPlayground} onClick={() => setData(d => ({ ...d, hasPlayground: !d.hasPlayground }))} />
                  <AmenityToggle icon={<Flame size={14} />} label="Zona BBQ" active={!!data.hasBBQArea} onClick={() => setData(d => ({ ...d, hasBBQArea: !d.hasBBQArea }))} />
                  <AmenityToggle icon={<Coffee size={14} />} label="Coworking" active={!!data.hasCoworking} onClick={() => setData(d => ({ ...d, hasCoworking: !d.hasCoworking }))} />
                  <AmenityToggle icon={<User size={14} />} label="Recepción/Conserje" active={!!data.hasReception} onClick={() => setData(d => ({ ...d, hasReception: !d.hasReception }))} />
                  <AmenityToggle icon={<Package size={14} />} label="Bodega" active={!!data.bodega} onClick={() => setData(d => ({ ...d, bodega: !d.bodega }))} />
                </div>
              </div>

              {/* CARACTERÍSTICAS DEL INMUEBLE */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-slate-700">Características del inmueble</label>
                <div className="grid grid-cols-2 gap-2">
                  <AmenityToggle icon={<Sofa size={14} />} label="Amoblado" active={!!data.isFurnished} onClick={() => setData(d => ({ ...d, isFurnished: !d.isFurnished }))} />
                  <AmenityToggle icon={<Trees size={14} />} label="Terraza" active={!!data.hasTerrace} onClick={() => setData(d => ({ ...d, hasTerrace: !d.hasTerrace }))} />
                  <AmenityToggle icon={<Wind size={14} />} label="Balcón" active={!!data.hasBalcon} onClick={() => setData(d => ({ ...d, hasBalcon: !d.hasBalcon }))} />
                  <AmenityToggle icon={<Trees size={14} />} label="Jardín privado" active={!!data.hasGarden} onClick={() => setData(d => ({ ...d, hasGarden: !d.hasGarden }))} />
                  <AmenityToggle icon={<Waves size={14} />} label="Jacuzzi" active={!!data.hasJacuzzi} onClick={() => setData(d => ({ ...d, hasJacuzzi: !d.hasJacuzzi }))} />
                  <AmenityToggle icon={<Flame size={14} />} label="Chimenea" active={!!data.hasFireplace} onClick={() => setData(d => ({ ...d, hasFireplace: !d.hasFireplace }))} />
                  <AmenityToggle icon={<BedDouble size={14} />} label="Walk-in closet" active={!!data.hasWalkInCloset} onClick={() => setData(d => ({ ...d, hasWalkInCloset: !d.hasWalkInCloset }))} />
                  <AmenityToggle icon={<User size={14} />} label="Cuarto servicio" active={!!data.hasMaidRoom} onClick={() => setData(d => ({ ...d, hasMaidRoom: !d.hasMaidRoom }))} />
                  <AmenityToggle icon={<Home size={14} />} label="Cuarto lavado" active={!!data.hasLaundryRoom} onClick={() => setData(d => ({ ...d, hasLaundryRoom: !d.hasLaundryRoom }))} />
                </div>
              </div>

              {/* SERVICIOS */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-slate-700">Servicios</label>
                <div className="grid grid-cols-2 gap-2">
                  <AmenityToggle icon={<Wifi size={14} />} label="Internet incluido" active={!!data.hasInternet} onClick={() => setData(d => ({ ...d, hasInternet: !d.hasInternet }))} />
                  <AmenityToggle icon={<Flame size={14} />} label="Gas centralizado" active={!!data.hasNaturalGas} onClick={() => setData(d => ({ ...d, hasNaturalGas: !d.hasNaturalGas }))} />
                  <AmenityToggle icon={<PawPrint size={14} />} label="Acepta mascotas" active={!!data.petsAllowed} onClick={() => setData(d => ({ ...d, petsAllowed: !d.petsAllowed }))} />
                </div>
              </div>

              <div className="bg-amber-50/80 border border-amber-100/50 p-3.5 rounded-[1rem] flex items-start gap-3">
                <div className="bg-amber-100/50 p-1.5 rounded-full shrink-0 mt-0.5">
                  <Info size={14} className="text-amber-600" />
                </div>
                <p className="text-xs text-amber-700/80 leading-snug">
                  <strong>Mientras más detalles ingreses, mejor el avalúo.</strong> Cada característica afecta el precio: piso alto +10%, vista panorámica +15%, amenities +3-8% c/u.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-500 flex-1">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight mb-2">Una imagen vale más...</h1>
                <p className="text-slate-500 text-sm">Nuestra IA analizará acabados, estado real y vista para mayor precisión.</p>
              </div>

              <label className="border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50 hover:bg-slate-100 transition-colors flex flex-col items-center justify-center p-8 text-center cursor-pointer group">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                  <UploadCloud size={28} className="text-[#1a56db]" />
                </div>
                <h3 className="text-base font-semibold text-slate-800 mb-1">Arrastra tus fotos aquí</h3>
                <p className="text-xs text-slate-400 max-w-[250px]">Sube entre {CONFIG.MIN_PHOTOS} y {CONFIG.MAX_PHOTOS} fotos. Incluye fachada, sala, cocina y baños.</p>
                <div className="mt-6 bg-white border border-slate-200 text-slate-600 px-6 py-2 rounded-full text-sm font-medium shadow-sm group-hover:text-[#1a56db]">
                  Examinar archivos
                </div>
                <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
              </label>

              {photoError && (
                <p className="text-red-500 text-sm font-medium flex items-center gap-2">
                  <AlertCircle size={14} />
                  Falta información: Por favor sube al menos {CONFIG.MIN_PHOTOS} fotos para continuar.
                </p>
              )}

              {/* PREVIEW REAL DE FOTOS */}
              {photoPreviews.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">
                      {photoPreviews.length} {photoPreviews.length === 1 ? 'foto subida' : 'fotos subidas'}
                    </p>
                    <p className="text-xs text-slate-400">Máximo {CONFIG.MAX_PHOTOS}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {photoPreviews.map((photo, idx) => (
                      <div
                        key={`${photo.name}-${idx}`}
                        className="relative aspect-square rounded-2xl overflow-hidden border-2 border-slate-100 group bg-slate-50"
                      >
                        <img
                          src={photo.url}
                          alt={`Foto ${idx + 1}: ${photo.name}`}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                          <span className="text-white text-[10px] font-medium truncate">{photo.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute top-2 right-2 w-7 h-7 bg-white/95 backdrop-blur rounded-full flex items-center justify-center shadow-md hover:bg-red-50 hover:text-red-500 transition-all text-slate-600"
                        >
                          <XIcon size={14} strokeWidth={2.5} />
                        </button>
                        <div className="absolute top-2 left-2 w-6 h-6 bg-[#1a56db] text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-md">
                          {idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight mb-2">Casi listo</h1>
                <p className="text-slate-500 text-sm">Ingresa tus datos para generar tu análisis personalizado.</p>
              </div>

              <div className="flex flex-col gap-4">
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type="text" value={data.name}
                    onChange={(e) => setData(d => ({ ...d, name: e.target.value }))}
                    placeholder="Tu nombre completo" autoComplete="name"
                    className="w-full bg-slate-50 border border-transparent focus:border-[#1a56db] focus:bg-white rounded-full py-4 pl-12 pr-4 text-sm outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                      type="email" value={data.email}
                      onChange={(e) => {
                        setData(d => ({ ...d, email: e.target.value }));
                        if (emailError) setEmailError('');
                      }}
                      placeholder="Correo electrónico (Obligatorio)" autoComplete="email"
                      className={`w-full bg-slate-50 border focus:bg-white rounded-full py-4 pl-12 pr-4 text-sm outline-none transition-all placeholder:text-slate-400 ${
                        emailError ? 'border-red-300 focus:border-red-500' : 'border-transparent focus:border-[#1a56db]'
                      }`}
                    />
                  </div>
                  {emailError && <p className="text-red-500 text-xs mt-1.5 ml-4">{emailError}</p>}
                </div>

                <div>
                  <div className="relative">
                    <Phone size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel" value={data.phone}
                      onChange={(e) => {
                        setData(d => ({ ...d, phone: e.target.value }));
                        if (phoneError) setPhoneError('');
                      }}
                      placeholder="Teléfono / WhatsApp" autoComplete="tel"
                      className={`w-full bg-slate-50 border focus:bg-white rounded-full py-4 pl-12 pr-4 text-sm outline-none transition-all placeholder:text-slate-400 ${
                        phoneError ? 'border-red-300 focus:border-red-500' : 'border-transparent focus:border-[#1a56db]'
                      }`}
                    />
                  </div>
                  {phoneError && <p className="text-red-500 text-xs mt-1.5 ml-4">{phoneError}</p>}
                </div>
              </div>

              <div className="bg-slate-50 p-5 rounded-[1.5rem] border border-slate-100 mt-2">
                <SourceSelector selected={sources} onChange={setSources} />
              </div>

              <label className="bg-[#f0f4fa] p-5 rounded-[1.5rem] border border-[#e2ebfa] flex items-start gap-4 cursor-pointer hover:bg-[#e6eff9] transition-colors group">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <FileDigit size={20} className="text-[#1a56db]" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-[#185fa5] mb-1">Mejora la precisión un 15% (Opcional)</h4>
                  <p className="text-xs text-[#5c85b5] mb-3">Sube tu cédula catastral o pago de predial.</p>
                  {uploadedDocs.length === 0 ? (
                    <div className="inline-block text-xs font-medium bg-white text-[#1a56db] px-4 py-1.5 rounded-full shadow-sm">Adjuntar documento</div>
                  ) : (
                    <div className="inline-block text-xs font-medium bg-[#1a56db] text-white px-4 py-1.5 rounded-full shadow-sm">{uploadedDocs.length} archivo(s) listo(s)</div>
                  )}
                </div>
                <input type="file" accept=".pdf,image/*" multiple onChange={handleDocUpload} className="hidden" />
              </label>
            </div>
          )}

          {step === 5 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in duration-500 py-12">
              <div className="relative w-24 h-24 mb-8">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-[#1a56db] rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles size={28} className="text-[#1a56db] animate-pulse" />
                </div>
              </div>
              <h2 className="text-2xl font-semibold mb-2">Calculando avalúo de {operationLabel}...</h2>
              <p className="text-sm text-slate-400 mb-6">Esto puede tomar hasta 60 segundos</p>
              <div className="flex flex-col gap-4 w-full max-w-xs mx-auto text-left">
                <LoadingItem text={`Analizando ${uploadedPhotos.length} fotos (IA Vision)`} active={loadingStep >= 0} done={loadingStep > 0} />
                <LoadingItem text={`Buscando comparables de ${operationLabel}`} active={loadingStep >= 1} done={loadingStep > 1} />
                <LoadingItem text="Mapeando sector con Google Maps" active={loadingStep >= 1} done={loadingStep > 1} />
                <LoadingItem text="Aplicando ajustes por características" active={loadingStep >= 2} done={loadingStep > 2} />
                <LoadingItem text="Generando reporte final" active={loadingStep >= 3} done={loadingStep > 3} />
              </div>
            </div>
          )}

          {step === 6 && result && (
            <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-emerald-500 bg-emerald-50 px-3 py-1.5 rounded-full text-xs font-bold">
                    <ShieldCheck size={14} /> Confianza {result.confidence >= 80 ? 'Alta' : 'Media'} ({result.confidence}%)
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                    data.operation === 'venta' ? 'text-blue-600 bg-blue-50' : 'text-purple-600 bg-purple-50'
                  }`}>
                    {data.operation === 'venta' ? <DollarSign size={12} /> : <Key size={12} />}
                    Avalúo de {operationLabelCap}
                  </div>
                </div>
                <button type="button" className="text-slate-400 hover:text-slate-600">
                  <UploadCloud size={20} />
                </button>
              </div>

              <div className="text-center mb-8">
                <p className="text-slate-500 text-sm uppercase tracking-widest font-semibold mb-2">
                  {data.operation === 'venta' ? 'Valor Comercial Estimado' : 'Renta Mensual Estimada'}
                </p>
                <div className="flex items-start justify-center gap-1">
                  <span className="text-3xl font-semibold text-slate-400 mt-2">$</span>
                  <h1 className="text-[4rem] font-bold text-slate-800 leading-none tracking-tighter">{fmtNum(result.value)}</h1>
                  {data.operation === 'arriendo' && (
                    <span className="text-lg font-medium text-slate-400 mt-6 ml-1">/mes</span>
                  )}
                </div>
                <p className="text-slate-400 text-sm mt-3">Rango sugerido: {fmtUSD(result.rangeLow)} - {fmtUSD(result.rangeHigh)}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-slate-50 p-4 rounded-[1.5rem] flex flex-col items-center text-center">
                  <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Precio por m²</p>
                  <p className="text-xl font-semibold text-slate-800">{fmtUSD(result.pricePerM2)}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-[1.5rem] flex flex-col items-center text-center">
                  <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">
                    {data.operation === 'venta' ? 'Tiempo de venta' : 'Tiempo en alquilar'}
                  </p>
                  <p className="text-xl font-semibold text-slate-800">~{result.daysOnMarket} días</p>
                </div>
              </div>

              <div className="bg-[#1a56db] text-white p-6 rounded-[2rem] shadow-xl shadow-blue-500/20 relative overflow-hidden mb-10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
                <h3 className="text-xl font-semibold mb-2 relative z-10">
                  {data.operation === 'venta' ? '¿Listo para vender?' : '¿Listo para arrendar?'}
                </h3>
                <p className="text-blue-200 text-sm mb-6 relative z-10 max-w-[250px]">
                  Publica ahora en nuestro Marketplace. Solo pagas comisión si {data.operation === 'venta' ? 'vendes' : 'arriendas'} con nosotros.
                </p>
                <div className="flex gap-3 relative z-10">
                  <button type="button" className="flex-1 bg-white text-[#1a56db] py-3 rounded-full text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors">
                    Publicar Propiedad
                  </button>
                </div>
              </div>

              <div className="w-full border-t border-slate-100 pt-10 pb-4">
                <div className="flex flex-col items-center gap-2 justify-center mb-8 text-slate-400">
                  <FileText size={24} className="text-slate-300" />
                  <span className="text-xs uppercase tracking-widest font-semibold text-slate-400">Reporte Detallado</span>
                </div>
                <ReporteInline data={data} result={result} reportId={reportId} />
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="mt-8 mb-4 text-xs font-medium text-slate-400 text-center w-full hover:text-slate-600 transition-colors"
              >
                Hacer otro avalúo
              </button>
            </div>
          )}

          {step === 7 && errorMessage && (
            <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in duration-500 py-12 px-6">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                <AlertCircle size={36} className="text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-3">{errorMessage}</h2>
              <p className="text-slate-500 text-sm max-w-md mb-6 leading-relaxed">
                No pudimos calcular tu avalúo en este momento. Esto puede deberse a que los servicios de IA están temporalmente saturados.
              </p>
              {errorDetails && (
                <details className="mb-6 max-w-md w-full">
                  <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 mb-2 select-none">
                    Ver detalles técnicos
                  </summary>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left mt-2">
                    <code className="text-xs text-slate-600 font-mono break-all whitespace-pre-wrap">
                      {errorDetails}
                    </code>
                  </div>
                </details>
              )}
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button type="button" onClick={handleRetry} className="bg-[#1a56db] text-white py-3 rounded-full text-sm font-semibold shadow-lg shadow-blue-500/30 hover:bg-[#1546b5] transition-all">
                  Reintentar
                </button>
                <button type="button" onClick={handleReset} className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors py-2">
                  Empezar de nuevo
                </button>
              </div>
            </div>
          )}

        </main>

        {step < 5 && (
          <footer className="p-6 border-t border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md">
            <button
              type="button" onClick={prevStep}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                step === 1 ? 'opacity-0 cursor-default pointer-events-none' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
              disabled={step === 1}
            >
              <ArrowLeft size={20} />
            </button>
            <button
              type="button" onClick={nextStep}
              className="bg-[#1a56db] text-white px-8 py-3.5 rounded-full text-sm font-semibold shadow-lg shadow-blue-500/30 flex items-center gap-2 hover:bg-[#1546b5] transition-all transform hover:-translate-y-0.5"
            >
              {step === 4 ? `Calcular Avalúo de ${operationLabelCap}` : 'Continuar'} <ArrowRight size={16} />
            </button>
          </footer>
        )}

      </div>
    </div>
  );
}