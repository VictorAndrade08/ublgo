import { CONFIG } from './config';
import { PropertyData, AvaluoResult, Comparable, Base64File, ScrapedItem, ScrapeSource, Operation } from '../types';

// =====================================================================
// UTILIDADES
// =====================================================================
export const fmtUSD = (n: number | undefined): string => {
  if (n === undefined || n === null || isNaN(n)) return '$0';
  return '$' + Math.round(n).toLocaleString('en-US');
};

export const fmtNum = (n: number | undefined): string => {
  if (n === undefined || n === null || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('en-US');
};

export const plural = (n: number, singular: string, pluralWord: string): string =>
  n === 1 ? `${n} ${singular}` : `${n} ${pluralWord}`;

const genId = (prefix = 'id'): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

export const isValidEmail = (email: string): boolean => CONFIG.EMAIL_REGEX.test(email.trim());
export const isValidPhone = (phone: string): boolean => !phone.trim() || CONFIG.PHONE_REGEX.test(phone.trim());

export class AvaluoError extends Error {
  constructor(message: string, public details?: string) {
    super(message);
    this.name = 'AvaluoError';
  }
}

// =====================================================================
// CONFIGURACIÓN
// =====================================================================
export const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
];

export const TEXT_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'];
export const IMAGE_MODELS = ['gemini-2.5-flash'];

const GEMINI_FALLBACK_ORDER = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

const VERTEX_PROJECT = process.env.NEXT_PUBLIC_VERTEX_PROJECT || '';
const VERTEX_LOCATION = process.env.NEXT_PUBLIC_VERTEX_LOCATION || 'us-central1';

export const DEFAULT_SOURCES: ScrapeSource[] = ['plusvalia'];

export const SOURCE_META: Record<ScrapeSource, { label: string; description: string; needsLogin: boolean }> = {
  facebook: { label: 'Facebook Marketplace', description: 'Listings de Marketplace local', needsLogin: true },
  plusvalia: { label: 'Plusvalía', description: 'Portal #1 inmobiliario de Ecuador', needsLogin: false },
  properati: { label: 'Properati', description: 'Portal LATAM (de OLX)', needsLogin: false },
  remax: { label: 'RE/MAX Ecuador', description: 'Inmobiliaria con agentes verificados', needsLogin: false },
};

export const SCRAPE_LIMITS = {
  FB_MAX_ITEMS: 25,
  PLUSVALIA_MAX_ITEMS: 20,
  PROPERATI_MAX_ITEMS: 15,
  REMAX_MAX_ITEMS: 15,
  GMAPS_MAX_PLACES: 15,
  TIMEOUT_MS: 50000,
  GMAPS_TIMEOUT_MS: 25000,
  GEMINI_TIMEOUT_MS: 90000,
};

export const APIFY_PRICING = { PER_ITEM: 0.005, GEMINI_FLAT: 0.002 };

export function estimateCostPerAvaluo(sources: ScrapeSource[] = DEFAULT_SOURCES) {
  let total = APIFY_PRICING.GEMINI_FLAT;
  total += SCRAPE_LIMITS.GMAPS_MAX_PLACES * APIFY_PRICING.PER_ITEM;
  if (sources.includes('facebook')) total += SCRAPE_LIMITS.FB_MAX_ITEMS * APIFY_PRICING.PER_ITEM;
  if (sources.includes('plusvalia')) total += SCRAPE_LIMITS.PLUSVALIA_MAX_ITEMS * APIFY_PRICING.PER_ITEM;
  if (sources.includes('properati')) total += SCRAPE_LIMITS.PROPERATI_MAX_ITEMS * APIFY_PRICING.PER_ITEM;
  if (sources.includes('remax')) total += SCRAPE_LIMITS.REMAX_MAX_ITEMS * APIFY_PRICING.PER_ITEM;
  return total;
}

// =====================================================================
// LOGGING
// =====================================================================
export interface AvaluoLog {
  timestamp: number;
  city: string; sector: string; type: string;
  operation: Operation;
  sources: ScrapeSource[];
  fbItems: number; plusvaliaItems: number; properatiItems: number; remaxItems: number;
  mapsPlaces: number;
  estimatedCost: number; durationMs: number;
  success: boolean; modelUsed?: string; errorMessage?: string;
}

export function logAvaluo(entry: AvaluoLog): void {
  if (typeof window === 'undefined') return;
  try {
    const logs: AvaluoLog[] = JSON.parse(localStorage.getItem('avaluo_logs') || '[]');
    logs.push(entry);
    localStorage.setItem('avaluo_logs', JSON.stringify(logs.slice(-100)));
  } catch (e) { console.warn('No se pudo guardar log:', e); }
}

export function getAvaluoLogs(): AvaluoLog[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('avaluo_logs') || '[]'); }
  catch { return []; }
}

// =====================================================================
// FETCH CON TIMEOUT
// =====================================================================
export async function fetchWithTimeout(url: string, options: RequestInit, signal: AbortSignal, timeoutMs = 30000) {
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), timeoutMs)
  );
  const response = await Promise.race([fetch(url, { ...options, signal }), timeoutPromise]);
  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'no body');
    throw new Error(`HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
  }
  return response;
}

// =====================================================================
// CONVERSION DE FOTOS A BASE64
// =====================================================================
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX = 1200;
        let width = img.width, height = img.height;
        if (width > height) {
          if (width > MAX) { height *= MAX / width; width = MAX; }
        } else {
          if (height > MAX) { width *= MAX / height; height = MAX; }
        }
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        const result = canvas.toDataURL('image/webp', 0.85);
        const base64 = result.split(',')[1];
        console.log(`📸 Foto convertida: ${(base64.length / 1024).toFixed(0)}KB, ${width}x${height}`);
        resolve(base64);
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
};

// =====================================================================
// FILTROS Y DETECCIÓN
// =====================================================================
function detectOperation(item: ScrapedItem): Operation | null {
  const text = `${item.titulo || ''} ${item.ubicacion || ''}`.toLowerCase();
  const ARRIENDO_KEYWORDS = [
    'arriendo', 'arrienda', 'arrendar', 'alquiler', 'alquilar', 'alquila',
    'al mes', '/mes', 'mensual', 'mensuales', 'por mes', 'se renta', 'en renta',
  ];
  const VENTA_KEYWORDS = ['venta', 'vendo', 'vende', 'vender', 'en venta', 'se vende'];
  const isArriendo = ARRIENDO_KEYWORDS.some(kw => text.includes(kw));
  const isVenta = VENTA_KEYWORDS.some(kw => text.includes(kw));
  if (isArriendo && !isVenta) return 'arriendo';
  if (isVenta && !isArriendo) return 'venta';
  const priceNum = parseInt((item.precio || '').replace(/[^\d]/g, ''), 10);
  if (!isNaN(priceNum) && priceNum > 0 && priceNum < 3000) return 'arriendo';
  if (!isNaN(priceNum) && priceNum >= 30000) return 'venta';
  return null;
}

function filterByOperation(items: ScrapedItem[], target: Operation): ScrapedItem[] {
  return items.filter(item => {
    const detected = detectOperation(item);
    if (detected === target) return true;
    if (!detected && target === 'venta') {
      const priceNum = parseInt((item.precio || '').replace(/[^\d]/g, ''), 10);
      return !isNaN(priceNum) && priceNum >= 15000;
    }
    if (!detected && target === 'arriendo') {
      const priceNum = parseInt((item.precio || '').replace(/[^\d]/g, ''), 10);
      return !isNaN(priceNum) && priceNum > 0 && priceNum < 5000;
    }
    return false;
  });
}

// Filtro estricto: items que SÍ son de Ecuador y la ciudad correcta
function filterByEcuadorAndCity(items: ScrapedItem[], data: PropertyData): ScrapedItem[] {
  const cityLower = data.city.toLowerCase();
  
  // Sectores conocidos por ciudad para validación
  const ECUADOR_CITIES: Record<string, string[]> = {
    'quito': ['quito', 'cumbaya', 'cumbayá', 'tumbaco', 'pomasqui', 'calderon', 'calderón', 'conocoto', 'la carolina', 'mariscal', 'gonzález suárez', 'la floresta', 'pichincha'],
    'ambato': ['ambato', 'huachi', 'ficoa', 'atocha', 'ingahurco', 'tungurahua', 'cevallos', 'pelileo', 'baños', 'banos', 'pinllo', 'izamba', 'celiano monge', 'miraflores'],
  };
  
  // Otras ciudades de Ecuador (también válidas pero no perfectas)
  const OTHER_ECUADOR = ['guayaquil', 'cuenca', 'manta', 'machala', 'loja', 'ibarra', 'riobamba', 'esmeraldas', 'portoviejo', 'durán', 'duran'];
  
  // EEUU/otros países (RECHAZAR)
  const FOREIGN = [
    'french camp', 'california', 'ca,', ', ca ', 'fl,', ', fl ', 'tx,', ', tx ', 'ny,', ', ny ',
    'usa', 'united states', 'estados unidos', 'colombia', 'bogotá', 'bogota', 'medellín', 'medellin',
    'lima', 'perú', 'peru', 'venezuela', 'caracas', 'argentina', 'buenos aires', 'chile', 'santiago',
    'méxico', 'mexico city', 'panamá', 'panama'
  ];
  
  const cityKeywords = ECUADOR_CITIES[cityLower] || [];
  const before = items.length;
  
  const filtered = items.filter(item => {
    const text = `${item.titulo || ''} ${item.ubicacion || ''}`.toLowerCase();
    
    // RECHAZAR si menciona país/ciudad extranjera
    if (FOREIGN.some(f => text.includes(f))) {
      return false;
    }
    
    // ACEPTAR si menciona la ciudad correcta
    if (cityKeywords.some(kw => text.includes(kw))) return true;
    
    // ACEPTAR si menciona Ecuador genéricamente
    if (text.includes('ecuador')) return true;
    
    // ACEPTAR si menciona otra ciudad de Ecuador (no ideal pero válido)
    if (OTHER_ECUADOR.some(c => text.includes(c))) {
      console.log(`   ⚠️ Item de otra ciudad Ecuador: "${item.ubicacion?.slice(0, 40)}"`);
      return false; // mejor descartar para tener data limpia
    }
    
    // Si no menciona nada concreto, asumimos válido (algunas fuentes no incluyen ubicación clara)
    return true;
  });
  
  console.log(`   🇪🇨 Filtro Ecuador+Ciudad: ${filtered.length}/${before}`);
  return filtered;
}

function filterOutliers(items: ScrapedItem[]): ScrapedItem[] {
  const withPrice = items.map(item => {
    const numStr = (item.precio || '').replace(/[^\d]/g, '');
    const price = parseInt(numStr, 10);
    return { ...item, _price: isNaN(price) ? 0 : price };
  });
  const valid = withPrice.filter(i => i._price > 5000 && i._price < 5000000);
  if (valid.length < 4) return withPrice;
  const sorted = [...valid].sort((a, b) => a._price - b._price);
  const median = sorted[Math.floor(sorted.length / 2)]._price;
  const mean = valid.reduce((s, i) => s + i._price, 0) / valid.length;
  const variance = valid.reduce((s, i) => s + Math.pow(i._price - mean, 2), 0) / valid.length;
  const stdDev = Math.sqrt(variance);
  return withPrice.filter(i => i._price === 0 || Math.abs(i._price - median) <= 2 * stdDev);
}

function calculateConfidence(comparablesFound: number, scrapedCount: number, hasPhotos: boolean, photosCount: number, extraFeatures: number): number {
  let score = 30;
  score += Math.min(35, comparablesFound * 4);
  score += Math.min(15, scrapedCount * 0.7);
  if (hasPhotos) score += Math.min(15, photosCount * 2);
  score += Math.min(10, extraFeatures * 0.7);
  return Math.min(95, Math.max(40, Math.round(score)));
}

// =====================================================================
// SCRAPER 1: PLUSVALIA (más confiable para Ecuador)
// =====================================================================
async function scrapePlusvalia(data: PropertyData, signal: AbortSignal): Promise<ScrapedItem[]> {
  const apifyToken = process.env.NEXT_PUBLIC_APIFY_TOKEN || ''; 
  if (!apifyToken) {
    console.warn('⚠️ NEXT_PUBLIC_APIFY_TOKEN no configurado');
    return [];
  }

  const formattedSector = data.sector.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
  const formattedCity = data.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  const typeMap: Record<string, string> = {
    'Departamento': 'departamentos', 'Casa': 'casas', 'Suite': 'suites', 'Terreno': 'terrenos'
  };
  const typeSlug = typeMap[data.type] || 'departamentos';
  const operation = data.operation || 'venta';
  const opSlug = operation === 'venta' ? 'venta' : 'alquiler';
  
  // URL Plusvalía Ecuador
  const targetUrl = `https://www.plusvalia.com/${typeSlug}-en-${opSlug}-en-${formattedSector}-${formattedCity}.html`;
  
  // Page function que extrae TODOS los datos relevantes
  const pageFunctionStr = `async function pageFunction(context) {
    const { $ } = context;
    const items = [];
    $('[data-qa="POSTING_CARD"], .posting-card, article.list-card-container, [class*="postingCard"]').each(function(i, el) {
      if (i >= ${SCRAPE_LIMITS.PLUSVALIA_MAX_ITEMS}) return false;
      const $el = $(el);
      const titulo = $el.find('h2, h3, [data-qa="POSTING_CARD_LOCATION"], [class*="title"]').first().text().trim();
      const precio = $el.find('[data-qa="POSTING_CARD_PRICE"], .first-price, .price-tag, [class*="price"]').first().text().trim();
      const ubicacion = $el.find('[data-qa="POSTING_CARD_LOCATION"], .posting-location, [class*="location"]').first().text().trim();
      const features = $el.find('[data-qa="POSTING_CARD_FEATURES"], [class*="feature"]').text().trim();
      const link = $el.find('a[href*="/propiedades/"], a').first().attr('href');
      const fullUrl = link ? (link.startsWith('http') ? link : 'https://www.plusvalia.com' + link) : '';
      if (titulo || precio) {
        items.push({ 
          titulo: (titulo || ubicacion).substring(0, 200), 
          precio: precio.substring(0, 50), 
          ubicacion: ubicacion.substring(0, 100), 
          features: features.substring(0, 200),
          url: fullUrl, 
          fuente: 'Plusvalia' 
        });
      }
    });
    return items;
  }`;
  
  const input = {
    "startUrls": [{ "url": targetUrl }],
    "maxRequestsPerCrawl": 1,
    "proxyConfiguration": { 
      "useApifyProxy": true,
      "apifyProxyCountry": "EC"  // FUERZA proxy desde Ecuador
    },
    "pageFunction": pageFunctionStr
  };

  const url = `https://api.apify.com/v2/acts/apify~cheerio-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
  console.log(`🟢 Plusvalía: ${targetUrl}`);

  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }, signal, SCRAPE_LIMITS.TIMEOUT_MS);
    const result = await res.json();
    console.log(`🟢 Plusvalía items raw: ${Array.isArray(result) ? result.length : 0}`);
    if (!Array.isArray(result)) return [];
    return result.slice(0, SCRAPE_LIMITS.PLUSVALIA_MAX_ITEMS).filter((i: any) => i.url);
  } catch (e: any) {
    console.warn(`⚠️ Plusvalía: ${e?.message?.slice(0, 100) || 'error'}`);
    return [];
  }
}

// =====================================================================
// SCRAPER 2: PROPERATI Ecuador
// =====================================================================
async function scrapeProperati(data: PropertyData, signal: AbortSignal): Promise<ScrapedItem[]> {
  const apifyToken = process.env.NEXT_PUBLIC_APIFY_TOKEN || ''; 
  if (!apifyToken) return [];

  const formattedCity = data.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const typeMap: Record<string, string> = {
    'Departamento': 'departamento', 'Casa': 'casa', 'Suite': 'departamento', 'Terreno': 'terreno'
  };
  const typeSlug = typeMap[data.type] || 'departamento';
  const operation = data.operation || 'venta';
  const opSlug = operation === 'venta' ? 'venta' : 'alquiler';
  const targetUrl = `https://www.properati.com.ec/s/${formattedCity}/${typeSlug}/${opSlug}`;

  const pageFunctionStr = `async function pageFunction(context) {
    const { $ } = context;
    const items = [];
    $('article.listing-card, [class*="listing-card"], [class*="ListingCard"], .property-card').each(function(i, el) {
      if (i >= ${SCRAPE_LIMITS.PROPERATI_MAX_ITEMS}) return false;
      const $el = $(el);
      const titulo = $el.find('h2, h3, [class*="title"], [class*="Title"]').first().text().trim();
      const precio = $el.find('[class*="price"], [class*="Price"]').first().text().trim();
      const ubicacion = $el.find('[class*="location"], [class*="Location"], address').first().text().trim();
      const features = $el.find('[class*="feature"], [class*="property-features"]').text().trim();
      const link = $el.find('a').first().attr('href');
      const fullUrl = link ? (link.startsWith('http') ? link : 'https://www.properati.com.ec' + link) : '';
      if ((titulo || ubicacion) && fullUrl) {
        items.push({ 
          titulo: (titulo || ubicacion).substring(0, 200), 
          precio: precio.substring(0, 50), 
          ubicacion: ubicacion.substring(0, 100),
          features: features.substring(0, 200),
          url: fullUrl, 
          fuente: 'Properati' 
        });
      }
    });
    return items;
  }`;
  
  const input = {
    "startUrls": [{ "url": targetUrl }],
    "maxRequestsPerCrawl": 1,
    "proxyConfiguration": { 
      "useApifyProxy": true,
      "apifyProxyCountry": "EC"
    },
    "pageFunction": pageFunctionStr
  };

  const url = `https://api.apify.com/v2/acts/apify~cheerio-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
  console.log(`🟡 Properati: ${targetUrl}`);

  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }, signal, SCRAPE_LIMITS.TIMEOUT_MS);
    const result = await res.json();
    console.log(`🟡 Properati items raw: ${Array.isArray(result) ? result.length : 0}`);
    if (!Array.isArray(result)) return [];
    return result.slice(0, SCRAPE_LIMITS.PROPERATI_MAX_ITEMS).filter((i: any) => i.url);
  } catch (e: any) {
    console.warn(`⚠️ Properati: ${e?.message?.slice(0, 100) || 'error'}`);
    return [];
  }
}

// =====================================================================
// SCRAPER 3: REMAX Ecuador (con cheerio adaptado)
// =====================================================================
async function scrapeRemax(data: PropertyData, signal: AbortSignal): Promise<ScrapedItem[]> {
  const apifyToken = process.env.NEXT_PUBLIC_APIFY_TOKEN || ''; 
  if (!apifyToken) return [];

  const formattedCity = data.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const operation = data.operation || 'venta';
  const opQuery = operation === 'venta' ? 'venta' : 'arriendo';
  
  const targetUrl = `https://www.remax.com.ec/listings?q=${data.type}+${opQuery}+${formattedCity}`;
  
  const pageFunctionStr = `async function pageFunction(context) {
    const { $ } = context;
    const items = [];
    $('[class*="ListingCard"], [class*="listing-card"], article, .property-listing').each(function(i, el) {
      if (i >= ${SCRAPE_LIMITS.REMAX_MAX_ITEMS}) return false;
      const $el = $(el);
      const titulo = $el.find('h2, h3, [class*="title"], [class*="Title"]').first().text().trim();
      const precio = $el.find('[class*="price"], [class*="Price"], [class*="USD"]').first().text().trim();
      const ubicacion = $el.find('[class*="address"], [class*="location"]').first().text().trim();
      const link = $el.find('a[href*="listing"]').first().attr('href') || $el.find('a').first().attr('href');
      const fullUrl = link ? (link.startsWith('http') ? link : 'https://www.remax.com.ec' + link) : '';
      if ((titulo || ubicacion) && fullUrl) {
        items.push({ 
          titulo: (titulo || ubicacion).substring(0, 200),
          precio: precio.substring(0, 50),
          ubicacion: ubicacion.substring(0, 100),
          url: fullUrl,
          fuente: 'Remax'
        });
      }
    });
    return items;
  }`;
  
  const input = {
    "startUrls": [{ "url": targetUrl }],
    "maxRequestsPerCrawl": 1,
    "proxyConfiguration": { 
      "useApifyProxy": true,
      "apifyProxyCountry": "EC"
    },
    "pageFunction": pageFunctionStr
  };

  const url = `https://api.apify.com/v2/acts/apify~cheerio-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
  console.log(`🔴 Remax: ${targetUrl}`);

  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }, signal, SCRAPE_LIMITS.TIMEOUT_MS);
    const result = await res.json();
    console.log(`🔴 Remax items raw: ${Array.isArray(result) ? result.length : 0}`);
    if (!Array.isArray(result)) return [];
    return result.slice(0, SCRAPE_LIMITS.REMAX_MAX_ITEMS).filter((i: any) => i.url);
  } catch (e: any) {
    console.warn(`⚠️ Remax: ${e?.message?.slice(0, 100) || 'error'}`);
    return [];
  }
}

// =====================================================================
// SCRAPER 4: FACEBOOK MARKETPLACE (último recurso, menos confiable)
// =====================================================================
async function scrapeFacebook(data: PropertyData, signal: AbortSignal): Promise<ScrapedItem[]> {
  const apifyToken = process.env.NEXT_PUBLIC_APIFY_TOKEN || ''; 
  if (!apifyToken) return [];

  const formattedSector = data.sector.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
  const operation = data.operation || 'venta';
  const opKw = operation === 'venta' ? 'venta' : 'arriendo';
  
  // Solo URLs de Ecuador específicas
  const cityUrls: Record<string, string[]> = {
    'quito': ['https://www.facebook.com/marketplace/quito/search/?query=' + encodeURIComponent(`${opKw} ${data.sector} ${data.type}`)],
    'ambato': ['https://www.facebook.com/marketplace/108079079212106/search/?query=' + encodeURIComponent(`${opKw} ${data.sector} ${data.type}`)],
  };
  
  const cityKey = data.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const urls = cityUrls[cityKey] || cityUrls['quito'];
  
  console.log(`🔵 Facebook: ${urls[0]}`);
  
  const input = {
    "urls": urls,
    "count": SCRAPE_LIMITS.FB_MAX_ITEMS,
    "proxyConfiguration": { 
      "useApifyProxy": true,
      "apifyProxyCountry": "EC"
    }
  };

  const url = `https://api.apify.com/v2/acts/curious_coder~facebook-marketplace/run-sync-get-dataset-items?token=${apifyToken}&maxItems=${SCRAPE_LIMITS.FB_MAX_ITEMS}`;

  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }, signal, SCRAPE_LIMITS.TIMEOUT_MS);
    const result = await res.json();
    console.log(`🔵 FB items raw: ${Array.isArray(result) ? result.length : 0}`);
    if (!Array.isArray(result) || result.length === 0) return [];
    
    return result.slice(0, SCRAPE_LIMITS.FB_MAX_ITEMS).map((item: any) => ({
      titulo: item.title || item.marketplace_listing_title || `${data.type} en ${data.sector}`,
      precio: item.price?.amount || item.listing_price?.formatted_amount || item.price || "",
      ubicacion: item.location?.reverseGeocode?.cityPage?.displayName || item.location || item.location_text || `${data.sector}, ${data.city}`,
      url: item.url || item.listingUrl || item.facebookUrl || urls[0],
      fuente: 'Facebook'
    }));
  } catch (e: any) {
    console.warn(`⚠️ Facebook: ${e?.message?.slice(0, 100) || 'error'}`);
    return [];
  }
}

// =====================================================================
// SCRAPING ORCHESTRATOR (runs in parallel)
// =====================================================================
export async function scrapeWithApify(data: PropertyData, signal: AbortSignal): Promise<ScrapedItem[]> {
  let sources = data.sources && data.sources.length > 0 ? data.sources : DEFAULT_SOURCES;
  const operation = data.operation || 'venta';
  
  // ESTRATEGIA: priorizar fuentes confiables para Ecuador
  // Plusvalía SIEMPRE activo (más confiable)
  // Properati y Remax se activan automáticamente
  // Facebook solo si el usuario lo eligió
  const cityLower = data.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const newSources = new Set<ScrapeSource>(sources);
  newSources.add('plusvalia');  // siempre
  newSources.add('properati');  // siempre
  newSources.add('remax');      // siempre
  sources = Array.from(newSources);
  
  console.log(`🔍 SCRAPING ${operation.toUpperCase()} en ${data.city} - ${data.sector}`);
  console.log(`   Fuentes activas: ${sources.join(', ')}`);
  
  const promises: Promise<ScrapedItem[]>[] = [];
  const sourceOrder: ScrapeSource[] = [];
  
  if (sources.includes('plusvalia')) { promises.push(scrapePlusvalia(data, signal)); sourceOrder.push('plusvalia'); }
  if (sources.includes('properati')) { promises.push(scrapeProperati(data, signal)); sourceOrder.push('properati'); }
  if (sources.includes('remax')) { promises.push(scrapeRemax(data, signal)); sourceOrder.push('remax'); }
  if (sources.includes('facebook')) { promises.push(scrapeFacebook(data, signal)); sourceOrder.push('facebook'); }
  
  const results = await Promise.allSettled(promises);
  const byS: Record<string, ScrapedItem[]> = { facebook: [], plusvalia: [], properati: [], remax: [] };
  
  results.forEach((res, idx) => {
    const source = sourceOrder[idx];
    if (res.status === 'fulfilled') byS[source] = res.value;
    else console.warn(`⚠️ ${source} rechazado: ${res.reason?.message?.slice(0, 80)}`);
  });
  
  console.log(`📊 Items raw: Plusvalía=${byS.plusvalia.length}, Properati=${byS.properati.length}, Remax=${byS.remax.length}, FB=${byS.facebook.length}`);
  
  // Merge con prioridad: Plusvalía > Properati > Remax > Facebook
  const merged: ScrapedItem[] = [];
  const max = Math.max(byS.plusvalia.length, byS.properati.length, byS.remax.length, byS.facebook.length);
  for (let i = 0; i < max; i++) {
    if (byS.plusvalia[i]) merged.push(byS.plusvalia[i]);
    if (byS.properati[i]) merged.push(byS.properati[i]);
    if (byS.remax[i]) merged.push(byS.remax[i]);
    if (byS.facebook[i]) merged.push(byS.facebook[i]);
  }
  
  // Dedupe por URL
  const seen = new Set<string>();
  const unique = merged.filter(item => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
  
  console.log(`🔗 Merged unique: ${unique.length}`);
  
  // FILTROS EN CADENA
  const ecuadorFiltered = filterByEcuadorAndCity(unique, data);
  const opFiltered = filterByOperation(ecuadorFiltered, operation);
  console.log(`🎯 Filtro operación ${operation}: ${opFiltered.length}/${ecuadorFiltered.length}`);
  const finalResult = filterOutliers(opFiltered);
  
  console.log(`✅ COMPARABLES VÁLIDOS: ${finalResult.length}`);
  if (finalResult.length === 0) {
    console.warn(`⚠️ ZERO comparables. El avalúo se basará en conocimiento del mercado + características.`);
  }
  
  return finalResult;
}

// =====================================================================
// GOOGLE MAPS PLACES (POI scraping)
// =====================================================================
export async function scrapeGoogleMaps(data: PropertyData, signal: AbortSignal): Promise<any[]> {
  const apifyToken = process.env.NEXT_PUBLIC_APIFY_TOKEN || ''; 
  if (!apifyToken) return [];
  
  const input = {
    "timeoutSecs": 20, 
    "language": "es",
    "locationQuery": `${data.sector}, ${data.city}, Ecuador`,
    "maxCrawledPlacesPerSearch": SCRAPE_LIMITS.GMAPS_MAX_PLACES,
    "scrapeContacts": false, 
    "scrapePlaceDetailPage": false,
    "scrapeReviewsPersonalData": false,
    "scrapeSocialMediaProfiles": { "facebooks": false, "instagrams": false, "tiktoks": false, "twitters": false, "youtubes": false },
    "searchStringsArray": ["restaurant", "supermarket", "school", "hospital"],
    "skipClosedPlaces": true,
  };
  
  const url = `https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/run-sync-get-dataset-items?token=${apifyToken}&maxItems=${SCRAPE_LIMITS.GMAPS_MAX_PLACES}`;
  
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }, signal, SCRAPE_LIMITS.GMAPS_TIMEOUT_MS);
    const result = await res.json();
    console.log(`🗺️ Google Maps POIs: ${Array.isArray(result) ? result.length : 0}`);
    return Array.isArray(result) ? result.slice(0, SCRAPE_LIMITS.GMAPS_MAX_PLACES) : [];
  } catch (e: any) { 
    console.warn(`⚠️ Google Maps: ${e?.message?.slice(0, 80) || 'error'}`);
    return []; 
  }
}

// =====================================================================
// BUILD FEATURES DESCRIPTION para Vertex
// =====================================================================
function buildFeaturesDescription(data: PropertyData): string {
  const features: string[] = [];
  
  if (data.yearBuilt) {
    const age = new Date().getFullYear() - data.yearBuilt;
    features.push(`Año de construcción: ${data.yearBuilt} (antigüedad: ${age} años)`);
  }
  if (data.floor !== undefined && data.floor !== '') {
    const floorStr = typeof data.floor === 'number' ? `Piso ${data.floor}` : data.floor;
    features.push(floorStr);
  }
  if (data.totalFloors) features.push(`Edificio de ${data.totalFloors} pisos en total`);
  if (data.view && data.view !== 'Sin vista') features.push(`Vista: ${data.view}`);
  if (data.orientation && data.orientation !== 'No sé') features.push(`Orientación: ${data.orientation}`);
  if (data.parkingType && data.parkingType !== 'Sin parqueo') features.push(`Parqueo: ${data.parkingType}`);
  if (data.bodega) features.push('Tiene bodega');
  
  if (data.hasElevator) features.push('Ascensor');
  if (data.hasGym) features.push('Gimnasio');
  if (data.hasPool) features.push('Piscina');
  if (data.hasSecurity24h) features.push('Seguridad 24/7');
  if (data.hasCommonAreas) features.push('Áreas comunales');
  if (data.hasPlayground) features.push('Juegos infantiles');
  if (data.hasBBQArea) features.push('Zona BBQ/parrillas');
  if (data.hasCoworking) features.push('Sala coworking');
  if (data.hasReception) features.push('Recepción/conserje');
  
  if (data.isFurnished) features.push('Amoblado');
  if (data.hasTerrace) features.push('Terraza');
  if (data.hasBalcon) features.push('Balcón');
  if (data.hasGarden) features.push('Jardín privado');
  if (data.hasJacuzzi) features.push('Jacuzzi');
  if (data.hasFireplace) features.push('Chimenea');
  if (data.hasWalkInCloset) features.push('Walk-in closet');
  if (data.hasMaidRoom) features.push('Cuarto de servicio');
  if (data.hasLaundryRoom) features.push('Cuarto de lavado independiente');
  
  if (data.hasInternet) features.push('Internet incluido');
  if (data.hasNaturalGas) features.push('Gas centralizado');
  if (data.petsAllowed) features.push('Acepta mascotas');
  
  return features.length > 0 ? features.join(' • ') : 'Características estándar';
}

function countExtraFeatures(data: PropertyData): number {
  const fields = [
    'yearBuilt', 'floor', 'totalFloors', 'view', 'orientation', 'parkingType', 'bodega',
    'hasElevator', 'hasGym', 'hasPool', 'hasSecurity24h', 'hasCommonAreas', 'hasPlayground',
    'hasBBQArea', 'hasCoworking', 'hasReception',
    'isFurnished', 'hasTerrace', 'hasBalcon', 'hasGarden', 'hasJacuzzi', 'hasFireplace',
    'hasWalkInCloset', 'hasMaidRoom', 'hasLaundryRoom',
    'hasInternet', 'hasNaturalGas', 'petsAllowed'
  ];
  let count = 0;
  for (const f of fields) {
    const v = (data as any)[f];
    if (v !== undefined && v !== null && v !== false && v !== '' && v !== 'Sin vista' && v !== 'No sé' && v !== 'Sin parqueo') {
      count++;
    }
  }
  return count;
}

// =====================================================================
// VERTEX AI / GEMINI - Avalúo con metodología profesional
// =====================================================================
export async function calculateWithGemini(
  data: PropertyData,
  scrapedContext: ScrapedItem[],
  mapsContext: any[],
  filesContext: Base64File[],
  signal: AbortSignal
): Promise<AvaluoResult> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
  if (!apiKey) throw new AvaluoError('Configuración faltante', 'NEXT_PUBLIC_GEMINI_API_KEY no está en .env.local');
  if (!VERTEX_PROJECT) throw new AvaluoError('Configuración faltante', 'NEXT_PUBLIC_VERTEX_PROJECT no está en .env.local');

  const sources = data.sources || DEFAULT_SOURCES;
  const operation = data.operation || 'venta';
  const featuresDesc = buildFeaturesDescription(data);
  const age = data.yearBuilt ? new Date().getFullYear() - data.yearBuilt : null;
  
  console.log(`🤖 GEMINI INPUT: ${filesContext.length} fotos + ${scrapedContext.length} comparables + ${mapsContext.length} POIs`);
  if (filesContext.length > 0) {
    console.log(`📸 Fotos enviadas: ${filesContext.map(f => `${f.mimeType} (${(f.data.length/1024).toFixed(0)}KB)`).join(', ')}`);
  }

  // ============================================================
  // SYSTEM PROMPT - Metodología profesional Ambavaal-style
  // ============================================================
  const systemPrompt = `Eres el PERITO INMOBILIARIO MASTER de la proptech "Un Buen Lugar" en Ecuador, certificado por la Superintendencia de Bancos del Ecuador (Registro PA-2003-501). Tu trabajo replica la metodología profesional de PERITAJES Y AVALÚOS CALLEJAS NARANJO AMBAVAL.

🎯 OPERACIÓN: ${operation.toUpperCase()} (${operation === 'venta' ? 'precio total de mercado' : 'renta mensual'})

📚 METODOLOGÍA PROFESIONAL OBLIGATORIA:

1️⃣ **MÉTODO COMPARATIVO HOMOGENIZADO** (Sales Comparison Approach):
   - Toma comparables REALES del DATA SCRAPING
   - Aplica factores de homologación: ubicación, frente, fondo, topografía, tamaño, forma
   - Calcula precio unitario promedio ($/m²) ajustado
   
2️⃣ **MÉTODO DE REPOSICIÓN** (Cost Approach):
   - Costo de construcción nuevo = $${data.city === 'Quito' ? '650-750' : '550-650'}/m² (Ecuador 2026)
   - Aplica DEPRECIACIÓN por edad usando Tabla de Fitto Corvini:
     * 0-5 años: 0% depreciación
     * 5-10 años: 8-12%
     * 10-15 años: 15-20% (caso ${age || '?'} años)
     * 15-25 años: 25-35%
     * 25-40 años: 40-55%
     * 40+ años: 55-70%
   - Vida útil residencial Ecuador: 50 años

3️⃣ **ANÁLISIS VISUAL DE FOTOS** (peso 25% en valoración):
   ${filesContext.length > 0 ? `Tienes ${filesContext.length} fotos REALES del inmueble. ANALIZA:
   - Acabados visibles: mármol/porcelanato/cerámica/básico
   - Estado real de cocina: granito/cuarzo/MDF/deteriorada  
   - Estado de baños y muebles
   - Calidad de pisos: madera fina/laminado/cerámica
   - Iluminación natural y vista desde ventanas
   - Señales de problemas: humedad, moho, grietas
   - Antigüedad visible vs declarada
   - Mantenimiento general` : 'NO HAY FOTOS - usar solo datos declarados.'}

🇪🇨 CONOCIMIENTO MERCADO ECUADOR 2026 (PRECIOS REALES):

**QUITO** (precios venta $/m²):
- Premium (Cumbayá, González Suárez, La Carolina): $1,500-$2,200
- Intermedio (La Floresta, Quito Tenis, Bellavista): $1,200-$1,500
- Estándar (Iñaquito, Mariscal): $900-$1,200
- Popular (Solanda, Quitumbe, Calderón): $700-$950

**AMBATO** (precios venta $/m² - VERIFICADO con Ambavaal):
- Premium (Ficoa, Atocha alto, Club Tungurahua): $1,000-$1,400
  → REFERENCIA REAL: Apto Ficoa 188m² + 162m² terreno = $290,557 (~$520/m² terreno + $560/m² const)
- Intermedio (Ingahurco, Centro, Miraflores): $750-$1,000
- Estándar (Huachi Chico cerca PUCE): $700-$850
  → REFERENCIA REAL: Casa 158m² Huachi Chico Cotolica = $118,000 (~$747/m²)
- Popular (Pelileo, Cevallos, Picaihua): $400-$650

**ARRIENDO**: aproximadamente 0.4-0.7% del valor de venta mensual.

📊 FACTORES DE AJUSTE PROFESIONALES:

**ANTIGÜEDAD** (multiplicador sobre construcción):
- 0-5 años: ×1.10 a ×1.15
- 6-15 años: ×1.00 (base)
- 16-25 años: ×0.85 a ×0.92  
- 26-40 años: ×0.65 a ×0.80
- 40+ años: ×0.50 a ×0.65

**PISO/UBICACIÓN VERTICAL** (deptos):
- Planta baja: ×0.92
- Piso 1-3: ×1.00 (base)
- Piso 4-7: ×1.07
- Piso 8+: ×1.13
- Penthouse: ×1.20-×1.30
- Sin ascensor + piso 4+: -15% adicional

**VISTA**:
- Sin vista (a pared): ×0.97
- Ciudad: ×1.05
- Valle: ×1.12
- Montaña: ×1.15
- Panorámica 360°: ×1.25

**ORIENTACIÓN** (Ecuador hemisferio sur):
- Norte (más sol): ×1.05
- Este (mañana): ×1.03
- Sur: ×1.00
- Oeste (calor tarde): ×0.97

**PARQUEO**:
- Sin: ×0.90
- Descubierto: ×1.00
- Cubierto: ×1.03
- Subterráneo: ×1.06

**AMENITIES** (cada uno suma sobre base):
- Ascensor: +3-5% (obligatorio piso 3+)
- Gimnasio: +4-7%
- Piscina: +5-10%
- Seguridad 24/7: +6-10% ⭐ CRÍTICO en Ecuador
- BBQ/Coworking/Recepción: +2-5% c/u
- Bodega: +3-5%

**INMUEBLE**:
- Amoblado: VENTA +3-7%, ARRIENDO +20-35%
- Terraza/Jardín privado: +5-15%
- Walk-in closet, cuarto servicio: +1-3% c/u
- Jacuzzi/Chimenea: +3-5% c/u
- Gas centralizado: +2-4%
- Acepta mascotas (arriendo): +5-8%

**ESTADO**:
- Excelente: ×1.15
- Bueno: ×1.00 (base)
- Regular: ×0.85
- A remodelar: ×0.65

⚠️ TECHO MÁXIMO DE AJUSTES ACUMULATIVOS: ±40%

📋 REGLAS ESTRICTAS DEL OUTPUT:

✅ Si DATA SCRAPING tiene 3+ comparables: úsalos TAL CUAL (no modifiques títulos/precios/URLs)
✅ Si DATA SCRAPING tiene <3 comparables: devuelve "comparables": [] (vacío)
✅ Cada comparable: "address" = título original + " [" + fuente + "]"
✅ Cada comparable: "url" = URL exacta del scraping (no inventes)
✅ Cada comparable: "price" = parseInt del precio del scraping
❌ PROHIBIDO inventar comparables, direcciones, precios o URLs
❌ NUNCA uses placeholder como "Calle 123" o "Sector Centro"

📊 CÁLCULO FINAL DEL VALUE:

PASO 1: Si HAY comparables reales (≥3):
   - Calcula MEDIANA de precio/m² de comparables
   - Aplica factores de ajuste de la propiedad sujeta
   - Valida: value debe estar entre min-max de comparables ±10%

PASO 2: Si NO hay comparables:
   - Toma precio base del sector según conocimiento de mercado
   - Aplica todos los ajustes acumulativos
   - "comparables": []

PASO 3: Confianza:
   - Base: 50%
   - +5% por cada 3 comparables reales (max +25%)
   - +15% si hay fotos analizadas
   - +10% si hay >5 features extras
   - Max: 95%

PASO 4: Tendencia (12 meses):
   - Crecimiento típico Ecuador: 6-9% anual
   - Genera 12 valores mostrando esa curva con variación realista

PASO 5: Días en mercado:
   - Excelente estado: 30-60 días
   - Bueno: 60-90 días
   - Regular: 90-150 días
   - A remodelar: 150-250 días

PASO 6: Range:
   - rangeLow = value × 0.92
   - rangeHigh = value × 1.08`;

  // ============================================================
  // USER QUERY
  // ============================================================
  const userQuery = `🏠 INMUEBLE A VALUAR (OPERACIÓN: ${operation.toUpperCase()})

📍 UBICACIÓN (CRÍTICO):
• País: ECUADOR 🇪🇨
• Ciudad: ${data.city}
• Sector: ${data.sector || 'No especificado'}
• Coordenadas: ${data.lat}, ${data.lng}

🏗️ DATOS BÁSICOS:
• Tipo: ${data.type}
• Área construida: ${data.area} m²
• Distribución: ${plural(data.rooms, 'habitación', 'habitaciones')}, ${plural(data.baths, 'baño', 'baños')}, ${plural(data.parking, 'parqueo', 'parqueos')}
• Estado declarado: ${data.condition}
${data.yearBuilt ? `• Año construcción: ${data.yearBuilt} (antigüedad: ${age} años)` : ''}

🔑 CARACTERÍSTICAS COMPLETAS:
${featuresDesc}

📸 FOTOS ADJUNTAS: ${filesContext.length} ${filesContext.length === 1 ? 'foto' : 'fotos'}
${filesContext.length > 0 ? '⚠️ Analiza CADA foto en detalle para validar el estado real.' : '⚠️ Sin fotos. Usar solo datos declarados.'}

🏘️ COMPARABLES SCRAPEADOS (${scrapedContext.length} encontrados):
${scrapedContext.length > 0 ? JSON.stringify(scrapedContext.slice(0, 15), null, 2).slice(0, 6000) : '⚠️ NO HAY COMPARABLES. Calcula con conocimiento del mercado + ajustes. Devuelve "comparables": [] (array VACÍO).'}

📍 PUNTOS DE INTERÉS CERCANOS (${mapsContext.length}):
${JSON.stringify(mapsContext.slice(0, 8).map((p: any) => ({ name: p.title || p.name, category: p.categoryName })), null, 2).slice(0, 1000)}

🎯 INSTRUCCIONES FINALES:
1. Aplica metodología comparativo homogenizado SI hay comparables
2. Aplica método de reposición + depreciación Fitto Corvini
3. Analiza TODAS las fotos para validar estado real
4. Aplica TODOS los factores de ajuste de manera acumulativa
5. El "value" final debe ser realista para el mercado ecuatoriano
6. NO inventes datos: si no hay comparables reales → comparables: []
7. La tendencia debe mostrar crecimiento típico Ecuador (6-9% anual)`;

  // ============================================================
  // PAYLOAD CON FOTOS
  // ============================================================
  const imageParts = filesContext.map(file => ({
    inlineData: { mimeType: file.mimeType, data: file.data }
  }));

  const payload = {
    contents: [{ 
      role: 'user', 
      parts: [
        { text: userQuery },
        ...imageParts  // ← Las fotos VAN AQUÍ
      ] 
    }],
    systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
      responseSchema: {
        type: 'OBJECT',
        properties: {
          value: { type: 'INTEGER' },
          rangeLow: { type: 'INTEGER' },
          rangeHigh: { type: 'INTEGER' },
          confidence: { type: 'INTEGER' },
          pricePerM2: { type: 'INTEGER' },
          daysOnMarket: { type: 'INTEGER' },
          trend: { type: 'ARRAY', items: { type: 'INTEGER' } },
          comparables: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                id: { type: "STRING" }, 
                address: { type: "STRING" }, 
                area: { type: "INTEGER" },
                rooms: { type: "INTEGER" }, 
                baths: { type: "INTEGER" }, 
                price: { type: "INTEGER" },
                pricePerM2: { type: "INTEGER" }, 
                distance: { type: "INTEGER" }, 
                url: { type: "STRING" },
              },
              required: ['id', 'address', 'area', 'rooms', 'baths', 'price', 'pricePerM2', 'distance', 'url'],
            },
          },
        },
        required: ['value', 'rangeLow', 'rangeHigh', 'confidence', 'pricePerM2', 'daysOnMarket', 'trend', 'comparables'],
      },
    },
  };

  const startTime = Date.now();
  const errors: string[] = [];
  
  for (const modelName of GEMINI_FALLBACK_ORDER) {
    const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${modelName}:generateContent`;
    console.log(`🤖 Probando ${modelName}...`);
    
    try {
      const result = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
        body: JSON.stringify(payload)
      }, signal, SCRAPE_LIMITS.GEMINI_TIMEOUT_MS);
      
      const responseData = await result.json();
      console.log(`✅ ${modelName} respondió en ${Date.now() - startTime}ms`);
      
      const parsed: AvaluoResult = JSON.parse(responseData.candidates[0].content.parts[0].text);
      
      // Validar trend
      if (!parsed.trend || parsed.trend.length === 0) {
        const pricePerM2Base = CONFIG.PRICE_PER_M2[data.city] ?? 1300;
        parsed.trend = Array.from({ length: 12 }, (_, i) => 
          Math.round(pricePerM2Base * (1 + (i / 11) * 0.07))
        );
      }
      
      // Forzar URLs reales en comparables (anti-alucinación)
      parsed.comparables = parsed.comparables.map((c, i) => {
        const realItem = scrapedContext[i];
        if (realItem) {
          const fuenteTag = realItem.fuente ? ` [${realItem.fuente}]` : '';
          return { 
            ...c, 
            url: realItem.url, 
            address: (realItem.titulo || c.address) + fuenteTag 
          };
        }
        return c;
      });
      
      // Recalcular confianza
      const extraFeatures = countExtraFeatures(data);
      parsed.confidence = calculateConfidence(
        parsed.comparables.length, 
        scrapedContext.length, 
        filesContext.length > 0,
        filesContext.length,
        extraFeatures
      );
      
      logAvaluo({
        timestamp: Date.now(), 
        city: data.city, sector: data.sector, type: data.type,
        operation, sources,
        fbItems: scrapedContext.filter(i => i.fuente === 'Facebook').length,
        plusvaliaItems: scrapedContext.filter(i => i.fuente === 'Plusvalia').length,
        properatiItems: scrapedContext.filter(i => i.fuente === 'Properati').length,
        remaxItems: scrapedContext.filter(i => i.fuente === 'Remax').length,
        mapsPlaces: mapsContext.length,
        estimatedCost: estimateCostPerAvaluo(sources),
        durationMs: Date.now() - startTime,
        success: true, 
        modelUsed: `vertex/${modelName}`,
      });
      
      return parsed;
    } catch (error: any) {
      if (signal.aborted) throw error;
      const errMsg = error?.message?.slice(0, 150) || 'Unknown error';
      console.warn(`⚠️ ${modelName}: ${errMsg}`);
      errors.push(`${modelName}: ${errMsg}`);
    }
  }
  
  const errorSummary = errors.join(' | ');
  console.error('❌ Todos los modelos Gemini fallaron');
  
  logAvaluo({
    timestamp: Date.now(), 
    city: data.city, sector: data.sector, type: data.type,
    operation, sources,
    fbItems: 0, plusvaliaItems: 0, properatiItems: 0, remaxItems: 0,
    mapsPlaces: 0,
    estimatedCost: 0, durationMs: Date.now() - startTime,
    success: false, errorMessage: errorSummary,
  });
  
  throw new AvaluoError(
    'No pudimos generar el avalúo', 
    `Los modelos de IA no respondieron. Detalles: ${errorSummary}`
  );
}

// =====================================================================
// generateMockResult - SOLO usado por reporte-inline.tsx para chart
// =====================================================================
export const generateMockResult = (data: PropertyData): AvaluoResult => {
  const pricePerM2Base = CONFIG.PRICE_PER_M2[data.city] ?? 1300;
  const baseValue = data.area * pricePerM2Base;
  
  const trend: number[] = [];
  for (let i = 0; i < 12; i++) {
    const growth = (i / 11) * 0.07;
    const noise = (Math.random() - 0.5) * 0.01;
    trend.push(Math.round(pricePerM2Base * (1 + growth + noise)));
  }

  return {
    value: baseValue,
    rangeLow: baseValue * 0.92,
    rangeHigh: baseValue * 1.08,
    confidence: 70,
    pricePerM2: pricePerM2Base,
    daysOnMarket: 110,
    comparables: [],
    trend,
  };
};