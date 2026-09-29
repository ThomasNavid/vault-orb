# Recurring tasks

[Tasks](tasks.md) · [Vault format](../vault-format.md) · [Use Obsidian](../obsidian-only.md)

Recurring tasks are ordinary Markdown notes in your Life or Business task folder. One note holds the current occurrence, rule and history. You can manage the complete workflow in **desktop Obsidian without Orb running or installed**, or use Orb's optional native controls, chat and voice.

## Open the controls

In Orb, use **Today → Manage recurring tasks**, **Explore → Recurring tasks**, or ask “Show my recurring tasks.” Native controls do not need an API key. Chat/voice need their normal model configuration.

In Obsidian, open `0. Home/Recurring Tasks.md` in Reading view or Live Preview. Enable **Dataview → JavaScript Queries**, as for the existing habit dashboard. Home and Today include compact controls. The scripts and dependencies are bundled in the vault; there is no runtime server, build step, API call or network requirement. Editing currently supports desktop Obsidian; mobile can read the notes.

For an existing vault, choose **Install Obsidian dashboard** in Orb's recurring panel. This adds six dashboard/setup/script files. It preserves existing files and reports any differing files for manual comparison; it does not replace personalised Home pages or Bases. Open the installed dashboard, then add its link or embed to your pages. Custom task paths are recorded in the dashboard's vault-local `config.md`. See the installed `99. System/Recurring Tasks Setup.md` for manual installation and recovery.

## Set a schedule

Create a new task or choose an existing unfinished task. Enter the first date and choose which field repeats: Planned is intended work; Deadline is a real latest date. Dates must be date-only. Repetition cannot be added while a task has a linked calendar block; remove that block first.

| Pattern | Behaviour |
| --- | --- |
| Fixed every N days | Keeps its original calendar cadence. |
| Fixed every N weeks | Runs on selected weekdays; weeks start Monday. The first date must match a selected weekday. |
| Fixed every N months / years | Keeps the first date's day/month anchor. Short months clamp to their final day without losing the original anchor. |
| N days / weeks / months / years after completion | Starts the interval from the date you record completion. |

For example, fixed monthly on January 31 advances to February 28/29, then March 31. Fixed annual February 29 uses February 28 in other years. The editor previews the next date. Both existing dates move by the same calendar-day delta; empty dates stay empty.

**Save repeat** changes the pattern and establishes its first date. **Change dates only** postpones the current occurrence while retaining the fixed repeat anchor. Changing the other date changes the offset carried forward.

## Complete, skip and undo

- **Complete** records the occurrence and advances the same note to the next date. The next occurrence stays open, so `completed` remains false.
- **Skip** advances without recording completion. For completion-relative rules, the chosen skip date starts the next interval.
- **Undo last occurrence** restores the last eligible completion/skip and records its reversal. It works across both interfaces because the data lives in the note. Later changes to dates or the rule can prevent reversal.
- **Stop repeating** removes the rule and keeps the current task and history.
- **History** shows completion, skip, configuration and reversal records. Completed occurrences do not become separate rows in the ordinary completed-task list.

Choose the effective date when recording past work. Future completions are rejected. Late fixed tasks move to the first scheduled date after both the nominal occurrence and completion date. Early completion never moves a fixed schedule backwards. Missed slots create no extra notes and never count as completed.

Today still means planned or due today. Earlier planned recurring tasks appear in a separate review group; they are not labelled overdue unless they have an actual past Deadline. Calendar views include only the current occurrence, not an expanded future series.

Use the recurring controls rather than editing the plain Done checkbox. If a recurring note is externally marked `completed: true`, it stays visible as **Advance needed**. Choose its completion date and advance, or cancel the external completion. This can be done entirely in Obsidian. Reading/refreshing never advances a recurrence.

## Examples to ask Smith

- “Create a personal task called Put the bins out, planned for Monday 5 October 2026, repeating every Monday.”
- “Make Replace the filter repeat three months after completion; first planned for 1 October 2026.”
- “I finished Put the bins out yesterday. Complete that occurrence.”
- “Skip the current occurrence of Put the bins out.”
- “Postpone this occurrence to Thursday without changing the weekly pattern.”
- “Undo the last occurrence completion.”
- “Stop repeating this task.”

These are illustrative tasks. Specify an exact note when names are ambiguous. Orb must not infer completion from discussing the work. Goal links follow the recurring series and show the latest unreversed completion; they do not automatically achieve a goal. Habits remain separate.

## Conflicts and limits

Both desktop interfaces use the same recurrence engine and an exclusive local write lock. Stale controls fail instead of advancing a newer occurrence; retrying the same operation does not advance twice. If both apps crash and leave `.orb-task-write.lock`, close both and remove that lock file before retrying.

Direct Markdown edits and independent synced devices do not share that lock. Refresh after external edits, avoid completing the same occurrence on two offline devices, and resolve sync conflicts from original records/backups. Automatic history merging is not provided.

Invalid rules remain visible with an error. Unsupported versions require updating the app and vault scripts. The existing 512 KB note limit applies; history is never silently truncated. There are no reminder notifications, holiday calendars, ordinal weekdays, end-after-count rules, or automatic task execution. Recurrence does not create Google Calendar events.

Orb's Activity undo remains an exact, private journal for Orb-origin edits. The dashboard's portable occurrence undo is available without that journal. Installation adds support files and does not create personal tasks.
