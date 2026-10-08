# Habits contributor guide

[User guide](features/habits.md) · [Vault format](vault-format.md#habit-records) · [Development](development.md)

`src/habits.cjs` reads the existing Dataview definitions and daily Markdown records. It exports `listHabits`, `createHabit`, `setHabit`, and `ensureHabitRecord`. The first is read-only; the others use Vault's versioned commit and undo journal. Record writes require the selected record version (null for absence) and a hash of the currently validated habit definitions.

## Definition and record boundaries

The definition reader recognizes a standalone `const habits = [...];` array in the configured visible `.js` file (up to 128 KB). Acorn parses the JavaScript syntax without executing it. Orb accepts exactly one top-level `const habits` array of plain objects with literal key, label, target, cadence and color fields; it validates unique keys, target bounds, labels, cadence, and six-digit colors. Comments and quoted property names are supported. Creation additionally rejects duplicate names after case/whitespace/Unicode normalization. It does not evaluate JavaScript. Computed arrays, functions, spread syntax, or expressions are unsupported and must produce setup guidance. There is no fallback to guessed definitions. Use quoted text/colors and literal numbers as in the sample.

Records are addressed by folder plus exact date filename, matching the existing Obsidian implementation. Date/type metadata disagreements are warnings, not alternate identities. Only strict boolean true is counted. Unsupported values produce warnings and remain unrecorded. Parse/read failures produce unknown-day markers and incomplete-week flags, rather than fabricated completions. Warnings are part of the assistant result as well as the UI.

Reads cover the selected year through today, the 13-week heatmap window (Monday-aligned, ending with the week that contains `end`, capped at today), eight weeks around the current Monday, and the selected date. Missing records are not materialized. Non-date filenames and nested log folders are not considered. The Vault layer enforces file size, path, symlink, and journal boundaries. Optional folders are validated without creating anything. Defaults that overlap older custom task/goal layouts disable habits instead of breaking setup.

Date-only arithmetic uses UTC calendar days to avoid daylight-saving shifts; today comes from the device's local date. Weekly cards use today's week independently of selection. Future dates never count or accept writes. The supported heatmap range starts at 1900.

## Creating definitions

`createHabit` requires `label`, integer `target` (1–7), and `script_version` returned by `listHabits`. It holds the vault task lock, checks the whole script hash, and inserts one serialized object at the parsed array offset without rewriting existing bytes. It generates the key/cadence/color; keys found in any daily record are reserved to avoid reviving removed history. Unreadable daily records block creation with an error. Empty valid trackers return `can_create: true`; disabled, missing or unsupported setup returns false. The 12-habit cap also disables creation.

The journal marks these changes `habitDefinitions`. Commit, recovery and undo allow that type only for the currently configured visible `.js` dashboard, up to 128 KB. Generic note reads and writes remain restricted. Undo checks the saved full-file hash and restores exact previous bytes; changing the configured script path requires switching back before undoing the old script edit. Creation never writes daily records. Existing custom dashboard code stays intact, including any hard-coded columns that need manual adaptation.

## Assistant and UI routing

Voice and typed/deep requests share `list_habits`, `create_habit` and `set_habit` (voice delegates vault requests to the shared tools model). Native `habitsVisual` data goes to `visual-renderer.js`, without model-authored HTML. Direct IPC exposes read, create-definition, set, and create/open record operations; no API key is required for these controls. Main-process sender validation and conversational-write guards apply.

The selected view retains its date/year after writes and undo. Other native/general panels clear habit view state. The panel disables controls while saving, restores keyboard focus after repaint, and exposes date-specific checkbox, progress, and heatmap labels. Its annual grid uses Monday-first columns and arrow-key navigation. Unsafe vault strings are rendered with textContent; colors are validated.

## Verification

Run `node --test test/habits.test.cjs`, then `npm test`. Tests use temporary vaults and cover empty reads, live definition labels, binary counts, backfill, remove, exact undo, record creation, stale/missing versions, changed definitions, malformed YAML, strict booleans, metadata disagreements, week/year/leap/DST boundaries, future dates, source boundaries, optional setup, and native assistant routing.

The browser preview's Today → Open habits route uses explicitly fictional in-memory activity. It supports in-memory creation, toggles, dates, and years for layout checks; it does not test IPC or durable saving. Test the normal 870 × 560 window, scrolling, focus, keyboard navigation, and narrow widths. Test real writes only against a disposable vault. Live OpenAI conversation and actual Obsidian rendering require separate integration checks.

The sample includes a Dataview dashboard whose record properties and recent-week headings are generated from the definitions. Extending a real older dashboard may still require updating its hard-coded record template and table headings; Orb preserves that surrounding script when inserting definitions.

## Validation record — 29 September 2026

- All 62 offline tests passed; documentation relative links passed validation.
- Browser checks at 870 × 560 and 700 × 560 covered logging feedback, date backfill, heatmap selection, arrow-key focus, year navigation, future-date rejection, and overflow with fictional activity.
- The packaged source files matched the working copy. The signed build was installed with a backup, and the native panel was observed reading the configured vault's actual definitions and empty history successfully.
- No test completions were written to the real vault. Durable writes/undo were tested against temporary vaults; actual Obsidian rendering and live conversational writes were not tested.

## Creation validation — 7 October 2026

- All 304 offline tests passed, including temporary-vault definition creation, exact undo, full-script conflicts, injection-shaped labels, capacity, historical key collisions, and trusted IPC creation from an empty tracker.
- Browser preview checks at 870 × 560 and 700 × 560 covered creation, required frequency, duplicate feedback, refresh and restored keyboard focus. No browser errors were observed.
- All durable writes used disposable vaults; browser activity was fictional and in memory. The Apple Silicon app was subsequently rebuilt, ad-hoc signed, installed with a backup, and reopened. Packaged habit sources matched the workspace; Acorn and the native modules were included. The installed Add habit form was observed against the configured vault without submitting a habit. Live AI conversations and actual Obsidian rendering remain unverified.
