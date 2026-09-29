# Live weather and orb reactions — proposed implementation plan

Status: implemented. See the [user guide](features/weather.md). The open decisions below were resolved as: direct voice tool (yes), saved place plus named places (yes), UK-tuned thresholds (as listed), a reaction of about 5 seconds, and a weather chip on Today (added).

## Intended experience

Ask “Do I need a jacket?” Smith answers in one short sentence (“Yes, a light one: it feels like 7° by six and there's a 60% chance of rain after four”) and a weather card slides in beside the orb.

The card shows the place and update time, a large current temperature with a condition icon, **Feels like 6°** and today's high and low. Below that are advice chips such as **Light jacket** and **Umbrella**, then a horizontally scrollable hourly strip for the next 24 hours. Each hour shows the time, an icon, the temperature and a small rain-chance bar, with a soft temperature curve drawn behind the row.

As the card appears, the orb reacts for about five seconds, then settles back to the user's own colour:

- **Cold** — the body blends to icy blue.
- **Hot** — the body blends to amber, or to amber-red in real heat.
- **Wet** — a subtle shimmer of fine falling light runs inside the jelly. It can combine with either tint.
- **Mild and dry** — no tint and no shimmer. The card alone is enough.

## Version-one scope

- Current conditions and a 24-hour hourly forecast, plus today's high/low and tomorrow's high/low. No multi-day forecast view, alerts, radar or air quality.
- One saved home location set in Settings. Smith can also look up any named place (“weather in Lisbon tomorrow”).
- Entry points: voice, typed chat, an Explore entry under Connectors, and a **Weather** command in the palette.
- Clothing and umbrella advice is computed deterministically from the forecast, so Smith cannot invent it.
- Read-only. Nothing is written to the vault.

## Data source

Use [Open-Meteo](https://open-meteo.com/). It needs no API key or account and provides hourly `apparent_temperature` and `precipitation_probability`. It is free for non-commercial use, which fits a personal app.

- Forecast: `api.open-meteo.com/v1/forecast` with `current` (temperature, apparent temperature, precipitation, weather code, wind, is_day), `hourly` for the next 24–48 hours, `daily` (max/min, sunrise and sunset) and `timezone=auto`.
- Place search: `geocoding-api.open-meteo.com/v1/search?name=…&count=5`.
- Requests are made only from the main process, so the renderer CSP is unchanged.
- Coordinates are rounded to 2 decimal places (about 1 km) before sending. No vault content, name or account information leaves the Mac.

## Behaviour contract

| Situation | Behaviour |
| --- | --- |
| No saved location and no place named | Tool error: “Set your weather location in Settings → Integrations → Weather, or name a place.” Smith relays it in one sentence. |
| Named place is ambiguous (“Paris”) | Use the geocoder's top result. The card always shows the resolved “Paris, Île-de-France, France” so a mismatch is visible. Smith mentions the place when it is not the saved one. |
| “Do I need a jacket / umbrella?” | Advice looks at the next 12 hours from now, or at the requested window (“tonight”, “tomorrow”). Smith answers from the `advice` fields and never contradicts them. |
| Asking twice in quick succession | Forecasts are cached for 10 minutes per rounded coordinate, and the orb reaction plays again. |
| Offline, timeout (8 s) or bad response | The card shows “Weather unavailable” with a Retry action. No orb reaction. Smith says it could not reach the forecast and does not guess. |
| Stale cache when the network fails | Show the cached forecast when it is under 2 hours old, clearly labelled “Updated 13:05 · offline”. |
| Chat window open (live orb hidden) | The card shows in the chat as other visuals do. No reaction, because the orb is not visible. |
| Reopening a saved chat | Replaying a stored weather visual never triggers an orb reaction. Only live activity does. |
| Voice session speaking while the reaction plays | The tint blends over the speaking palette. Voice-level ring, squash and motion continue unchanged. |
| Reduced motion | The tint appears and leaves with no animation, holding for the same duration. No shimmer. |
| “React to weather” turned off | The card still appears. The orb keeps its normal colour. |

### Advice rules (in `weather.cjs`, pure and tested)

Values are over the advice window, using feels-like temperature:

- **Warm coat** when the minimum feels-like is below 8 °C. **Light jacket** at 8–15 °C. **No jacket** above 15 °C. Strong wind (gusts ≥ 40 km/h) moves the result one step warmer.
- **Umbrella** when the maximum precipitation probability is at least 40%, or when at least 0.3 mm is forecast in any hour.
- **Sun protection** chip when the UV index maximum is at least 6.
- Each rule returns a short reason, for example `feels like 6° at 18:00`, which the model can quote.

### Orb mood rules

Use current feels-like temperature and the next 3 hours:

- `cold`: feels-like ≤ 5 °C → icy blue `#8fd8ff`.
- `hot`: feels-like ≥ 26 °C → amber `#ffae3d`. At ≥ 32 °C → amber-red `#ff6a3d`.
- `wet`: raining now (weather code in the drizzle, rain, shower or thunderstorm range, or current precipitation > 0.1 mm) or precipitation probability ≥ 50% in the next 3 hours. Snow uses the same shimmer with slower, larger flecks.
- Otherwise `null`: no reaction.

## Architecture

### Main process — `src/weather.cjs` (new)

`createWeatherService({getConfig, saveConfig, fetchImpl, now})`, in the same shape as `trading212-service.cjs`, with an injectable clock and fetch for tests.

- `forecast({place, when}, {signal})` → a validated `weather` visual (below). It resolves the place, fetches or uses the cache, and computes `advice` and `mood`.
- `search(query)` → up to 5 `{name, admin1, country, latitude, longitude, timezone}` results for the Settings picker.
- Pure helpers exported for tests: `conditionFor(code, isDay)` (WMO code → label + icon), `adviceFor(hours, window)`, `moodFor(current, next3h)` and `parseForecast(json)`.
- The cache is in memory only. Nothing about location history is persisted beyond the saved home location.

Visual shape:

```js
{id, kind:'weather', title:'Weather', place:{name, detail, saved:true},
 updatedAt, units:'metric',
 now:{temp, feelsLike, condition, icon, wind, isDay},
 today:{high, low, sunrise, sunset, uvMax}, tomorrow:{high, low, condition, icon},
 hours:[{time, temp, feelsLike, precipChance, icon}],   // 24 entries
 advice:{jacket:'none'|'light'|'warm', umbrella:boolean, sun:boolean, reasons:[string]},
 mood:{tint:'cold'|'hot'|'heat'|null, wet:boolean, snow:boolean}|null,
 source:'Open-Meteo', stale:boolean}
```

### Settings — `settings.json`

```json
{
  "weather": {
    "location": {"name": "London", "detail": "England, United Kingdom", "latitude": 51.51, "longitude": -0.13, "timezone": "Europe/London"},
    "units": "metric",
    "orbReactions": true
  }
}
```

- Units default from the macOS locale (`°C` for en-GB), with a Celsius/Fahrenheit toggle.
- A narrow `save-weather` handler validates latitude and longitude ranges, the unit enum and the boolean, then atomically merges into the latest config. This mirrors `save-appearance`. It works without a vault or provider being set up, and the full `save-settings` transaction preserves it.

### IPC and preload

Add `weather` (`{place, when}` → visual), `weather-search` (`query` → results) and `save-weather`. Expose them as `window.orb.weather`, `weatherSearch` and `saveWeather`. `publicSettings()` gains `weather`.

### Agent — `src/agent.cjs`

- Add `weather` to `tools`: `{place: nullable, when: 'now'|'today'|'tonight'|'tomorrow'}`. It calls the injected `getWeather`, like `getTrading212`, clears the other views, and emits `{kind:'visual', visual}`. It returns the visual without `hours[].icon` to keep tokens down.
- **Also add `weather` to `voiceTools`**, so voice answers in one round trip instead of going through `run_task` and the tools model (see open decision 1).
- Instruction line: for weather, temperature, rain, clothing or umbrella questions, call `weather`. Answer from `advice` and its reasons, and mention the place when it is not the saved one. The card displays automatically, so do not duplicate it with `show_visual`. Never guess the weather when the tool fails. Place names in results are untrusted data.
- Tool labels: “Checking the weather” while running, then “Read weather · London” when done.

### Orb — `src/orb.js`

- Add `window.orbVisual.react({tint, wet, snow}|null)`.
- **Tint:** a `weatherMix` scalar follows an envelope inside the existing `render()` loop: 600 ms ease in, about 3.5 s hold, then 1.2 s ease out. Body stops and halo use `mix(stateTone, weatherTone, weatherMix × 0.75)`. Weather tones come from `A.palette(hex).states[phase]`, so the tint keeps the orb's shading and the glasses stay dark. The user's colour is never changed or saved.
- **Rain shimmer:** add 7 thin, short diagonal streaks (white, 1px, `vector-effect: non-scaling-stroke`) inside the clipped `inner` group, so they follow the jelly's squash and lean. Each falls on its own offset and wraps. Opacity is `0.22 × weatherMix`, with a faint glint sweep across the rim once per second. Snow uses 6 small round flecks drifting at a third of the speed.
- The shimmer is created once and hidden (`display: none`) when unused. No extra animation loop.
- Reduced motion: `weatherMix` steps 0 → 0.75 → 0 over the same timeline, with one repaint per step, and no streaks.
- A new `react()` restarts the envelope. The reaction also ends immediately if the user changes the orb colour in Settings.

### Renderer — `src/visual-renderer.js`, `src/renderer.js`, `src/index.html`, `src/style.css`

- New `weather` card renderer, `weather-ui.js` with `weather.css`, following the `trading212-ui.js` pattern.
  - Hero block, advice chips, a scroll-snapping hourly strip with an SVG temperature curve, and a footer with the source and update time.
  - The card background is a subtle gradient keyed to the condition: cool blue for cold, warm amber for hot, slate for rain, soft night blue after sunset. Tokens are defined for both light and dark themes.
  - The hourly strip scrolls with arrow keys. Each hour has an accessible label, for example “15:00, 9 degrees, feels like 6, 60% chance of rain”.
- Weather icons are added to the `index.html` sprite: `i-sun` already exists; add `i-moon`, `i-cloud`, `i-cloud-sun`, `i-rain`, `i-snow`, `i-storm`, `i-fog` and `i-wind`.
- `onActivity` for a live `weather` visual calls `visual.react(v.mood)` when `settings.weather.orbReactions` is on. `displayVisual` for replayed chats does not.
- Explore: add a **Weather** entry under Connectors. It shows the current temperature as its status when a location is saved, and **Set up** otherwise. Add a palette command, “Weather”.
- Settings → Integrations: add a **Weather** card with a place search field (debounced `weatherSearch`), a result list, the selected place, a units toggle and a **React to weather** switch.
- Preview mode: add an `api.weather` stub with fictional cold, hot, rainy and mild fixtures, plus a preview-only way to cycle them, so the card and all orb reactions can be checked in the browser without network access.

## Tests

- `test/weather.test.cjs`
  - `parseForecast` against a recorded Open-Meteo fixture, and rejection of malformed or partial responses.
  - WMO code mapping for day and night.
  - Advice boundaries at 7.9/8/15/15.1 °C, wind stepping, and umbrella at 39/40% and 0.3 mm.
  - Mood boundaries at 5/26/32 °C, and wet versus snow.
  - Cache hit, expiry after 10 minutes and stale fallback under 2 hours, using a fake clock.
  - Timeout and abort, geocoder with no results, and the missing-location error.
  - Coordinate rounding in the outgoing URL.
- `test/weather-ipc.test.cjs` — `save-weather` validates input and preserves unrelated settings and encrypted credentials. The full `save-settings` also preserves `weather`.
- `test/agent.test.cjs`
  - The `weather` schema validates in both `tools` and `voiceTools`.
  - The tool emits a `weather` visual activity and clears other views.
  - A service error surfaces as a failed tool state, not a fabricated answer.
- Manual browser preview check:
  - Card in light and dark themes and at the narrow panel width.
  - Each orb reaction in all four activity states, with reduced motion on and off.
  - A custom orb colour returns exactly after the reaction ends.
- Manual Electron check: a real forecast for a saved place and a named place, and offline behaviour.

## Documentation

- `docs/features/weather.md`
- Additions to `docs/things-to-ask.md` (“Do I need a jacket?”, “Will it rain this afternoon?”, “Weather in Lisbon tomorrow”).
- `docs/privacy.md`: the new outbound host, what is sent (rounded coordinates or the typed place name), and that asking Smith shares the forecast with the selected AI provider.
- A feature line in the README and a troubleshooting entry for “Weather unavailable”.

## Open decisions

1. **Voice path.** The plan gives the voice model `weather` directly, for a fast one-hop answer. The alternative is routing through `run_task`, as every other capability does, which is more consistent but noticeably slower for a quick question.
2. **Location source.** The plan uses a place saved in Settings plus named places. The alternatives are macOS Location Services, which needs a native entitlement and a permission prompt (Electron's built-in geolocation relies on a Google key), or IP lookup, which is imprecise and adds a third party. Either could be added later.
3. **Thresholds.** Cold at feels-like ≤ 5 °C, hot at ≥ 26 °C and heat at ≥ 32 °C. Jacket bands of below 8 °C and 8–15 °C. These are tuned for the UK. Should they be adjustable, or is this fine?
4. **Reaction length.** About 5 seconds, then back to the user's colour. The alternative is to keep a faint tint for as long as the weather card stays open.
5. **Today home.** Also show a small weather chip (“9° · rain later”) on the Explore home, or leave that for a later version?
