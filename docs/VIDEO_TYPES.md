# Chaplin video types

Every brief declares one `VideoType`. The brief resolves its duration, shot
count, aspect ratio, required intake fields, and prompt grammar before it is
written to `video_briefs`. All resulting shots use the existing
`episode_shots` → `episode_shot_takes` → media pipeline path; there is no
separate product renderer.

| Type | Runtime / shots | Required intake | Optional intake | Default ratio | Grammar |
| --- | --- | --- | --- | --- | --- |
| `character_punch` | 5s / 1 | actor | — | 9:16 | `character_punch_v1` — one actor performance |
| `character_reel` | 15s / 3 | actor | — | 9:16 | `character_reel_v1` — three actor shots |
| `episode` | 60s / 12 | `character_ids` ensemble | legacy `character_id` | 16:9 | `episode_v1` — existing episode grammar |
| `ugc_ad` | 15–30s / 3–6 | actor, product, persona, hook, CTA, platform | — | 9:16 | `ugc_ad_v1` — handheld, eye-level, natural light; hook → demo → reaction → CTA |
| `product_hero` | 15s / 3 | product | — | 9:16 | `product_hero_v1` — no humans; macro material beats → pack shot/logo lockup |
| `brand_spot` | 30s / 6 | actor, product, narrative beat | — | 16:9 | `brand_spot_v1` — episode grammar; product by shot 2; actor + pack shot finale |

The `aspect_ratio` on a brief may override the default (the schema permits
`9:16`, `16:9`, or `1:1`). Duration and shot-count overrides remain bounded by
the taxonomy; a UGC brief may choose any value in its declared range.

## Product identity contract

`ProductCard` is the product-side equivalent of a character identity seed. It
contains at least one approved `media_assets` reference, a verbatim
`identity_block`, `must_preserve` rules, a negative prompt, approved claims,
and handling notes. Every product image/video prompt includes the identity
block verbatim, the reference asset IDs, preservation rules, and merged
negative prompt. Actor-and-product grammars additionally include the actor's
canonical reference.

`product_hero` is intentionally actor-free: its prompts explicitly prohibit
people, faces, hands, and silhouettes, and no character biography is passed to
the builder. Product references are binding for shape, proportions, material,
colour, cap/closure, and label/logo text.

## Dialogue and claim safety

UGC dialogue/VO is limited to `claims_allowed` plus the supplied hook and CTA.
The prompt builder emits the approved claim allowlist and caps direct-to-camera
speech at two seconds per shot. Builders must not invent product benefits or
labels.

## Pipeline and reporting

Creating a brief inserts a typed shot list and a `media_pipeline_run` with the
same `video_type`, `product_id`, and `video_brief_id` tags. Generation jobs can
carry those tags in both dedicated columns and metadata, allowing per-brand
cost/ledger reporting. Feed publication still occurs only after the existing
approval gate.
