// Per-article garment SVG components for the animated figure. Each clothing article (catalog id)
// is its own component so the figure can render the actual recommended outfit and so the admin
// Wardrobe page can review them individually. Drawn in the figure's 130×220 viewBox; flat fills
// in the warm-clay language. Sleeves/legs render into the caller-supplied walk-cycle animation
// (`anim`) so they swing with the body. Umbrella is a positioned overlay (see scene.tsx).

import type { ReactNode } from 'react';
import type { WornOutfit } from '@/lib/scene-model';

export type Anim = { armL: string; armR: string; legL: string; legR: string };
export const STATIC_ANIM: Anim = { armL: 'none', armR: 'none', legL: 'none', legR: 'none' };

const SKIN = '#E2B89A';
const HAIR = '#3D2A1F';
const SHOE = '#1F1A14';

// ── Shared path geometry ───────────────────────────────────────
const TORSO_TEE = 'M40 78 Q35 95 38 130 L92 130 Q95 95 90 78 Q85 70 75 68 L55 68 Q45 70 40 78 Z';
const TORSO_KNIT = 'M38 80 Q33 100 35 132 L95 132 Q97 100 92 80 Q86 72 75 70 L55 70 Q44 72 38 80 Z';
const TORSO_JACKET = 'M34 82 Q28 108 31 138 L99 138 Q102 108 96 82 Q88 72 75 70 L55 70 Q42 72 34 82 Z';
const TORSO_COAT = 'M32 82 Q26 120 30 158 L100 158 Q104 120 98 82 Q90 70 75 68 L55 68 Q40 70 32 82 Z';
// Full torso width (matches the body) with shoulder straps + a deep scoop neck; arms stay bare.
const TORSO_TANK = 'M40 80 Q36 102 38 130 L92 130 Q94 102 90 80 Q88 75 82 77 Q79 91 65 91 Q51 91 48 77 Q42 75 40 80 Z';

const SL_L_FULL = 'M40 78 Q30 95 28 120 L36 122 Q40 100 44 82 Z';
const SL_R_FULL = 'M90 78 Q100 95 102 120 L94 122 Q90 100 86 82 Z';
const SL_L_SHORT = 'M40 80 Q33 90 32 101 L41 102 Q43 91 45 83 Z';
const SL_R_SHORT = 'M90 80 Q97 90 98 101 L89 102 Q87 91 85 83 Z';
const SL_L_WIDE = 'M34 82 Q24 105 22 126 L34 128 Q36 105 40 86 Z';
const SL_R_WIDE = 'M96 82 Q106 105 108 126 L96 128 Q94 105 90 86 Z';

const LEG_L_FULL = 'M55 130 Q53 165 50 198 L62 198 Q60 165 62 130 Z';
const LEG_R_FULL = 'M68 130 Q70 165 68 198 L80 198 Q77 165 75 130 Z';
const LEG_L_SHORT = 'M55 130 Q54 148 53 163 L63 163 Q62 148 62 130 Z';
const LEG_R_SHORT = 'M68 130 Q69 148 68 163 L80 163 Q78 148 75 130 Z';

// ── Building blocks ────────────────────────────────────────────
function ArmGroup({ anim, side, origin, children }: { anim: Anim; side: 'L' | 'R'; origin: string; children: ReactNode }) {
  return <g style={{ animation: side === 'L' ? anim.armL : anim.armR, transformOrigin: origin }}>{children}</g>;
}
function LegGroup({ anim, side, children }: { anim: Anim; side: 'L' | 'R'; children: ReactNode }) {
  return (
    <g style={{ animation: side === 'L' ? anim.legL : anim.legR, transformOrigin: side === 'L' ? '60px 130px' : '70px 130px' }}>
      {children}
    </g>
  );
}

// A top/outerwear garment: a torso body + two animated sleeves + optional detailing.
function Top({
  anim,
  body,
  sleeveL,
  sleeveR,
  color,
  originL = '38px 80px',
  originR = '92px 80px',
  detail,
}: {
  anim: Anim;
  body: string;
  sleeveL: string;
  sleeveR: string;
  color: string;
  originL?: string;
  originR?: string;
  detail?: ReactNode;
}) {
  return (
    <g style={{ transition: 'opacity 0.4s ease' }}>
      <path d={body} fill={color} />
      <ArmGroup anim={anim} side="L" origin={originL}>
        <path d={sleeveL} fill={color} />
      </ArmGroup>
      <ArmGroup anim={anim} side="R" origin={originR}>
        <path d={sleeveR} fill={color} />
      </ArmGroup>
      {detail}
    </g>
  );
}

// ── Tops ───────────────────────────────────────────────────────
const Tank = () => (
  <g>
    {/* sleeveless → no sleeve groups; bare skin arms show through */}
    <path d={TORSO_TANK} fill="#E4D3A8" />
    <path d="M48 78 Q56 90 65 90 Q74 90 82 78" fill="none" stroke="#C9B485" strokeWidth="1.2" opacity="0.7" />
  </g>
);
const Tee = ({ anim }: { anim: Anim }) => (
  <Top anim={anim} body={TORSO_TEE} sleeveL={SL_L_SHORT} sleeveR={SL_R_SHORT} color="#9FB7C9" />
);
const LongSleeve = ({ anim }: { anim: Anim }) => (
  <Top
    anim={anim}
    body={TORSO_TEE}
    sleeveL={SL_L_FULL}
    sleeveR={SL_R_FULL}
    color="#B5A06A"
    detail={<path d="M65 70 L65 128" stroke="#9A8654" strokeWidth="1" opacity="0.6" />}
  />
);
const Sweater = ({ anim }: { anim: Anim }) => (
  <Top
    anim={anim}
    body={TORSO_KNIT}
    sleeveL={SL_L_FULL}
    sleeveR={SL_R_FULL}
    color="#9A6A4A"
    detail={
      <g stroke="#7E5238" strokeWidth="0.8" opacity="0.55">
        <line x1="40" y1="128" x2="92" y2="128" />
        <line x1="55" y1="70" x2="75" y2="70" />
        <line x1="44" y1="100" x2="44" y2="108" />
        <line x1="88" y1="100" x2="88" y2="108" />
      </g>
    }
  />
);
const Thermal = ({ anim }: { anim: Anim }) => (
  <Top anim={anim} body={TORSO_TEE} sleeveL={SL_L_FULL} sleeveR={SL_R_FULL} color="#8A8FA0" />
);

// ── Outerwear ──────────────────────────────────────────────────
const LightJacket = ({ anim }: { anim: Anim }) => (
  <Top
    anim={anim}
    body={TORSO_JACKET}
    sleeveL={SL_L_WIDE}
    sleeveR={SL_R_WIDE}
    color="#7A8C5A"
    originL="34px 80px"
    originR="96px 80px"
    detail={
      <>
        <path d="M65 74 L65 136" stroke="#5E6E44" strokeWidth="1.5" />
        <path d="M52 74 Q65 64 78 74" fill="none" stroke="#5E6E44" strokeWidth="2" opacity="0.5" />
      </>
    }
  />
);
const Windbreaker = ({ anim }: { anim: Anim }) => (
  <Top
    anim={anim}
    body={TORSO_JACKET}
    sleeveL={SL_L_WIDE}
    sleeveR={SL_R_WIDE}
    color="#3C7A6E"
    originL="34px 80px"
    originR="96px 80px"
    detail={
      <g stroke="#2C5A50" strokeWidth="1.2">
        <line x1="65" y1="72" x2="65" y2="136" />
        <circle cx="65" cy="78" r="1.4" fill="#2C5A50" stroke="none" />
      </g>
    }
  />
);
const HeavyCoat = ({ anim }: { anim: Anim }) => (
  <Top
    anim={anim}
    body={TORSO_COAT}
    sleeveL={SL_L_WIDE}
    sleeveR={SL_R_WIDE}
    color="#5C3A28"
    originL="32px 82px"
    originR="98px 82px"
    detail={
      <>
        <path d="M50 72 Q65 60 80 72 L76 84 Q65 76 54 84 Z" fill="#4A2E1F" />
        <path d="M65 84 L65 156" stroke="#3D2519" strokeWidth="1.6" />
        <g fill="#3D2519">
          <circle cx="65" cy="100" r="1.8" />
          <circle cx="65" cy="118" r="1.8" />
          <circle cx="65" cy="136" r="1.8" />
        </g>
      </>
    }
  />
);
const Raincoat = ({ anim }: { anim: Anim }) => (
  <Top
    anim={anim}
    body={TORSO_JACKET}
    sleeveL={SL_L_WIDE}
    sleeveR={SL_R_WIDE}
    color="#C9A23A"
    originL="34px 80px"
    originR="96px 80px"
    detail={
      <>
        {/* hood behind the neck + a sheen highlight */}
        <path d="M48 70 Q65 58 82 70 Q80 80 65 80 Q50 80 48 70 Z" fill="#B38E2C" />
        <path d="M65 76 L65 136" stroke="#A07F22" strokeWidth="1.4" />
        <path d="M40 92 Q42 110 44 132" fill="none" stroke="#E4C46A" strokeWidth="1.5" opacity="0.7" />
      </>
    }
  />
);

// ── Bottoms ────────────────────────────────────────────────────
function Legs({ anim, left, right, color }: { anim: Anim; left: string; right: string; color: string }) {
  return (
    <g style={{ transition: 'opacity 0.4s ease' }}>
      <LegGroup anim={anim} side="L">
        <path d={left} fill={color} />
      </LegGroup>
      <LegGroup anim={anim} side="R">
        <path d={right} fill={color} />
      </LegGroup>
    </g>
  );
}
const Shorts = ({ anim }: { anim: Anim }) => (
  <Legs anim={anim} left={LEG_L_SHORT} right={LEG_R_SHORT} color="#3A4E66" />
);
const Trousers = ({ anim }: { anim: Anim }) => (
  <Legs anim={anim} left={LEG_L_FULL} right={LEG_R_FULL} color="#37404E" />
);
const ThermalLeggings = ({ anim }: { anim: Anim }) => (
  <Legs anim={anim} left={LEG_L_FULL} right={LEG_R_FULL} color="#555A66" />
);

// ── Accessories ────────────────────────────────────────────────
const Beanie = () => (
  <g>
    <path d="M48 44 Q46 28 65 26 Q84 28 82 44 Q82 50 78 52 L52 52 Q48 50 48 44 Z" fill="#3C6E8A" />
    <rect x="49" y="48" width="32" height="5" fill="#2F5A72" />
  </g>
);
const Scarf = () => (
  <g>
    <path d="M48 64 Q42 72 46 80 L60 78 L60 90 L70 90 L70 78 L84 80 Q88 72 82 64 Z" fill="#77584C" />
    <rect x="60" y="78" width="10" height="22" fill="#77584C" />
  </g>
);
const Sunglasses = () => (
  <g>
    <rect x="53" y="47" width="9" height="6" rx="2" fill="#1F1A14" />
    <rect x="68" y="47" width="9" height="6" rx="2" fill="#1F1A14" />
    <line x1="62" y1="50" x2="68" y2="50" stroke="#1F1A14" strokeWidth="1" />
  </g>
);
const Gloves = ({ anim }: { anim: Anim }) => (
  <>
    <ArmGroup anim={anim} side="L" origin="38px 80px">
      <circle cx="32" cy="128" r="6.5" fill="#3D2A1F" />
    </ArmGroup>
    <ArmGroup anim={anim} side="R" origin="92px 80px">
      <circle cx="98" cy="128" r="6.5" fill="#3D2A1F" />
    </ArmGroup>
  </>
);

// ── Registries (catalog id → component) ────────────────────────
const TORSO: Record<string, (p: { anim: Anim }) => ReactNode> = {
  tank: Tank,
  tshirt: Tee,
  long_sleeve: LongSleeve,
  sweater: Sweater,
  thermal_top: Thermal,
  light_jacket: LightJacket,
  windbreaker: Windbreaker,
  heavy_coat: HeavyCoat,
  raincoat: Raincoat,
};
const BOTTOMS: Record<string, (p: { anim: Anim }) => ReactNode> = {
  shorts: Shorts,
  trousers: Trousers,
  thermal_leggings: ThermalLeggings,
};

// ── Body base + full composition ───────────────────────────────
function Shadow() {
  return <ellipse cx="65" cy="216" rx="34" ry="4" fill="#000" opacity="0.15" />;
}
function SkinLegs({ anim }: { anim: Anim }) {
  return (
    <>
      <LegGroup anim={anim} side="L">
        <path d={LEG_L_FULL} fill={SKIN} />
        <ellipse cx="56" cy="206" rx="9" ry="5" fill={SHOE} />
      </LegGroup>
      <LegGroup anim={anim} side="R">
        <path d={LEG_R_FULL} fill={SKIN} />
        <ellipse cx="74" cy="206" rx="9" ry="5" fill={SHOE} />
      </LegGroup>
    </>
  );
}
function SkinTorso({ anim }: { anim: Anim }) {
  return (
    <>
      <path d={TORSO_TEE} fill={SKIN} />
      <ArmGroup anim={anim} side="L" origin="38px 80px">
        <path d={SL_L_FULL} fill={SKIN} />
      </ArmGroup>
      <ArmGroup anim={anim} side="R" origin="92px 80px">
        <path d={SL_R_FULL} fill={SKIN} />
      </ArmGroup>
    </>
  );
}
function Head() {
  return (
    <g>
      <ellipse cx="65" cy="50" rx="16" ry="18" fill={SKIN} />
      <path d="M50 42 Q48 28 65 26 Q82 28 80 42 Q82 50 78 56 Q76 46 65 44 Q54 46 52 56 Q48 50 50 42 Z" fill={HAIR} />
    </g>
  );
}
function Hands({ anim }: { anim: Anim }) {
  return (
    <>
      <ArmGroup anim={anim} side="L" origin="38px 80px">
        <circle cx="32" cy="128" r="5.5" fill={SKIN} />
      </ArmGroup>
      <ArmGroup anim={anim} side="R" origin="92px 80px">
        <circle cx="98" cy="128" r="5.5" fill={SKIN} />
      </ArmGroup>
    </>
  );
}

// Renders the full ordered figure stack (everything inside the 130×220 svg, sans the umbrella
// overlay). Used by the live Figure (animated) and the Wardrobe mini-figure (static).
export function FigureBody({ worn, anim }: { worn: WornOutfit; anim: Anim }) {
  const TorsoGarment = worn.torso ? TORSO[worn.torso] : null;
  const LegGarment = worn.legs ? BOTTOMS[worn.legs] : null;
  return (
    <>
      <Shadow />
      <SkinLegs anim={anim} />
      {LegGarment && <LegGarment anim={anim} />}
      <SkinTorso anim={anim} />
      {TorsoGarment && <TorsoGarment anim={anim} />}
      {worn.neck === 'scarf' && <Scarf />}
      <Head />
      {worn.head === 'beanie' && <Beanie />}
      {worn.face === 'sunglasses' && <Sunglasses />}
      <Hands anim={anim} />
      {worn.hands === 'gloves' && <Gloves anim={anim} />}
    </>
  );
}

// Inline umbrella (held overhead) for the review mini-figure. The live scene uses an animated
// overlay (scene.tsx); this is the static equivalent.
function UmbrellaInline() {
  return (
    <g>
      <path d="M54 14 Q98 -26 142 14 Z" fill="#A33C3C" stroke="#6E2424" strokeWidth="1.6" />
      <path d="M54 14 Q76 6 98 14 Q120 6 142 14" fill="none" stroke="#6E2424" strokeWidth="0.8" opacity="0.4" />
      <path d="M64 14 Q98 -10 132 14" fill="none" stroke="#6E2424" strokeWidth="0.8" opacity="0.5" />
      <line x1="98" y1="-6" x2="98" y2="-14" stroke="#6E2424" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="98" y1="14" x2="98" y2="128" stroke="#3D2A1F" strokeWidth="2.4" strokeLinecap="round" />
    </g>
  );
}

// A static mini-figure wearing a single article — for the admin Wardrobe review page.
export function MiniFigure({ garmentId, width = 92 }: { garmentId: string; width?: number }) {
  const worn = wornForItem(garmentId);
  return (
    <svg viewBox="0 -30 150 256" width={width} style={{ overflow: 'visible' }} aria-hidden>
      <FigureBody worn={worn} anim={STATIC_ANIM} />
      {garmentId === 'umbrella' && <UmbrellaInline />}
    </svg>
  );
}

// Gloves on the body are just two dots at the hands; alone they don't read, so the
// flat-lay view draws a proper pair of mittens instead.
const GlovesFlat = () => (
  <g fill="#3D2A1F">
    <rect x="6" y="10" width="12" height="22" rx="6" />
    <circle cx="5" cy="18" r="3.4" />
    <rect x="24" y="10" width="12" height="22" rx="6" />
    <circle cx="37" cy="18" r="3.4" />
  </g>
);

// Per-slot crop window (viewBox) that tightly frames a garment drawn alone (no body),
// so it can be shown as a flat-lay item scaled to fit a square thumbnail.
const GARMENT_CROP: Record<string, string> = {
  torso: '18 62 94 104',
  legs: '46 126 42 78',
  head: '42 22 46 34',
  neck: '38 60 54 44',
  face: '48 42 34 18',
  hands: '0 4 42 34',
  umbrella: '50 -28 96 70',
};

// Renders a single clothing article ALONE (no figure) — the garment art is body-anchored,
// so we just omit the body and crop to the garment's region, scaled to fit `size`.
export function GarmentOnly({ garmentId, size = 56 }: { garmentId: string; size?: number }) {
  let node: ReactNode = null;
  let crop = GARMENT_CROP.torso;
  if (garmentId in TORSO) {
    const Comp = TORSO[garmentId];
    node = <Comp anim={STATIC_ANIM} />;
    crop = GARMENT_CROP.torso;
  } else if (garmentId in BOTTOMS) {
    const Comp = BOTTOMS[garmentId];
    node = <Comp anim={STATIC_ANIM} />;
    crop = GARMENT_CROP.legs;
  } else if (garmentId === 'beanie') {
    node = <Beanie />;
    crop = GARMENT_CROP.head;
  } else if (garmentId === 'scarf') {
    node = <Scarf />;
    crop = GARMENT_CROP.neck;
  } else if (garmentId === 'sunglasses') {
    node = <Sunglasses />;
    crop = GARMENT_CROP.face;
  } else if (garmentId === 'gloves') {
    node = <GlovesFlat />;
    crop = GARMENT_CROP.hands;
  } else if (garmentId === 'umbrella') {
    node = <UmbrellaInline />;
    crop = GARMENT_CROP.umbrella;
  }
  return (
    <svg viewBox={crop} width={size} height={size} preserveAspectRatio="xMidYMid meet" aria-hidden>
      {node}
    </svg>
  );
}

// Which slot a catalog id occupies — lets the Wardrobe build a single-garment WornOutfit.
export function wornForItem(id: string): WornOutfit {
  const base: WornOutfit = {
    torso: null,
    legs: null,
    head: null,
    face: null,
    neck: null,
    hands: null,
    umbrella: false,
    hiddenLayers: 0,
    itemCount: 1,
  };
  if (id in TORSO) return { ...base, torso: id };
  if (id in BOTTOMS) return { ...base, legs: id };
  if (id === 'beanie') return { ...base, head: id };
  if (id === 'sunglasses') return { ...base, face: id };
  if (id === 'scarf') return { ...base, neck: id };
  if (id === 'gloves') return { ...base, hands: id };
  if (id === 'umbrella') return { ...base, umbrella: true };
  return base;
}
