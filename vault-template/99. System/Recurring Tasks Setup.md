# Recurring tasks setup

Open [[0. Home/Recurring Tasks|Recurring Tasks]] in Reading view or Live Preview. Enable Dataview and **JavaScript Queries**, as for the habit dashboard. The controls run in **desktop Obsidian**, offline, with Orb closed or uninstalled. The scripts use Obsidian's embedded desktop runtime; no separate Node installation is needed. Mobile can read the notes but currently cannot use these controls.

Create a task or choose an existing task, enter its first Planned or Deadline date, then choose a repeat schedule. Use **Save repeat** to start/change the pattern. **Change dates only** postpones the current occurrence while keeping its fixed pattern.

- Fixed schedules: every N days; every N weeks on selected weekdays; every N months or years. Choose the first date on one of the selected weekdays.
- After completion: every N days, weeks, months or years from the actual completion date.
- **Complete** records an occurrence and moves the same note forward. **Skip** moves it forward without recording completion. Both dates move by the same number of calendar days, keeping their offset. Empty dates stay empty.
- Late fixed tasks advance to the first scheduled date after the completed occurrence and completion date. Missed slots do not create more notes or count as completions.
- Month ends clamp to the month's last day: a fixed 31st schedule returns to the 31st in March after February. February 29 repeats on February 28 in other years.
- **Stop repeating** leaves the current task and history. **Undo last occurrence** restores the last eligible completion/skip, even if it was made in the other app. It refuses if dates or the rule have subsequently changed.
- The effective completion date defaults to today; choose a past date when recording late. Future completion is not allowed.
- History is in `recurrence_history` in the task's YAML properties. Orb's private Activity history is separate and only records its own writes.

Use the recurring controls instead of the plain `completed` checkbox. If you do edit that property, the dashboard shows **Advance needed**; choose the completion date and advance, or cancel the mark. Opening a page never advances tasks automatically. Task recurrence does not create Google events or reminders. Remove a linked calendar block before making its task recur.

The current occurrence stays in the normal Life/Business task folder. Fixed dates and history remain readable/editable YAML. Keep task filenames stable to preserve links. Habit counts are separate from recurring tasks.

## Existing or custom vaults

In Orb, open **Today → Manage recurring tasks → Install Obsidian dashboard** to add the dashboard and scripts without overwriting existing files. Then open the dashboard in Obsidian. To install manually, copy `0. Home/Recurring Tasks.md`, this setup note, and the entire `99. System/99.4 Scripts/recurring-tasks` folder from the starter.

Custom task folders go in `99. System/99.4 Scripts/recurring-tasks/config.md`; use the same paths as Orb. Add `[[0. Home/Recurring Tasks]]` to Home/Today, or embed:

```dataviewjs
await dv.view("99. System/99.4 Scripts/recurring-tasks/view", { compact: true });
```

If your old Bases tables still have a Done checkbox for recurring notes, exclude them from that editable view with `!note.recurrence` and use the dashboard. Ordinary tasks retain their checkbox workflow. Existing personalised Home pages and Bases are not overwritten by installation. Updates to already installed scripts require comparing/replacing the bundled files; the installer reports conflicts instead of silently replacing custom code.

## Conflicts and recovery

The desktop controls share a short exclusive lock with Orb. If another supported task edit is in progress, retry when it finishes. After a crash, if the lock persists, close both apps and remove only `.orb-task-write.lock` in the vault root before reopening. Do not remove a live lock.

Direct note-editor writes and separate offline devices do not participate in this lock. Refresh after editing elsewhere; resolve sync conflicts using the original notes and your sync history. Avoid completing the same occurrence simultaneously on different devices. No automatic history merging is claimed.

An invalid rule stays visible with an error; repair it or stop repeating. If a task approaches the 512 KB note limit, archive old history with a backup before continuing; history is never silently deleted. Unsupported schema versions require updating both application and vault scripts.
