# AI daily planner

[Documentation](../README.md) · [Today](today-and-explore.md) · [Task scheduling](task-scheduling.md)

Open **Today → Plan my day** or **Explore → Plan my day** to turn tasks and calendar commitments into a realistic day. You can also say “Help me plan today” or “Plan tomorrow; finish by three.” Chat and voice open the same planner.

## Make a draft

The planner reads unfinished tasks from your configured Life and Business folders, including undated work, and the next actions of active goals. Existing future plans start excluded. Completed work is not proposed again, and recurring tasks refer only to their current occurrence.

Under **Shape your day**, choose a working window, task list, energy level, and the percentage to leave free (20% initially). Add breaks or manual commitments. Working days and hours start from your calendar settings; enable the day override to plan on a non-working day. The date picker also lets you open tomorrow or another date.

The capacity calculation merges overlapping calendar events, excludes elapsed time, protects breaks, and reserves buffer time. Each task gets one continuous gap. A task that cannot fit appears under **Not in this timeline** with a reason; its dates remain unchanged.

Without complete calendar coverage, the plan is labelled **Provisional availability**. Known events still occupy time, but booking is unavailable. You can build a manual draft and add commitments yourself. Google booking requires the same token, selected calendar, matching recurrence feeds, and running Obsidian plugin as [linked task scheduling](task-scheduling.md#setup).

## Ask AI to help

Enter priorities or constraints and choose **Plan with AI**. Later use **Refine with AI**, for example:

- “Protect time for the proposal and finish by three.”
- “The proposal needs 90 minutes. Keep it first.”
- “I have low energy today; put the demanding work earlier.”
- “Replan the remaining day around my updated calendar.”

Orb uses the configured reasoning model when enabled, otherwise your chat model. It supplies task metadata, bounded relevant note excerpts, active goal context, your preferences, and busy intervals. AI proposes a priority order, reasons, estimates, and any necessary questions. Local code calculates the final timeline and checks its constraints. The planning model has no note-editing, booking, or delegation tools.

AI considers up to 60 candidate tasks and reports omitted coverage. Essential and pinned tasks are retained; if those exceed the bound, narrow the task list first. Opening Today, opening a manual draft, and editing its controls do not call AI. A missing key or failed request leaves manual planning available.

## Edit the plan

Expand **Tasks and estimates** to change minutes, include/exclude tasks, reorder work, or pin a task and optionally a time. Labels distinguish **Your estimate**, **Saved estimate**, and **AI suggestion**. These changes recalculate the draft locally.

Choose **Started** to preserve a proposed session during replanning. **Release session** makes it available to place again. Replanning preserves earlier proposed sessions as history, current started sessions, and existing bookings. Elapsed time never marks a task complete.

Existing calendar bookings stay fixed. Move them through the existing scheduling workflow, then refresh the planner. An impossible pin is reported rather than moved silently. Estimates above eight hours require a smaller next action; tasks shorter than five minutes can stay in the plan but are not eligible for calendar booking.

## Save and apply

**Save plan** creates or updates `0. Home/Daily Plans/YYYY-MM-DD.md`. It saves priorities, proposed times, assumptions, task links, and any apply outcomes. Task dates and calendars are unchanged. A conflicting unrelated note gets a separate filename. Text outside the marked planner section is preserved; if Obsidian edited the note, refresh before saving again.

**Apply to tasks…** offers separate choices for each eligible one-off task:

| Choice | Result |
| --- | --- |
| Planned date only | Set the selected date in the task's `planned` property. Proposed times remain in the day plan. The review shows the previous date/time. |
| Save estimate | Save `estimated_minutes` to the task, including an explicitly selected AI suggestion. |
| Book time | Create a linked calendar block at the displayed time and duration. Booking sets timed Planned; it does not change Deadline. |

Choose **Review selected changes**, inspect the exact actions, then **Apply these changes**. Selecting a booking accepts its displayed duration, including a labelled AI suggestion. Task dates, goals, calendar coverage, and settings are checked again; stale plans require refresh and review. The conversational planner directs you to these controls instead of applying its own suggestions.

Recurring tasks and already linked tasks remain visible but cannot be bulk-rescheduled or booked here. Use their existing management controls. Excluded tasks and real deadlines are never moved as a side effect.

## Interrupted work and undo

Each action reports **applied**, **not applied**, or **pending recovery**. A failure stops later actions and retains successful changes. **Resume remaining changes** checks the prior operation and reuses the same booking identity. If a link needs repair, follow [calendar recovery](task-scheduling.md#partial-writes-and-recovery) first. **Keep changes and close review** ends the operation without running the remaining actions; inspect any uncertain calendar booking before creating another plan.

Note edits use Recent changes and version-checked undo. Calendar bookings use the existing remove/move/repair controls. There is no single transaction or undo across a saved plan, several tasks, and external events.

In-progress drafts are cached locally per vault/date and resume after restart. Ordinary caches expire after 30 days without a write; unfinished apply records are retained. **Discard cached draft** removes the local draft, not saved Markdown or task/calendar changes. See [Privacy](../privacy.md).

## Verification and limits

Offline tests exercise actual temporary-vault writes, capacity and timezone rules, structured AI responses with mocked providers, stale revisions, cancellation, and recovery. The browser preview uses fictional data and simulated actions; it does not verify live AI or Google Calendar behaviour. Existing upstream calendar-cache delays still apply.

This release does not split a task across sessions, move existing bookings as part of a plan, schedule recurring occurrences, infer actual time spent, or run background reminders.
