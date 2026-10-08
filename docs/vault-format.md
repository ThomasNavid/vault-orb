# Vault format

[Documentation](README.md) · [Getting started](getting-started.md) · [Sample vault](../vault-template/)

Orb reads files from the chosen vault. Task, goal, and habit features recognize specific frontmatter fields; ordinary Markdown notes remain searchable without them.

## Folder layout

New vaults use the fixed starter layout:

```text
0. Home/                 Home, Today, Life Tasks, Business Tasks, Goals, Habit Log
1. Portfolio/            Your thinking and outputs
2. Hubs/                 Broad maps of interests
3. Topics/               Focused subjects
4. Knowledge Library/    Source and learning notes, with source-type subfolders
5. Archives/             Inactive material
6. Life Admin/           Non-financial career documents and certificates
99. System/              Templates, scripts, setup guides, assistant guidance
README.md                Standalone vault guide
```

**Create new…** creates all required folders and view files automatically. **Connect existing…** validates the standard structure without modifying it. The paths shown in Settings are read-only. Existing saved installations retain their previous folder configuration, including any disabled optional features; there is no automatic relocation or conversion of those notes. Missing files in an older vault can still produce feature-specific setup guidance.

The starter has no tasks, goals, habit definitions, or completed knowledge notes. Folder placeholder files only preserve empty directories in source control and are omitted when Orb creates a vault. See [Knowledge](features/knowledge.md) and the [Obsidian guide](obsidian-only.md) for the knowledge properties, links, and plugin setup.

General tools do not traverse outside the vault, hidden paths, or symbolic links. They skip common generated directories such as `node_modules` and `dist`. Calendar integration has a specific reader for its Full Calendar plugin settings; this does not make hidden files generally searchable.

## Task properties

A task is one `.md` file within a configured task folder. The filename is the title.

```yaml
---
type: task
category: Inbox
planned: null
due: null
completed: false
---
```

| Property | Meaning and supported values |
| --- | --- |
| `type` | Must be exactly `task` for recognition. |
| `category` | Optional grouping text. Missing displays as Inbox. |
| `planned` | Optional intended work date/time; blank/null means unset. |
| `due` | Optional genuine deadline; labeled Deadline in Orb. |
| `completed` | Boolean `true` means complete; absent is treated as unfinished. Use booleans, not quoted text. |
| `venture` | Optional work/project label, such as Example Studio. New business tasks include it. |

New tasks include the basic fields above. Existing unknown properties and body content are retained when updating supported fields. Initial body details can be supplied on creation, and later text can be appended.

`planned` and `due` accept local `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss` strings. Orb's write validation rejects invalid calendar dates and local times. Use a date only when you mean a day rather than an hour. Clear a date by requesting its removal.

“Today” means an unfinished task planned **or** due on today's local date. “Past deadlines” means an unfinished task with `due` before today. A past planned date alone is not overdue. A task with no dates remains visible in all-tasks views.

Task titles cannot be renamed through the task-edit tool, and a task cannot be moved between lists through it. Make structural changes in Obsidian. Checkbox syntax and Bases display labels do not change this schema.

## Goal properties

A goal is a `.md` file inside the configured Goals folder, with the filename as its title:

```yaml
---
type: goal
status: Active
target: null
review: 2026-10-05
next_task: "[[0. Home/Business Tasks/Example project task]]"
---
```

| Property | Meaning and supported values |
| --- | --- |
| `type` | Must be exactly `goal`. |
| `status` | Exactly Active, Paused, Someday, or Achieved. |
| `target` | Optional date-only `YYYY-MM-DD`; a planning target, not a deadline. |
| `review` | Optional date-only `YYYY-MM-DD`; active goals with no date need attention. |
| `next_task` | Optional quoted wikilink to an existing task. Full paths prevent ambiguous titles. |

Quote wikilinks in YAML. Existing unique short links and aliases can resolve; missing or ambiguous matches are flagged. New assignments require an exact `.md` task path in one of the configured task folders, with the task unfinished. Paths containing wikilink delimiters must be renamed before they can be assigned unambiguously.

Use these level-two headings in the body:

```markdown
## Finish line

What observable result would mean the goal is achieved?

## Why it matters

## Starting point and milestones

## Weekly check-ins
```

The Finish line prompt above is a template placeholder; replace it with a concrete outcome. Orb requires a finish line when creating a goal and can write the other narrative sections when requested. Heading spelling matters for the managed section reader/editor. Other sections and unknown frontmatter are preserved.

A saved check-in appends a dated `### YYYY-MM-DD` entry with Progress, Obstacle, and Decision and next action. It updates the goal's metadata in the same journaled write. See [Goals](features/goals.md) for Review defaults, inactive states, and undo.

## Habit records

A record is an exact `YYYY-MM-DD.md` file directly inside the configured Habit log folder (default `0. Home/Habit Log`). Orb matches the vault dashboard's folder/filename lookup; nested records and other filenames do not count. Keep `date` consistent with the filename.

```yaml
---
type: habit-log
date: 2026-09-28
pull_ups: false
study_mandarin: true
---
```

The habit keys above are examples. New records include every currently defined habit, defaulting to false, plus a date heading, a link back to Habits, and a Notes section. Only an actual YAML boolean `true` counts, once per habit per calendar day; quoted `"true"`, `yes`, numbers, false, and missing values do not count. False/missing means not recorded, not proof of a skip. Orb warns about unsupported values, unreadable notes, and metadata that disagrees with the filename.

Checkbox or voice edits change one property, preserving unrelated properties/comments and the note body. Writes use current record and definition versions and the existing undo journal. Future dates are not accepted or counted. The calendar is local and weeks run Monday–Sunday. Merely viewing a day creates nothing; explicitly opening a missing daily record creates it with all habits false.

Habit log, goal, and task folders must be separate. The log can be absent during Settings setup but must exist before using habits. Blank disables habits; older layouts overlapping the default habit location start disabled. See [Habits](features/habits.md) for UI behavior and limitations.

## Habit definitions

The Habit dashboard script setting defaults to `99. System/99.4 Scripts/habits/view.js`. Orb reads a standalone literal array from that visible file:

```js
const habits = [
  { key: "pull_ups", label: "Pull-ups", target: 7, cadence: "Daily", color: "#31995b" },
  { key: "study_mandarin", label: "Study Mandarin", target: 2, cadence: "Twice a week", color: "#6387db" }
];
```

Use this plain literal syntax with quoted text/colors. Comments and quoted property names are supported. Orb parses the script syntax with Acorn and reads only the literal definition fields; it **never executes vault JavaScript**. Chat and the Add habit form insert a definition into this array, preserving surrounding code, with a whole-script version check and undo. Computed definitions, expressions, functions, and spread syntax are unsupported. It accepts 0–12 habits (zero is the empty starter state), unique lowercase keys (letters/digits/underscores, starting with a letter, up to 64 characters), nonempty labels up to 80 characters, integer targets from 1–7 days/week, cadence text up to 80 characters, and six-digit hex colors. Reserved metadata/prototype keys are rejected. The file limit is 128 KB. Invalid definitions show setup guidance; Orb does not guess a substitute.

Keep keys stable: changing `study_mandarin` does not migrate old records, even if the label stays the same. Targets are not versioned historically; changing a target changes past-week comparisons. Orb generates all controls and new record properties from this array. If extending an older Obsidian dashboard, also update any hard-coded record defaults and table headings there. The starter dashboard generates both from the array.

The script's own `ROOT` path controls Obsidian's record lookup, while Orb uses Settings. Keep those paths aligned when customizing. Dataview and JavaScript query enablement are needed for Obsidian rendering only; Orb does not change those settings.

`This Week.md` is a manual Markdown planning page with chosen weekly outcomes and previous weeks. It is not a task database and has no automatic reset. See [Goals and This Week](features/habits.md#goals-and-this-week).

## Task conventions and templates

The configured Task rules note supplies assistant guidance, such as which grouping labels you prefer. It cannot change the hard-coded field names or configured folders. Set paths in Settings and use the supported fields above. Only put instructions you intend Orb to follow in that conventions note.

Orb reads Markdown directly; it does not interpret arbitrary `.base` queries. The sample Goals.base displays the same goal notes in Obsidian. If you use a different folder, update that Base's filters separately.

The manual Goal Template works with Obsidian's core Templates plugin after you set its template folder. Folder-triggered automatic templates require your own plugin configuration. Orb's goal creation writes a complete note without running a template script.

## Other files

Markdown content search scans `.md` notes. Filename discovery also supports `.txt`, `.xlsx`, `.csv`, and `.tsv`. Plain text is readable; spreadsheets require the bounded reader described in [Spreadsheets and visuals](features/spreadsheets-and-visuals.md). PDF/image contents and legacy `.xls` are not parsed.

Task/goal parse errors are returned as warnings. Do not assume a list is complete if some notes could not be read. A goal with unsupported status or invalid dates needs correction in its source note.

Implementation: [vault.cjs](../src/vault.cjs), [goals.cjs](../src/goals.cjs), [habits.cjs](../src/habits.cjs), and [spreadsheet.cjs](../src/spreadsheet.cjs).

## Knowledge relationships and workbench fields

The [Knowledge guide](features/knowledge.md) describes the browser, capture, Portfolio workbench and graph. Each note needs its matching `hub`, `topic`, `knowledge` or `portfolio` tag in the corresponding numbered folder. Quote wikilinks in YAML. A Topic's `hub` points to a Hub; a Library note's `topic` points to its main Topic. An unfiled Library capture has `topic: null`. Additional body links are relationships, not primary filing.

Optional fields used by Orb:

```yaml
tags: [portfolio]
hub: "[[2. Hubs/Computing]]"
topic: "[[3. Topics/Computer Architecture]]"
stage: Developing # Idea | Developing | Ready
reason: Explain the basics clearly
revisit: 2026-10-06 # user-chosen date, never automatically advanced
```

Library notes can also have `source` (http/https URL), `reason`, and `revisit`. An absent Portfolio `stage` displays as Idea without changing the file. The workbench uses `<!-- orb:Working draft -->` / `<!-- /orb:Working draft -->` and equivalent `Open questions` markers for the sections it edits, preserving original content outside them.

Creating a Portfolio note with supporting Library paths writes outgoing citations and appends a `Supports: [[1. Portfolio/Title]]` backlink to each source. These are separate undoable writes. This maintains the template's incoming-link Dataview list. Linking a Library source to an existing Portfolio note can also populate that list.

## Apple Reminders task fields

Apple Reminders sync adds an independent `reminders_key` UUID to linked task notes. Preserve it when renaming the original note; remove it from copies intended to become distinct tasks. The full mapping, previous synced values and recovery state live in the local app's `reminders/` directory. The connector leaves `planned`, body text and unrelated YAML intact when syncing completion/deadline changes. See [Apple Reminders](features/apple-reminders.md).

## Calendar-linked task fields

[Task scheduling](features/task-scheduling.md) adds optional `task_id` (UUID) and `calendar_block` YAML to a non-recurring task. Unlinked notes need no migration. Preserve these fields when renaming a task; do not duplicate the UUID when copying one.

```yaml
task_id: 11111111-1111-4111-8111-111111111111
calendar_block:
  id: 22222222-2222-4222-8222-222222222222
  calendar_id: connected-provider-id
  remote_calendar_id: google-calendar-id
  event_id: plugin-event-id
  state: linked
  start: 2030-01-07T10:00:00
  end: 2030-01-07T10:45:00
  timezone: Europe/London
  previous_planned: null
  planned: 2030-01-07T10:00:00
```

`start`/`end` are event-zone wall times; `planned` is the last synchronized value in the Mac's local timezone. `previous_planned` is restored when the block is removed. Recovery states are `creating`, `moving`, and `removing`; a creating block can have a null event ID, and a moving block also carries `target_start`/`target_end`. Orb owns these fields and preserves unrelated YAML/body content. The opaque block UUID also appears in the event description to recover identity after uncertain writes or a plugin cache reload. No token, feed URL, task body, or vault path is stored in the event marker.

## Recurring task properties

Optional `recurrence` (version 1) and `recurrence_history` extend the existing task note. One note represents a series; current dates stay in `planned`/`due`. The full behaviour and UI are documented in [Recurring tasks](features/recurring-tasks.md).

```yaml
recurrence:
  version: 1
  mode: fixed
  unit: week
  interval: 1
  weekdays: [monday]
  date_field: planned
  anchor: 2026-10-05
  occurrence: 2026-10-05
recurrence_history: []
```

`mode` is `fixed` or `completion`; `unit` is `day`, `week`, `month`, or `year`; `interval` is an integer 1–1000. `weekdays` is nonempty only for fixed weekly schedules. Dates are local date-only values. `anchor` retains the fixed cadence, and `occurrence` identifies the nominal current slot even when its actual date is postponed. Completion-relative rules update both to their next slot. Linked `calendar_block` metadata and recurrence cannot be used together.

Each history entry has an operation `id`, action, request fingerprint, effective local `date`, UTC `recorded_at`, and before/after snapshots of the occurrence state and dates. An `undo` entry references the reversed operation. Both Obsidian and Orb use these records for portable undo and duplicate prevention; this is independent of Orb's private Activity journal. Preserve history and its identifiers when editing notes manually.

Desktop Obsidian assets are in `99. System/99.4 Scripts/recurring-tasks`; its `config.md` holds the task folders. Dataview JavaScript provides controls; plain Bases checkboxes do not calculate recurrence. A direct completed mark on an active rule is pending reconciliation, never an inferred completion date. No read operation advances recurrence.

## Web clipping search

Orb searches visible Markdown recursively within `4. Knowledge Library/Web Clippings`, including untagged notes. The starter dashboard is excluded. Keep captures in Websites, Videos, or X Posts and preserve `source`, optional `author`/`type`/`topic`/`tags`, and `created` as the capture date. A `title` property overrides the display filename, and a valid HTTP(S) `url` property is accepted when `source` is unavailable. These are read-time conventions; browsing never migrates existing notes. See [Web Clippings](features/web-clippings.md) for accepted dates, aliases, missing-metadata behaviour, and limits.

## Focus log

Logging a [focus session](features/focus-sessions.md) appends one line under a `## Focus log` heading in the task note. The heading is created at the end of the note if it is missing:

```markdown
## Focus log

- 2026-09-29 14:30 · 25 min — Outlined the three sections
```

Each line holds the local date and time, the whole minutes, and an optional single-line note of up to 500 characters. New lines go at the end of the section, before any later heading. Nothing is added to the frontmatter. Each entry is a separate, undoable change.

## Daily planning

Task notes may include optional `estimated_minutes`, a whole number from 1 to 10080 representing estimated remaining work. Missing values remain unknown. Planner edits stay in a draft until the user chooses to save an estimate; AI suggestions are labelled. Other task properties and note bodies are preserved.

Saved plans live in optional `0. Home/Daily Plans/YYYY-MM-DD.md` notes with `type: day-plan`, `plan_schema: 1`, `plan_id`, `plan_revision`, `date`, and `timezone`. A managed section between `<!-- orb-day-plan:v1 -->` and `<!-- /orb-day-plan -->` contains the readable plan; text outside it is preserved. Its proposed times do not imply calendar bookings or completed work. The folder is created on first save and is not required to connect an existing vault. See [AI daily planner](features/daily-planner.md).

## Places

`6. Life Admin/Places/<Place Name>.md` uses `type: place`, free-text `category` (default `Uncategorized`), free-text `location`, optional `website`, and optional decimal-number `latitude`/`longitude`. Unknown coordinates stay empty; a map pin needs both valid numbers. Latitude is −90…90; longitude −180…180. Additional notes go in the body. Orb preserves custom fields when saving a resolved location and journals writes for undo. The sibling `Places.md` directory embeds `Places.base`; the Base includes only Markdown place notes inside the Places folder and provides All, By category, and With coordinates views.

The template is `99. System/99.1 Templates/10. Place Template.md`. Templater applies it in Obsidian when mapped to the folder; agents and Orb must write complete YAML themselves. Older vaults without Places remain valid. See [Maps and nearby places](features/maps-and-places.md).
