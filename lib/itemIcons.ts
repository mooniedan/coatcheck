import type { Category } from './types';
import type { IconName } from '@/components/ui/Icon';

// Map a clothing item to a stroke Icon (the design uses stroke icons, not emoji).
// Resolution order: known catalog id → keyword in name → category fallback.

const BY_ID: Record<string, IconName> = {
  tank: 'tShirt',
  tshirt: 'tShirt',
  long_sleeve: 'longSleeve',
  sweater: 'longSleeve',
  thermal_top: 'baseLayer',
  shorts: 'shorts',
  trousers: 'jeans',
  thermal_leggings: 'pants',
  light_jacket: 'jacket',
  heavy_coat: 'downJacket',
  raincoat: 'shellJacket',
  windbreaker: 'jacket',
  umbrella: 'umbrella',
  sunglasses: 'sunglasses',
  beanie: 'beanie',
  gloves: 'gloves',
  scarf: 'scarf',
};

// Keyword → icon, scanned against a lowercased item name when id is unknown.
const BY_KEYWORD: [string, IconName][] = [
  ['tank', 'tShirt'],
  ['t-shirt', 'tShirt'],
  ['tee', 'tShirt'],
  ['long-sleeve', 'longSleeve'],
  ['thermal', 'baseLayer'],
  ['base layer', 'baseLayer'],
  ['sweater', 'longSleeve'],
  ['jumper', 'longSleeve'],
  ['shorts', 'shorts'],
  ['legging', 'pants'],
  ['trouser', 'jeans'],
  ['jean', 'jeans'],
  ['pant', 'pants'],
  ['rain', 'shellJacket'],
  ['shell', 'shellJacket'],
  ['wind', 'jacket'],
  ['down', 'downJacket'],
  ['coat', 'downJacket'],
  ['jacket', 'jacket'],
  ['umbrella', 'umbrella'],
  ['sunglass', 'sunglasses'],
  ['beanie', 'beanie'],
  ['hat', 'hat'],
  ['glove', 'gloves'],
  ['scarf', 'scarf'],
  ['boot', 'boots'],
  ['shoe', 'shoes'],
  ['sock', 'socks'],
];

const BY_CATEGORY: Record<Category, IconName> = {
  Tops: 'tShirt',
  Bottoms: 'pants',
  Outerwear: 'jacket',
  Accessories: 'hat',
};

export function getItemIcon(item: { id?: string; name?: string; category: Category }): IconName {
  if (item.id && BY_ID[item.id]) return BY_ID[item.id];
  const name = (item.name ?? '').toLowerCase();
  for (const [kw, icon] of BY_KEYWORD) {
    if (name.includes(kw)) return icon;
  }
  return BY_CATEGORY[item.category];
}
