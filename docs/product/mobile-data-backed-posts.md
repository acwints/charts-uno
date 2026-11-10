# Chartsuno mobile: data-backed social posts

Research and decision plan, 2026-11-10. User brief: mobile should feel like Instagram for charts, with no image-only publication; every post connects a chosen chart, a viewable table, and its data source. This plan supersedes the earlier suggestion to allow simple image uploads.

## Recommendation

Keep AI as an optional import assistant, not the central mobile product. A post is a published revision of **display data + chart specification + provenance**. Its image is a generated representation of that revision. The mobile app is where people discover, understand, save, discuss, and publish; web is the advanced creation studio.

Start with existing web-created charts. Next add deterministic table/CSV import. Add screenshot extraction only after table review, uncertainty, and private evidence handling are reliable. Do not expose prompt-generated numbers, an AI chat panel, SQL, complex transforms, or artwork generation in the new mobile composer.

## Research and what it changes

| Evidence | Product implication |
| --- | --- |
| [Datawrapper starts with clean tabular data](https://www.datawrapper.de/academy/upload-data), followed by visualization and [explicit publication/republishing](https://www.datawrapper.de/academy/publishing-and-unpublishing). | Use a structured data-first pipeline. Saving a draft must not mean publishing. |
| [Our World in Data's chart API](https://docs.owid.io/projects/etl/api/chart-api/) exposes chart data plus metadata including units and citations. | A reader gets the data and source context, not only a picture. |
| [OWID distinguishes live and archived charts](https://ourworldindata.org/new-feature-embed-archived-charts). Archived versions retain a chosen data/view selection; live charts can change. | Our recommendation is stable social-post revisions, with explicit corrections. A like or share should not silently change meaning when a draft refreshes. This is a product choice, not a claim that every charting tool uses immutable posts. |
| [WebPlotDigitizer](https://automeris.io/docs/) combines computer vision and manual input to recover data from chart images, with [inspectable/exportable digitized data](https://automeris.io/docs/data/). | Screenshot extraction creates a proposed reconstruction. It does not recover a guaranteed exact original dataset. |
| [C2PA distinguishes provenance from truth](https://spec.c2pa.org/specifications/specifications/2.5/specs/C2PA_Specification.html). | “Source linked,” “Author's own data,” and “Reconstructed from an image” are defensible labels. “Verified” is not justified by a URL or model output. Full C2PA adoption is not needed for the MVP. |
| [Apple charts guidance](https://developer.apple.com/design/human-interface-guidelines/charts) prioritizes data, context, and accessibility; [W3C complex-image guidance](https://www.w3.org/WAI/tutorials/images/complex/) calls for both a short description and a fuller equivalent. | Chart-first feed, concise caption, accessible table, units and sources. A table does not replace a useful description. |
| [Apple tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) are destinations; [sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) support focused tasks. | Use a compose action that opens a focused posting flow. Do not simply rename an action tab “Post.” A Drafts tab is acceptable only as a real destination. |

Mobbin's requested social-post flow search was refused because this account connection requires a paid plan. No Mobbin screenshots were inspected or used as evidence. Impeccable provides the iOS interaction/craft checks; the existing design system is preserved. No unrelated Hallmark landing-page theme is being imposed on the app.

## What every post contains

1. **Public display table:** the exact rows/columns consumed by the visualization after intentional selection and transformations. Null stays missing, never zero. Numeric precision, categories, units, series identifiers, dates, and the selected period are explicit.
2. **Chart specification:** supported type, field/series mapping, aggregation, ordering, filters, stacking, axes, units, chosen time frame, and renderer version. Feed, detail, exported image, and table share one revision ID.
3. **Source declaration:** kind, descriptive title, attribution, source URL when applicable, observation/collection period, import/retrieval time, and methodology. Original social post/reference links are distinguishable from dataset citations.
4. **Provenance status:** imported table, author-collected data, or image reconstruction. Estimated/missing values and extraction/review status stay visible in detail and exports. A user acknowledgment means reviewed by that user, not independently verified.
5. **Publication metadata:** author, caption/description, creation time, revision identity/hash, visibility, and correction/retraction state.

The original spreadsheet, image, EXIF, prompts, SQL, connection IDs, and hidden columns are private inputs, not automatic attachments. A source image can become a separately disclosed attachment later, after a preview of exactly what will be public. The primary feed image always comes from the public display table and chart specification.

## Mobile flow

**Compose → choose a draft → review Data & sources → choose presentation → caption/preview → publish.**

- Initial entry: pick one of the user's saved charts created on web. Show eligible drafts, existing publication state, and a clear route back. Keep incomplete work private.
- Data review: a focused table view with units, missing-value explanation, source declarations, and a plain statement of the rows/columns that will be public. No SQL or hidden raw columns appear. A reader can inspect this same representation after publication.
- Presentation: only compatible simple types, initially bar/line/area/pie/table, with deterministic compatibility checks. Restrict pie to suitable nonnegative data with a meaningful whole. Do not silently drop series to fit a type. Complex map/race/dual-axis/infographic views require explicit semantics before becoming eligible.
- Preview: actual generated post, caption, source label, and accessible summary. Publish is an explicit action, with Cancel/Back available. Retry is idempotent.
- Reader: feed remains chart-first with a clearly reachable Data & sources action. Detail shows chart, caption, sources, and the full display table. Save/like/share do not require opening the editor.
- Mobile navigation: preserve Feed, library/saved, and account/profile destinations while introducing a compose action. Do not remove working creation routes until the replacement covers publishing and draft recovery. Advanced editing routes can then hand off to web with a clear explanation.

### Next inputs

**Paste/CSV:** deterministic parsing; preview labels, units, nulls, categories, and chosen columns before creating a draft. Detect ambiguous dates/decimal separators; do not silently guess. No generative numbers required.

**Image scan:** crop/inspect privately → extract proposed values → show source image beside the proposed table → correct labels, units, axes, values, and missing cells → acknowledge the reconstruction → choose app-rendered chart. Estimated points remain marked as estimates after review. Reject unreadable or unsupported images rather than fill gaps. No image-only publish escape hatch. Do not treat confidence scores as calibrated truth probabilities.

## Technical plan

Keep the existing `charts` document as a mutable private draft. Add `chart_revisions` and a published-revision reference rather than rebuilding likes/saves immediately.

Suggested revision fields: `id`, `chart_id`, `author_id`, `parent_revision_id`, `public_data`, `chart_spec`, `provenance`, `caption`, `content_hash`, `renderer_version`, `reviewed_by`, `reviewed_at`, `published_at`, and retraction/correction status. Private source artifacts live separately with owner/team permissions, deletion policy, and no automatic public URL.

A single server publication service must be used by publish-targets, direct chart updates, bot publication, and future import paths. Auto-refresh updates drafts only. The publish transaction validates the expected draft version, builds an allowlisted public projection, records the reviewed hash, and creates the immutable revision. An idempotency key prevents duplicates. A concurrent edit yields a conflict and returns the user to review.

Validate: nonempty/appropriately sized tables, finite numbers or explicit null, aligned arrays, unambiguous column/series IDs, at least some actual observations, supported chart/mapping semantics, explicit provenance, safe URLs, and acknowledgment tied to the current server revision. A syntactically valid URL is not evidence of factual accuracy. Do not fetch arbitrary URLs without a separate SSRF-safe ingestion service.

Serve feed/detail/table/download/image from the same revision and ACL. Asset/cache keys include revision/hash plus renderer version. A correction creates a new revision with an explanation and link; existing shared revisions retain their meaning until revoked. Retraction/privacy removal overrides historical availability and revokes public assets/share access. Decide whether engagement follows the post or a specific revision before schema rollout; retain stable post identity with visibly recorded revisions as the recommended default.

### Legacy migration

Audit existing public charts without destructive changes. Keep valid legacy posts readable with accurate missing-source/extraction notices. Do not invent citations or certify old data. Require repair and review before republishing into the strict contract. Malformed/unrenderable or privacy-unsafe payloads must not enter a feed advertised as universally data-backed. Roll out the new eligibility feed behind a flag after coverage is measured; preserve owner access for repair. No silent mass deletion.

## Adversarial review findings

Two independent reviews challenged backend integrity and mobile UX. Findings resolved in the first foundation slice or explicitly queued:

- Public serializers currently return original images, prompts, SQL metadata, and arbitrary JSON extras. **Fix first:** allowlist reader payloads; preserve authenticated owner editor access.
- The current `verifiedData` field is client-writable and can merely mean search grounding exists. **Fix first:** remove factual verification claims; do not suppress generated/extracted-data disclosures based on it.
- Reader values can round to zero via default locale formatting, and categorical context is omitted. **Fix first:** show stored precision, missing-value meaning, and row context.
- Root source URLs are ignored and multiple source locations conflict. **Fix first:** collect/deduplicate safe citations with clear reference/source labels. **Later:** canonical provenance model.
- A chart can be published via direct PUT or bot routes, and edited/refreshed after publication. **Revision phase:** centralize all public writes; UI-only checks are insufficient.
- Feed race thumbnails can mix values from different periods by selecting each series' last non-null point. **Fix first:** use one shared final frame and honor the explicit carry-forward setting. Carry-forward is a supported renderer feature, not inherently a bug; ignoring a disabled setting is the defect. **Revision phase:** unify full rendering semantics and selected views.
- A table may expose hidden import columns or be unrelated to an uploaded picture. **Revision phase:** public projection + app-rendered image + explicit public preview.
- An irreversible snapshot design can conflict with privacy removal. **Revision phase:** immutable content, revocable access, explicit corrections.

## Delivery sequence and release gates

### 1. Trust/readability foundation — implement now

Public-response privacy; faithful reader data; complete safe source access; honest AI provenance; shared-frame thumbnail correction. Regression tests and Pro Max validation. Remove the old persistent feed cache, which could retain previously exposed editor fields; navigation remains cached in memory only. No database migration. This does **not** yet enforce the complete publication contract or replace the mobile editor.

### 2. Versioned publication contract

Add schema/migration, single publication service, concurrency/idempotency, safe public projection, renderer/revision binding, revocation and correction policy. Tests cover every write/read path, bot/cron, stale review, and backward compatibility. Deploy additive server support first; do not gate existing web publishing until a working repair/review path ships.

### 3. Mobile existing-chart composer

Replace the desktop-like creation surface only after the new flow works end to end. Hide mobile AI chat, generative prompts, SQL, and advanced styling. Preserve draft recovery and web handoff. Test cancellation, backgrounding, duplicate taps, offline retry, system appearance, large text, VoiceOver, and real device gestures. Ship via a new signed native release; web deployment alone does not update installed apps.

### 4. Deterministic table import

CSV/paste with public-column selection, parsing diagnostics, units, source declaration and compatible chart selection. Exercise row limits, categorical values, zero/null, negative and tiny decimal values, and inaccessible sources.

### 5. Assisted image extraction

Separate evidence storage/deletion, extraction evaluation corpus, comparison/review UI, uncertainty labels, abuse controls, cost/latency budgets. Do not launch until wrong/exaggerated/unreadable examples fail safely. AI proposes; the user reviews; the post retains its reconstruction disclosure.

## Acceptance tests that define done

- Image-only, unrelated-table, empty/all-null, nonfinite, misaligned and oversized posts fail server-side with actionable errors.
- Direct API, bot, refresh, and existing-public edits cannot bypass revision review.
- A client-written `verifiedData=true` never produces a Verified badge or removes provenance disclosures.
- Original images, prompts, SQL, credentials and unexpected nested fields do not appear in public/read-only API payloads; owner draft retrieval still works.
- Feed/detail/export/table use the same published revision and selection. Missing race-frame observations borrow earlier values only when the explicit carry-forward setting allows it.
- Small decimals, zero/null, categorical context and units survive inspection; all rows can be reached accessibly.
- Editing a draft cannot change an existing post. Concurrent edits invalidate review. Retry creates one publication.
- Public preview matches the columns and data actually served. Only selected display data is published.
- No URL fetching or unsupported “verification” occurs merely because a link is present.
- Correction and retraction behave consistently across feed, saved views, share links, assets and caches.
- Legacy data is accurately labeled until reviewed; no fabricated source metadata.

## Open decisions

- Allow original/author-collected data with an explicit declaration and collection method (recommended), or demand an external URL. User clarification requested; foundation work does not depend on the answer.
- Whether the first social launch needs comments/following/search. These are separate from the publication integrity work and are not prerequisites for this foundation slice.
- How strict moderation should be about reconstructed data in the main feed versus a labeled category. Reconstruction must never appear as exact original data by default.
