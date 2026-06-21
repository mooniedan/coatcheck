// Stroke-style icon set — ported from the Claude Design kit (shared/coatcheck.jsx).
// All icons ride currentColor and a 24×24 viewBox. Use for clothing items + UI chrome
// (the design calls for stroke icons, not emoji).
import type { CSSProperties, ReactNode } from 'react';

export const ICONS: Record<string, ReactNode> = {
  // UI
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  arrowBack: (
    <>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </>
  ),
  close: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  crosshair: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9A1.7 1.7 0 0 0 10 3.1V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.5.8.9 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  share: (
    <>
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <path d="m16 6-4-4-4 4" />
      <path d="M12 2v14" />
    </>
  ),
  check: <path d="m5 12 5 5L20 7" />,
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M11 12h1v4h1" />
    </>
  ),
  // navigation
  navToday: (
    <>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  navTrip: (
    <>
      <path d="M5 21h14" />
      <rect x="4" y="7" width="16" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </>
  ),
  navSettings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),
  // weather
  cloudRain: (
    <>
      <path d="M4 14.5A4 4 0 0 1 7 8a6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 18 16H7a3 3 0 0 1-3-1.5Z" />
      <path d="m9 19-1 2M13 19l-1 2M17 19l-1 2" />
    </>
  ),
  cloud: <path d="M4 14.5A4 4 0 0 1 7 8a6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 18 16H7a3 3 0 0 1-3-1.5Z" />,
  snowflake: (
    <>
      <path d="M12 2v20M4.2 6 19.8 18M19.8 6 4.2 18" />
      <path d="M8 4l4 2 4-2M8 20l4-2 4 2M4 8l2 4-2 4M20 8l-2 4 2 4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </>
  ),
  wind: <path d="M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2M17.5 8a2.5 2.5 0 1 1 2 4H2" />,
  droplet: <path d="M12 2.7s-6 7.5-6 11.6a6 6 0 0 0 12 0c0-4.1-6-11.6-6-11.6Z" />,
  // clothing — stroke style
  tShirt: (
    <path d="M5 7l3-3h2a2 2 0 0 0 4 0h2l3 3-2.5 2.5L16 8v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8l-.5 1.5L5 7Z" />
  ),
  longSleeve: (
    <path d="M3 9.5 6.5 4h3a2.5 2.5 0 0 0 5 0h3L21 9.5 19 13l-2-2v9a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-9l-2 2-2-3.5Z" />
  ),
  jacket: (
    <path d="M6 5 9 3v2a3 3 0 0 0 6 0V3l3 2 2.5 4-2 1.5V21a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V10.5L4 9l2-4ZM12 5v17" />
  ),
  shellJacket: (
    <>
      <path d="M6 5 9 3l1 1.5a3 3 0 0 0 4 0L15 3l3 2 2.5 4.5-2.5 1.5V21a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V11L3.5 9.5 6 5ZM12 4.5V22" />
      <path d="M16 14h2" />
    </>
  ),
  downJacket: (
    <>
      <path d="M7 5 9 3v1.5a3 3 0 0 0 6 0V3l2 2 3 4-2.5 2V21a1 1 0 0 1-1 1H7.5a1 1 0 0 1-1-1V11L4 9l3-4Z" />
      <path d="M12 5v17M9 8h6M9 11h6M9 14h6M9 17h6" />
    </>
  ),
  baseLayer: (
    <>
      <path d="M6 7l3-3h6l3 3-2 2.5L15 8v13a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V8l-1 1.5L6 7Z" />
      <path d="M9 13h6" />
    </>
  ),
  pants: <path d="M6 4h12l-1 8-1 10h-3.5L12 14l-.5 8H8L7 12 6 4Z" />,
  jeans: (
    <>
      <path d="M6 4h12l-.5 7-1.5 11h-3.5L12 14l-.5 8H8L7 11 6 4Z" />
      <path d="M6 7h12" />
    </>
  ),
  shorts: <path d="M5 4h14l-1 6-.5 6h-3L13.5 13 12 16l-1.5-3-1 3h-3l-.5-6L5 4Z" />,
  shoes: (
    <path d="M3 16v2a1 1 0 0 0 1 1h16a2 2 0 0 0 0-4l-5-1c-1.5-.3-2-1-2.5-2L11 9 7 11l-1 4-3 1Z" />
  ),
  boots: (
    <>
      <path d="M7 3h5v11l4 1.5c1.5.5 2 1.4 2 2.5v2a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3Z" />
      <path d="M7 11h5" />
    </>
  ),
  snowBoots: (
    <>
      <path d="M7 3h5v10l4 1.5c1.5.5 2 1.5 2 2.5v2a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3Z" />
      <path d="M7 9h5M9 14l1 1M11 14l1 1M13 14l1 1" />
    </>
  ),
  umbrella: (
    <>
      <path d="M3 11a9 9 0 0 1 18 0H3Z" />
      <path d="M12 11v8a2 2 0 0 1-4 0" />
    </>
  ),
  hat: <path d="M5 18s2-1.5 7-1.5S19 18 19 18l-1-9a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2l-1 9Z" />,
  beanie: (
    <>
      <path d="M4 16c0-4.5 3.5-8 8-8s8 3.5 8 8H4Z" />
      <path d="M4 16v2h16v-2M8 8c0-1.5.5-3 2-3M12 8c0-1.5.5-3 2-3" />
    </>
  ),
  gloves: (
    <path d="M6 21V11a1 1 0 0 1 2 0v3M8 14V8a1 1 0 0 1 2 0v6M10 14V7a1 1 0 0 1 2 0v7M12 14V8a1 1 0 0 1 2 0v6c0 4-2 7-4 7Z" />
  ),
  scarf: (
    <>
      <path d="M7 4l5 5v8l-3 5-2-1 1.5-4-3-3 1.5-10Z" />
      <path d="M17 4l-5 5" />
    </>
  ),
  socks: (
    <path d="M9 3h5v9c0 1 .5 1.5 1.5 2l2.5 1.5c1.5 1 2 2.5 1 4l-1 1.5a2 2 0 0 1-3 0L8 14.5C7.5 14 7 13 7 12V3h2Z" />
  ),
  sunglasses: (
    <>
      <rect x="3" y="9" width="8" height="6" rx="2" />
      <rect x="13" y="9" width="8" height="6" rx="2" />
      <path d="M11 11h2" />
      <path d="M3 9l-1-2M21 9l1-2" />
    </>
  ),
  passport: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="1.5" />
      <circle cx="12" cy="11" r="3" />
      <path d="M9 17h6" />
    </>
  ),
  plug: <path d="M9 7V3M15 7V3M7 11h10v3a5 5 0 0 1-10 0v-3ZM12 19v3" />,
  swap: <path d="M7 7h12l-3-3M17 17H5l3 3" />,
};

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 24,
  color,
  strokeWidth = 1.6,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}) {
  const path = ICONS[name];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden
    >
      {path}
    </svg>
  );
}
