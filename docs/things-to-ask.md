# Things to ask Smith

[Documentation](README.md) · [Getting started](getting-started.md)

Smith (Agent Smith) is the assistant in Vault Orb. Use **Ask Smith** or **Talk to Smith** to make a request.

These are copyable examples of supported requests, checked against the app's tools and behavior. They are not fixed commands, exhaustive phrasing rules, or transcripts of live model tests. Smith may ask for missing details or an exact note path. Speech and typing support the same feature requests.

The [starter](../vault-template/) begins empty. Names below are illustrative, not included records. Create your own tasks, goals, habits, and notes first, or use a disposable vault for practice. Requests marked **writes** change actual records. Substitute existing paths and intended dates.

## Start without knowing what to ask

Click **Today** beneath the orb for a read-only overview of today's tasks, past deadlines, active goals, habit progress, and calendar. Click **Explore** for starting requests covering the major features. Selecting an Explore suggestion submits an ordinary assistant request; it has the same prerequisites and write boundaries as typing that request.

[Today and Explore guide](features/today-and-explore.md)

## Read your task list

> Show my tasks.
>
> Show today's tasks.
>
> Which tasks have past deadlines?
>
> Show my personal tasks.
>
> Show my work tasks, including completed ones.

**Requires:** recognized task notes in the configured folders. **Result:** current task records in a companion panel; no note changes. Today means planned or due today, not all past deadlines.

[Task guide](features/tasks.md)

## Capture, plan, and complete a task

> Add a personal task called Book a dentist appointment. Leave it unscheduled, with no deadline.
>
> Plan Example errand for tomorrow.
>
> Clear the planned date on Example errand.
>
> Set Example project task's category to Projects and venture to Example Studio.
>
> Mark Example errand complete.
>
> Reopen Example errand.

**Writes:** creates or updates task Markdown. Planned dates do not book calendar events. Updating a task requires it to exist; Smith should clarify duplicate names.

[Task guide](features/tasks.md) · [Undo](features/changes-and-undo.md)

## Check the weather

> Do I need a jacket?
>
> Will I need an umbrella this afternoon?
>
> Weather in Lisbon tomorrow.

**Requires:** a home location in Settings → Connectors → Weather, or a named place. **Result:** a forecast card with feels-like temperature, advice chips and the next 24 hours. The orb briefly turns icy blue in the cold, amber or red in the heat, and shimmers when it's wet. **Writes:** nothing.

[Weather guide](features/weather.md)

## Focus on a task

> Give me 25 minutes on Example project task.
>
> Focus on this for 45 minutes.
>
> 20 minutes on email.
>
> How long is left? Pause my focus session. Add 10 minutes. Stop the timer.
>
> Log that I drafted the intro.

**Requires:** an unfinished task note for task-linked sessions. A title works for anything else. **Result:** a progress ring around the orb and minutes left in the menu bar. When time is up, a card offers Log progress, Mark done, +5 min and Done. **Writes:** only logging (a line under `## Focus log` in the task note) and Mark done change the vault.

[Focus sessions guide](features/focus-sessions.md)

## Work towards a goal

> Show all my goals, including Someday.
>
> Make Example portfolio goal active.
>
> Link Example project task as the next task for Example portfolio goal.
>
> Move Example portfolio goal's target to 20 November 2026.
>
> Which goals need a review?
>
> Pause Example portfolio goal.

**Requires:** a configured Goals folder. First create the illustrative goal in Someday and link an unfinished task, or use your own goal. **Writes:** activation, linking, target changes, and pausing update the goal. Showing/filtering goals is read-only.

[Goals guide](features/goals.md)

## Create a goal through conversation

> Help me create a goal to launch my portfolio.

Smith should ask for missing information, such as what “launched” means. You could then supply:

> Create it as an active goal called Launch my portfolio. Done means three case studies and a working contact page are published. No target date yet. Link Example project task as the next action.

**Writes:** a goal note after the concrete creation request. Review defaults to next week for an active goal. The example uses an existing task; creating a new task would be a separate requested edit.

[Goal creation and fields](features/goals.md)

## Do a weekly review

> Let's review my goals.

Orb reads goals needing attention and guides you through one at a time. For a practice review on the fictional sample goal, you could say:

> Help me review Example portfolio goal now.
>
> I chose three projects. My obstacle is time for writing. I will continue and use Example project task as the next action. Save this check-in.

**Writes:** the completed check-in and updated Review date in one goal-note edit. Starting the conversation alone writes nothing. Supply actual progress for your real goals; the example progress is fictional.

[Review walkthrough](features/goals.md#a-complete-weekly-review)

## Track repeated actions

> Show my habits.
>
> Record pull-ups for today.
>
> I studied Mandarin yesterday. Log it.
>
> Remove yesterday's pull-ups completion.
>
> Show my habit heatmaps for 2025.
>
> Use my habit history to help review my language goal.

**Requires:** a habit log folder and a supported dashboard script. No habits are preloaded; first define any habits used in these examples, or use your own habit names and an existing goal for the last example. **Result:** source-backed heatmaps, current-week cards, and eight recent weeks. **Writes:** only explicit logging/removal changes daily records. Looking at history writes nothing. Undo reverses eligible Orb log edits.

From Today, click **Open habits** to log locally without a model request. The manually maintained This Week page is separate from habits and tasks.

[Habits guide](features/habits.md)

## Read your calendar

> What's on my calendar today?
>
> Show my calendar next week.
>
> Show my calendar next week, including planned tasks and deadlines.

**Requires:** configured calendar sources for external events; task-date entries only need recognized task notes. **Result:** a calendar and day agenda. Warnings mean some data may be missing.

[Calendar setup](features/calendar.md#setup)

## Create a real calendar event

> Add a Google Calendar event called Portfolio review tomorrow from 2pm to 3pm.
>
> Add an all-day Google Calendar event called Studio closed on 20 November 2026.

**Requires:** a connected Google calendar, enabled Full Calendar local server, token/scopes, and Obsidian open. **Writes:** a real Google Calendar event. Supply the intended date and both times for timed events. Orb's note undo cannot reverse this action.

[Calendar guide and limits](features/calendar.md)

## Find, read, and compare notes

> Find my notes about launch options.
>
> Read Notes/Example meeting.md and summarize the decisions and open questions.
>
> Compare the options in Notes/Example launch options.md in a table.

**Result:** source-grounded answers or a comparison table. No notes are changed. Search is keyword-based; specifying a path is useful when the filename is known.

[Notes guide](features/notes.md)

## Save a decision in an existing note

> Append “Decision: use the one-page pilot for the first launch.” to Notes/Example meeting.md.
>
> Undo your last note edit.

**Writes:** appends to the existing Markdown note, then optionally restores it through undo. It does not rewrite earlier paragraphs or create a general-purpose note.

[Notes](features/notes.md) · [Changes and undo](features/changes-and-undo.md)

## Read data and show a chart

> Read A1:B7 of Data/Measurements.csv.
>
> Chart those balances over time in GBP.
>
> How much did the balance change from January to June?
>
> Close the chart.

**Result:** a sourced chart and answer. The fictional January/June values are 3,200 and 5,650, a change of GBP 2,450. The source file is unchanged. Use View data to inspect the plotted numbers.

For a workbook you supply, start with **“Which sheets are in Data/Measurements.xlsx?”**, then request an exact sheet/range. Measurements.xlsx and Measurements.csv are not included in the starter; supply your own data.

[Spreadsheets and visuals](features/spreadsheets-and-visuals.md)

## Plan across sources

> Compare Notes/Example launch options.md against the priorities in Notes/Example meeting.md. Recommend a first step without changing anything.
>
> What can I do today to move my goals forward?
>
> Use my calendar and today's tasks to suggest a plan for tomorrow. Don't schedule anything yet.

**Result:** a proposal based on the available sources. State constraints such as available time or priorities when they are not recorded. Explicitly ask to create or schedule an action if you decide to adopt it.

[Planning guide](features/planning.md)

## Requests that need a different workflow

| Desired result | Current boundary |
| --- | --- |
| “Remind me every Friday to review my goals.” | No background reminder scheduler. Use your own reminder app; review through Orb when ready. |
| “Find a free slot and automatically book my tasks.” | No automatic slot placement. Inspect the calendar, choose a time, and request a specific event. |
| “Move or delete that calendar event.” | Event editing/deletion is not implemented. Use Google Calendar or Obsidian. |
| “Edit the formula in this workbook.” | Spreadsheet reading is supported; workbook writes and recalculation are not. |
| “Turn every old checkbox into a task.” | No automatic historical checkbox import. Select the actions you intend to create. |
| “Rewrite/rename this general note.” | General note writes append only. Make structural or replacement edits in Obsidian. |
| “Read this PDF or screenshot.” | PDF/image contents are not currently parsed. Supply supported text or spreadsheet sources. |

If a request fails after some edits succeeded, inspect Recent changes before repeating the whole request. See [Troubleshooting](troubleshooting.md).

## Build your knowledge system

“Create a Computing Hub.” Then: “Create a Computer Architecture Topic linked to that Hub.” Save your actual source notes under that Topic and ask for a Portfolio draft when you want to develop an output. “Show my Hubs and Topics” is read-only. See [Knowledge](features/knowledge.md).

## Learn and create from your notes

These examples require your own tagged notes in the knowledge folders. Substitute your actual Topic and Portfolio titles.

| Request | Effect |
| --- | --- |
| “Show the knowledge graph for Computer Architecture.” | Opens a local graph; no writes. |
| “Explain registers using my Computer Architecture notes.” | Reads the subject and linked notes; returns a sourced answer. |
| “Quiz me on Computer Architecture, one question at a time.” | Starts a learning conversation; no grades or progress are saved. |
| “Give me a five-minute refresher on Networking.” | Reads linked notes and gives a short recap with a recall question. |
| “Save an unfiled Library note called Reading idea with this text: [your text].” | Creates an unfiled note; undoable. |
| “Create a cheat sheet from [exact Library notes], explaining [your angle]. Save it in Portfolio.” | Creates an AI-assisted draft and appends backlinks to the supplied sources; separate undo entries. |
| “Mark [Portfolio note] Ready.” | Reads its version and updates its explicit stage. |
| “Revisit [Library note] on 6 October 2026.” | Saves a date for Today; no background notification. |

For a visual workflow, open **Explore → Knowledge → Library**, select notes, and choose **Create from these notes**. Review [Knowledge](features/knowledge.md) for write behavior, source limits, and partial-failure recovery.

## Trading 212 investments

First connect a read-only Invest or Stocks ISA key pair in Settings → Integrations → Trading 212. [Setup, supported data and limits](features/trading212.md).

- “Show my Trading 212 portfolio.”
- “How much am I up today?” — requires local tracking, an opening observation and complete cash/fill history.
- “What income did I receive this UK tax year?” — uses the local ledger and reports coverage.
- “Show my performance since tracking began.”
- “Which holding is my largest investment exposure?”
- “Show my dividends and tell me whether more history needs loading.”
- “Show my recent deposits and cash interest.”
- “Do I have any pending orders?”

These requests read financial data and share the relevant results with your selected AI provider. The connector cannot trade. For direct viewing without an AI request, open Explore → Trading 212. Enable local tracking for persistent period queries. Metrics report actual observation times and history coverage; incomplete totals remain partial. Missing overnight values cannot be recreated by a broader API key.

## Put task work on the calendar

With [linked scheduling set up](features/task-scheduling.md), try “Find me 45 minutes this week for Draft proposal,” then “Book the first slot.” To authorize both steps at once, say “Schedule Draft proposal for 45 minutes this week.” Move it with “Move Draft proposal’s block to Thursday at 2pm.” Completion shows alongside the block in Orb. “Remove Draft proposal’s calendar block” deletes that event and keeps the task.

## Search saved web clippings

Save material under `4. Knowledge Library/Web Clippings` using Obsidian Web Clipper, then try:

- “Find my web clippings about local AI models.”
- “Show videos I saved about photography last month.”
- “What did the article I clipped about pricing say?”

These requests search and read saved notes without changing them or fetching their URLs. Content questions require captured text, not just a link. [Web Clippings](features/web-clippings.md) explains search, filters, previews, and limits.

## Build a realistic day

Open **Today → Plan my day**, or ask “Help me plan today.” Try “Plan tomorrow and finish by three,” “Keep the proposal first; it needs 90 minutes,” or “Replan the remaining day.” These requests produce drafts. Use the planner’s **Save plan** or reviewed **Apply to tasks…** controls to make the selected note/date/calendar changes. See [AI daily planner](features/daily-planner.md) for estimate provenance, calendar requirements, and recovery.

## Maps and nearby places

- “Find a quiet coffee shop nearby.” — choose a starting point; nearby discovery and walking times need a Geoapify key. Quietness is sourced from notes or marked unverified.
- “Show my saved places.” — browses place notes without a Geoapify connection; Explore → Places opens the same view directly.
- “Save that café to Places.” — saves the selected result as an undoable Markdown note.
- “Find parks near Soho, London.” — resolves the starting area, with a chooser for ambiguous results.

Use the card's Directions / Open in controls for Apple or Google Maps, and Widen to 3 km to extend the search. [Feature guide](features/maps-and-places.md).
