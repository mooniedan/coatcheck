# Feedback & comfort learning

How Coat Check turns per-day feedback into a recommendation that adapts to each wearer. The aim:
two people in the same weather should, over time, get different advice — one in a t-shirt, one in a
jacket — because the app has learned how each of them actually dresses.

This document is the plan for the **per-article feedback** phase plus a record of what is
intentionally deferred (see [Not in this phase](#not-in-this-phase)).

## The model

Personalization is a **single learned warmth offset per profile** — `profiles.comfort_model`
(`{ "offsetC": number }`, migration `0001`). The engine (`lib/recommend.ts`) computes:

```
effectiveTemp = feelsLikeC − offsetC + windChill          (windChill = −2 when wind ≥ 20 kph)
item applies   ⇔ effectiveTemp ∈ [item.minTempC, item.maxTempC]   (+ rain/wind/sun gates)
```

A positive offset means "runs cold" → the engine treats the weather as colder → warmer clothes.
Because the offset shifts the *effective temperature*, it already produces the "t-shirt vs jacket"
divergence between users — we just need it to **learn well from real choices**. One scalar is the
whole model; there is no per-garment state in this phase.

### What's wrong with the current learning

Today `applyFeedback(model, verdict)` (`lib/thresholds.ts`) moves the offset a flat **±1.5 °C** per
verdict and **ignores `worn_item_ids` entirely** for learning (they're recorded but unused). So the
strongest signal — *what the wearer said they'd actually wear* — never reaches the model.

### New learning rule: infer comfort temperature from the chosen outfit

When feedback includes an edited outfit, infer the **effective temperature `T*` that the chosen
outfit suits**, then nudge the offset toward making the engine reproduce that outfit.

1. **Consider only temperature-driven garments.** Exclude condition-gated items (`requiresRain` /
   `requiresWind`, plus `sunglasses` / `umbrella`) — they signal weather, not warmth.
2. **`T*` = the effective temperature whose engine layering best matches the chosen set** (max
   Jaccard overlap between `chosen` and the temperature-driven items the engine would recommend at
   `T`, scanned across a realistic range). This beats a naive band-intersection midpoint, which the
   catalog's open-ended sentinel bands (±40/60) make meaningless — a tank top implies "very warm",
   not the midpoint of `[26, 60]`.
3. **Desired offset** so `effectiveTemp == T*`: `o* = feelsLikeC + windChill − T*` (computed as
   `effectiveTemp(weather, {offsetC:0}) − T*`, reusing the engine's own wind-chill).
4. **Nudge, don't snap** (one odd edit shouldn't swing the model):
   `offsetC = clamp( current + LR · (o* − current), ±MAX_OFFSET_C )`, with `LR = 0.5` and a
   per-update cap `STEP_CAP_C = 3 °C`. `MAX_OFFSET_C = 10` stays as-is.

Direction check: pick lighter clothes (higher bands) → higher `T*` → lower `o*` → offset drops →
engine treats weather as warmer → lighter future recommendations. Repeated feedback converges on the
wearer's true tolerance.

**Fallbacks.** No edited outfit (a bare verdict): `too_hot` / `too_cold` → existing ±`FEEDBACK_STEP_C`
step; `just_right` → no change (it confirms the current pick). Empty chosen set → no learning.

The learner uses **today's live weather** (`rec.weather`) and today's recommended set, exactly the
context the wearer is reacting to.

## UX — both "Today" views

Both views of the Today screen expose the **same** editable-outfit feedback, gated on
`signedIn && isToday` (future days stay read-only — feedback applies to today's outfit). The two
views share one component so they can't drift.

### Shared component: `OutfitFeedback`

Generalises the current `ComfortPicker`. Given the recommended outfit + catalog + today's weather, it
holds a local **edited set** seeded from the recommendation and renders:

- **Per article:** the garment with quick actions — **remove** (−), **swap** (choose another item in
  the same category), and **too hot / too cold**. "Too hot" drops to the next-lighter item in that
  region (or removes it); "too cold" adds/upgrades to the next-warmer one. These are just fast ways to
  reach the edited set.
- **Add clothing:** a category-grouped catalog picker (the existing `ComfortPicker` grid) to add
  anything not currently on.
- **Overall:** a `too cold / perfect / too hot` row (the existing `FeedbackRow`) for a one-tap verdict
  when the outfit is basically right.
- **Save** → submits `{ verdict, wornItemIds: editedSet }`; **Perfect/Looks right** → submits
  `just_right` with the unedited set.

Edits are **today-only** — they reshape the displayed outfit and form the learning signal; reopening
Today tomorrow re-derives from the now-smarter offset (no stored per-day outfit; see deferred list).

### Scene view (`components/home/AnimatedHome.tsx`)

Already has the explode → `ComfortPicker` → `FeedbackRow` flow. Replace `ComfortPicker` with
`OutfitFeedback` (pre-seeded from the current hour/day rec) and surface the per-article controls in
the exploded outfit. The verdict + edited set submit through the same `onFeedback`.

### List view (`components/home/DayItems.tsx` + `GarmentThumbs.tsx`)

Today the list is read-only. Add the `OutfitFeedback` block beneath the garment thumbnails when
`signedIn && isToday`. `DayItems` needs `signedIn` / `isToday` / `onFeedback` props (passed from
`app/page.tsx`, which already owns `sendFeedback`). The garment thumbnails themselves gain the
per-article remove/swap/hot/cold affordances.

## API & data

`POST /api/feedback` already carries everything (`verdict`, `weather`, `recommendedItemIds`,
`wornItemIds`) — **no contract or schema change**. Changes are:

- `lib/thresholds.ts` — add `learnFromOutfit(model, weather, wornItemIds, catalog)` implementing the
  rule above; keep `applyFeedback` for the verdict-only fallback. Pure + unit-tested.
- `app/api/feedback/route.ts` — when `wornItemIds` is non-empty, learn via `learnFromOutfit`; else
  fall back to `applyFeedback`. Still records the `feedback` row as today.
- Recommendation flow is **unchanged** — the updated offset already flows through
  `resolveComfortForProfile` → `recommend`.

## i18n

New `feedback.*` keys (en + nb): `adjust`, `addClothing`, `remove`, `swap`, `tooHotItem` /
`tooColdItem` (aria), `save`, `looksRight`, plus an `adjustHint`. Existing `feedback.*` and
`comfort.*` keys are reused.

## Files

| File | Change |
|---|---|
| `lib/thresholds.ts` | new `learnFromOutfit`; constants `LR`, `STEP_CAP` |
| `lib/thresholds.test.ts` | tests for the inference + direction + clamping |
| `app/api/feedback/route.ts` | route to outfit-learner when an edited set is present |
| `components/home/OutfitFeedback.tsx` | new shared editor (generalises `ComfortPicker`) |
| `components/home/AnimatedHome.tsx` | use `OutfitFeedback`; per-article controls in explode |
| `components/home/DayItems.tsx`, `GarmentThumbs.tsx` | editable thumbnails + feedback block |
| `app/page.tsx` | pass `signedIn` / `isToday` / `onFeedback` to `DayItems` |
| `messages/{en,nb}.ts` | new `feedback.*` keys |

## Not in this phase

Deferred deliberately; revisit when there's data/demand:

- **Per-garment / per-region tolerance.** One offset can't learn "runs hot up top but cold on the
  legs" — upper body, legs, and extremities all share one knob. A future model could hold per-region
  or per-item biases (`comfort_model.itemBias[itemId]`) and shift individual bands.
- **Persisted per-day outfit overrides.** Edits shape today's view and the learning signal but are not
  stored; reopening re-derives from the model. No "my saved outfit for today."
- **Confidence & decay.** Fixed learning rate; no per-profile confidence, no down-weighting of stale
  feedback, no outlier rejection beyond the per-update cap.
- **Richer context.** Learning keys off feels-like only — no time-of-day, activity ("commuting" vs
  "hiking"), humidity, or sun/UV influence on the offset.
- **Conditional-item learning.** Rain/wind/sun-gated items (raincoat, windbreaker, umbrella,
  sunglasses) are excluded from the comfort inference; we don't yet learn personal rain/wind
  thresholds.
- **Swap transitions.** Only the resulting edited set is used as signal, not which item replaced which.
- **Feedback on future/trip days.** Stays today-only; no learning from "what I packed."
- **Undo / inspect learning.** No UI to see or revert the learned offset (it's only surfaced
  indirectly through changed recommendations).
- **Cohort aggregation (existing Phase 3).** The cohort-baseline job that rolls feedback up into
  per-cohort defaults is untouched here; this phase only changes the personal offset.
