# Things to ask Orb

[Documentation](README.md) · [Getting started](getting-started.md)

These are copyable examples of supported requests, checked against the app's tools and behavior. They are not fixed commands, exhaustive phrasing rules, or transcripts of live model tests. Orb may ask for missing details or an exact note path. Speech and typing support the same feature requests.

For the examples naming files below, copy the [fictional sample vault](../vault-template/) to a separate folder and configure Orb to use it. Examples that say **writes** change real files or calendar events when submitted. Replace dates with ones you intend to use.

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

**Writes:** creates or updates task Markdown. Planned dates do not book calendar events. Updating a task requires it to exist; Orb should clarify duplicate names.

[Task guide](features/tasks.md) · [Undo](features/changes-and-undo.md)

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

**Requires:** a configured Goals folder. The sample goal starts in Someday and its linked task is unfinished. **Writes:** activation, linking, target changes, and pausing update the goal. Showing/filtering goals is read-only.

[Goals guide](features/goals.md)

## Create a goal through conversation

> Help me create a goal to launch my portfolio.

Orb should ask for missing information, such as what “launched” means. You could then supply:

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

**Requires:** a habit log folder and a supported dashboard script. The sample supplies Pull-ups and Study Mandarin; use your own habit names and an existing goal for the last example. **Result:** source-backed heatmaps, current-week cards, and eight recent weeks. **Writes:** only explicit logging/removal changes daily records. Looking at history writes nothing. Undo reverses eligible Orb log edits.

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

> Read A1:B7 of Finance/Example savings.csv.
>
> Chart those balances over time in GBP.
>
> How much did the balance change from January to June?
>
> Close the chart.

**Result:** a sourced chart and answer. The fictional January/June values are 3,200 and 5,650, a change of GBP 2,450. The source file is unchanged. Use View data to inspect the plotted numbers.

For a workbook you supply, start with **“Which sheets are in Finance/Budget.xlsx?”**, then request an exact sheet/range. Budget.xlsx is not included in the sample vault.

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
