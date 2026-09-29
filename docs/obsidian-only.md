# Use the vault in Obsidian

You can use the complete file-based system without Vault Orb or an OpenAI account. Orb is an optional assistant; Markdown notes, properties, links, templates, and dashboards live in your vault.

## Open the same folder

In Obsidian's vault switcher, choose **Open folder as vault** and select the folder created by Orb. Do not import or copy each note. Open `0. Home/Home.md` in Reading view or Live Preview. If you only want Obsidian, copy the entire starter folder from the repository to a location you control, then open that copy.

Keep the numbered folders and script paths. Renaming them requires updating templates, queries, and Orb's expectations together. Use descriptive filenames within the folders. No personal data, plugin binaries, `.obsidian` settings, credentials, financial features, or third-party reference PDFs are bundled.

## Plugins and settings

Enable **Bases** in Obsidian's Core plugins for editable task and goal tables. Properties, internal links, and Backlinks supply the underlying editing and navigation. Use an Obsidian release that supports Bases.

Install community plugins through **Settings → Community plugins → Browse**, then enable them:

| Plugin | Needed for | Setup |
| --- | --- | --- |
| Dataview | Home summaries, knowledge backlinks, upcoming tasks, habit controls and heatmaps | Enable **JavaScript Queries** in Dataview settings; inspect the bundled scripts before enabling execution. |
| Templater | Automatic templates when creating notes in the supported folders | Set Template folder location to `99. System/99.1 Templates`; enable **Trigger Templater on new file creation** and configure Folder Templates below. |
| Full Calendar Remastered | Optional embedded calendar and calendar integrations | Configure your own providers. See Calendar Setup in `99. System`. |

The reference setup used Dataview 0.5.68, Templater 2.16.2, and Full Calendar Remastered 0.13.6. These are reference versions, not guaranteed minimums. Labels can vary by plugin release. **Charts is not needed**: its finance dashboard has been removed, and habit heatmaps use the bundled Dataview view.

Orb's own task/goal/habit panels do not require Dataview or Templater. Orb's connected Google Calendar operations do require the Full Calendar plugin and an open Obsidian instance. Markdown reading and editing work without community plugins; dynamic queries and dashboards require their listed plugins.

## Templater folder mappings

Select these paths in Templater's Folder Templates settings. Template paths below are relative to `99. System/99.1 Templates`.

| Folder | Template |
| --- | --- |
| `1. Portfolio` | `1. Portfolio Template.md` |
| `2. Hubs` | `2. Hub Template.md` |
| `3. Topics` | `3. Topic Template.md` |
| `4. Knowledge Library` and its source subfolders | `4. Knowledge Template.md` |
| `0. Home/Life Tasks` | `6. Life Task Template.md` |
| `0. Home/Business Tasks` | `7. Business Task Template.md` |
| `0. Home/Goals` | `9. Goal Template.md` |

Use the Library parent mapping if your Templater release applies it to subfolders; otherwise add explicit mappings for the source subfolders you use. Verify by creating one disposable note in a Library subfolder and checking its properties. Folder templates apply to new files created in Obsidian, not retroactively. Do not apply a Knowledge template to index pages or apply a task template to Habit Log. Orb writes complete records directly and does not run Templater.

For manual use, create a note in the correct folder and run **Templater: Insert template**, then fill its properties. If you see literal `<% tp.file.title %>`, run Templater's replace-templates command or replace it with your title. Avoid applying the same template twice. You can also write the documented YAML properties yourself; no plugin is required for the record format.

## First five minutes

1. Create a Hub in `2. Hubs` and a Topic in `3. Topics`. Set the Topic's `hub` property to a quoted wikilink to your Hub.
2. Create a Knowledge note in the relevant Library subfolder. Set `topic`, retain the source URL and author when known, and write your learning notes.
3. Open the Topic, then the Hub. Dataview lists notes linking back to each page. A body link counts too.
4. Develop an original idea or explanation in Portfolio. Cite the supporting Library notes under Related Documents. The automatic Portfolio knowledge list only shows Library notes that link back to that Portfolio note.
5. Create a Life or Business task with the matching template. See it in Home's editable Base; tick Done only when completed.

The starter contains no tasks, goals, habit definitions, or completed knowledge outputs. Writing prompts in templates are guidance, not your content.

## Daily and weekly use

Start at Home or Today. `planned` is when you intend to work; `due` is a genuine deadline. Today includes either date, with past deadlines shown separately. Keep one note per task. Use Category for your own grouping and Venture for business/project labels.

Goals describe outcomes, with an observable Finish line, status (Active, Paused, Someday, Achieved), optional target, review date, and `next_task` link to a Life/Business task. In Obsidian alone, choose review dates yourself and append progress, obstacle, and decision under Weekly check-ins. Completing the next task does not automatically achieve its goal. Missing review dates need attention.

Choose your own habits in `99. System/Habit Setup.md`; then use the dashboard or edit boolean properties in daily Habit Log records. No habit history is inferred. The habit dashboard creates records on an explicit toggle/open action, not just by viewing. This Week is a manual planning and history page; move last week's objectives to History and choose new ones yourself.

Calendar is optional and separate from tasks. Read `99. System/Calendar Setup.md` before connecting a provider. Calendar events and task dates do not automatically synchronise. Web Clipper is a separate optional browser extension; its setup guide is included.

## Leaving Orb

Quit or uninstall Orb and keep your vault folder. No export or conversion is required. Your notes, task/goal metadata, habit history, source links, templates, and Obsidian dashboards remain usable. Dataview computes its lists from files; Bases edits those same files.

Voice, AI assistance, Orb's panels, its conversation history, encrypted API credentials, and its edit/undo journal belong to the app, not to the Markdown vault. Obsidian edits do not appear in Orb's undo journal. Orb's safe undo refuses to overwrite notes changed externally. Use Obsidian's editing history and your own backups for changes outside Orb. Calendar accounts and plugin settings must be configured independently; they are not exported by copying the starter.

Keep a separate backup: sync alone is not versioned backup. An external assistant can use `99. System/Assistant Guide.md` when you explicitly provide it; that document is not automatically installed as another tool's system prompt.

## Troubleshooting

- Query code appears as text: use Reading view or Live Preview, enable Dataview, and enable JavaScript Queries for the scripted dashboards.
- Task tables do not render: enable Bases and check that the `.base` files and task folders are present.
- A note is absent: check its folder, tags and links; tasks need `type: task`, goals need `type: goal`. Quote YAML wikilinks.
- A Portfolio source is absent: its automatic table uses incoming links from Library notes. Outgoing citations alone do not add it.
- Habits are empty: follow Habit Setup and refresh. This is the expected initial state.
- Calendar is empty: connect your own sources. No calendar credentials are included.
- A template is not applied: check the exact folder mapping and trigger setting; use Insert template manually for existing files.

## Recurring tasks without Orb

Open `0. Home/Recurring Tasks.md` with desktop Obsidian and Dataview JavaScript enabled. Create and configure repeats, complete or skip occurrences, adjust dates, stop repeating, view history and undo entirely in Obsidian. The engine and history travel with the vault; Orb and internet access are not required. Mobile currently supports reading these records, not the editing controls. See [Recurring tasks](features/recurring-tasks.md) and the vault's `99. System/Recurring Tasks Setup.md` for existing-vault installation and custom task folders.

## Places

Open `6. Life Admin/Places.md` for the editable Places Base. Map the Places folder to `10. Place Template.md` in Templater, use Text properties for category/location/website and Number for latitude/longitude, and leave unknown coordinates blank. All, By category, and With coordinates work without Orb. Maps, address lookup, and nearby search are provided by Orb with an optional Geoapify connection; no Obsidian map plugin is installed.
