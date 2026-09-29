# Maps and nearby places

Open **Explore → Places** to browse saved places. Ask Smith “Find a quiet coffee shop nearby” to open a map with up to five places, numbered pins, walking times, and place cards. Select a pin to select its card. **Directions** opens walking directions in your preferred maps app; **Open in…** offers Apple Maps and Google Maps.

## Set up

1. Saved places need only the connected vault. New starter vaults include the Places folder, directory, Base, and template. For an older vault without Places, the panel offers **Set up Places**, previews missing files, and adds only those files. Existing files and plugin configuration are preserved.
2. Create a Geoapify account and obtain an API key from [Geoapify](https://www.geoapify.com/). In **Settings → Connectors → Places**, save the key. The key is encrypted on this Mac and is not sent to the chat model or renderer.
3. Optionally save a starting area and choose Apple Maps or Google Maps as the default. A starting area is remembered only when you save it in these settings.
4. For each nearby search, choose a starting address or **Use current location**. Location uses macOS Core Location for one fix, with a 12-second timeout. If permission is denied or no fix is available, enter an address instead. Building from source requires `npm run build:native` for this helper.

The map uses locally bundled MapLibre and Geoapify raster tiles. Search, address lookup, and pedestrian routing use Geoapify. Nearby search starts within 1.5 km; **Widen to 3 km** explicitly expands it. This radius is geographic distance, not a guaranteed walking-time boundary. Panning the map reveals **Search this area**. Saved-note searches and opening directions do not require an AI key.

## Save a place

Choose **Save** on a discovered place card, or ask Smith to save a specific returned result. Orb writes one complete Markdown note in `6. Life Admin/Places` and records the change for undo. A duplicate resolves to the existing note; different branches with the same name need a branch/neighbourhood suffix. Choosing a place or searching never saves automatically.

The schema stays compatible with existing vaults:

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

Category and location are free text. Coordinates are optional decimal numbers; leave unknown values empty. Both valid coordinates are needed for a pin. Notes with an address can be located during a nearby search, or through **Locate on map** on a saved card. Choose the correct match for an ambiguous address. **Save location** is a separate, undoable action; resolving an address does not silently change a note. Additional observations and provider attribution go in the body. Walking times are not written to notes.

In Obsidian, `6. Life Admin/Places.md` embeds `Places.base`, with All, By category, and With coordinates views. Add the Places folder → `99. System/99.1 Templates/10. Place Template.md` mapping in Templater. Set location/website/category to Text and latitude/longitude to Number in Properties. Orb writes full frontmatter itself and does not run Templater. Orb's map needs no Obsidian map plugin.

## Evidence and limits

- Walking minutes come from pedestrian routes. Failed routes display **Walking time unavailable**; straight-line distance is not substituted for walking time.
- “Quiet” can be supported by a quotation from your saved note. Otherwise cards say **Quietness not verified**. Personal observations are not current noise measurements. There are no live occupancy, ratings, or opening-hours claims.
- Invalid or ambiguous coordinates leave a place unpinned; other records still load. The Base's With coordinates view only checks nonempty fields; Orb also validates types/ranges.
- Without a key, or when offline/quota-limited, saved notes and external directions remain available. Failed map tiles or unavailable WebGL leave the cards usable.
- A single search returns up to five places from a bounded shortlist. Saved browsing displays at most 100 matching notes; search to narrow the list. It is not an exhaustive local-business directory.
- Historical chat cards retain destinations and labelled historical walking times, but no device origin or live save handles. Choose a new starting point to refresh before saving a discovery. Opening directions from history uses the maps app's current starting point.
- The provider needs an account and has usage limits. No booking, background tracking, or turn-by-turn navigation runs inside Orb.

## Provider verification and development

Checked 29 September 2026: [Places API documentation](https://apidocs.geoapify.com/docs/places/) describes OpenStreetMap-backed results and unrestricted result storage/caching; [terms](https://www.geoapify.com/terms-and-conditions/) require OpenStreetMap attribution and Geoapify attribution on the free plan. Orb includes both in the panel and provider-derived saved notes. [Routing](https://apidocs.geoapify.com/docs/routing/) supports `walk` and returns time in seconds. [Pricing](https://www.geoapify.com/pricing/) lists a free allowance of 3,000 credits/day and up to five API requests/second; verify current limits in your account. Simple short two-waypoint routes generally cost one credit, and tiles have their own credit conversion. Usage is not unlimited.

The adapter caches bounded JSON results in memory for five minutes and spaces requests; changing vault/provider configuration clears that cache. Map requests are restricted to known tile paths through an Electron protocol handler; the renderer never receives the secret key. MapLibre 6.11.2 is bundled with its licence. `npm run build:maps` refreshes the checked-in assets after an intentional dependency update; packaging runs it automatically.

Browser preview uses clearly labelled fictional places/times over real OpenStreetMap tiles, without a Geoapify key. It does not write the vault. Automated tests use fixture responses and temporary vaults; a real Geoapify key is still needed to validate account-specific search/routing coverage and quotas. Native location is built and module-load checked; actual permission/fix behaviour depends on the target Mac's Location Services.

See [Privacy](../privacy.md) and [Troubleshooting](../troubleshooting.md).
