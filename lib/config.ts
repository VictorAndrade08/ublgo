export const CONFIG = {
  PRICE_PER_M2: { Quito: 1450, Ambato: 1200 } as Record<string, number>,
  CITY_CENTERS: {
    Quito: { lat: -0.180653, lng: -78.467834 },
    Ambato: { lat: -1.241667, lng: -78.616667 },
  } as Record<string, { lat: number; lng: number }>,
  MIN_PHOTOS: 1,
  MAX_PHOTOS: 15,
  COMPARABLES_COUNT: 10,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^[\d\s+\-()]{7,20}$/,
};