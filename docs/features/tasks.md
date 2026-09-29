# Tasks

[Documentation](../README.md) · [Things to ask Orb](../things-to-ask.md) · [Vault format](../vault-format.md)

Use Orb to see work you have planned, capture new actions, change dates and grouping, and explicitly complete or reopen tasks. A task is one Markdown note in your configured personal or work folder.

[![Today's task panel](../images/today-tasks.png)](../images/today-tasks.png)

## Setup

Configure two existing, separate task folders in Settings. Each task needs YAML frontmatter containing `type: task`; the filename is its title. Existing checklist items inside other notes are not task records. The [sample vault](../../vault-template/) contains Example errand and Example project task.

The app calls the folders Personal/Work in Settings and uses `life`/`business` internally. The exact frontmatter fields are documented in [Task properties](../vault-format.md#task-properties).

## Things to ask

Names below refer to the sample vault unless a request creates a new task. These are flexible natural-language requests; state the task path if more than one note has the same title.

| Ask | Expected result | Changes data? |
| --- | --- | --- |
| “Show my tasks.” | Lists unfinished tasks across both lists. | No |
| “Show today's tasks.” | Shows unfinished tasks planned **or due** today. | No |
| “Which tasks have past deadlines?” | Lists unfinished tasks whose Deadline is before today. | No |
| “Show my work tasks.” | Lists the work/business folder's unfinished tasks. | No |
| “Show all my tasks, including completed ones.” | Includes completed task records. | No |
| “Add a personal task called Book a dentist appointment. Leave it unscheduled.” | Creates a personal task note with no Planned or Deadline date. | Vault note |
| “Plan Example errand for tomorrow.” | Updates its Planned date. | Vault note |
| “Set Example project task's deadline to 20 November 2026.” | Updates its Deadline (`due`) date. | Vault note |
| “Clear the planned date on Example errand.” | Removes Planned without changing Deadline. | Vault note |
| “Set Example project task's category to Projects and venture to Example Studio.” | Updates the grouping labels. | Vault note |
| “Mark Example errand complete.” | Sets `completed: true`. | Vault note |
| “Reopen Example errand.” | Sets `completed: false`. | Vault note |

Relative dates use the current local date. Example absolute dates are illustrative; choose your intended date. Orb should clarify ambiguous identities and missing information rather than invent a commitment.

## What happens

Task reads open a companion list with task title, area, Planned, and Deadline. Click a task title to open its source note in Obsidian. Dates without a time stay date-only; asking for “tomorrow” does not authorize an invented hour.

A successful edit is recorded in Recent changes. Visible task lists refresh after edits and undo. Completed tasks disappear from the default unfinished list. If a new task falls outside the current Today filter, Orb switches to all tasks so you can see it. Completion also refreshes a visible calendar that includes task dates or a Goals panel linking that task.

**Planned** means when you intend to work. **Deadline** means a real latest date. A past Planned date does not itself make a task overdue. Today and past deadlines are separate lists.

## Try a complete workflow

Using a copy of the sample vault:

1. **“Show my personal tasks.”** Locate Example errand.
2. **“Plan Example errand for tomorrow.”** Expect its Planned property to change.
3. **“Show my tasks for tomorrow.”** Orb can query the daily task view for that date.
4. **“Mark Example errand complete.”** Expect it to leave unfinished lists.
5. **“Undo your last note edit.”** Expect the completion to be undone, while the earlier Planned change remains.

An edit is authorized by your request; you do not need to confirm the same unambiguous edit again. If Orb asks which note you mean, give its path.

## Limits

- Exactly two task lists and the documented field names are supported. Checkbox tasks and arbitrary Bases definitions are not imported.
- Existing tasks can change dates, completion, category, and venture. There is no dedicated task rename, move-between-lists, or delete tool. Do those in Obsidian.
- Creation can include body details; subsequent free text can be appended using the note tool. There is no arbitrary task-body rewrite tool.
- Task Planned/Deadline dates do not create Google Calendar events or background reminders.
- Orb can reopen a task, but it must not infer completion just because you discussed or worked on it.
- Creating the same title twice creates separate filenames with a numeric suffix; be explicit when referring to a previous task.

## Troubleshooting

**A task is missing:** check its folder, `type: task`, valid YAML, completion state, and date filter. An undated task belongs in the all-tasks list, not Today. Warnings can indicate unreadable notes.

**The dates look wrong:** inspect `planned` and `due` in the note; display labels in Obsidian do not change the underlying property names. A real deadline should be stored in `due`.

**“Task changed” or undo refuses:** another edit changed the file version. Ask Orb to read the task again. See [Changes and undo](changes-and-undo.md).

Implementation: [vault.cjs](../../src/vault.cjs), [agent.cjs](../../src/agent.cjs), and [vault tests](../../test/vault.test.cjs).
