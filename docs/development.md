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
| [agent.cjs](../src/agent.cjs) | Assistant instructions, tool schemas, OpenAI requests, tool dispatch, and panel refresh after changes. |
| [vault.cjs](../src/vault.cjs) | File boundary checks, note search/reads, task records, versioned writes, journal, and undo. |
| [goals.cjs](../src/goals.cjs) | Goal records, link resolution, managed narrative sections, and review writes. |
| [habits.cjs](../src/habits.cjs) | Validated Dataview habit definitions, date-based activity, weekly totals, and versioned logging. |
| [today.cjs](../src/today.cjs) | Read-only aggregation of daily tasks, goals, habits, and calendar state with isolated section failures. |
| [calendar.cjs](../src/calendar.cjs) | iCal sources/cache/recurrence, task dates, source warnings, and calendar query results. |
| [google-calendar.cjs](../src/google-calendar.cjs) | Full Calendar local API, connected Google calendars, event reads, validation, and creation. |
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
| `query_calendar`, `create_calendar_event` | [Calendar](features/calendar.md): reads plus explicit single-event creation. |
| `search_notes`, `find_files`, `read_note`, `append_note` | [Notes](features/notes.md): keyword retrieval and append-only general note writes. |
| `read_spreadsheet`, `show_visual`, `dismiss_visual` | [Spreadsheets and visuals](features/spreadsheets-and-visuals.md): bounded data and source-backed presentation. |
| `undo_change` | [Changes and undo](features/changes-and-undo.md): version-checked note restoration. |
| `think_deeply` | [Planning](features/planning.md): voice can delegate complex work to the reasoning backend. |

Voice uses `gpt-realtime-2.1`; typed/deeper reasoning uses `gpt-6-sol`. The reasoning backend cannot recursively call `think_deeply`, runs with sequential tool calls, and has a bounded 12-step response loop. Permanent keys remain in the main process. Use [agent tests](../test/agent.test.cjs) for API mocks, cancellation, and refresh behavior; do not introduce credentials into fixtures.

## Data and write contracts

Keep note bodies and tool results as untrusted reference data. Only user requests authorize edits. Task conventions from the explicitly configured rules note are a separate trusted input. Requests for plans should not silently create commitments.

The vault layer rejects traversal and symbolic links, reads versions before edits, and journals writes. Preserve unknown properties and unrelated body content. Goal reviews combine the check-in and goal metadata in one note edit; multi-note workflows are separate writes. A cancellation or later failure does not roll back completed writes. Calendar creation is external and outside note undo.

Dates have different meanings: task Planned is intended work, task Deadline is a real latest date, goal Target is adjustable, and goal Review drives an explicit check-in workflow. Do not conflate them. [Vault format](vault-format.md) owns the supported schema; [Privacy](privacy.md) owns the storage/network description.

## UI preview and manual validation

For a UI-only preview, serve `src` from the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory src
```

Open `http://127.0.0.1:8765` in a browser. The preview starts on Explore. Open Today to test the fictional daily aggregation, then use **Open habits** for in-memory logging and heatmaps. Explore suggestions route through fictional preview answers. You can also type “Show my goals”, “Show my calendar”, or “Chart my savings”. The preview does not connect to your vault, call the assistant, save settings, or test voice. It is not an implementation of all cookbook prompts. Stop the server with Control-C when finished.

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

It copies the native module beside the packaged app resources. `dist`, tests, scripts, the sample vault, and other excluded development files are not included as runtime source. The repository excludes generated bundles and native binaries.

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
