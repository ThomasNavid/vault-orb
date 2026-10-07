# Tasks

[Documentation](../README.md) · [Things to ask Smith](../things-to-ask.md) · [Vault format](../vault-format.md)

Use Orb to see work you have planned, capture new actions, change dates and grouping, and explicitly complete or reopen tasks. A task is one Markdown note in your configured personal or work folder.

[![Today's task panel](../images/today-tasks.png)](../images/today-tasks.png)

## Setup

Orb creates `0. Home/Life Tasks` and `0. Home/Business Tasks` automatically. New vaults use these fixed paths; older saved installations keep their existing paths. Each task is a Markdown note with `type: task`. The starter is empty. For the examples below, first ask Smith to create a personal task called Example errand and a business task called Example project task in a disposable vault, or substitute your own records.

## Things to ask

Names below are illustrative, not preloaded records. These are flexible natural-language requests; state the task path if more than one note has the same title.

| Ask | Expected result | Changes data? |
| --- | --- | --- |
| “Show my tasks.” | Lists unfinished tasks across both lists. | No |
| “Show today's tasks.” | Shows unfinished tasks planned **or due** today. | No |
| “Show today's tasks and past deadlines.” | Keeps today’s tasks first, with past deadlines in a separate section below. | No |
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

Relative dates use the current local date. Example absolute dates are illustrative; choose your intended date. Smith should clarify ambiguous identities and missing information rather than invent a commitment.

## What happens

Task reads open a companion list with task title, area, Planned, and Deadline. Click a task title to open its source note in Obsidian. Dates without a time stay date-only; asking for “tomorrow” does not authorize an invented hour.

A successful edit is recorded in Recent changes. Visible task lists refresh after edits and undo. Completed tasks disappear from the default unfinished list. If a new task falls outside the current Today filter, Orb switches to all tasks so you can see it. Completion also refreshes a visible calendar that includes task dates or linked blocks or a Goals panel linking that task.

**Planned** means when you intend to work. **Deadline** means a real latest date. A past Planned date does not itself make a task overdue. Today and past deadlines are separate lists. When one answer reads both for the same date and completion filter, today’s tasks stay at the top and past deadlines appear below; the second query does not replace the first list. A later request for only past deadlines opens that list on its own.

The corner graph follows the displayed task list. Expand it to see **To-dos** linked to their **Areas** (the displayed venture or task list). A task appearing in both sections has one graph node. Opening a different task view clears the previous graph focus and filters; an empty list shows an empty to-do graph. Click a task node to preview its dates or open its source note in Obsidian. These area connections do not create links in your notes. See [Corner graph](knowledge.md#corner-graph).

## Try a complete workflow

After creating the two practice tasks above:

1. **“Show my personal tasks.”** Locate Example errand.
2. **“Plan Example errand for tomorrow.”** Expect its Planned property to change.
3. **“Show my tasks for tomorrow.”** Orb can query the daily task view for that date.
4. **“Mark Example errand complete.”** Expect it to leave unfinished lists.
5. **“Undo your last note edit.”** Expect the completion to be undone, while the earlier Planned change remains.

An edit is authorized by your request; you do not need to confirm the same unambiguous edit again. If Smith asks which note you mean, give its path.

## Apple Reminders

For non-recurring tasks, [Apple Reminders](apple-reminders.md) can sync new tasks, deadlines and completion with two chosen lists. Categories appear in reminder notes; section dividers are managed manually in Reminders.

## Recurring tasks

Use **Today → Manage recurring tasks**, or the vault’s **Recurring Tasks** dashboard in desktop Obsidian. Both interfaces support fixed schedules, intervals after completion, skip, history and portable undo. Completing a recurring task logs its occurrence and advances the same note; the next occurrence stays open. See [Recurring tasks](recurring-tasks.md) for setup, examples and date rules.

## Focus on a task

Focus timers don't need a task, but you can link one: hover over an unfinished task in any task list and press the clock beside its title to start 25 minutes on it, or ask Smith for time on it. When the session ends you can log progress under the task's `## Focus log` heading or mark it done. See [Focus sessions](focus-sessions.md).

## Limits

- Exactly two task lists and the documented field names are supported. Checkbox tasks and arbitrary Bases definitions are not imported.
- Existing tasks can change dates, completion, category, and venture. There is no dedicated task rename, move-between-lists, or delete tool. Do those in Obsidian.
- Creation can include body details; subsequent free text can be appended using the note tool. There is no arbitrary task-body rewrite tool.
- Setting Planned/Deadline alone does not create an event. [Linked scheduling](task-scheduling.md) explicitly books task work, keeps Planned aligned, and shows completion beside the block. [Apple Reminders](apple-reminders.md) can supply phone reminders when connected.
- Orb can reopen a task, but it must not infer completion just because you discussed or worked on it.
- Creating the same title twice creates separate filenames with a numeric suffix; be explicit when referring to a previous task.

## Troubleshooting

**A task is missing:** check its folder, `type: task`, valid YAML, completion state, and date filter. An undated task belongs in the all-tasks list, not Today. Warnings can indicate unreadable notes.

**The dates look wrong:** inspect `planned` and `due` in the note; display labels in Obsidian do not change the underlying property names. A real deadline should be stored in `due`.

**“Task changed” or undo refuses:** another edit changed the file version. Ask Smith to read the task again. See [Changes and undo](changes-and-undo.md).

Implementation: [vault.cjs](../../src/vault.cjs), [agent.cjs](../../src/agent.cjs), and [vault tests](../../test/vault.test.cjs).

## Reserve calendar time

Ask “Find me 45 minutes this week for Draft proposal,” then “Book the first slot.” A linked task shows its block in the calendar; moving the block updates Planned, and completion appears beside it in Orb. Use calendar actions to move or remove a linked block instead of changing Planned separately. See [Task scheduling](task-scheduling.md) for working hours, setup, refresh behavior, recovery, and undo.

Reading tasks can reconcile Planned for existing calendar links after the plugin has loaded external moves; it never creates a new booking.
