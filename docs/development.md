# Development

[Documentation](README.md) · [Contributing](../CONTRIBUTING.md) · [Project home](../README.md)

## Requirements and commands

Use an Apple Silicon Mac with Node.js 22+, npm, and Xcode Command Line Tools. From the repository root:

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
| [agent.cjs](../src/agent.cjs) | Assistant instructions, shared tool dispatch, bounded model loops, and panel refresh after changes. |
| [vault.cjs](../src/vault.cjs) | File boundary checks, note search/reads, task records, versioned writes, journal, and undo. |
| [goals.cjs](../src/goals.cjs) | Goal records, link resolution, managed narrative sections, and review writes. |
| [habits.cjs](../src/habits.cjs) | Validated Dataview habit definitions, date-based activity, weekly totals, and versioned logging. |
| [today.cjs](../src/today.cjs) | Daily aggregation with linked-block reconciliation before task reads with isolated section failures. |
| [calendar.cjs](../src/calendar.cjs) | iCal sources/cache/recurrence, task dates, source warnings, and calendar query results. |
| [google-calendar.cjs](../src/google-calendar.cjs) | Full Calendar local API, connected Google calendars, event lookup, validation, creation, editing, and linked-block removal. |
| [trading212.cjs](../src/trading212.cjs) | Credential helpers, fixed read-only API endpoints, response projection, caching, rate limits and history pagination. |
| [trading212-ui.js](../src/trading212-ui.js), [trading212.css](../src/trading212.css) | Settings connector, companion/chat financial views, pagination controls and fictional preview. |
| [spreadsheet.cjs](../src/spreadsheet.cjs) | Bounded Excel/CSV/TSV inspection and reads. |
| [visuals.cjs](../src/visuals.cjs) | Chart/table validation and native task, goal, and calendar visual construction. |
| [visual-renderer.js](../src/visual-renderer.js) | DOM/SVG presentation, source links, goal filters, and calendar interactions. |
| [renderer.js](../src/renderer.js) | WebRTC voice session, typed messages, UI state, activity, and preview fixtures. |
| [orb.js](../src/orb.js) | Jelly Orb: layered SVG, spring motion, pointer attraction, and per-state looks behind `window.orbVisual.setState/setLevel`. |
| [index.html](../src/index.html), [style.css](../src/style.css) | Interface structure and styling. |
| [native/shortcut.cc](../native/shortcut.cc) | Native Control gesture listener. |

Main/renderer isolation, restricted navigation, and the local preload bridge keep filesystem and permanent credential access in the main process. Native goal/task/calendar panels are created directly from tool results. General visuals accept validated data, not executable HTML or scripts.

## Assistant tool map

| Tools | User guide / contract |
| --- | --- |
| `list_tasks`, `create_task`, `update_task` | [Tasks](features/tasks.md): two lists, exact fields, explicit completion. |
| `list_goals`, `create_goal`, `update_goal`, `review_goal` | [Goals](features/goals.md): outcome → task → recorded review. [Internals](goals.md). |
| `list_habits`, `set_habit` | [Habits](features/habits.md): shared daily logs, local controls, and heatmaps. [Internals](habits.md). |
| `trading212` | [Trading 212](features/trading212.md): read account data and render a financial card; no order mutations. History continuation needs the returned `nextPagePath` and `connectionId`. |
| `query_calendar`, `create_calendar_event` | [Calendar](features/calendar.md): reads, single-event edits, and [linked scheduling](features/task-scheduling.md). |
| `search_notes`, `find_files`, `read_note`, `append_note` | [Notes](features/notes.md): keyword retrieval and append-only general note writes. |
| `read_spreadsheet`, `show_visual`, `dismiss_visual` | [Spreadsheets and visuals](features/spreadsheets-and-visuals.md): bounded data and source-backed presentation. |
| `undo_change` | [Changes and undo](features/changes-and-undo.md): version-checked note restoration. |
| `run_task`, `think_deeply` | [Planning](features/planning.md): Realtime delegates to chat/tools; chat can delegate to an optional reasoning model. |

Existing settings default to OpenAI `gpt-realtime-2.1` and `gpt-6-sol`. `ai-settings.cjs` validates model roles and migrates the legacy encrypted key when settings are saved. `providers.cjs` adapts OpenAI Responses and OpenRouter Chat Completions, preserving native reasoning state across tool turns. Realtime exposes only `run_task`, delegating vault work to chat/tools. Optional `think_deeply` routes to the reasoning model and cannot recurse. Nested work shares a 12-request budget, with sequential tool execution, argument validation, and per-request call-ID deduplication. `speech.cjs` and `speech-client.js` implement the interruptible Deepgram/ElevenLabs pipeline; recognition and playback buffers are memory-only. Permanent keys remain in the main process. Use [agent tests](../test/agent.test.cjs) for API mocks, cancellation, and refresh behavior; do not introduce credentials into fixtures.

## Data and write contracts

Keep note bodies and tool results as untrusted reference data. Only user requests authorize edits. Task conventions from the explicitly configured rules note are a separate trusted input. Requests for plans should not silently create commitments.

The vault layer rejects traversal and symbolic links, reads versions before edits, and journals writes. Preserve unknown properties and unrelated body content. Goal reviews combine the check-in and goal metadata in one note edit; multi-note workflows are separate writes. A cancellation or later failure does not roll back completed writes. Calendar creation is external and outside note undo.

Dates have different meanings: task Planned is intended work, task Deadline is a real latest date, goal Target is adjustable, and goal Review drives an explicit check-in workflow. Do not conflate them. [Vault format](vault-format.md) owns the supported schema; [Privacy](privacy.md) owns the storage/network description.

## UI preview and manual validation

For a UI-only preview, serve `src` from the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory src
```

Open `http://127.0.0.1:8765` in a browser. The preview starts on Explore. Open Today to test the fictional daily aggregation, then use **Open habits** for in-memory logging and heatmaps. Explore suggestions route through fictional preview answers. You can also type “Show my goals”, “Show my calendar”, “Show my Trading 212 portfolio”, or “Chart my savings”. Explore → Trading 212 opens fictional investments directly, including dividend pagination and year filtering. The preview does not connect to your vault, call the assistant, save settings, or test voice. It is not an implementation of all cookbook prompts. Stop the server with Control-C when finished.

The expanded app is normally 870 × 560, reduced to fit smaller screens. Check overflow, keyboard access, source links, filter states, warning/empty states, and readable chart values. Reload static previews after source changes.

For live validation, use Electron and a disposable copy of the sample vault. Test reading, one task change, goal creation/review, and undo. Only test a real calendar write against a calendar you intend to change; remove the event through its calendar app. Record which steps were live and which were mocked.

## Build and install

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

`src/trading212.cjs` owns credential validation/encryption helpers, the fixed GET-only API allowlist, data projection, bounded responses, cancellation, per-endpoint queues, short caches, pagination validation and response-level rate limits. `main.cjs` provides trusted `trading212` and `trading212-connect` IPC. Connection testing and saving only read the account summary. `connectionId` is an opaque identifier for the in-memory client, not an account number or credential; cursors from another client are rejected. `fromStart=false` marks a continuation page, and `complete=true` means the returned records cover the full history. The renderer preserves this distinction when appending pages or opening saved chat cards. Connection changes preserve unrelated settings; disconnect aborts clients and clears backend caches. Temporary test clients are bounded to three and remain in memory until replaced, disconnected, or the app exits.

`src/trading212-ui.js` renders the native visual in both companion and chat views; `trading212.css` styles the dashboard. The Settings connection is saved separately from vault/model settings, so it can be configured without an AI key. Explore opens it directly; the `trading212` assistant tool returns projected data and emits the same visual. The voice model delegates through `run_task`. Financial tool output never contains credentials. No API order mutation or report-generation endpoint is exposed.

Run `node --test test/trading212.test.cjs` and the full `npm test`. Tests use fictional responses and cover authentication boundaries, encryption unavailable, retained settings, pagination destinations, incomplete sections, cache/pacing, 401/403/429 failures, malformed/oversized responses, cancellation and assistant integration. Browser preview includes fictional overview, holdings, dividend pagination/year filtering, trades, cash movements and empty pending orders. Check 870 × 560 and narrower views, Settings controls and horizontal table scrolling. Real credentials, macOS credential storage and live provider behaviour need a separate integration check; never use personal financial data in test fixtures.

## Calendar-linked scheduling

`scheduling.cjs` coordinates availability, a single block per non-recurring task, note/event identity, refresh reconciliation, removal, and explicit repair. `calendar-time.cjs` resolves IANA wall times independently of the device timezone and rejects DST gaps/folds. Working days/hours are validated in settings. `calendar.cjs` bypasses feed cache for availability, blocks incomplete/truncated results, joins completion onto linked events, and avoids duplicate Planned entries. Today reconciles before collecting task dates.

Full Calendar Remastered's [public REST contract](https://github.com/obsidian-full-calendar-remastered/plugin-full-calendar/blob/main/docs/architecture/api/rest-server.md) provides GET/PUT/DELETE by event ID. Creation returns a boolean, so scheduling journals a unique description marker before POST and reads it back. The adapter preserves other event fields and verifies the selected provider against the open vault. REST data is plugin-cached; the API does not expose an atomic reservation or conditional update. Matching Google iCal feeds are required for recurrence coverage during availability checks.

Tools: `find_task_time`, `schedule_task`, `move_task_block`, `remove_task_block`, `repair_task_block`, `read_calendar_event`, and `update_calendar_event`. Read operations can reconcile previously authorized links. Standalone event editing uses a freshly read version. Calendar journal entries reject ordinary undo; completion remains undoable. Partial writes remain pending and are never blindly replayed. The in-process scheduling lock serializes scheduling operations for a vault; note version checks protect external edits, but are not a cross-device transaction.

Run `node --test test/scheduling.test.cjs test/calendar.test.cjs test/today.test.cjs`, then `npm test`. Fixtures emulate the documented plugin payloads and use no credentials or live writes. For live validation use a disposable vault/test calendar, refresh Full Calendar after Google moves, and follow the [scheduling walkthrough](features/task-scheduling.md#walkthrough). Do not report mock tests as live Google verification.

## Recurring tasks

`src/recurrence.cjs` is the host-independent calendar engine and YAML-preserving note transformation. `recurring-ui.cjs` supplies one native DOM interface used in Orb and Dataview. `recurring-obsidian.cjs` uses current file contents through Obsidian's `vault.process()` and desktop filesystem lock; Orb uses its journaled commit path. `task-lock.cjs` serializes supported writes on a local vault. Ordinary editor writes and separate sync devices are outside that protocol.

Run `npm run build:recurring` after changing those modules. It generates the app bundle and the identical self-contained Obsidian bundle, including YAML's license; no network or runtime package install is needed. These generated JavaScript assets are intentionally committed. `npm run check:recurring` verifies freshness. The Obsidian CSS is distributed with the template too; keep it identical to `src/recurring.css`.

`test/recurrence.test.cjs` covers cadence, date edges, immutable anchors, portable history/reversal, malformed records, conflict/duplicate handling, both file adapters, bundle parity and additive installation. Browser preview supports in-memory recurrence creation and editing via Explore → Recurring tasks. Tests of the Obsidian file API use a filesystem-backed adapter double; they are not proof of a live Dataview installation. Validate desktop Obsidian with a disposable vault before describing live plugin compatibility as tested. Mobile controls are not supported in this version.
