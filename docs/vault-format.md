# Vault format

[Documentation](README.md) · [Getting started](getting-started.md) · [Sample vault](../vault-template/)

Orb reads files from the chosen vault. Task, goal, and habit features recognize specific frontmatter fields; ordinary Markdown notes remain searchable without them.

## Folder layout

The sample layout is:

```text
0. Home/
  Life Tasks/
    Example errand.md
  Business Tasks/
    Example project task.md
  Goals/
    Example portfolio goal.md
  Habit Log/
    README.md
  Habits.md
  This Week.md
  Goals.md
  Goals.base
  Task Rules.md
Notes/
  Welcome.md
  Example launch options.md
  Example meeting.md
Finance/
  Example savings.csv
99. System/99.4 Scripts/habits/
  view.js
  view.css
Templates/
  Goal Template.md
```

Only the two task folders must exist to save a vault configuration. Set their vault-relative paths in Settings; they must be separate, neither containing the other. If a Task rules note is configured, it must exist and be Markdown. Blank disables that note.

Goals folder defaults to `0. Home/Goals`, can be customized, and must be separate from task folders. It may be absent while other features are used, but must exist before goal creation. Blank disables goals. Existing configurations whose task folders overlap the default goal location start with goals disabled.

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

Use this plain literal syntax with quoted text/colors and spaces after colons. Orb parses it as data and **never executes vault JavaScript**. Computed definitions, expressions, functions, and spread syntax are unsupported. It accepts 1–12 habits, unique lowercase keys (letters/digits/underscores, starting with a letter, up to 64 characters), nonempty labels up to 80 characters, integer targets from 1–7 days/week, cadence text up to 80 characters, and six-digit hex colors. Reserved metadata/prototype keys are rejected. The file limit is 128 KB. Invalid definitions show setup guidance; Orb does not guess a substitute.

Keep keys stable: changing `study_mandarin` does not migrate old records, even if the label stays the same. Targets are not versioned historically; changing a target changes past-week comparisons. Orb generates all controls and new record properties from this array. If extending an older Obsidian dashboard, also update any hard-coded record defaults and table headings there. The sample dashboard generates both from the array.

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
