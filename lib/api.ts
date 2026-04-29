import { CONFIG } from './config';
import { PropertyData, AvaluoResult, Comparable, Base64File, ScrapedItem, ScrapeSource, Operation } from '../types';

export const fmtUSD = (n: number | undefined): string => {
  if (n === undefined || n === null || isNaN(n)) return '$0';
  return '$' + Math.round(n).toLocaleString('en-US');
};

export const fmtNum = (n: number | undefined): string => {
  if (n === undefined || n === null || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('en-US');
};

const genId = (prefix = 'id'): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

export const isValidEmail = (email: string): boolean => CONFIG.EMAIL_REGEX.test(email.trim());
export const isValidPhone = (phone: string): boolean => !phone.trim() || CONFIG.PHONE_REGEX.test(phone.trim());

export const plural = (n: number, singular: string, pluralWord: string): string =>
  n === 1 ? `${n} ${singular}` : `${n} ${pluralWord}`;

export class AvaluoError extends Error {
  constructor(message: string, public details?: string) {
    super(message);
    this.name = 'AvaluoError';
  }
}

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

export const DEFAULT_SOURCES: ScrapeSource[] = ['facebook'];

export const SOURCE_META: Record<ScrapeSource, { label: string; description: string; needsLogin: boolean }> = {
  facebook: { label: 'Facebook Marketplace', description: 'Listings de Marketplace', needsLogin: true },
  plusvalia: { label: 'Plusvalia', description: 'Portal #1 inmobiliario de Ecuador', needsLogin: false },
  properati: { label: 'Properati', description: 'Portal LATAM (de OLX)', needsLogin: false },
};

export const SCRAPE_LIMITS = {
  FB_MAX_ITEMS: 30,
  PLUSVALIA_MAX_ITEMS: 15,
  PROPERATI_MAX_ITEMS: 15,
  GMAPS_MAX_PLACES: 20,
  TIMEOUT_MS: 25000,
  GMAPS_TIMEOUT_MS: 18000,
  GEMINI_TIMEOUT_MS: 60000,
};

export const APIFY_PRICING = { PER_ITEM: 0.005, GEMINI_FLAT: 0.002 };

export function estimateCostPerAvaluo(sources: ScrapeSource[] = DEFAULT_SOURCES) {
  let total = APIFY_PRICING.GEMINI_FLAT;
  total += SCRAPE_LIMITS.GMAPS_MAX_PLACES * APIFY_PRICING.PER_ITEM;
  if (sources.includes('facebook')) total += SCRAPE_LIMITS.FB_MAX_ITEMS * APIFY_PRICING.PER_ITEM;
  if (sources.includes('plusvalia')) total += SCRAPE_LIMITS.PLUSVALIA_MAX_ITEMS * APIFY_PRICING.PER_ITEM;
  if (sources.includes('properati')) total += SCRAPE_LIMITS.PROPERATI_MAX_ITEMS * APIFY_PRICING.PER_ITEM;
  return total;
}

export interface AvaluoLog {
  timestamp: number;
  city: string; sector: string; type: string;
  operation: Operation;
  sources: ScrapeSource[];
  fbItems: number; plusvaliaItems: number; properatiItems: number;
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

export async function fetchWithTimeout(url: string, options: RequestInit, signal: AbortSignal, timeoutMs = 20000) {
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), timeoutMs)
  );
  const response = await Promise.race([fetch(url, { ...options, signal }), timeoutPromise]);
  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'no body');
    console.error(`HTTP ${response.status}. Body:`, errorBody.slice(0, 300));
    throw new Error(`HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
  }
  return response;
}

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
        resolve(canvas.toDataURL('image/webp', 0.8).split(',')[1]);
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
};

function detectOperation(item: ScrapedItem): Operation | null {
  const text = `${item.titulo || ''} ${item.ubicacion || ''}`.toLowerCase();
  const ARRIENDO_KEYWORDS = [
    'arriendo', 'arrienda', 'arrendar', 'arriend',
    'rent ', 'renta ', 'renta.', 'rento', 'rentar',
    'alquiler', 'alquilar', 'alquila',
    'al mes', '/mes', 'mensual', 'mensuales', 'por mes',
    'se renta', 'en renta', 'se arrienda',
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
  const before = items.length;
  const filtered = items.filter(item => {
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
  console.log(`🎯 Filtro ${target}: ${filtered.length}/${before} items`);
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

function calculateConfidence(comparablesFound: number, scrapedCount: number, hasPhotos: boolean, extraFeatures: number): number {
  let score = 30;
  score += Math.min(35, comparablesFound * 4);
  score += Math.min(15, scrapedCount * 0.7);
  if (hasPhotos) score += 10;
  score += Math.min(15, extraFeatures * 1);
  return Math.min(95, Math.max(35, Math.round(score)));
}


// =====================================================================
// MAPEO DE CIUDADES - Facebook Marketplace usa códigos específicos
// =====================================================================
const FB_CITY_SLUGS: Record<string, { slug: string; lat: number; lng: number; radius: number; keywords: string[] }> = {
  'quito': {
    slug: 'quito',
    lat: -0.1807, lng: -78.4678, radius: 25,
    keywords: ['quito', 'cumbaya', 'cumbayá', 'tumbaco', 'pomasqui', 'calderon', 'calderón', 'conocoto', 'valle de los chillos', 'pichincha', 'la carolina', 'la mariscal', 'cumbayá'],
  },
  'ambato': {
    slug: 'ambatoecuador',  // FB usa "ambatoecuador" no "ambato"
    lat: -1.2491, lng: -78.6168, radius: 15,
    keywords: ['ambato', 'huachi', 'ficoa', 'tungurahua', 'cevallos', 'pelileo', 'baños', 'banos', 'ingahurco', 'atocha', 'el recreo', 'celiano monge'],
  },
};

// Lista de OTRAS ciudades que NO queremos en los resultados
const OTHER_CITIES_KEYWORDS = ['guayaquil', 'cuenca', 'manta', 'machala', 'loja', 'ibarra', 'riobamba', 'esmeraldas', 'portoviejo', 'duran', 'durán', 'samborondón', 'samborondon', 'salinas', 'milagro'];

function filterByCityKeywords(items: ScrapedItem[], cityKey: string): ScrapedItem[] {
  const cityConfig = FB_CITY_SLUGS[cityKey];
  if (!cityConfig) return items;
  
  const before = items.length;
  const filtered = items.filter(item => {
    const text = `${item.titulo || ''} ${item.ubicacion || ''}`.toLowerCase();
    
    // Si menciona la ciudad correcta o algún sector conocido → OK
    if (cityConfig.keywords.some(kw => text.includes(kw))) return true;
    
    // Si menciona OTRA ciudad grande → DESCARTAR
    const wrongCity = OTHER_CITIES_KEYWORDS.some(oc => {
      // Solo descartamos si NO está la ciudad correcta también mencionada
      const isOtherCity = text.includes(oc);
      const isOurCity = cityConfig.keywords.some(kw => text.includes(kw));
      return isOtherCity && !isOurCity;
    });
    if (wrongCity) {
      console.log(`   🚫 Descartado por ciudad: "${item.ubicacion?.slice(0, 50)}"`);
      return false;
    }
    
    // Si no menciona ninguna ciudad concreta → dejamos pasar (asumimos correcta)
    return true;
  });
  
  console.log(`   🏙️ Filtro ciudad ${cityKey}: ${filtered.length}/${before}`);
  return filtered;
}

async function scrapeFacebook(data: PropertyData, signal: AbortSignal): Promise<ScrapedItem[]> {
  const apifyToken = process.env.NEXT_PUBLIC_APIFY_TOKEN || ''; 
  if (!apifyToken) return [];

  // Mapeo correcto de ciudad
  const cityKey = data.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cityConfig = FB_CITY_SLUGS[cityKey] || FB_CITY_SLUGS['quito'];
  
  // Usar coords del usuario si las marcó en el mapa, sino las de la ciudad
  const lat = data.lat || cityConfig.lat;
  const lng = data.lng || cityConfig.lng;
  
  const formattedSector = data.sector.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
  const operation = data.operation || 'venta';
  const opKw = operation === 'venta' ? 'venta' : 'arriendo';
  
  // URL con coordenadas + radio (Facebook respeta esto)
  const fbTargetUrl = `https://www.facebook.com/marketplace/${cityConfig.slug}/search/?query=${opKw}%20${formattedSector}%20${data.type}&latitude=${lat}&longitude=${lng}&radius=${cityConfig.radius}`;
  
  console.log(`🔵 FB scraping (${operation}) en ${data.city} [slug: ${cityConfig.slug}]`);
  
  const actorId = 'curious_coder~facebook-marketplace';
  
  const input = {
    "urls": [fbTargetUrl],
    "count": SCRAPE_LIMITS.FB_MAX_ITEMS,
    "proxyConfiguration": { "useApifyProxy": true }
  };
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyToken}&maxItems=${SCRAPE_LIMITS.FB_MAX_ITEMS}`;
  console.log(`🔵 FB scraping (${operation})...`);

  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }, signal, SCRAPE_LIMITS.TIMEOUT_MS);
    const result = await res.json();
    console.log('🔵 FB items:', Array.isArray(result) ? result.length : 'no es array');
    if (!Array.isArray(result)) return [];
    const items = result.slice(0, SCRAPE_LIMITS.FB_MAX_ITEMS).map((item: any) => ({
      titulo: item.title || item.marketplace_listing_title || `${data.type} en ${data.sector}`,
      precio: item.price?.amount || item.listing_price?.formatted_amount || item.price || "",
      ubicacion: item.location || item.location_text || `${data.sector}, ${data.city}`,
      url: item.url || item.listingUrl || item.facebookUrl || fbTargetUrl,
      fuente: 'Facebook'
    }));
    
    // Filtro adicional por keywords de ciudad
    return filterByCityKeywords(items, cityKey);
  } catch (e: any) {
    console.error("❌ FB FAILED:", e?.message || e);
    return [];
  }
}

async function scrapePlusvalia(data: PropertyData, signal: AbortSignal): Promise<ScrapedItem[]> {
  const apifyToken = process.env.NEXT_PUBLIC_APIFY_TOKEN || ''; 
  if (!apifyToken) return [];

  const formattedSector = data.sector.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
  const formattedCity = data.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const typeMap: Record<string, string> = {
    'Departamento': 'departamentos', 'Casa': 'casas', 'Suite': 'suites', 'Terreno': 'terrenos'
  };
  const typeSlug = typeMap[data.type] || 'departamentos';
  const operation = data.operation || 'venta';
  const opSlug = operation === 'venta' ? 'venta' : 'alquiler';
  const targetUrl = `https://www.plusvalia.com/${typeSlug}-en-${opSlug}-en-${formattedSector}-${formattedCity}.html`;
  
  const pageFunctionStr = `async function pageFunction(context) {
    const { $ } = context;
    const items = [];
    $('[data-qa="POSTING_CARD"], .posting-card, article.list-card-container').each(function(i, el) {
      if (i >= ${SCRAPE_LIMITS.PLUSVALIA_MAX_ITEMS}) return false;
      const $el = $(el);
      const titulo = $el.find('[data-qa="POSTING_CARD_LOCATION"], .posting-title, h3').first().text().trim();
      const precio = $el.find('[data-qa="POSTING_CARD_PRICE"], .first-price, .price-tag').first().text().trim();
      const ubicacion = $el.find('[data-qa="POSTING_CARD_LOCATION"], .posting-location').first().text().trim();
      const link = $el.find('a[href*="/propiedades/"], a').first().attr('href');
      const fullUrl = link ? (link.startsWith('http') ? link : 'https://www.plusvalia.com' + link) : '';
      if (titulo || precio) {
        items.push({ titulo: titulo || ubicacion, precio, ubicacion, url: fullUrl, fuente: 'Plusvalia' });
      }
    });
    return items;
  }`;
  
  const input = {
    "startUrls": [{ "url": targetUrl }],
    "maxRequestsPerCrawl": 1,
    "proxyConfiguration": { "useApifyProxy": true },
    "pageFunction": pageFunctionStr
  };

  const url = `https://api.apify.com/v2/acts/apify~cheerio-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
  console.log(`🟢 Plusvalia (${operation})...`);

  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }, signal, SCRAPE_LIMITS.TIMEOUT_MS);
    const result = await res.json();
    console.log('🟢 Plusvalia items:', Array.isArray(result) ? result.length : 'no es array');
    if (!Array.isArray(result)) return [];
    return result.slice(0, SCRAPE_LIMITS.PLUSVALIA_MAX_ITEMS).filter((i: any) => i.url);
  } catch (e: any) {
    console.error("❌ Plusvalia FAILED:", e?.message || e);
    return [];
  }
}

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
    $('article.listing-card, [class*="listing-card"], [class*="ListingCard"]').each(function(i, el) {
      if (i >= ${SCRAPE_LIMITS.PROPERATI_MAX_ITEMS}) return false;
      const $el = $(el);
      const titulo = $el.find('h2, h3, [class*="title"], [class*="Title"]').first().text().trim();
      const precio = $el.find('[class*="price"], [class*="Price"]').first().text().trim();
      const ubicacion = $el.find('[class*="location"], [class*="Location"], address').first().text().trim();
      const link = $el.find('a').first().attr('href');
      const fullUrl = link ? (link.startsWith('http') ? link : 'https://www.properati.com.ec' + link) : '';
      if ((titulo || ubicacion) && fullUrl) {
        items.push({ titulo: titulo || ubicacion, precio, ubicacion, url: fullUrl, fuente: 'Properati' });
      }
    });
    return items;
  }`;
  
  const input = {
    "startUrls": [{ "url": targetUrl }],
    "maxRequestsPerCrawl": 1,
    "proxyConfiguration": { "useApifyProxy": true },
    "pageFunction": pageFunctionStr
  };

  const url = `https://api.apify.com/v2/acts/apify~cheerio-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
  console.log(`🟡 Properati (${operation})...`);

  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }, signal, SCRAPE_LIMITS.TIMEOUT_MS);
    const result = await res.json();
    console.log('🟡 Properati items:', Array.isArray(result) ? result.length : 'no es array');
    if (!Array.isArray(result)) return [];
    return result.slice(0, SCRAPE_LIMITS.PROPERATI_MAX_ITEMS).filter((i: any) => i.url);
  } catch (e: any) {
    console.error("❌ Properati FAILED:", e?.message || e);
    return [];
  }
}

export async function scrapeWithApify(data: PropertyData, signal: AbortSignal): Promise<ScrapedItem[]> {
  const sources = data.sources && data.sources.length > 0 ? data.sources : DEFAULT_SOURCES;
  const operation = data.operation || 'venta';
  console.log(`🔍 Scraping ${operation.toUpperCase()}. Fuentes: ${sources.join(', ')}`);
  
  const promises: Promise<ScrapedItem[]>[] = [];
  const sourceOrder: ScrapeSource[] = [];
  
  if (sources.includes('facebook')) { promises.push(scrapeFacebook(data, signal)); sourceOrder.push('facebook'); }
  if (sources.includes('plusvalia')) { promises.push(scrapePlusvalia(data, signal)); sourceOrder.push('plusvalia'); }
  if (sources.includes('properati')) { promises.push(scrapeProperati(data, signal)); sourceOrder.push('properati'); }
  
  const results = await Promise.allSettled(promises);
  const byS: Record<string, ScrapedItem[]> = { facebook: [], plusvalia: [], properati: [] };
  results.forEach((res, idx) => {
    const source = sourceOrder[idx];
    if (res.status === 'fulfilled') byS[source] = res.value;
  });
  console.log(`✅ FB=${byS.facebook.length}, Plusvalia=${byS.plusvalia.length}, Properati=${byS.properati.length}`);
  
  const merged: ScrapedItem[] = [];
  const max = Math.max(byS.facebook.length, byS.plusvalia.length, byS.properati.length);
  for (let i = 0; i < max; i++) {
    if (byS.plusvalia[i]) merged.push(byS.plusvalia[i]);
    if (byS.properati[i]) merged.push(byS.properati[i]);
    if (byS.facebook[i]) merged.push(byS.facebook[i]);
  }
  
  const seen = new Set<string>();
  const unique = merged.filter(item => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
  
  const cityKey = data.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cityFiltered = filterByCityKeywords(unique, cityKey);
  const filtered = filterByOperation(cityFiltered, operation);
  return filterOutliers(filtered);
}

export async function scrapeGoogleMaps(data: PropertyData, signal: AbortSignal): Promise<any[]> {
  const apifyToken = process.env.NEXT_PUBLIC_APIFY_TOKEN || ''; 
  if (!apifyToken) return [];
  const input = {
    "timeoutSecs": 15, "language": "es",
    "locationQuery": `${data.sector}, ${data.city}, Ecuador`,
    "maxCrawledPlacesPerSearch": SCRAPE_LIMITS.GMAPS_MAX_PLACES,
    "scrapeContacts": false, "scrapePlaceDetailPage": false, "scrapeReviewsPersonalData": false,
    "scrapeSocialMediaProfiles": { "facebooks": false, "instagrams": false, "tiktoks": false, "twitters": false, "youtubes": false },
    "searchStringsArray": ["restaurant"], "skipClosedPlaces": true,
  };
  const url = `https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/run-sync-get-dataset-items?token=${apifyToken}&maxItems=${SCRAPE_LIMITS.GMAPS_MAX_PLACES}`;
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }, signal, SCRAPE_LIMITS.GMAPS_TIMEOUT_MS);
    const result = await res.json();
    return Array.isArray(result) ? result.slice(0, SCRAPE_LIMITS.GMAPS_MAX_PLACES) : [];
  } catch (e) { return []; }
}

// =====================================================================
// BUILD FEATURES DESCRIPTION - usa TODAS las nuevas características
// =====================================================================
function buildFeaturesDescription(data: PropertyData): string {
  const features: string[] = [];
  
  // Técnicas
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
  
  // Amenities edificio
  if (data.hasElevator) features.push('Ascensor');
  if (data.hasGym) features.push('Gimnasio');
  if (data.hasPool) features.push('Piscina');
  if (data.hasSecurity24h) features.push('Seguridad 24/7');
  if (data.hasCommonAreas) features.push('Áreas comunales');
  if (data.hasPlayground) features.push('Juegos infantiles');
  if (data.hasBBQArea) features.push('Zona BBQ/parrillas');
  if (data.hasCoworking) features.push('Sala coworking');
  if (data.hasReception) features.push('Recepción/conserje');
  
  // Inmueble
  if (data.isFurnished) features.push('Amoblado');
  if (data.hasTerrace) features.push('Terraza');
  if (data.hasBalcon) features.push('Balcón');
  if (data.hasGarden) features.push('Jardín privado');
  if (data.hasJacuzzi) features.push('Jacuzzi');
  if (data.hasFireplace) features.push('Chimenea');
  if (data.hasWalkInCloset) features.push('Walk-in closet');
  if (data.hasMaidRoom) features.push('Cuarto de servicio');
  if (data.hasLaundryRoom) features.push('Cuarto de lavado independiente');
  
  // Servicios
  if (data.hasInternet) features.push('Internet incluido');
  if (data.hasNaturalGas) features.push('Gas centralizado');
  if (data.petsAllowed) features.push('Acepta mascotas');
  
  return features.length > 0 ? '- ' + features.join('\n- ') : 'Sin características adicionales especificadas';
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
  const sourcesLabel = sources.map(s => SOURCE_META[s].label).join(', ');
  const featuresDesc = buildFeaturesDescription(data);

  const systemPrompt = `Eres el perito maestro (AVM) de la proptech 'Un Buen Lugar' en Ecuador.
TIPO DE OPERACIÓN: ${operation.toUpperCase()} (${operation === 'venta' ? 'precio total de venta' : 'precio mensual de arriendo'})

ANALIZA EN DETALLE:
1) FOTOS: Observa MUY bien acabados (mármol/porcelanato/madera/cerámica básica), estado real, calidad de muebles si aplica, iluminación natural, vista desde ventanas, presencia de moho/humedad, calidad de cocina/baños, antigüedad visible.
2) Comparables del scraping (${sourcesLabel}, SOLO de ${operation}).
3) Puntos de Interés (Maps).
4) TODAS las características del inmueble listadas más abajo.

REGLAS DE AJUSTE DE PRECIO:
- AÑO CONSTRUCCIÓN: cada 10 años de antigüedad reduce ~5-8% (excepto patrimoniales).
- PISO: alto (4+) suma 5-15% por mejor vista/menos ruido. Penthouse o último piso +10-25%.
- VISTA panorámica/montaña/mar: +8-25%. Vista al valle: +10%.
- ORIENTACIÓN norte (más sol en hemisferio sur): +3-5%.
- ASCENSOR en deptos +piso 3: imprescindible (sin ascensor en piso alto = -10%).
- AMENITIES (gym, piscina, seguridad 24/7, BBQ, coworking): cada uno +3-8% al m².
- PARQUEO subterráneo: +3-5% vs descubierto.
- BODEGA adicional: +2-4%.
- AMOBLADO: en arriendo +15-30%; en venta +3-7%.
- JARDÍN privado en casa: +5-10%.
- JACUZZI/CHIMENEA: +2-5% c/u.
- WALK-IN CLOSET, cuarto servicio, lavado separado: +1-3% c/u.
- ESTADO "Excelente"/"A remodelar" puede variar ±20%.
- GAS centralizado: +2-3%.
- ACEPTA MASCOTAS (arriendo): +5%.

REGLAS DEL JSON:
- EXACTAMENTE 10 comparables.
- Cada comparable DEBE tener "url" con el link EXACTO del scraping. NUNCA inventes URLs.
- Cada "address" debe ser el "titulo" + "[fuente]" del scraping.
- TODOS los precios son de ${operation}. NO mezcles venta y arriendo.
- "trend": array de 12 enteros (precio/m² últimos 12 meses).
- "value" debe REFLEJAR los ajustes acumulativos de TODAS las características.`;

  const userQuery = `PROPIEDAD A VALUAR (${operation.toUpperCase()}):
- Tipo: ${data.type}
- Ciudad: ${data.city}, sector ${data.sector || 'Centro'}
- Coords: ${data.lat}, ${data.lng}
- Área: ${data.area} m²
- ${data.rooms} habitaciones, ${data.baths} baños, ${data.parking} parqueos
- Estado: ${data.condition}

CARACTERÍSTICAS COMPLETAS DEL INMUEBLE:
${featuresDesc}

DATA SCRAPING (TODOS son listings de ${operation}, ya filtrados):
${JSON.stringify(scrapedContext.slice(0, 20), null, 2).slice(0, 7000)}

PUNTOS DE INTERÉS:
${JSON.stringify(mapsContext.slice(0, 8), null, 2).slice(0, 1200)}

INSTRUCCIONES FINALES:
1. Analiza FOTOS para validar el estado real declarado.
2. Calcula precio base usando comparables del sector.
3. APLICA AJUSTES ACUMULATIVOS por TODAS las características marcadas.
4. El "value" final debe reflejar TODOS estos ajustes.
5. Cada comparable debe usar link REAL del scraping.`;

  const imageParts = filesContext.map(file => ({
    inlineData: { mimeType: file.mimeType, data: file.data }
  }));

  const payload = {
    contents: [{ role: 'user', parts: [{ text: userQuery }, ...imageParts] }],
    systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.4,
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
                id: { type: "STRING" }, address: { type: "STRING" }, area: { type: "INTEGER" },
                rooms: { type: "INTEGER" }, baths: { type: "INTEGER" }, price: { type: "INTEGER" },
                pricePerM2: { type: "INTEGER" }, distance: { type: "INTEGER" }, url: { type: "STRING" },
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
    console.log(`🤖 Probando Vertex: ${modelName} (timeout 60s)`);
    try {
      const result = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
        body: JSON.stringify(payload)
      }, signal, SCRAPE_LIMITS.GEMINI_TIMEOUT_MS);
      const responseData = await result.json();
      console.log(`✅ Vertex ${modelName} funcionó! (${Date.now() - startTime}ms)`);
      const parsed: AvaluoResult = JSON.parse(responseData.candidates[0].content.parts[0].text);
      
      if (!parsed.trend || parsed.trend.length === 0) {
        const pricePerM2Base = CONFIG.PRICE_PER_M2[data.city] ?? 1300;
        parsed.trend = Array.from({ length: 12 }, (_, i) => 
          Math.round(pricePerM2Base * (1 + (i / 11) * 0.094))
        );
      }
      
      parsed.comparables = parsed.comparables.map((c, i) => {
        const realItem = scrapedContext[i];
        if (realItem && (!c.url || !c.url.startsWith('http'))) {
          const fuenteTag = realItem.fuente ? ` [${realItem.fuente}]` : '';
          return { ...c, url: realItem.url, address: (realItem.titulo || c.address) + fuenteTag };
        }
        return c;
      });
      
      const extraFeatures = countExtraFeatures(data);
      parsed.confidence = calculateConfidence(parsed.comparables.length, scrapedContext.length, filesContext.length > 0, extraFeatures);
      
      logAvaluo({
        timestamp: Date.now(), city: data.city, sector: data.sector, type: data.type,
        operation, sources,
        fbItems: scrapedContext.filter(i => i.fuente === 'Facebook').length,
        plusvaliaItems: scrapedContext.filter(i => i.fuente === 'Plusvalia').length,
        properatiItems: scrapedContext.filter(i => i.fuente === 'Properati').length,
        mapsPlaces: mapsContext.length,
        estimatedCost: estimateCostPerAvaluo(sources),
        durationMs: Date.now() - startTime,
        success: true, modelUsed: `vertex/${modelName}`,
      });
      return parsed;
    } catch (error: any) {
      if (signal.aborted) throw error;
      const errMsg = error?.message?.slice(0, 150) || 'Unknown error';
      console.warn(`⚠️ Vertex ${modelName} falló: ${errMsg}`);
      errors.push(`${modelName}: ${errMsg}`);
    }
  }
  
  const errorSummary = errors.join(' | ');
  console.error('❌ TODOS los modelos fallaron:', errorSummary);
  logAvaluo({
    timestamp: Date.now(), city: data.city, sector: data.sector, type: data.type,
    operation, sources,
    fbItems: scrapedContext.filter(i => i.fuente === 'Facebook').length,
    plusvaliaItems: scrapedContext.filter(i => i.fuente === 'Plusvalia').length,
    properatiItems: scrapedContext.filter(i => i.fuente === 'Properati').length,
    mapsPlaces: mapsContext.length,
    estimatedCost: estimateCostPerAvaluo(sources),
    durationMs: Date.now() - startTime,
    success: false, errorMessage: errorSummary,
  });
  throw new AvaluoError('No se pudo calcular el avalúo', `Todos los modelos de IA fallaron. Detalles: ${errorSummary}`);
}

// =====================================================================
// generateMockResult - usado por reporte-inline.tsx para fallback del chart
// NO se usa como fallback de error (eso lanza AvaluoError)
// =====================================================================
export const generateMockResult = (data: PropertyData): AvaluoResult => {
  const pricePerM2Base = CONFIG.PRICE_PER_M2[data.city] ?? 1300;
  const baseValue = data.area * pricePerM2Base;
  
  const trend: number[] = [];
  for (let i = 0; i < 12; i++) {
    const growth = (i / 11) * 0.094;
    const noise = (Math.random() - 0.5) * 0.01;
    trend.push(Math.round(pricePerM2Base * (1 + growth + noise)));
  }

  return {
    value: baseValue,
    rangeLow: baseValue * 0.95,
    rangeHigh: baseValue * 1.05,
    confidence: 70,
    pricePerM2: pricePerM2Base,
    daysOnMarket: 110,
    comparables: [],
    trend,
  };
};