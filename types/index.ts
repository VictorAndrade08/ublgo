export type PropertyType = 'Departamento' | 'Casa' | 'Suite' | 'Terreno';
export type City = 'Quito' | 'Ambato';
export type Condition = 'Excelente' | 'Bueno' | 'Regular' | 'A remodelar';
export type Operation = 'venta' | 'arriendo';
export type ScrapeSource = 'facebook' | 'plusvalia' | 'properati';

export type ViewType = 'Sin vista' | 'Vista a la ciudad' | 'Vista a montaña' | 'Vista al valle' | 'Vista al mar' | 'Vista panorámica';
export type Orientation = 'Norte' | 'Sur' | 'Este' | 'Oeste' | 'No sé';
export type ParkingType = 'Sin parqueo' | 'Subterráneo' | 'Cubierto' | 'Descubierto';

export interface PropertyData {
  type: PropertyType;
  city: City;
  sector: string;
  area: number;
  rooms: number;
  baths: number;
  parking: number;
  condition: Condition;
  name: string;
  email: string;
  phone: string;
  lat?: number;
  lng?: number;
  sources?: ScrapeSource[];
  operation?: Operation;
  
  // Características técnicas
  yearBuilt?: number;
  floor?: number | string;       // input manual: "5", "12", "Planta baja", "PH"
  totalFloors?: number;          // pisos totales del edificio
  view?: ViewType;
  orientation?: Orientation;
  parkingType?: ParkingType;
  bodega?: boolean;              // tiene bodega
  
  // Amenities edificio
  hasElevator?: boolean;
  hasGym?: boolean;
  hasPool?: boolean;
  hasSecurity24h?: boolean;
  hasCommonAreas?: boolean;
  hasPlayground?: boolean;       // juegos infantiles
  hasBBQArea?: boolean;          // zona BBQ/parrillas
  hasCoworking?: boolean;        // sala coworking
  hasReception?: boolean;        // recepción/conserje
  
  // Inmueble
  isFurnished?: boolean;
  hasTerrace?: boolean;
  hasGarden?: boolean;           // jardín privado
  hasBalcon?: boolean;           // balcón
  hasJacuzzi?: boolean;
  hasFireplace?: boolean;        // chimenea
  hasWalkInCloset?: boolean;     // walk-in closet
  hasMaidRoom?: boolean;         // cuarto de servicio
  hasLaundryRoom?: boolean;      // cuarto de lavado
  
  // Servicios
  hasInternet?: boolean;
  hasNaturalGas?: boolean;       // gas centralizado
  petsAllowed?: boolean;
}

export interface Comparable {
  id: string;
  address: string;
  area: number;
  rooms: number;
  baths: number;
  price: number;
  pricePerM2: number;
  distance: number;
  url: string;
}

export interface AvaluoResult {
  value: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: number;
  pricePerM2: number;
  daysOnMarket: number;
  comparables: Comparable[];
  trend: number[]; 
}

export interface LatLng { lat: number; lng: number; }
export interface Base64File { mimeType: string; data: string; }
export interface ScrapedItem {
  titulo?: string; precio: string; ubicacion: string; url: string; fuente?: string;
}

export interface LeafletMap {
  setView: (latlng: [number, number], zoom: number) => LeafletMap;
  on: (event: string, handler: (e: { latlng: { lat: number; lng: number } }) => void) => void;
  remove: () => void;
}
export interface LeafletMarker {
  setLatLng: (latlng: [number, number]) => LeafletMarker;
  addTo: (map: LeafletMap) => LeafletMarker;
}
export interface LeafletGlobal {
  map: (el: HTMLElement) => LeafletMap;
  tileLayer: (url: string, opts: Record<string, unknown>) => { addTo: (m: LeafletMap) => void };
  marker: (latlng: [number, number]) => LeafletMarker;
  Icon: { 
    Default: { 
      prototype: Record<string, unknown>; 
      mergeOptions: (o: Record<string, string>) => void;
    } 
  };
}