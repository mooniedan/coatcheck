# PRD: Recommendation-faithful figure wardrobe

**Date:** 2026-06-22 · **Status:** approved · **Tier:** medium

> **Living spec.** Maintained through implementation as the source of truth. The recommendation→
> worn-outfit **resolution rules** (§4) and the **garment visual classes** (§10) are
> platform-agnostic and intended to be reused verbatim when building the native apps — keep them in
> the framework-free domain layer (`lib/scene-model.ts`), not in web-only components. §5 (UI
> surfaces) and §8 (types) are updated to match what shipped.

## 1. Problem & outcome
The animated home figure looks nearly identical at 16°C and 34°C even though the recommended
outfits differ, because it renders only ~6 coarse SVG layers and many catalog items collapse to
the same art (any outerwear → one brown shell; tank/tee/long-sleeve → one base torso; all bottoms
→ one pair of trousers; gloves never drawn). Outcome: the figure shows the **actual recommended
garments** with enough variety that cold, mild, and hot outfits are obviously different — and each
article of clothing is its own reusable SVG component, reviewable on a dedicated admin page.

## 2. Users & goals
- **App user (signed-in or not)** — glances at the figure to understand what to wear today/at a
  scrubbed hour. *As a user, I want the figure to actually look like the recommended outfit so I
  trust it and can read the advice at a glance.*
- **Admin / designer** — reviews the garment components. *As an admin, I want a page listing every
  clothing article with its rendered component so I can visually QA the wardrobe.*

## 3. Domain vocabulary  **[design-pack]**
- **Garment** — one rendered article of clothing (its own SVG component), e.g. Sweater, Heavy coat.
- **Visual class** — a group of catalog items that share one garment component because they look
  alike enough at the figure's scale. Most items map 1:1 to a garment; look-alikes may share.
- **Body region / slot** — where a garment sits: `torso`, `legs`, `head`, `face`, `neck`,
  `hands`, plus the held `umbrella`. (`feet` is derived, not from the catalog — see §9.)
- **Worn outfit** — the resolved description of what the figure renders: the single outermost
  garment per region, derived from the recommendation (replaces today's opacity map).
- **Outermost-wins** — when several garments are recommended for one region, the figure shows only
  the outermost/warmest; the rest live in the exploded view + layer indicator.
- **Layer indicator** — a small chip shown when the worn outfit hides ≥1 garment under the
  outermost (e.g. a top beneath a coat). Tapping it explodes the outfit.
- **Exploded outfit** — the existing tap-to-reveal overlay listing every recommended item (kept).
- **Wardrobe (admin)** — review page rendering each catalog garment on a mini figure.

## 4. Relationships & lifecycle  **[design-pack]**
- A **Recommendation** contains 0..N **ClothingItem**s per category (Tops/Bottoms/Outerwear/
  Accessories). `outfitFromRecommendation()` maps it → one **Worn outfit**.
- Each catalog item → exactly one **Garment** component (some items share a class).
- Region resolution (outermost-wins):
  - `torso` = the recommended **Outerwear** (warmest/most-protective) if any, else the warmest
    recommended **Top**.
  - `legs` = recommended **Bottoms** by coverage priority (trousers > thermal leggings > shorts).
  - `head` = beanie if recommended; `face` = sunglasses; `neck` = scarf; `hands` = gloves.
  - `umbrella` = held when the **umbrella** accessory is recommended.
- **Layer count** = number of recommended garments in stacked regions (Tops + Outerwear, and any
  doubled Bottoms). Indicator shows when layer count implies something is hidden (> the garments
  actually drawn on the torso/legs).
- The same `Worn outfit` feeds three places: the **resting/scrubbed figure** (real hourly data),
  the **canned day-tour fallback** (when no hourly data), and the **admin Wardrobe** (one garment
  at a time).

## 5. UI surfaces  **[design-pack]**

### Home figure — `components/home/scene.tsx` (Figure) + new garment components
- **Purpose:** render the worn outfit on the walking/standing figure.
- **Components/regions:** body skeleton (animated arm/leg groups, head, hands) + slotted garments:
  - Tops: Tank · T-shirt · Long-sleeve · Sweater · Thermal base.
  - Bottoms: Shorts · Trousers · Thermal leggings.
  - Outerwear: Light jacket · Heavy coat · Raincoat · Windbreaker.
  - Accessories: Beanie · Scarf · Gloves (new) · Sunglasses · Umbrella.
- **States:** populated (a garment per occupied region); essentials always present (a base torso +
  legs so the figure is never naked even if a region is empty); reduced-motion (no walk cycle);
  exploded (overlay open). Garment changes crossfade (existing 0.4–0.55s opacity transitions).
- **Interactions:** tap figure → explode (existing). Sleeves/legs move with the `ahs*` walk
  animation, so garments with sleeves/legs must render into the animated arm/leg groups.

### Layer indicator — within the hero scene
- **Purpose:** signal hidden layers and offer a second tap target to explode.
- **Component:** a small M3 chip (e.g. "▤ 3 layers") positioned unobtrusively over the scene
  (near the figure / above the timeline), only when layer count > drawn layers.
- **States:** hidden (single-layer outfit) / shown (multi-layer). Tap → explode.

### Admin Wardrobe — new `/admin/wardrobe` (linked from `/admin`)
- **Purpose:** visually review every garment component.
- **Components:** grouped-by-category grid; each cell renders the garment on a small neutral mini
  figure, plus the item name, temp band (min–max °C), and condition flags (rain/wind).
- **States:** loading / denied (non-admin) / populated. Read-only (no mutations); data is the
  static `DEFAULT_CATALOG`, gated like the rest of `/admin`.

## 6. User flows  **[design-pack]**
1. **Read the outfit:** user loads a recommendation → figure renders the outermost garment per
   region → if layers are hidden, the layer indicator appears → user taps figure or indicator →
   exploded overlay lists all items → close returns to the figure.
2. **Scrub the day:** user drags the timeline → each hour re-resolves the worn outfit → the figure
   visibly changes garments (e.g. tank at the warm afternoon hour → sweater + jacket in the cold
   morning hour).
3. **Review wardrobe (admin):** admin opens `/admin` → "Wardrobe" → sees all 17 articles rendered
   as components with their bands/conditions.

## 7. Functional requirements
1. The system MUST resolve a recommendation to a **single outermost garment per body region**
   (torso, legs, head, face, neck, hands, umbrella) per §4.
2. The figure MUST render a **distinct garment component** for each visual class so that tank,
   t-shirt, long-sleeve, sweater, and thermal are visually distinguishable; likewise shorts vs
   trousers vs leggings; and light jacket vs heavy coat vs raincoat vs windbreaker.
3. **Gloves** MUST be rendered on the hands when recommended (new).
4. Each garment MUST be its **own component** (self-contained: torso/sleeves/legs as needed),
   composed by the Figure, and reusable standalone (for the Wardrobe page).
5. Garments with sleeves/legs MUST animate with the existing walk cycle (render into the animated
   arm/leg groups); garment swaps MUST crossfade.
6. Essentials MUST guarantee the figure is never bare: a base torso + legs render even if the
   recommendation is empty for that region.
7. A **layer indicator** MUST appear only when the worn outfit hides ≥1 garment under the
   outermost, MUST show the total item/layer count, and tapping it MUST trigger the same explode
   as tapping the figure.
8. The existing **exploded outfit** view (lists every recommended item) MUST be retained.
9. `outfitFromRecommendation()` MUST be replaced/extended to return the structured worn outfit;
   the canned day-tour fallback (`outfitAt(t)`) MUST produce the same structured shape so the
   figure renders consistently with or without hourly data.
10. The admin **Wardrobe** page MUST list all `DEFAULT_CATALOG` items grouped by category, each
    rendering its garment component plus name, temp band, and rain/wind flags; it MUST be gated to
    admins (denied state otherwise).
11. Unit tests MUST cover the recommendation→worn-outfit resolution (outermost-wins, region
    priorities, layer count) for representative cold/mild/hot/rainy cases.

## 8. Data model  **[design-pack]**
No new persistent data. Drives off existing `ClothingItem` (`lib/catalog.ts`) and `Recommendation`
(`lib/types.ts`).

**Delivered (`lib/scene-model.ts`):**
```ts
interface WornOutfit {
  torso: string | null;  // outerwear id, else warmest top id (fallback 'tshirt')
  legs:  string | null;  // bottom id (fallback 'trousers')
  head:  string | null;  // 'beanie' | null
  face:  string | null;  // 'sunglasses' | null
  neck:  string | null;  // 'scarf' | null
  hands: string | null;  // 'gloves' | null
  umbrella: boolean;
  hiddenLayers: number;  // garments hidden under the outermost (drives the indicator)
  itemCount: number;     // total recommended items (indicator label / explode count)
}
```
- `outfitFromRecommendation(rec): WornOutfit` — outermost-wins resolver (priorities §4).
- `outfitAt(t): WornOutfit` — day-tour fallback; synthesizes a recommendation from the canned
  temp/rain curves so the figure renders through the same path.

**Delivered UI/component map:**
- `components/home/garments.tsx` — one component per article + `FigureBody({worn, anim})` (full
  ordered stack), `MiniFigure({garmentId})` (single article for review), `wornForItem(id)`,
  `STATIC_ANIM`/`Anim`.
- `components/home/scene.tsx` `Figure` composes `FigureBody`; umbrella stays an animated overlay.
- Layer indicator lives in `components/home/AnimatedHome.tsx` (chip → explode).
- `app/admin/wardrobe/page.tsx` — the review grid; linked from `app/admin/page.tsx`.

## 9. Non-functional & constraints
- **Style:** flat fills + thin strokes, warm-clay palette, match current figure proportions and the
  `ahs*` keyframes. No gradients/photoreal.
- **Performance:** garments are static SVG; resolution memoized per hour (as today). No per-frame
  cost beyond current.
- **Accessibility:** layer indicator is a real button with an aria-label; figure tap target keeps
  its label; reduced-motion disables the walk cycle (existing).
- **Footwear:** the catalog has **no footwear items**, so feet are NOT suggestion-driven. Optional
  light heuristic (sandals with shorts/hot, boots when very cold) — derived, clearly out of the
  "from suggestions" promise; may be deferred.
- **Thermal/leggings** are base layers, so under outermost-wins they rarely show on the figure
  (they'll appear in the exploded view + layer count). Acceptable.

## 10. Visual & UX guardrails  **[design-pack]**
- Keep the existing faceless, minimal, geometric figure; new garments are flat shapes in the same
  language (see current Shell `#8E4B2C`, Mid `#6A5D2E`, Bottoms `#3A4E66`).
- Each garment needs a recognizable silhouette at ~130×220px: tank = sleeveless; tee = short
  sleeves; long-sleeve = collar + full sleeves; sweater = ribbed cuffs/hem + higher neck + knit
  hint; light jacket = cropped open front; heavy coat = long + bulky + collar; raincoat = hood +
  slight sheen; windbreaker = thin zip shell (may share the jacket base with a distinct colour/zip).
- Distinct but harmonious colours per garment; warm tones for heavy/cold items, cooler/lighter for
  summer items. Layer indicator: subtle secondary-container chip, not attention-grabbing.
- Wardrobe page: calm catalog grid, M3 cards, consistent mini-figure framing per item.

## 11. Out of scope (YAGNI)
- Footwear catalog items / shoe selection from suggestions.
- Body/gender/skin variants, item swapping from the figure, accessories beyond the five listed.
- Redesigning the figure's body, face, or the scene/weather layers.
- Richer (Claude Design) illustration — staying hand-authored in the current flat style.

## 12. Decisions & assumptions (resolved in review)
- **Windbreaker** shares the light-jacket base silhouette, differentiated by colour + a zip detail
  (accepted under "per visual class").
- **Layer indicator** shows when the recommendation includes more garments in stacked regions than
  the figure draws (i.e. something is hidden under the outermost). It displays the total item count
  and explodes on tap.
- **Wardrobe** ships at `/admin/wardrobe`, linked from `/admin`.
- Native parity: the resolver + visual-class table are the contract; the SVG itself will be
  re-authored per native platform.

## 13. Success criteria
- 34°C (tank · shorts · sunglasses), 16°C (long-sleeve · light jacket · trousers), and 2°C
  (sweater · heavy coat · beanie · scarf · gloves) produce **obviously different** figures.
- Every catalog item maps to a distinct garment component (look-alikes share by design), each
  rendered on the admin Wardrobe page with correct band/flags.
- Layer indicator appears for multi-layer outfits and explodes on tap; single-layer outfits show
  no indicator.
- Resolution logic is unit-tested for cold/mild/hot/rainy cases.
