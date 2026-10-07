# Apple Reminders

[Documentation](../README.md) · [Tasks](tasks.md)

Connect Orb's Life and Business task folders to two existing Apple Reminders lists. New unfinished tasks can start in either app; deadlines and completion reconcile in both directions. Apple handles iCloud delivery to your phone. Orb checks every 30 seconds while running and catches up when reopened.

## Setup

Use the packaged Mac app on macOS 14 or later. In **Settings → Connectors → Apple Reminders**, choose **Connect / choose lists**, allow the macOS Reminders permission, and select your existing Life and Business lists. Account names appear alongside list names; choose iCloud lists for phone access. Orb never creates or renames lists.

**Enable two-way sync** saves this connector immediately and imports/exports unfinished tasks. The main Save settings button is not needed for this connector. **Sync now** checks immediately; **Pause sync** leaves all existing reminders and vault notes in place. Sync waits while Smith or the daily planner is busy. Reconnecting a vault with existing links requires its original two lists.

## What syncs

| Information | Behaviour |
| --- | --- |
| New task | An unfinished reminder becomes an Inbox task note; an unfinished vault task becomes a reminder in its mapped list. Existing completed history is not copied. |
| Completion | Tick or reopen either copy; the other follows at the next sync. |
| Deadline (`due`) | The Reminders date, including its time if explicitly set. Date-only stays date-only. Zoned reminder times are converted to the Mac's local time. |
| Planned (`planned`) | Stays in Orb, independent of the deadline. |
| Title | A vault filename rename updates its reminder. A rename in Reminders is flagged for review: rename the note in Obsidian to match or restore the reminder title. Orb does not rename files and risk breaking note links. |
| Category and venture | Written into a labelled block in reminder notes. They remain managed in Orb. New phone reminders start in Inbox. |
| Notes | Existing reminder notes are preserved around Orb's metadata. Notes on a newly imported reminder are copied into the task once (up to 20,000 characters); subsequent free-text edits are not mirrored. Vault note bodies are not exported. |
| Alerts | Existing reminder alarms are preserved. Newly exported timed deadlines get an alarm at their due time; date-only notification behaviour follows Apple Reminders settings. |

Apple's public EventKit and AppleScript interfaces do **not** expose Reminders sections or section membership. You can create dividers such as Nova Launch or Mobile Apps in Reminders and arrange tasks manually; Orb cannot create, read, or assign these sections. Section placement does not set the vault category. Native tags, subtasks, priorities and repeating tasks are not synced. A repeat rule on either linked copy pauses that task's sync and is reported in Settings.

## Conflicts and recovery

Orb stores a `reminders_key` UUID in each linked task and a `[Vault Orb …]` block in the reminder's notes. Do not remove these from a linked pair. Local sync history is stored per vault under Orb's application data `reminders` directory. Matching uses identities, never just titles. Copying a linked note requires removing its copied `reminders_key`; otherwise both notes are flagged instead of modifying the same reminder.

If both sides change the same field differently, neither side is overwritten. **Settings → Connectors → Apple Reminders** shows the issue; make the values agree and sync again. A reminder renamed on the phone similarly needs manual reconciliation with the note filename. Different fields can merge, such as completing a task in Orb and changing its deadline on the phone.

Deletion and moving between lists are not mirrored. Restore a missing reminder/note or move it back to its original list to resume syncing. An uncertain reminder creation is not retried blindly: sync again after iCloud catches up so Orb can recover the existing link. If the original item cannot be recovered, pause sync and review both copies and the saved history before making a replacement. Keep backups of the notes and local sync history; deleting history is not a reset procedure. A moved vault path needs its old history/links reviewed before reconnection.

Imported notes and identity-link writes are shown as changes that cannot use ordinary note undo. Date/completion changes imported into an existing note can be undone, subject to the usual version check; that undo then syncs back to Reminders. Undoing a note does not roll back an earlier external reminder operation.

## Try it

1. Connect a disposable vault and two dedicated test lists.
2. Ask Smith: “Add a personal task called Example errand with a deadline of 20 November 2026.” Open the mapped Life list after Sync now.
3. Tick it in Reminders, sync, then refresh Orb's Today/tasks view. Check the task is completed.
4. Add an unfinished reminder in the Business list and sync. Its note appears in Business tasks with category Inbox.
5. Edit its deadline in Orb and in Reminders to different dates before syncing. Check that Settings reports a conflict and preserves both dates.

These actions write vault notes and Apple Reminders. The offline tests use temporary vaults and an EventKit mock; they do not prove iCloud propagation, native section retention, alert delivery, or macOS permission behaviour. The browser preview shows setup but cannot connect to Apple Reminders.

Implementation: [sync service](../../src/reminders.cjs), [native bridge](../../native/reminders.mm), [settings UI](../../src/reminders-ui.js), [tests](../../test/reminders.test.cjs).
