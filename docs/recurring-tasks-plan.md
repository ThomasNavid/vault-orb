# Recurring tasks — proposed implementation plan

Status: implemented for desktop Obsidian and Orb; see [user documentation](features/recurring-tasks.md) for the delivered scope. Automated cross-adapter tests and browser UI checks are recorded in development documentation; live Dataview/mobile testing is not claimed. Required by the user: recurring tasks must be fully manageable in Obsidian with Orb closed or uninstalled. The vault is the source of truth; Orb is an optional interface. Proposed defaults are both schedule modes and one note per series.

## Intended experience

Create a task such as “Put the bins out every Tuesday” or “Replace the water filter three months after I finish it.” Obsidian and Orb show the same current occurrence. Completing it in either interface records what happened and schedules the next occurrence in one undoable action.

The Obsidian workflow is a version-one requirement: create a recurring task, configure repetition, change dates, complete, skip, stop repeating, inspect history, and undo the latest supported transition without opening Orb, using an API key, or contacting a service. Merely storing readable notes is insufficient; the working controls and date calculation must ship inside the vault too.

Recommended storage: one stable Markdown task note per recurring series, with completion history in that note. This preserves links, supporting details, and the existing single-file undo mechanism. The alternative—one note per occurrence—preserves completed rows but needs coordinated multi-file writes, duplicate prevention, and a decision about goal links. Choose that alternative only if separate occurrence records are a product requirement.

## Version-one scope

- Fixed schedules: every N days, every N weeks on selected weekdays, every N months on a numbered day, and every N years on a month/day. Monday starts the week; weekdays are a weekly Monday–Friday selection.
- Completion-relative schedules: N days, weeks, months, or years after the date the user records completion.
- Date-only schedules initially. Existing timed one-off tasks keep working; adding recurrence to a timed task requires an explicit decision to remove its times. Timed recurrence can follow later.
- Ship a vault-local Obsidian recurring-task dashboard using Dataview JavaScript, which the existing habit dashboard already requires. Include a Repeat editor, creation, Complete/Skip, Stop repeating, history, and Undo controls. Provide the same operations through Orb's native UI and chat/voice as optional interfaces.
- One open occurrence per series. No automatic accumulation of missed task notes.
- No notifications, Google event creation, arbitrary RRULE input, holiday calendars, ordinal weekdays such as “last Friday,” or automatic task execution in this version.
- No pause state or end-after-count machinery initially. Stop repeating preserves the current task and its history; repeating can be configured again later.

## Behaviour contract

| Situation | Proposed behaviour |
| --- | --- |
| Finish a fixed weekly task late | Record completion; select the first scheduled date after both the occurrence's nominal date and the recorded completion date. The original weekday remains fixed. |
| Finish a completion-relative task late | Calculate the next date from the recorded completion date. |
| Finish a future occurrence early | Record the early completion; fixed recurrence still advances beyond that occurrence, never back to an earlier slot. |
| Miss several occurrences | Keep the current occurrence open until explicitly completed or skipped. Fixed recurrence then advances to the next future slot; omitted slots are not recorded as completed. |
| Skip | Log “skipped,” then advance. For completion-relative recurrence, use the explicit skip date as the new interval start and show that behaviour in the preview. |
| Repeat on the 31st | Use the month's final day when necessary, retaining 31 as the anchor: January 31 → February 28/29 → March 31. |
| Repeat annually on February 29 | Use February 28 in non-leap years; retain February 29 as the anchor. |
| Undo completion or skip | Restore the previous occurrence and dates, and record its reversal. Both interfaces offer this using vault-local state; refuse if a later change conflicts. Orb's existing exact Activity undo remains separate. |
| Stop repeating | Remove the active rule without completing, deleting, or moving the current task; keep its history. |
| Edit a schedule | Show the resulting current date and next-date preview; retain old history. Do not silently complete or skip the current occurrence. |
| Reopen the occurrence just completed | Use the portable Undo last occurrence action, or Orb's exact Activity undo when available. Do not interpret `completed: false` as permission to erase recurring history. |

Dates use the device's local calendar, matching existing task semantics. Calendar arithmetic must not add milliseconds per day or depend on daylight-saving transitions. Capture the operation date once. The user may supply a past completion date; reject future dates and dates earlier than the previous resolved occurrence's completion/skip date.

## Planned dates and deadlines

Recurrence advances an explicitly selected field: `planned` or `due`. Default to Planned for an activity and use Deadline only when the request expresses a real deadline. If the task has both dates and the intended anchor is unclear, ask once.

The other date, when present, moves by the same calendar-day delta, preserving its current offset. Empty dates stay empty. Show this in the editor preview before applying the configuration. Example: a report planned on the 28th and due on the 30th moves together when its deadline repeats.

Keep the fixed schedule's original anchor separately from the current occurrence's actual dates. Postponing just this occurrence must not change “every Monday” into “every Thursday.” Moving the other date changes the offset carried forward; the UI should say so. Changing the repeat pattern is a separate explicit operation.

Preserve existing Today semantics: planned OR due today; past deadlines remain separate. Add a labelled “Earlier planned recurring tasks” group in Orb and the starter Obsidian views so unfinished recurring tasks with only a past Planned date stay discoverable. Do not label these tasks overdue or invent a deadline.

## Storage and mutation design

Existing one-off task notes require no migration. Add optional, documented properties; provisional schema:

```yaml
type: task
category: Inbox
planned: 2026-10-05
due:
completed: false
recurrence:
  version: 1
  mode: fixed
  unit: week
  interval: 1
  weekdays: [monday]
  date_field: planned
  anchor: 2026-10-05
  occurrence: 2026-10-05
recurrence_history: []
```

`anchor` defines the fixed pattern; `occurrence` identifies the current nominal slot even if its actual dates are postponed. Use only fields valid for the chosen mode/unit; validate types, positive integer intervals, and date bounds. Completion-relative mode derives subsequent month/year anchors from each completion date. Never infer a rule from a task title.

Each history item records an operation ID, nominal occurrence, original Planned/Deadline dates, outcome (`completed` or `skipped`), effective local date, and a UTC recorded-at timestamp. Store the recurrence state and dates before/after the transition as needed for portable reversal, with explicit reversal records referencing the original operation. Keep history in structured YAML for reliable parsing; render a readable history view in both Obsidian and Orb. Preserve unrelated YAML, comments, and note body. Do not silently truncate history when approaching the existing note-size limit; report the limit before writing.

Successful completion/skip appends history, advances the dates and occurrence, and leaves `completed: false` for the new open occurrence. Return an explicit result such as “Completed October 5; next planned October 12,” rather than treating the final boolean as evidence that completion failed. Completed occurrences are visible in history, not separate rows in All tasks.

Use a shared pure note transformation and one file write for the entire transition. Orb applies it through its existing journaled `Vault.commit()`; Obsidian applies it through `app.vault.process()` against the current file contents, validating the expected version/occurrence inside the callback. Do not calculate mutations from Dataview's potentially stale metadata cache. Bundle a comment-preserving YAML parser for the Obsidian adapter; avoid `processFrontMatter()` reserialisation if it loses the preservation contract.

Require current note version and expected occurrence identity. Repeated clicks, stale tools, and retries must not advance twice: include a client operation ID, recognise a previously applied operation, and reject reuse with different arguments. Disable in-flight controls and never automatically retry a stale completion against the newly advanced occurrence. The operation history and reversal data live in the task note, not Orb's private journal, so an action completed in either interface can be inspected and reversed from the other when its expected state still matches.

Obsidian's process callback and Orb's filesystem write do not by themselves constitute a cross-process transaction. Validate coordination of local writes from both adapters before shipping; do not claim version checks alone eliminate a simultaneous-write race. Resolve a tested coordination strategy during the storage implementation. Concurrent offline edits on different synced devices require explicit conflict handling; do not promise automatic merging of occurrence histories. Preserve recoverable conflicting data and surface divergence rather than silently inventing a merged completion.

Invalid recurrence metadata must leave the task visible with a warning. Block advancement without writing; allow an explicit repair or Stop repeating. Reading lists, startup, refresh, calendar queries, and date changes must never write or advance recurrence.

## Obsidian is a complete interface

Add `0. Home/Recurring Tasks.md` with a full Dataview dashboard and embed compact actionable views in Home and Today. Store its reviewed scripts and styles under `99. System/99.4 Scripts/recurring-tasks/`. A user copying the vault to another Obsidian installation with Dataview and JavaScript queries enabled must get the complete feature without Orb, Node, a build step, or a network download at runtime. The shipped adapter uses Obsidian’s embedded desktop Node runtime for a shared exclusive filesystem lock. No separate Node installation is needed. Mobile editing is deferred; note reading remains portable.

The dashboard must support:

- Creating a new recurring note in either configured task folder, or adding repetition to an existing task.
- Editing both repeat modes with a readable schedule and next-date preview, without editing YAML by hand.
- Completing or skipping the current occurrence and immediately seeing its next date.
- Postponing an occurrence, changing the pattern, stopping repetition, viewing history, and undoing the latest eligible completion/skip.
- Showing earlier planned tasks, real past deadlines, malformed rules, and pending external completions.
- Opening the underlying Markdown note; all data remains editable and readable as ordinary vault files.

Obsidian Bases currently edits `completed` directly. This cannot safely supply a completion date or calculate recurrence by itself. Keep the ordinary Done column for one-off tasks; recurring tasks get actionable dashboard controls alongside those tables. Also expose recurring notes in read-only summary views. Do not tell users to open Orb to complete a recurring task.

If someone directly sets `completed: true` on a recurring note, show “Advance needed” in both interfaces, including with Orb closed. Offer explicit reconciliation with a chosen completion date, or cancellation, inside Obsidian itself. Never use file modification time as a completion date or mutate merely on rendering. No watcher or background daemon is required: completing in the dashboard performs the advancement immediately.

Dataview with JavaScript queries is an explicit dependency of the Obsidian controls, matching the existing habits setup. Core Obsidian alone can still read/edit the notes but does not execute the recurrence logic. Include a visible setup link outside the script block explaining this. Orb must not become a fallback requirement if a script fails; show an actionable setup/version error in the vault.

Existing vault dashboards must not be overwritten: provide a documented installation/update path for the new note, bundled scripts and selected Home/Today embeds, preserving user customisations. New vaults receive these assets in the starter. Keep all folder configuration in vault-local dashboard inputs/configuration, including non-default task folders; do not depend on Orb settings for Obsidian to find the records.

## Shared implementation and linked goals

Maintain one canonical recurrence engine and note transformation in the repository. Build the Obsidian bundle from that source with its YAML dependency; commit/distribute the generated `.js` asset with the vault template and verify it is up to date. Orb imports the trusted application copy; it must not execute arbitrary JavaScript read from a user's vault. Both adapters consume the same schema and conformance fixtures. Version the schema/bundle and reject unsupported rules visibly without changing them. Shipping a separate handwritten recurrence implementation for each app is out of scope.

Portable undo is part of the shared transformation: verify that the latest unreversed transition still matches current recurrence/dates, restore its prior occurrence state, and append a reversal entry while preserving unrelated note content. Refuse ambiguous or conflicting reversals. Orb's private Activity history still covers Orb-origin writes only; Obsidian completion and portable undo must function without that history existing.

Stable goal links follow the recurring series. Show the latest completion and next occurrence in the linked-task card so advancement does not hide evidence of progress. Explain that the link now represents an ongoing action, and never automatically achieve the goal. If the user wants the goal to reference one specific occurrence instead, use a separate one-off task in this version.

## Implementation sequence

1. **Shared engine and portable records:** add pure recurrence validation, summaries, previews, advancement, note transformation, and reversal. Inject dates and operation IDs. Define schema/version handling, history and conflict checks. Build a self-contained Obsidian asset from the same source used by Orb.
2. **Obsidian workflow first:** implement the vault-local Dataview dashboard and file adapter, creation and Repeat editor, Complete/Skip/Stop/History/Undo, Home/Today embeds, setup guidance and configurable folders. Prove the whole lifecycle works with Orb closed before treating the feature as implemented.
3. **Orb vault adapter:** extend task reads/creation/configuration and use the shared completion/skip/reversal transformations through the existing journal. Route `update_task(completed: true)` through recurrence when applicable. Preserve one-off behaviour and reject ambiguous combined mutations. Test local cross-adapter coordination and sync conflict reporting.
4. **Assistant contract and native controls:** extend schemas/instructions in `src/agent.cjs`, bounded IPC in `src/main.cjs`/`src/preload.cjs`, and task UI in the renderer and chat visual integration. Both AI and native controls invoke the same rules and report the resolved occurrence and next dates.
5. **Related views:** refresh task, Today, goal, and task-inclusive calendar panels after changes in either interface. Obsidian dashboards refresh from its vault events/cache; Orb rereads external changes on refresh. Calendar shows only the currently materialised occurrence. Surface earlier planned tasks and external completions needing advancement.
6. **Templates, packaging and documentation:** update task rules, Bases, Home/Today views, assistant guide, task/vault-format/Obsidian-only docs, and workspace packaging tests for the new assets. Keep the starter empty. Document Dataview setup and safe installation into existing customised vaults. Verify no runtime build, Orb process, private application state or network is needed in Obsidian.

## Acceptance and verification

- Fixed weekly dates remain anchored after early/late completion; completion-relative schedules move from the recorded completion date.
- Multi-week weekday selection, month/year boundaries, leap days, month-end clamping, and local daylight-saving boundaries calculate correctly.
- Planned-only, deadline-only, both-date offsets, postponed occurrences, stop/reconfigure, and long-missed schedules match the contract.
- One completion produces one history entry and one next occurrence; repeated operation IDs, changed versions and rapid clicks cannot advance twice. Exercise competing Obsidian/Orb writes and fail the release if either supported adapter silently loses a transition; document and test synced-device conflict limitations separately.
- Completion and portable reversal preserve the note body, unknown metadata and YAML comments in both interfaces. Orb's exact Activity undo restores original bytes; recovery of its existing pending journal entry does not reapply the transition.
- Invalid metadata and externally completed recurring notes remain visible and actionable without read-time writes.
- One-off task behaviour and custom task folder support remain unchanged. Linked goals and calendar views refresh without creating events or marking goals achieved.
- Both sets of controls work without a model/API key; voice/chat report the same result through the same shared transformations. Keyboard access and status announcements cover the editor, completion, errors, and undo.
- Add shared conformance tests against the application module and distributed Obsidian bundle, plus vault/agent/Today/goals/calendar and Obsidian-adapter integration coverage. Verify template assets survive workspace creation and application packaging. Run `npm test` after implementation.
- Release gate: quit Orb, copy the starter into a fresh Obsidian vault, enable only the documented Obsidian dependencies, and create/configure/complete/skip/reschedule/stop/view-history/undo recurring tasks. Repeat after removing access to Orb's private state and without network access. Copy the vault to a second installation and confirm its records/history still work.
- Complete in Obsidian, refresh Orb and inspect/undo the eligible transition; then complete in Orb, refresh Obsidian and inspect/undo there. Include month ends, malformed rules, custom folders, direct Bases edits, and both apps open. Test Obsidian desktop and mobile compatibility before claiming both supported.

Implementation followed this plan with desktop-only Obsidian editing. Live Dataview installation and mobile compatibility are not claimed by the automated validation. Existing vaults receive the dashboard through an additive installer; personalised Home/Bases edits remain explicit.
