# Tasks connected to calendar time

[Documentation](../README.md) · [Tasks](tasks.md) · [Calendar setup](calendar.md) · [Changes and undo](changes-and-undo.md)

Find time for a task, book one linked Google Calendar block, and keep its Planned time aligned when that block moves. The task remains a Markdown note. Its completion status appears beside the block in Orb, including in an events-only calendar.

## Setup

Complete [Google Calendar setup](calendar.md#connect-google-calendar-for-event-creation) using Full Calendar Remastered's local server and a token with Read events, Write events, and Read providers. Keep Obsidian open on the same vault.

For availability checks, add the **matching HTTPS Google iCal feed for every connected Google calendar** in Full Calendar. Orb matches the calendar ID in the feed's `/calendar/ical/<calendar-id>/` path. Its recurrence reader expands these feeds because the plugin's Google REST list does not expand recurring events. Keep private feed URLs out of chat. Other configured HTTPS iCal feeds also count as commitments.

In Orb **Settings → Integrations → Google Calendar**, choose working hours and days. Defaults are Monday–Friday, 09:00–17:00 in Full Calendar's display timezone. These constrain suggested slots; an explicitly requested time may be outside them.

## Requests

Use an existing unfinished, non-recurring task. If several tasks share a title, supply its exact path.

| Ask | Result | Writes |
| --- | --- | --- |
| “Find me 45 minutes this week for Draft proposal.” | Returns candidate slots, timezone, and working hours. | None |
| “Book the first slot for Draft proposal.” | Rechecks availability, creates a linked block, and updates Planned. | Google event and task note |
| “Schedule Draft proposal for 45 minutes this week.” | Finds and books a slot as explicitly requested. | Google event and task note |
| “Move Draft proposal's block to Thursday at 2pm.” | Moves the same event, retaining duration, and updates Planned. | Google event and task note |
| “Make that block an hour long.” | Changes its end time after checking availability. | Google event and task note |
| “Mark Draft proposal complete.” | Shows Task completed beside the existing block in Orb. | Task note |
| “Reopen Draft proposal.” | Restores the unfinished status beside the block. | Task note |
| “Remove Draft proposal's calendar block.” | Deletes the linked event, removes the link, and restores the pre-booking Planned value. | Google event and task note |
| “Repair Draft proposal's link using the calendar time.” | Accepts the actual event time as Planned. | Task note |
| “Unlink Draft proposal but leave its calendar event.” | Removes the link only; retains the current Planned value and any event. | Task note |

“Find time” proposes slots. “Schedule” or “book” authorizes a booking. Orb does not invent a missing duration. Searches cover at most 93 days and return up to 12 slots, with starts on a 15-minute grid relative to working hours. Blocks last 5–480 whole minutes. “This week” means Monday–Sunday, excluding past time.

## What stays in sync

The note stores a task UUID and a `calendar_block` record containing calendar identity, event identity, block UUID, start/end, timezone, and recovery state. The event description contains an opaque `[Vault Orb block …]` marker. The marker lets Orb recover a created event or a changed plugin event ID without matching on title or time. Renaming a task note preserves its link; copying its identity produces a repair warning.

An Orb move updates the event and Planned together. Changes made in Google Calendar or Obsidian are reconciled when you ask for tasks/calendar or open/refresh Today, **after Full Calendar has loaded those changes**. Lookup uses the linked identity even if the block moved outside the displayed range. This is refresh-based synchronization, not a background watcher or immediate Google push sync.

Block times retain their calendar timezone. Planned is projected into the Mac's local timezone for existing task filters. Deadline is never changed by booking or moving a block. A separate manual Planned edit creates a conflict: Orb asks you to move the block or accept calendar time rather than overwrite that edit silently.

Completed blocks stay on the calendar as history. Orb displays completion and a clickable task link; Google Calendar's title and completion state are unchanged. When task dates are included, a linked block replaces the duplicate Planned entry, while Deadline remains separate.

## Availability and its limits

Orb refreshes iCal feeds for availability, includes recurring and all-day commitments, checks every configured calendar, and rechecks before writing. Missing feeds, failed reads, ambiguous daylight-saving times, missing event end times, or truncated results block booking rather than imply free time. All returned events conservatively count as busy, including events another calendar may label “free.”

The plugin's local Google API reads its cache. Refresh Full Calendar after external changes; an Orb refresh cannot force Google's cache to refresh. Feed publication may also lag. Another person can book the same time between the final check and write; the providers offer no atomic reservation or conditional update through this API.

This version supports one timed block per non-recurring task and connected Google calendars for writes. It does not split work across sessions, create recurring blocks, schedule recurring task occurrences, drag blocks in Orb, manage invitees, or track time spent. Completed tasks must be reopened before a new booking.

## Partial writes and recovery

Calendar and note writes are separate. Before creating, moving, or deleting a block, Orb journals a pending state in the note. If a request times out or a note changes during the operation, Orb reports what is pending and keeps its identity. It never blindly creates another event on retry.

First refresh the task and Full Calendar. A successful but unconfirmed creation or move can then finish linking. If the event is missing, duplicated, converted to all-day, or conflicting with a manual edit, inspect it in Google Calendar/Obsidian. Restore the intended event and accept calendar time, or explicitly unlink. **Unlink does not delete an event.** After an uncertain deletion, inspect the calendar before unlinking or booking again.

Calendar journal entries cannot use ordinary note undo: restoring only the note would disconnect the event. Move the block back to reverse a move; remove the block to reverse booking. Completion, reopening, and unrelated note edits still support version-checked note undo. Removing a block restores the Planned value saved before booking, which may be in the past; review it afterward.

## Walkthrough

1. Create an unfinished task called Draft proposal in a disposable vault connected to a test calendar.
2. Ask to find 45 minutes this week. Verify that this writes nothing.
3. Book one returned slot. Inspect the task's link and Planned value and the Google event.
4. Move the block in Google Calendar, refresh Full Calendar, then open Today or ask for tasks. Planned should follow it.
5. Complete the task. Orb should retain the block and show Task completed beside it.
6. Reopen it, then remove the block. The task and Deadline remain; the event is removed.

Offline coverage uses temporary vaults and mocked plugin responses. It does not prove live Google propagation or a particular model's interpretation of every phrasing.

Implementation: [scheduling.cjs](../../src/scheduling.cjs), [calendar-time.cjs](../../src/calendar-time.cjs), [Google adapter](../../src/google-calendar.cjs), and [tests](../../test/scheduling.test.cjs).
