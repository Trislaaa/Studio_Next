# Chatbot Product Knowledge Update - TODO

## Audit Result

- [x] Step 1: Read and analyze all chatbot and product files
- [x] Step 2: Update `brochure-context.ts` - Add CAD Software, CAD Hardware, CAM Solutions sections (already present)
- [x] Step 3: Update `route.ts` `getLocalReply()` - Add new keyword sections for all products
- [x] Step 4: Update `knowledge.ts` `detectChatIntent()` - Add new product keywords
- [x] Step 5: Update `prompt.ts` - Add new product references to system prompt (already present)
- [x] Step 6: Update `seed-knowledge.ts` - Add new knowledge documents for vector DB (already present)
- [x] Step 7: Run seed and embedding scripts (SKIPPED - no .env/.env.local configured with DATABASE_URL)

## Our Story Mobile Responsiveness Fix

- [x] Step 1: Add `min-w-0` to grid-item wrappers (FadeInSection, card, text wrapper) so columns can shrink
- [x] Step 2: Add `shrink-0` to icon wrapper
- [x] Step 3: Reduce mobile heading/paragraph font sizes + add `break-words`
- [x] Step 4: Verify with type-check/build (desktop unchanged)

## Completed Work

- [x] Step 3 (detail): Enhanced keyword arrays in each `getLocalReply()` section in `route.ts` so product-specific queries (e.g., Magic Inkjet, SN-MJ, H185, XH series, GOA-SP, YS series, TF series, PA-SSD, B4 series, flatbed, denim, sample cutter) route to the correct section.
- [x] Step 4 (detail): Extended the `detectChatIntent()` regex in `knowledge.ts` with the same product-specific keywords so they map to `studionext_info`.

