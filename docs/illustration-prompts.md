# Illustration prompts

Figma AI and Canva image generation are both disabled on the connected accounts, so generate
these in any image model (ChatGPT, Midjourney, Firefly) and save them as WebP in
`public/illustrations/` with the file names below. Keep the shared style block on every
prompt so the set stays consistent.

**Style (prepend to every prompt):** Editorial lifestyle illustration. Loose, confident
hand-drawn black ink line art with slightly imperfect organic lines, on a flat warm off-white
background (#f6f4f0). Only the people and a few key objects get flat colour fills: warm amber
(#e8a317), graphite grey (#3a3530), soft terracotta (#c8664a) and natural skin tones. The room,
furniture and background stay line-only with no fill. No gradients, no shading, no text,
generous empty space, calm and human.

| File | Ratio | Scene |
|---|---|---|
| `hero.webp` | 3:2 | A young Indian woman sits on a low stool beside a front-loading washing machine with a small puddle beneath it, calmly typing on her phone. Laundry basket, potted plant, curtained window in line only. |
| `technician.webp` | 4:3 | A technician in a graphite work shirt kneels at a washing machine with the door open, inspecting the rubber seal. Amber toolbox open beside him, phone on the floor. |
| `support.webp` | 4:3 | A support agent with a light headset at a wooden desk, reading a message on her laptop and smiling. Cup of chai, small plant. |
| `dispatch.webp` | 4:3 | A dispatcher at a desk hands a tablet to a standing technician; wall calendar and pinned map in line only. |
| `resolved.webp` | 4:3 | The customer and technician at the doorway, she smiles at her phone, he closes his toolbox. |
| `caught-up.webp` | 1:1 | A person leans back at a tidy desk with a cup of tea, plant beside them. |

The set is in `public/illustrations/` and used by `components/shared/illustration.tsx` (landing hero,
relay section, CTA, sign-in and empty states). Use the same style block for any new scene.
