# Task Rules

## One task, one record

- Personal tasks belong in `0. Home/Life Tasks`; work and business tasks belong in `0. Home/Business Tasks`.
- Each task is one Markdown note with `type: task`. Do not duplicate it as a checkbox elsewhere.
- New tasks start with `category: Inbox`. Choose your own categories during review; business tasks can have a `venture` label.
- Keep supporting details and links in the task note.

## Dates and completion

- `planned` is when you intend to act; `due` is a genuine deadline. Either can be empty.
- Use local `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss`. Do not invent times or deadlines.
- Only `completed: true` means complete. Completed records stay in the All table.
- Today includes open tasks planned OR due today. A past planned date is not overdue.
- Dates do not send notifications or create calendar events.

## Reviews and assistants

- Add, change, or complete tasks only when the user requests it. Do not infer completion.
- Do not automatically import historical unchecked items as current commitments.
- Review Inbox tasks regularly. Keep goals, tasks, habits, and knowledge as distinct records linked where useful.
- See [[99. System/Assistant Guide|Assistant Guide]] for knowledge filing and source handling.

## Recurring tasks

- Manage repeats in [[Recurring Tasks]] using desktop Obsidian and Dataview JavaScript, or through Orb. The same notes and history work with Orb closed or uninstalled.
- Use its Complete/Skip controls instead of the ordinary Done checkbox. Completion advances the same note and records history; the next occurrence remains open.
- Planned and Deadline remain distinct. Repetition uses one explicitly selected field and moves the other date by the same calendar-day offset if present.
- Read-only views never advance recurrence. An external Done mark needs a chosen completion date in the recurring dashboard.
- Use Undo last occurrence for portable reversal and Stop repeating to keep the current task without future repeats. See [[99. System/Recurring Tasks Setup]].
