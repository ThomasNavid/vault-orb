# Development

[Documentation](README.md) · [Contributing](../CONTRIBUTING.md) · [Project home](../README.md)

## Requirements and commands

Use an Apple Silicon Mac with Node.js 24+, npm, and Xcode Command Line Tools. From the repository root:

```sh
npm ci
npm test
npm run build:native
clang++ -std=c++17 native/shortcut-test.cc -o /private/tmp/orb-shortcut-test
/private/tmp/orb-shortcut-test
npm start
```

Offline tests use temporary vaults, fictional fixtures, and mocked API responses. They do not require an API key or prove live model conversation behavior. Run focused tests with, for example, `node --test test/goals.test.cjs` during implementation, then the full suite for a code change.

The native build script resolves Node headers beside the installed Node binary and compiles the shortcut as an N-API module. Install a Node distribution including headers if they cannot be found. The module checks public modifier-state APIs and rejects gestures combined with other keys/buttons. It does not create an event tap or record typed text.

## Source map

| File | Responsibility |
| --- | --- |
| [main.cjs](../src/main.cjs) | Electron lifecycle, window, settings/credential storage, trusted IPC, shortcuts, and request cancellation. |
| [preload.cjs](../src/preload.cjs) | Narrow bridge between the isolated renderer and main process. |
| [appearance.js](../src/appearance.js), [appearance-settings.js](../src/appearance-settings.js), [orb.js](../src/orb.js) | Shared palette/validation, appearance draft/save lifecycle and controls, and SVG orb rendering. |
| [agent.cjs](../src/agent.cjs) | Assistant instructions, shared tool dispatch, bounded model loops, and panel refresh after changes. |
| [vault.cjs](../src/vault.cjs) | File boundary checks, note search/reads, task records, versioned writes, journal, and undo. |
| [goals.cjs](../src/goals.cjs) | Goal records, link resolution, managed narrative sections, and review writes. |
| [habits.cjs](../src/habits.cjs) | Validated Dataview habit definitions, date-based activity, weekly totals, and versioned logging. |
| [focus.cjs](../src/focus.cjs) | Focus session timer: one session with absolute start and end times, pause/extend, and `focus.json` persistence and restore. Also validates the optional task link or title. |
| [today.cjs](../src/today.cjs) | Daily aggregation with linked-block reconciliation before task reads with isolated section failures. |
| [calendar.cjs](../src/calendar.cjs) | iCal sources/cache/recurrence, task dates, source warnings, and calendar query results. |
| [google-calendar.cjs](../src/google-calendar.cjs) | Full Calendar local API, connected Google calendars, event lookup, validation, creation, editing, and linked-block removal. |
| [weather.cjs](../src/weather.cjs) | Open-Meteo forecast and place search, a 10-minute cache with a 2-hour offline fallback, deterministic jacket/umbrella/sun advice, orb mood thresholds, and `settings.json` weather validation. |
| [weather-ui.js](../src/weather-ui.js), [weather.css](../src/weather.css) | Weather card, Today chip helper, and the Settings → Connectors → Weather place search. |
| [trading212.cjs](../src/trading212.cjs) | Credential helpers, fixed read-only API endpoints, response projection, caching, rate limits and history pagination. |
| [trading212-ui.js](../src/trading212-ui.js), [trading212.css](../src/trading212.css) | Settings connector, companion/chat financial views, pagination controls and fictional preview. |
| [spreadsheet.cjs](../src/spreadsheet.cjs) | Bounded Excel/CSV/TSV inspection and reads. |
| [visuals.cjs](../src/visuals.cjs) | Chart/table validation and native task, goal, and calendar visual construction. |
| [visual-renderer.js](../src/visual-renderer.js) | DOM/SVG presentation, source links, goal filters, and calendar interactions. |
| [renderer.js](../src/renderer.js) | WebRTC voice session, typed messages, UI state, activity, and preview fixtures. |
| [orb.js](../src/orb.js) | Jelly Orb: layered SVG, spring motion, pointer attraction, and per-state looks behind `window.orbVisual.setState/setLevel`. `react({colour,wet,snow})` plays the roughly five-second weather tint and rain or snow shimmer without changing the saved colour. |
| [index.html](../src/index.html), [style.css](../src/style.css) | Interface structure and styling. |
| [native/shortcut.cc](../native/shortcut.cc) | Native Control gesture listener. |
| [reminders.cjs](../src/reminders.cjs), [reminders-ui.js](../src/reminders-ui.js), [native/reminders.mm](../native/reminders.mm) | Per-vault three-way Reminders sync, connector setup and native EventKit bridge. Sections are not exposed by Apple's API. |

Main/renderer isolation, restricted navigation, and the local preload bridge keep filesystem and permanent credential access in the main process. Native goal/task/calendar panels are created directly from tool results. General visuals accept validated data, not executable HTML or scripts.

## Assistant name

The assistant is **Smith (Agent Smith)**, a playful nod to *The Matrix*. The shared `instructions()` function in [agent.cjs](../src/agent.cjs) sets this identity for chat/tools, deeper reasoning, and Realtime voice. Independent voice uses the same chat agent. Conversational interface text uses Smith, including **Ask Smith**, **Talk to Smith**, **Draft with Smith**, and transcript labels.

**Vault Orb** remains the product name. Keep app identifiers, storage paths, vault layouts, `/orb`, and technical `orb` names stable when updating assistant-facing copy. The name does not select a different model or speech voice; those remain provider settings.

## Assistant tool map

| Tools | User guide / contract |
| --- | --- |
| `list_tasks`, `create_task`, `update_task` | [Tasks](features/tasks.md): two lists, exact fields, explicit completion. |
| `list_goals`, `create_goal`, `update_goal`, `review_goal` | [Goals](features/goals.md): outcome → task → recorded review. [Internals](goals.md). |
| `list_habits`, `set_habit` | [Habits](features/habits.md): shared daily logs, local controls, and heatmaps. [Internals](habits.md). |
| `weather` | [Weather](features/weather.md): forecast card, advice and orb reaction. Also a direct realtime voice tool beside `run_task`, so quick weather questions skip delegation. Main exposes `weather`, `weather-search` and `save-weather` IPC. |
| `trading212` | [Trading 212](features/trading212.md): read account data and render a financial card; no order mutations. History continuation needs the returned `nextPagePath` and `connectionId`. |
| `query_calendar`, `create_calendar_event` | [Calendar](features/calendar.md): reads, single-event edits, and [linked scheduling](features/task-scheduling.md). |
| `search_notes`, `find_files`, `read_note`, `append_note` | [Notes](features/notes.md): keyword retrieval and append-only general note writes. |
| `read_spreadsheet`, `show_visual`, `dismiss_visual` | [Spreadsheets and visuals](features/spreadsheets-and-visuals.md): bounded data and source-backed presentation. |
| `start_focus`, `focus`, `log_focus` | [Focus sessions](features/focus-sessions.md): one timer in the main process. A length alone starts a plain timer. A task link is optional and needed only for logging. Logging only happens on request, and a finished session never completes the task. |
| `undo_change` | [Changes and undo](features/changes-and-undo.md): version-checked note restoration. |
| `run_task`, `think_deeply` | [Planning](features/planning.md): Realtime delegates to chat/tools; chat can delegate to an optional reasoning model. |

Existing settings default to OpenAI `gpt-realtime-2.1` and `gpt-6-sol`. `ai-settings.cjs` validates model roles and migrates the legacy encrypted key when settings are saved. `providers.cjs` adapts OpenAI Responses and OpenRouter Chat Completions, preserving native reasoning state across tool turns. Realtime exposes only `run_task`, delegating vault work to chat/tools. Optional `think_deeply` routes to the reasoning model and cannot recurse. Nested work shares a 12-request budget, with sequential tool execution, argument validation, and per-request call-ID deduplication. `speech.cjs` and `speech-client.js` implement the interruptible Deepgram/ElevenLabs pipeline; recognition and playback buffers are memory-only. Permanent keys remain in the main process. Use [agent tests](../test/agent.test.cjs) for API mocks, cancellation, and refresh behavior; do not introduce credentials into fixtures.

## Task results and graph context

Within one assistant request, `agent.cjs` combines `list_tasks` reads for today and overdue when their dates and completion filters match and the task view is still current. The request budget tracks the previous view; a new request starts fresh. `taskSections` keeps today first and past deadlines below in `visual-renderer.js`, including after edits and undo. Tool results still return the individually requested scope.

`KnowledgeGraph.tasks()` builds a separate graph from displayed task rows, deduplicating exact task paths across sections and connecting them to their displayed areas. `knowledge-ui.js` chooses task or knowledge data from the active view and resets focus/search/type/Hub/unlinked filters on context changes. Task previews use the displayed dates and open the original note; area nodes cannot open a note. `chat.js` keeps background chat results from replacing the active graph context.

Regression coverage in `test/agent.test.cjs` checks both task-query orders, refresh after completion, and a subsequent overdue-only request. `test/knowledge.test.cjs` checks task graph membership, overlapping-section deduplication, paths, dates and empty results. Browser checks should reproduce Knowledge → Computing local graph → today and overdue → to-do graph, then switch to overdue-only and empty lists, verifying stale focus/search filters are cleared. These fixtures do not prove live model query selection or Obsidian opening.

## Orb appearance

`appearance.js` is shared by CommonJS and the browser. It validates canonical `#RRGGBB` values, supplies the default/presets, and derives per-state shading, including grayscale colours. Existing blue palettes and decorative colours remain exact defaults. `orb.js` interpolates the live body colours and publishes shared CSS variables for the rim, reflections, shadow and chat marks/glows. Explore, chat suggestion, command-menu and footer icons use `--orb-idle-mid` for their strokes, with transparent backgrounds and no tile shadows; preview, discard and saved colours therefore update existing icons together. Each mark keeps independent SVG gradients so it renders while the live orb is hidden. Reduced-motion colour changes repaint immediately.

`appearance.js` also carries the layout choice, `appearance.view`, as either `classic` or `bar`. The renderer puts `view-bar` on `<body>`; everything the bar needs is CSS, so the markup, the orb and every panel stay shared between the two layouts. In the bar, `paintStatus()` gives one line to either the status or a live caption: `setCaption()` is fed by transcript messages and, where the model sends them, by `conversation.item.input_audio_transcription.delta`, and any status change other than `speaking` clears it, so thinking and tool steps still get their words. There is one ask field and one tool track, not two of each: `placeBarParts()` moves `#ask-form` and `#tool-orbit` into the bar in that layout, and back into the panel header and the orb stage in the classic one, so the combobox wiring and `updateToolActivity()` — creation, status, pruning — are shared. In the bar the moons are laid out as a static flex row rather than rotated onto the orbit, CSS keeps the last eight (`:nth-last-child(n+9)`), and the hover tip gives way to the status line's own step label and the Steps view below. `paintStatus()` also mirrors the activity state onto `.orb-home`, which drives the sweeping hairline on the bar's lower edge, so working is visible even while the field holds the middle slot. `bar-typing` on `<body>` decides whether the bar's middle slot shows the status line or that field; it is turned on by a click on the status line, by ⌘K, or by a printable key pressed while the bar stands alone, and turned off by Escape, by closing the panel, by any view other than Explore or Conversation, and by starting a voice conversation. With the field in the bar, the panel header names only the views that carry no heading of their own. The main process reads the same `appearance.view` to size and place the window: a bar is 680 wide, 76 tall alone and 620 with a panel, anchored by its top-left corner so it grows downwards and keeps a position it was dragged to. Chat and reader windows are unaffected. Switching layouts while the window is visible re-places it immediately.

The local `settings.json` stores `appearance.orbColour`. Missing or malformed stored colours read as blue; an unknown `appearance.view` reads as `classic`, and a `save-appearance` that omits `view` keeps the saved layout, so applying a colour never moves Smith. Trusted `save-appearance` IPC validates a new colour and atomically merges it into the current config without vault validation or assistant reinitialisation. Full `save-settings` accepts the same field in its transaction; callers omitting it preserve the saved colour. Neither path changes unrelated credentials. `appearance-settings.js` tracks the saved baseline, reversible preview and pending save; leaving Settings discards an unapplied draft and late responses cannot reopen the editor.

Run `node --test test/appearance*.test.cjs` for palette/validation, draft lifecycle, failure handling, configuration preservation and IPC persistence tests. The IPC tests execute real handlers and temporary disk writes with Electron's OS surfaces mocked, including a fresh startup against saved settings. Browser checks should cover presets, custom extremes, all activity states, existing/new chat marks, reduced motion, invalid input, reset/discard, and keyboard access at the app's 870 × 560 expanded size, plus both layouts: the bar alone, the bar with the palette below it, a live caption from each speaker, the collapsed and unfolded control cluster, a muted microphone, the step dots and working line during and after a run, and the typing slot — click, ⌘K, type-to-start, the Escape ladder, and the field returning to the panel header when the classic layout comes back. Verify native picker behaviour and relaunch persistence in Electron before distributing a build.

## Data and write contracts

Keep note bodies and tool results as untrusted reference data. Only user requests authorize edits. Task conventions from the explicitly configured rules note are a separate trusted input. Requests for plans should not silently create commitments.

The vault layer rejects traversal and symbolic links, reads versions before edits, and journals writes. Preserve unknown properties and unrelated body content. Goal reviews combine the check-in and goal metadata in one note edit; multi-note workflows are separate writes. A cancellation or later failure does not roll back completed writes. Calendar creation is external and outside note undo.

Dates have different meanings: task Planned is intended work, task Deadline is a real latest date, goal Target is adjustable, and goal Review drives an explicit check-in workflow. Do not conflate them. [Vault format](vault-format.md) owns the supported schema; [Privacy](privacy.md) owns the storage/network description.

## UI preview and manual validation

For a UI-only preview, serve `src` from the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory src
```

Open `http://127.0.0.1:8765` in a browser. The preview starts on Explore. Open Today to test the fictional daily aggregation, then use **Open habits** for in-memory logging and heatmaps. Explore suggestions route through fictional preview answers. You can also type “Show my goals”, “Show my calendar”, “Show my Trading 212 portfolio”, or “Chart my savings”. Explore → Trading 212 opens fictional investments directly, including dividend pagination and year filtering. Settings → Appearance supports colour preview, reset and Apply colour in memory until reload, and Layout switches between the classic orb and the top bar in memory too (the browser preview cannot resize the window, so the bar simply fills the page width). The preview does not connect to your vault, call the assistant, persist settings, or test voice. It is not an implementation of all cookbook prompts. Stop the server with Control-C when finished.

The expanded app is normally 870 × 560, reduced to fit smaller screens. Check overflow, keyboard access, source links, filter states, warning/empty states, and readable chart values. Reload static previews after source changes.

For live validation, use Electron and a disposable copy of the sample vault. Test reading, one task change, goal creation/review, and undo. Only test a real calendar write against a calendar you intend to change; remove the event through its calendar app. Record which steps were live and which were mocked.

## Build and install

The native build also compiles `orb-reminders.node` against EventKit and Foundation. The packaged app includes `NSRemindersFullAccessUsageDescription`; connection requires macOS 14+. Running in an Electron development host without that usage description reports an error instead of invoking the permission API. Native store calls run on the main queue and check reminder versions before writes. Offline tests inject a mock adapter; native compilation and packaging do not validate live iCloud propagation. See the [Reminders guide](features/apple-reminders.md) for a disposable-list check.

Build a local app:

```sh
npm run package
```

The prepackage step builds the native module. Packaging produces:

```text
dist/Vault Orb-darwin-arm64/Vault Orb.app
```

It copies the native module beside the packaged app resources. The clean `vault-template` ships with the app for first-run creation. `dist`, tests, scripts, private `vault-example`, and local editor configuration are excluded. The repository excludes generated bundles and native binaries.

**Building does not replace an installed app.** To update the existing copy at `~/Applications/Vault Orb.app`, quit all running Orb copies and run from the repository root:

```sh
codesign --force --deep --sign - "dist/Vault Orb-darwin-arm64/Vault Orb.app"
orb_backup_dir=$(mktemp -d /private/tmp/vault-orb-backup.XXXXXX)
mv "$HOME/Applications/Vault Orb.app" "$orb_backup_dir/Vault Orb.app.backup"
ditto "dist/Vault Orb-darwin-arm64/Vault Orb.app" "$HOME/Applications/Vault Orb.app"
"/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister" -f "$HOME/Applications/Vault Orb.app"
```

Verify the copy succeeded before removing the generated duplicate and reopening the installed app:

```sh
rm -rf "dist/Vault Orb-darwin-arm64"
open "$HOME/Applications/Vault Orb.app"
```

Keep the backup location in `orb_backup_dir` until you have verified the update; the previous app is in that temporary backup directory. The support directory containing settings and keys is separate from the app bundle. Spotlight may list both copies until the duplicate build is removed.

For a first installation, copy the built app to your preferred Applications folder instead of running the existing-copy `mv` command. The optional [scripts/install.py](../scripts/install.py) installs to `~/Applications`, refuses to overwrite an existing app, and changes local Dock preferences after backing them up. Review it before use.

The bundle identifier is `app.vaultorb.desktop`. An older local build with a different identifier may need fresh macOS permissions or API key entry. Ad-hoc signing above is for local use; it is not a notarized public release or a distribution-signing process. Signed/notarized public builds are not currently provided.

## Documentation validation

Keep feature examples aligned with source and fixtures, and verify local Markdown links/anchors after moving pages. Sample-vault wikilinks use Obsidian conventions; documentation links use relative repository paths so they work on GitHub and in a checkout. Use fictional screenshots. [CONTRIBUTING.md](../CONTRIBUTING.md) lists the documentation updates expected with a feature change.

## Starter vault and private reference

`src/workspace.cjs` creates a new exclusive destination from the bundled `vault-template`. Never copy the private `vault-example` wholesale: it is ignored by Git and excluded from packaging. Keep the starter allowlist limited to Markdown, Bases, reviewed dashboard JS/CSS, and folder placeholders. Never include plugin settings, credentials, personal records, finance features, or third-party PDFs.

`src/knowledge.cjs` provides tagged knowledge listing and explicit creation with validated relationships and the shared undo journal. `test/workspace.test.cjs` covers creation, overwrite refusal, required structure, and package exclusions; `test/knowledge.test.cjs` covers relationships and writes. The static UI preview cannot test native directory dialogs or persistent settings.

The standalone guide is shipped both as `docs/obsidian-only.md` and `vault-template/99. System/Obsidian Setup.md`; keep them in sync.

## Knowledge browser and graph

`src/knowledge.cjs` owns tagged record discovery, wikilink/Markdown relationship resolution, bounded context, versioned capture/workbench/link writes, suggestion dismissal and Portfolio backlink creation. `src/knowledge-ui.js` provides the local browser, capture/creation forms, workbench, suggestions, previews and expandable corner graph. `src/knowledge-graph.js` renders a bounded SVG force layout with filtering, pan/zoom, drag and keyboard node selection; `src/knowledge.css` scopes its styles. No runtime graph library or remote script is loaded.

Trusted IPC exposes `knowledge`, `knowledge-note`, `knowledge-write` (an allowlist of three write actions), and `knowledge-dismiss`. Assistant tools expose `list_knowledge`, `create_knowledge`, `knowledge_context`, `knowledge_sources`, `knowledge_graph`, `update_knowledge`, and `connect_knowledge` to voice and typed requests. Reading the graph is local; learning/synthesis runs through the existing assistant. `today.cjs` includes explicitly dated knowledge revisits independently of other sections.

Multi-note Portfolio creation prevalidates sources, saves the output, then writes backlinks using the sources' captured versions. It returns `changes` and `warnings`; agent dispatch publishes every successful write. There is no cross-file transaction or automatic rollback. An unsuccessful backlink must not cause the output to be recreated. Undo backlinks before creation if reversing the entire operation.

The browser preview has fictional knowledge fixtures, including an unfiled note, and in-memory capture/stage/link actions. It does not run an AI quiz or generate a real draft; those buttons route into the existing simulated chat. Validate file semantics with `node --test test/knowledge.test.cjs test/today.test.cjs`. Check 870 × 560 and smaller layouts, graph expand/collapse, type/Hub/local filters, keyboard controls, capture, selection, suggestions, and workbench edits. Full `npm test` remains required. Live voice/model calls and Obsidian opening need separate integration checks.

## Trading 212 connector

`trading212.cjs` retains the GET-only host/endpoint allowlist, credential helpers, projection, short cache, pacing, bounded responses and cancellation. Capability checks cover all six implemented reads. `trading212-numbers.cjs` preserves JSON numeric lexemes (including int64 identifiers) and provides rational decimal arithmetic before display rounding. Private account IDs are removed from UI/model summaries.

`trading212-service.cjs` owns opt-in settings, account identity, connect/disconnect, pause/resume/rescan and local export/deletion. Main exposes trusted `trading212`, `trading212-connect` and `trading212-tracking` IPC; the latter is not an assistant tool. Export uses a native save dialog. Account identity is a hash of environment, broker ID and currency; runtime `connectionId` still isolates pagination. Saved cards include account identity and reject another account on refresh.

`trading212-store.cjs` uses Node's built-in SQLite (verified in Node 24 and Electron 41). Schema version 1 stores authenticated encrypted JSON payloads with a local key protected by safeStorage; indexes retain opaque identities, kinds and timestamps. Transactions atomically checkpoint pages and observations. Revised source events retain immutable evidence versions; current ledger rows are upserted without double counting. An unknown newer schema or missing key fails closed. Detailed holdings expire after 90 days; summary/event evidence remains. No database is created by untracked browsing.

`trading212-sync.cjs` has its own abort controller, independent of chat/window hiding. It captures approximately every five minutes (one minute for an active view), scans one page per history endpoint per step, persists continuation checkpoints, detects cursor loops and upserts source references. Because the beta API does not specify event ordering, scans run to exhaustion before advancing verified coverage. Repeated scans detect revised records but are not atomic broker snapshots. A large scan can lag current values; metrics select a covered closing observation and disclose its time. Resume schedules work; quit/disconnect/delete cancel it before further writes.

`trading212-metrics.cjs` shares period calculations and income queries between UI and assistant. Calendar boundaries use the configured IANA timezone. Period gain excludes classified external flows; funding periods use an estimated Modified Dietz denominator. Five-minute opening tolerance is explicitly estimated. Missing cash/fill coverage, unknown transfers, capture-boundary funding, inconsistent totals or currencies block unsupported returns. Value charts include funding; return charts do not. Query results include requested/actual ranges, evidence, method, coverage and freshness. Charts and model evidence are bounded; full records are available via explicit export.

The single read-only `trading212` assistant tool accepts existing raw views plus `performance` and `query`, with metric, period, optional custom dates, instrument and grouping. It cannot enable tracking or mutate the account. The dashboard uses the same service and metrics without an AI request. `trading212-ui.js` supplies period/income controls, accessible chart data tables, holdings search/detail, loaded activity filters and saved-card handling.

Run `node --test test/trading212.test.cjs test/trading212-performance.test.cjs`, then `npm test`. Fictional tests cover decimal/identity precision, return accounting, DST, missing coverage, encrypted persistence/tamper detection, interrupted sync, account/key changes, opt-in storage, deletion/export and capability failures. A 5,000-observation fixture exercises bounded chart output. Browser preview covers fictional overview, performance/income, holdings/detail and activity; it cannot verify credentials or native encryption. Package/runtime, macOS key storage and read-only broker comparisons require separate verification, and must never put personal balances in fixtures or logs.

## Calendar-linked scheduling

`scheduling.cjs` coordinates availability, a single block per non-recurring task, note/event identity, refresh reconciliation, removal, and explicit repair. `calendar-time.cjs` resolves IANA wall times independently of the device timezone and rejects DST gaps/folds. Working days/hours are validated in settings. `calendar.cjs` bypasses feed cache for availability, blocks incomplete/truncated results, joins completion onto linked events, and avoids duplicate Planned entries. Today reconciles before collecting task dates.

Full Calendar Remastered's [public REST contract](https://github.com/obsidian-full-calendar-remastered/plugin-full-calendar/blob/main/docs/architecture/api/rest-server.md) provides GET/PUT/DELETE by event ID. Creation returns a boolean, so scheduling journals a unique description marker before POST and reads it back. The adapter preserves other event fields and verifies the selected provider against the open vault. REST data is plugin-cached; the API does not expose an atomic reservation or conditional update. Matching Google iCal feeds are required for recurrence coverage during availability checks.

Tools: `find_task_time`, `schedule_task`, `move_task_block`, `remove_task_block`, `repair_task_block`, `read_calendar_event`, and `update_calendar_event`. Read operations can reconcile previously authorized links. Standalone event editing uses a freshly read version. Calendar journal entries reject ordinary undo; completion remains undoable. Partial writes remain pending and are never blindly replayed. The in-process scheduling lock serializes scheduling operations for a vault; note version checks protect external edits, but are not a cross-device transaction.

Run `node --test test/scheduling.test.cjs test/calendar.test.cjs test/today.test.cjs`, then `npm test`. Fixtures emulate the documented plugin payloads and use no credentials or live writes. For live validation use a disposable vault/test calendar, refresh Full Calendar after Google moves, and follow the [scheduling walkthrough](features/task-scheduling.md#walkthrough). Do not report mock tests as live Google verification.

## Recurring tasks

`src/recurrence.cjs` is the host-independent calendar engine and YAML-preserving note transformation. `recurring-ui.cjs` supplies one native DOM interface used in Orb and Dataview. `recurring-obsidian.cjs` uses current file contents through Obsidian's `vault.process()` and desktop filesystem lock; Orb uses its journaled commit path. `task-lock.cjs` serializes supported writes on a local vault. Ordinary editor writes and separate sync devices are outside that protocol.

Run `npm run build:recurring` after changing those modules. It generates the app bundle and the identical self-contained Obsidian bundle, including YAML's license; no network or runtime package install is needed. These generated JavaScript assets are intentionally committed. `npm run check:recurring` verifies freshness. The Obsidian CSS is distributed with the template too; keep it identical to `src/recurring.css`.

`test/recurrence.test.cjs` covers cadence, date edges, immutable anchors, portable history/reversal, malformed records, conflict/duplicate handling, both file adapters, bundle parity and additive installation. Browser preview supports in-memory recurrence creation and editing via Explore → Recurring tasks. Tests of the Obsidian file API use a filesystem-backed adapter double; they are not proof of a live Dataview installation. Validate desktop Obsidian with a disposable vault before describing live plugin compatibility as tested. Mobile controls are not supported in this version.

## Web Clippings

`clippings.cjs` indexes visible Markdown under `4. Knowledge Library/Web Clippings` independently of the Knowledge graph. It normalises optional metadata, scans full note bodies in bounded batches, ranks AND/phrase matches, applies filters, and returns pages of 30 with revision and coverage information. A WeakMap scopes the in-memory index to each Vault instance; invalidation prevents in-flight scans from installing stale data. Refresh is explicit for external edits.

Trusted IPC exposes `clippings`, `clipping-note`, and `clipping-source`; the latter rereads the exact clipping and opens only a validated HTTP(S) source URL. No arbitrary URL-opening IPC is added. `search_clippings` shares retrieval with the UI and delegates evidence reading to the existing `read_note` tool. `clippings-ui.js` and `clippings.css` provide the library, filters, inert previews and fictional browser fixtures.

Run `node --test test/clippings.test.cjs test/clippings-ipc.test.cjs` and `npm test`. Temporary-vault tests cover content beyond the preview limit, metadata, filters, pagination beyond 2,000 notes, incomplete coverage, refresh, vault isolation, trusted IPC and assistant retrieval. Browser checks should cover body search, category/date/source/Topic filters, missing results, keyboard navigation, narrow layouts and inert captured markup. IPC mocks and browser fixtures do not verify live Obsidian opening or model-generated answers.

## Focus sessions

`FocusTimer` in `focus.cjs` owns the only session. Main creates it with `userData/focus.json`, restores it on launch, and re-arms it when the Mac wakes. It sends `{session, event}` on the `focus` IPC channel. It is not sent as `activity`, so a finishing session is never attached to a chat turn. Main also updates the tray title, shows the orb with `showInactive()` when a session finishes, and posts a notification if the app is not focused. The trusted `focus` handle covers status, start, pause, resume, extend, stop and dismiss. Its `log` and `done` actions go through `agent.execute`, so the change is journaled and panels refresh.

`orb.js` exposes `orbVisual.setFocus({durationMs, endsAt, pausedAt})` and `orbVisual.celebrate()`. The ring is drawn in the existing render loop from absolute timestamps. With reduced motion, a one-second ticker redraws it instead. `renderer.js` mirrors the session on the idle status line and inline controls, and renders the setup and finish cards through `renderVisual` with `kind:'focus'`. In the browser preview, focus sessions count seconds instead of minutes, so typing “focus” or pressing a task-row clock shows the ring and celebration quickly.

Run `node --test test/focus.test.cjs`. It covers the timer state machine with a fake clock, restore after restart, target validation, Focus log placement and undo, and the agent tools.

## AI daily planner

`day-planner.cjs` collects a read-only snapshot, creates manual drafts, validates preferences and allocates continuous task intervals after merging busy time. It reuses exported scheduling availability helpers and `calendar-time.cjs`; snapshot calendar reads skip reconciliation. `day-planner-ai.cjs` uses the existing provider adapter with only `submit_day_plan`, bounded context, schema and identity validation, and one repair attempt. `day-plans.cjs` owns vault-scoped cached drafts, remembered preferences (`preferences.json`: start, end, buffer, scope, breaks; applied to new drafts, updated on preference edits), managed Markdown plans, revision-bound reviews, serial apply and durable recovery. A persisted booking UUID is passed into the existing scheduler so retry never posts a second event for a pending operation.

Trusted `day-planner` IPC and the draft-only `plan_day` assistant tool share the same service. Planner sessions cannot delegate or mutate; an assistant turn that enters daily planning cannot subsequently call mutation tools. `day-planner-ui.js` renders the same panel in companion and chat views as an eight-step flow (`STEPS`: hours, tasks, energy, breaks, free time, priorities, estimates, your day) with progress dots, Back/Continue, and an apply screen over the last step. Hours and free time are held locally and committed when you move on, so typing never redraws the field. It also contains fictional browser fixtures. `day-planner.css` scopes its dark-theme styles.

Run `node --test test/day-planner.test.cjs`, then `npm test`. Coverage includes interval union, reserves, fragmentation, timezones, estimate metadata preservation, model validation, read-only drafting, stale revisions, partial writes, cancellation and restart recovery. Browser checks cover each step of the flow, remembered hours on a new date, estimate editing and the apply review; these are simulated fixtures. Live AI, Full Calendar and Google behaviour require separate disposable-vault checks.

## Maps and Places implementation

`places.cjs` owns portable vault records, `places-provider.cjs` wraps Geoapify, and `places-service.cjs` resolves origins/results and constructs directions. `places-ui.js` shares the map/card component between companion and chat. Main-process IPC handles writes and external links; a narrowly validated `orbplaces://tiles/…` handler keeps the Geoapify key out of the renderer. `native/location.mm` provides one-shot macOS Core Location through N-API; `build:native` builds it and packaging includes both native helpers.

MapLibre assets are bundled under `src/vendor/maplibre` with their licence. After upgrading the pinned dependency, run `npm run build:maps`. Browser preview includes fictional Places fixtures and real OpenStreetMap tiles; the normal app requests Geoapify tiles. Run `node --test test/places*.test.cjs` for record, provider, service, and trusted IPC coverage, then `npm test`.
