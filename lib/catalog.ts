import type { ClothingItem } from './types';

// Default clothing catalog with generic feels-like bands (°C). This is the GENERIC
// baseline that ships before any cohort data exists; it is also the source of truth
// mirrored into supabase/seed.sql. Bands are intentionally overlapping so layering
// emerges naturally (e.g. a light jacket and a sweater can both apply near 12°C).
export const DEFAULT_CATALOG: ClothingItem[] = [
  // Tops
  { id: 'tank', name: 'Tank top', category: 'Tops', minTempC: 26, maxTempC: 60, icon: '🎽' },
  { id: 'tshirt', name: 'T-shirt', category: 'Tops', minTempC: 18, maxTempC: 30, icon: '👕' },
  { id: 'long_sleeve', name: 'Long-sleeve shirt', category: 'Tops', minTempC: 12, maxTempC: 22, icon: '👔' },
  { id: 'sweater', name: 'Sweater', category: 'Tops', minTempC: 4, maxTempC: 15, icon: '🧶' },
  { id: 'thermal_top', name: 'Thermal base layer', category: 'Tops', minTempC: -40, maxTempC: 6, icon: '🩲' },

  // Bottoms
  { id: 'shorts', name: 'Shorts', category: 'Bottoms', minTempC: 22, maxTempC: 60, icon: '🩳' },
  { id: 'trousers', name: 'Trousers / jeans', category: 'Bottoms', minTempC: 6, maxTempC: 24, icon: '👖' },
  { id: 'thermal_leggings', name: 'Thermal leggings', category: 'Bottoms', minTempC: -40, maxTempC: 8, icon: '🦵' },

  // Outerwear
  { id: 'light_jacket', name: 'Light jacket', category: 'Outerwear', minTempC: 10, maxTempC: 17, icon: '🧥' },
  { id: 'heavy_coat', name: 'Heavy coat', category: 'Outerwear', minTempC: -40, maxTempC: 9, icon: '🧥' },
  { id: 'raincoat', name: 'Raincoat', category: 'Outerwear', minTempC: -40, maxTempC: 22, requiresRain: true, icon: '🌂' },
  { id: 'windbreaker', name: 'Windbreaker', category: 'Outerwear', minTempC: 6, maxTempC: 20, requiresWind: true, icon: '🧥' },

  // Accessories
  { id: 'umbrella', name: 'Umbrella', category: 'Accessories', minTempC: -40, maxTempC: 60, requiresRain: true, icon: '☂️' },
  { id: 'sunglasses', name: 'Sunglasses', category: 'Accessories', minTempC: 18, maxTempC: 60, icon: '🕶️' },
  { id: 'beanie', name: 'Beanie', category: 'Accessories', minTempC: -40, maxTempC: 6, icon: '🧢' },
  { id: 'gloves', name: 'Gloves', category: 'Accessories', minTempC: -40, maxTempC: 4, icon: '🧤' },
  { id: 'scarf', name: 'Scarf', category: 'Accessories', minTempC: -40, maxTempC: 7, icon: '🧣' },
];
