# Maps and nearby places

Status: implemented, 29 September 2026. See [the feature guide](features/maps-and-places.md) for shipped behaviour, setup, and validation limits. The original design below records the intended scope; current implementation uses native macOS Core Location and MapLibre 6.11.2.

## Experience

“Find a quiet coffee shop nearby” opens a clean map beside the orb, with three to five numbered pins, walking times, and matching place cards. The same component works inside typed chat. Selecting a pin highlights its card; choosing the card's directions action opens Apple Maps or Google Maps. A separate Save action adds the place to the vault.

Smith gives one short, grounded sentence while the panel carries the detail. Saved places and new discoveries can appear together, with a discreet Saved label. Explore → Places opens saved places directly without an AI request; nearby discovery is available from the same view.

### Visual direction

- Reuse the existing companion panel and its light/dark theme. Map occupies approximately the upper 60% of the available panel, with compact stacked cards below. Avoid an additional floating window or nested modal.
- One short heading, such as “Coffee nearby”, with a smaller origin label and Change action. Keep the selected origin visible so “nearby” is understandable.
- Muted street map, legible street and park labels, one accent colour matching Orb, numbered pins, a distinct origin marker, rounded panel edges, subtle separators, and generous spacing. Preserve required map attribution.
- Each card shows place name, category, short address, walking time when available, and at most one sourced reason it fits. No reviews carousel or large photographs in v1.
- Selecting a pin/card synchronises both, keeps the selection in view, and exposes **Directions**, **Save**, and, for saved places, **Open note**. Directions uses the chosen default app; an adjacent menu offers the other app. Default to Apple Maps on this Mac app.
- Small Nearby / Saved switch; optional walking-limit control revealed when needed. Do not crowd the first result with a filter toolbar.
- Fit initial bounds to the origin and returned coordinates. Panning reveals a Search this area action instead of silently spending more API requests. Do not refit the camera on every render.
- Use a short fade/slide consistent with the existing UI; honour reduced motion. Keep map pan/zoom distinct from Electron window dragging.
- At narrow widths use map above list; at larger chat widths allow map and list side by side. Keep a useful minimum map height and resize it after the panel becomes visible.
- Cards and actions remain fully keyboard accessible without operating the map. Use visible focus, selected-state text, and concise loading/result announcements. Closing returns focus to the initiating control; preserve existing Escape behaviour.

## Behaviour and trustworthy results

| Situation | Behaviour |
| --- | --- |
| “Nearby” with no origin | Offer Use current location or an address/neighbourhood in the panel. Do not infer an origin from unrelated vault notes or IP location. |
| Location allowed | Take a single location fix for this search; show its accuracy/staleness when material. Do not track in the background. |
| Location denied, unavailable, or times out | Keep address/neighbourhood input available. No repeated permission prompts. |
| User supplies a place or neighbourhood | Geocode it and ask the user to choose when matches are ambiguous. A neighbourhood centre is labelled as the starting point, not the user's exact location. |
| “Quiet coffee shop” | Search cafés and rank using evidenced preferences. A saved note saying “quiet upstairs” may support that recommendation, with a note citation. If no quietness evidence exists, show nearby cafés with “Quietness not verified.” Never invent atmosphere, occupancy, reviews, or noise scores. |
| Walking time | Use pedestrian route duration, rounded to minutes, from the displayed origin. Straight-line distance may shortlist candidates but must not be presented as walking time. If routing fails, show Walking time unavailable; optionally show explicitly labelled straight-line distance. |
| Saved place has no coordinates | Show its card. A usable address can be geocoded for the current view; unresolved or ambiguous locations remain unpinned with an explanatory action. Do not silently write coordinates back to the note. |
| Saved place has malformed coordinates | Warn on that record and continue displaying other places. Empty is not zero; valid zero coordinates remain valid. |
| No places match | Show a compact empty state with Change area / Widen search. Do not fill the map with invented results. |
| API key missing, quota exceeded, or offline | Preserve saved-place browsing and external directions. Explain which online capability is unavailable; do not suggest saved notes were lost. |
| Map tiles fail or WebGL is unavailable | Keep cards, walking-time results where available, and directions usable with a Map unavailable state. |
| Saved and discovered records refer to the same place | Merge only with reliable identity/address evidence. Do not merge businesses merely because their names match. |

Start with a 1.5 km search radius and return up to five results, prioritising the user's category and evidenced preferences, then pedestrian travel time. Broaden to 3 km only through an explicit Widen search action or a user request. Label the radius as distance, not a guaranteed walking-time boundary. Fetch a bounded candidate set (up to 15), route the shortlist, and present results progressively. Opening hours or “open now” appear only when the provider supplies usable, current data and timezone context.

## Map and places provider

Proposed stack: **MapLibre GL JS**, bundled locally, for the map; **Geoapify** as the initial candidate for basemap tiles, place search, geocoding, and pedestrian routing. Apple and Google Maps are directions destinations and do not need to be the embedded map provider.

This is a recommendation, not a claim that current provider terms or all endpoints have been verified. The first implementation milestone must validate UK coverage, available category filters, pedestrian routes/matrix support, quotas and cost, attribution, Electron compatibility, and rights to retain returned place names, addresses, coordinates, and identifiers in permanent Markdown notes. A provider that cannot support the required Save to Places behaviour must be replaced before integration is committed. Do not assume that user confirmation overrides provider retention restrictions.

Keep one small provider adapter with `search`, `geocode`, and `walkingRoutes` methods. Category mapping belongs there: Café, coffee shop, and cafe can target the same search category while vault categories remain free text. Do not send arbitrary private note bodies to the maps provider. No second provider or generic plugin framework in v1.

Provider credentials are saved through the app's existing encrypted-settings pattern. Search/geocoding/routing run in the main process. Map tiles/styles must use either a provider-approved restricted public map token or a narrow main-process resource handler that keeps a secret key out of the renderer. Verify this choice in the initial spike. Never pass arbitrary renderer URLs to an authenticated network proxy.

Bundle map scripts, CSS, and worker assets. Audit the current strict Content Security Policy against actual map-library requirements; use a local worker bundle and specific resource origins/schemes, not broad wildcards or remote executable scripts. Document attribution, outbound domains, query/origin sharing, and any permitted cache retention.

## Origin and directions

- Store a user-entered default area only when they choose Remember this area. Keep device coordinates and search origins ephemeral by default. Allow a query-specific origin without replacing the default.
- The current Electron permission handlers allow microphone access only. Test geolocation in both development and the packaged macOS app; add only the required permission handling and usage description. If Chromium cannot provide a reliable fix, implement a small macOS Core Location bridge. Address entry must work independently and ship even when location permission is unavailable.
- A Places settings section contains provider connection, optional default area, and preferred directions app. Reuse a location service with weather if that planned feature lands, but do not make maps depend on unfinished weather code.
- Build directions URLs in main from validated destination data. Use Apple's supported map URL with walking mode and Google's Maps URLs directions endpoint with `travelmode=walking`; verify the current URL parameters on the target Mac/browser. Prefer coordinates; use a clear name/address when no coordinates exist.
- Use HTTPS links for both providers where supported by the macOS handoff. If a native scheme is needed, narrowly allow that scheme and exact URL construction in the directions handler. Do not broaden general note-link permissions.
- Use the displayed explicit origin when available. After reopening a historical chat, obtain a fresh origin or let the maps app choose one rather than reusing an old device location silently.

## Vault format and starter update

The connected vault already has this structure, verified read-only during planning:

```text
6. Life Admin/
  Places.md
  Places.base
  Places/
    Place Name.md
99. System/99.1 Templates/
  10. Place Template.md
```

Keep the current schema unchanged in v1:

```yaml
---
type: place
category: Uncategorized
location:
latitude:
longitude:
website:
---
```

Category and location remain free text. Website is optional text; opening it requires a valid HTTP(S) URL. Coordinates are optional finite decimal numbers in the existing ranges (latitude −90…90, longitude −180…180), and a pin requires both. Never fabricate coordinates or coerce null/empty strings to zero. Unknown properties and existing note bodies must survive edits. Do not require provider IDs, ratings, quietness scores, or routing data in frontmatter.

Save creates `6. Life Admin/Places/<Place Name>.md` with full YAML and a real Markdown heading; it must not write unresolved Templater expressions. Put user notes and permitted source attribution/link and retrieval date in the body. Walking times are transient and do not belong in the note. Save only provider fields whose retention is permitted. Use the existing version/conflict checks and edit journal so create/update can be undone.

Normalise unsafe filename characters and reject traversal/symlink escapes. If the exact file already exists, read it and either identify it as the same place or offer a neighbourhood suffix for a different branch. Never overwrite by matching title alone. Repeated clicks and retries must return the already-created note instead of creating duplicates. Saving a temporary geocoded pin to an existing note is a separate explicit Save location action.

### Starter assets

Add the following to `vault-template`:

- `6. Life Admin/Places.md`: instructions, embedded By category table, and clear explanation that Orb can display/search maps while Obsidian continues to use the table.
- `6. Life Admin/Places.base`: Markdown + exact Places-folder membership + `type: place` filter; preserve All, By category, and With coordinates views and current columns. Numeric/range validation is enforced by Orb, not implied by the nonempty-coordinate Base view.
- `6. Life Admin/Places/.gitkeep`: empty starter directory, no real locations or personal records.
- `99. System/99.1 Templates/10. Place Template.md`: the existing YAML schema, Templater heading, and Notes section.

Update Home → Around the vault, Life Admin, starter README, Assistant Guide, and Obsidian Setup with Places links, folder mapping, property types, direct-file-writing instructions, and the difference between a saved table and an Orb map. No Obsidian map plugin is required for Orb.

The starter deliberately excludes `.obsidian` configuration, and `createWorkspace()` rejects hidden configuration files and JSON. Preserve that contract: document the Templater mapping and text/number property types rather than copying the live vault's plugin settings into the starter. New-vault creation should materialise the empty Places directory and reviewed Markdown/Base assets.

### Existing vaults

Keep Places optional when connecting older vaults; do not make their existing validation fail. Offer an additive Set up Places action for missing assets, with a preview of files/configuration changes. Existing notes, directories, templates, Bases, navigation customisations, and plugin settings must not be replaced wholesale.

For this user's vault, the folder, Base, template, mapping, property types, and navigation are already configured according to the supplied setup. Inspect them again at implementation time and only apply needed additive changes; update the directory's map explanation once Orb supports it. If an optional setup helper modifies `.obsidian/plugins/templater-obsidian/data.json` or `.obsidian/types.json`, merge only missing mapping/type entries, preserve unrelated values, report conflicts, and retain a backup. Do not install plugins automatically.

## Implementation map

| Area | Proposed change |
| --- | --- |
| `src/places.cjs` (new) | Read eligible place notes, validate fields, filter/search saved records, deduplicate cautiously, and create/update through Vault's journal. Keep source path/version for each saved result. |
| `src/places-provider.cjs` (new) | Bounded provider calls, category translation, geocoding, pedestrian durations, timeouts, cancellation, response validation, attribution, and terms-compliant caching. Inject transport/clock for tests. |
| `src/places-service.cjs` (new) | Resolve origin, combine saved/discovered places, rank and route candidates, manage short-lived result IDs, expose explicit empty/partial/error states, and build directions destinations. |
| `src/main.cjs`, `src/preload.cjs` | Add validated Places read/search, save, location, directions, and settings IPC; wire services into Agent. Preserve unrelated settings. Check IPC sender and resolve result IDs in main instead of trusting renderer-supplied URLs. |
| `src/agent.cjs` | Add `find_places`, `list_places`, and `save_place`. Search returns a validated `kind: 'places'` visual automatically. Save uses a returned candidate ID or explicitly supplied user facts; never save just because the user searched. Voice reaches these through `run_task`; extend its routing description beyond vault-only requests. |
| `src/visuals.cjs` | Add a service-owned Places visual builder; keep generic `show_visual` chart validation unchanged. The model does not create arbitrary map pins. |
| `src/places-ui.js`, `src/places.css` (new) | Shared map/card renderer, selection, directions, save feedback, origin input, loading/partial states, keyboard access, and cleanup. |
| `src/visual-renderer.js`, `src/renderer.js`, `src/chat.js` | Route Places visuals and action callbacks in companion and chat, add map tool labels, and dispose map instances on replacement/hide/unmount. Instantiate only visible maps to avoid many WebGL contexts in long chats. |
| `src/chats.cjs` / chat persistence boundary | Persist only permitted place-summary fields; exclude device origin, full routes, keys, and expiring result handles. Historical walking times are labelled as historical and refreshed only on request. Re-resolve saved note paths or permitted provider references for replayed actions. |
| `src/index.html`, `src/style.css`, `src/explore.js` and renderer commands | Register local map assets/CSP changes, Places discovery entry, command-palette entry, and settings integration. Reuse current panel sizing first; change layout dimensions only if visual QA demonstrates the need. |
| `src/workspace.cjs`, `test/workspace.test.cjs`, `vault-template/` | Include the starter assets, keep old vaults compatible, and verify clean/new-vault behaviour. |

A Places visual should contain a schema version, query/title, display origin label, result IDs, name/category/address, nullable coordinate pair, nullable walking duration and retrieval time, saved note path/version, evidence/source labels, attribution, and partial-result warnings. Exact live origin and credentials stay in service state. Provider text is untrusted content rendered as text, not HTML or agent instructions.

Use cancellation plus monotonically increasing request IDs so changing area or closing the panel cannot paint stale results. Limit concurrent route requests and rate-limit retries; do not route an entire large vault. Clear origin/result state on vault switch and prevent writes using stale results from another vault. Invalidate saved-place data after saves, undo, and external note changes; re-read current content before writes.

## Delivery sequence

1. **Provider and location spike.** Prove actual tiles, nearby café search, pedestrian times, directions handoff, credential handling, permanent-save rights, and packaged-app location/fallback behaviour. Record the chosen provider and costs. This gates online integration.
2. **Vault support.** Implement saved-place parsing/writes and starter assets, additive setup, note opening, and tests. Existing Places notes must work unchanged.
3. **Map and cards.** Build the shared component against clearly labelled fictional UI fixtures, including dark/light themes, selection, origin input, list fallback, save feedback, and replay behaviour. Verify at the real companion width and small chat sizes.
4. **Live nearby flow.** Connect search/geocoding/routes, agent tools, Explore, settings, and cancellation. Exercise the complete “quiet coffee shop nearby” request through typed chat and voice.
5. **Finish and document.** Verify undo, fresh/new and older vaults, location denial, offline/partial states, attribution, security boundaries, and packaged macOS behaviour; add the user guide and provider/privacy/setup documentation.

## Acceptance and validation

- A request with a known origin opens a real, geographically correct map with up to five real candidates and matching numbered cards; fewer results remain fewer results. Route failures never become invented walking times.
- Pin/card selection is synchronised. Each result opens the correct destination and walking mode in both Apple and Google Maps, with a deliberate fallback when handoff fails.
- “Quiet” is backed by a visible source or clearly marked unverified. Broad location matches never become silently persisted exact addresses.
- Save creates one correctly formatted note visible in Places.base, preserves optional empty values, and can be undone. Existing custom categories, properties, and body content survive editing.
- Fresh vaults include Places and its navigation; older vaults connect successfully without Places; setting up this feature preserves existing configuration.
- Fixture tests cover eligibility/path boundaries, Unicode names, duplicate business names/branches, null versus zero coordinates, invalid ranges, malformed notes, stale versions, duplicate-save retries, undo, geocoding ambiguity, route failure, timeouts, quotas, cancellation, and vault switching.
- IPC/provider tests cover URL construction, invalid payloads, credential redaction, permission scope, cache rules, agent schemas, and sanitised chat replay. Avoid live provider calls in automated tests.
- Browser/manual checks cover actual map rendering, card selection, saved/replayed cards, narrow widths, theme changes, reduced motion, keyboard use, map disposal, and unavailable tiles/WebGL. Electron checks cover CSP, location granted/denied, packaged assets, external maps handoff, and end-to-end saving into a temporary vault.
- Run the relevant Places/workspace/agent/chat tests, then the existing `npm test` suite. Do not modify the user's live place notes for testing.

Add `docs/features/maps-and-places.md` and update the feature index, Things to ask Smith, vault format, Obsidian-only/setup guides, troubleshooting, privacy, and README once functionality ships. Keep proposed capabilities out of current-feature documentation until then.

## Deferred

Embedded turn-by-turn navigation, live traffic, transport modes beyond walking, reservations, reviews ingestion, background location, automatic visits, automatic bulk coordinate writes, and an Obsidian map plugin. The first release is a focused map, a few useful cards, reliable walking directions, and portable saved places.
