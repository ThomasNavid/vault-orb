# AI daily planner — proposed implementation plan

Status: implemented in the source app; see [AI daily planner](features/daily-planner.md) for the delivered workflow and limits. The design below records the implementation contract. Automated checks use temporary vaults and mocked provider/calendar responses; the browser preview is fictional. Live AI and Google Calendar testing is not claimed.

## Product outcome

“Help me make a realistic plan for today” should produce a manageable day grounded in the user's tasks, goals, commitments, and stated preferences. Orb explains what it selected, what does not fit, and which assumptions need attention. The user can refine the draft by voice or text and apply specific changes from a concrete preview.

AI recommends priorities, interprets constraints, and suggests estimates. Local code calculates available time, places work, validates the result, and executes requested changes. An apparently confident model answer must never substitute for actual calendar availability or task identity.

## Intended experience

1. Open **Today → Plan my day**, or say “Help me plan today.” Tomorrow is also supported, using the same one-day workflow.
2. Show the planning date, timezone, working window, breaks, and calendar coverage. Reuse configured working hours; offer a day-only override. Optional quick inputs: **Must do**, **Finish by**, **Energy: low / usual / high**, and **Life / Business / Both**. Do not require a questionnaire before producing a useful draft.
3. Read eligible tasks and active goals. Bring in linked task details selectively. Ask a focused question only when missing information materially changes the plan, such as an unknown duration for a must-do task. Other assumptions can remain visible in the draft.
4. Present a capacity summary, up to three priorities with reasons, a timeline, and **Not in this plan**. Distinguish existing calendar events, existing task bookings, proposed task sessions, breaks, and unscheduled buffer time.
5. Let the user adjust durations, pin tasks or proposed times, exclude work for this day, and refine conversationally: “Finish by three,” “Keep the proposal first,” or “I have less energy today.” Show what changed between drafts.
6. **Save plan** saves a readable Markdown day note. **Apply to tasks…** shows a concrete summary of date changes, optional estimate changes, and any selected calendar bookings. One apply action authorizes exactly the displayed changes.
7. Later, **Replan remaining day** refreshes sources and produces another draft. Preserve completed work, past sessions, current work marked as started, pinned commitments, and existing calendar bookings. Never infer completion from elapsed time.

Opening Today, refreshing it, and editing a saved plan manually must remain useful without an AI request. AI runs when the user requests a plan or a conversational revision, not on every dashboard refresh.

## What the planner shows

| Element | Behaviour |
| --- | --- |
| Capacity | “3 hours available for new work · 2 hours 15 minutes proposed · 45 minutes left free.” Show uncertainty when a duration or calendar source is missing. |
| Priorities | Up to three concrete tasks, each with a short reason linked to actual evidence: a deadline, an active goal's next action, or an explicit user choice. Do not fill three slots artificially. |
| Timeline | Fixed commitments alongside proposed work, with separate visual and text labels for booked and unbooked blocks. |
| Estimates | Label durations as **Your estimate**, **Saved estimate**, or **AI suggestion**. Keep suggested cognitive demand equally distinguishable from user preferences. |
| Not in this plan | Explain exclusions: not enough time, no sufficiently long gap, blocked by a stated prerequisite, missing estimate, or deliberately deferred. Exclusion does not change a date or deadline. |
| Source status | Show planning timezone and last refresh; surface incomplete calendars and unreadable tasks without hiding usable sections. |
| Actions | Edit duration, include/exclude, pin, refine, save, and apply. Provide keyboard controls rather than requiring drag-and-drop. |

Illustrative interaction, using fictional records:

> User: “Plan tomorrow. Finish by three and protect time for the proposal.”
>
> Orb: “After your meetings and lunch, there are three hours for new work. I suggest the proposal first because it is the next action for your launch goal, then the invoice due tomorrow. I've suggested 60 minutes for the proposal; adjust that if needed. The website tidy-up can wait.”
>
> User: “The proposal needs 90 minutes. Leave the last half hour free.”
>
> Orb updates the proposed timeline, preserves fixed events, and shows which work no longer fits. Nothing has been booked.

## Inputs and selection

Use a dedicated planning snapshot rather than only the current Today result: Today omits undated tasks, and the visible dashboard shows limited subsets.

- Include tasks explicitly selected by the user, tasks planned for the day, past deadlines, deadlines approaching within seven days, active goals' next tasks, and earlier planned unfinished work. Offer relevant undated tasks from the chosen lists so important work can enter the day.
- Preserve existing future plans by default. Do not silently pull a task from another day simply because its deadline is near. Explain a proposed change when the user asks to include it.
- Include the current occurrence of recurring tasks when relevant; never expand an entire future series into the day. Recurrence errors or externally completed occurrences that need reconciliation remain visible for repair.
- Exclude completed tasks from new work. Keep completed calendar blocks as history. Track recurring selections by both note identity and occurrence date so completion cannot accidentally substitute the next occurrence.
- Use active goal finish lines and next-task links. Read the weekly planning note only when selected or requested. Habit targets and knowledge revisits can appear as suggestions, but do not become timed tasks or logged completions automatically.
- Use a bounded candidate context, initially 60 tasks. Explicit selections, due-today/past-deadline tasks, and existing bookings must not be silently dropped to meet that bound. If essential candidates alone exceed it, ask the user to narrow the scope. Show coverage and omitted counts; offer more candidates in the UI.
- Start with metadata, then read only relevant task details and linked goal context. Calendar timing can be sent as busy intervals; external event descriptions and unrelated vault notes are unnecessary.

Prioritisation considers explicit user constraints first, then deadline risk, goal relevance, prior commitments, stated blockers, effort, and preferences about energy or task switching. A past Planned date is not a deadline. A goal Target is not a task Deadline. Explain tradeoffs without manufacturing a precise productivity score.

## Estimates and task properties

Add one optional task property initially: `estimated_minutes`, a positive whole-number estimate for the task's remaining work. Existing tasks need no migration. Validate and preserve unknown YAML properties, comments, and note bodies.

Existing booked duration describes a reserved session, not proof of the task's total effort. If the task lacks an estimate, AI may suggest one with a brief assumption and an uncertainty label. Broad tasks such as “Launch website” should prompt a smaller next action rather than receive a confident arbitrary duration. Suggested decomposition remains advice until task creation is requested.

Keep estimated effort separate from booking limits: the existing calendar API accepts sessions of 5–480 whole minutes. A larger estimate remains visible as work that needs decomposition; a very short task can remain untimed. Do not silently clamp either to a bookable duration. Recurring estimates remain specific to the draft occurrence in the initial release.

AI suggestions live in the draft. They are persisted to task notes only when included in the reviewed apply request. Booking with an AI-suggested duration requires the user to accept the displayed duration; no separate confirmation is needed after that concrete booking has been authorised. This is an explicit extension to the current assistant rule that durations must be supplied rather than inferred.

Optional day energy and a preference for demanding work earlier/later can remain plan settings in version one. Additional task metadata such as dependencies, permanent priority, or measured time spent should follow demonstrated need.

## Capacity and placement

Extract a shared availability reader and interval utilities from `scheduling.cjs`. `findTaskTime` is designed for one task and returns at most 12 slots; it cannot serve as a whole-day capacity model.

1. Resolve the day in the planning timezone. Use the calendar display timezone when connected and the Mac timezone otherwise. Store that choice with the plan. Preserve the existing local-date semantics of task Planned/Deadline and show when a proposed booking maps to a different Mac date.
2. For today, start from the current time. Use configured working days/hours, an explicit day override, and user-selected breaks. A non-working day has no work window unless overridden.
3. Clip commitments to the planning window, merge overlapping busy intervals, and subtract their union. Deduplicate display rows where possible; merging intervals must prevent duplicate feeds, overlapping meetings, and existing linked blocks from reducing capacity twice.
4. Reserve 20% of remaining free time by default, adjustable per day. Keep lunch and other breaks separate. This is a proposed starting preference, not a claim about ideal productivity.
5. Place ranked tasks into remaining gaps using their accepted or visibly provisional estimates. Respect pins and expressed time-of-day preferences when feasible. Reserve each placed interval locally before placing the next task.
6. Honour actual timed deadlines; a date-only deadline means the day, not an invented hour. Flag impossible or already missed deadlines rather than compress estimates, remove breaks, or move deadlines.
7. Show overflow and fragmented availability honestly. Ninety free minutes in three small gaps cannot fit a single 90-minute task. Do not silently split tasks, overlap work, or assume unlimited capacity.

Use `calendar-time.cjs` for wall-time conversion and daylight-saving validation. Reject ambiguous or nonexistent times. Keep existing conservative calendar rules, including busy all-day events and recurring-event feed coverage.

When no calendar is configured, support a clearly labelled provisional timeline based on a user-provided working window and manual commitments. When a configured source fails, describe coverage as incomplete; continue with prioritisation and, if requested, a provisional draft. Do not label the uncovered time as confirmed free or enable booking until the existing availability requirements are satisfied.

## AI integration

Reuse the configured OpenAI/OpenRouter provider and existing text-session adapter. Use the separate reasoning model when configured, otherwise the chat model. No additional account or provider is required.

Give the planning model a dedicated instruction set and a restricted capability set: read the supplied snapshot, request bounded relevant context, ask a necessary clarification, and return a structured proposal. The existing `think_deeply` route can access write tools, so reusing it unchanged would violate the draft boundary.

Route planning requests from Today, chat, and voice through the same restricted backend. A planning request must not regain mutation tools through nested delegation. Treat retrieved note content as reference data, not instructions. Save/apply requests use the separate validated action path.

The proposal should contain snapshot and draft revision identifiers, ranked task references, proposed durations with provenance, suggested time preferences, up to three priorities, reasons tied to sources, exclusions, and unresolved questions. Task references must resolve to the supplied snapshot. Do not accept model-generated arbitrary file paths, calendar IDs, write commands, or claims of successful booking.

Use a schema-validated tool response such as `submit_day_plan` so the same contract works across both providers. Validate task uniqueness, source references, numeric bounds, occurrence identity, and selected-day constraints locally. The local allocator owns final times and capacity totals. If model output is invalid, permit one bounded repair attempt; then retain the previous usable draft and show an actionable error.

Prefer one reasoning call per initial draft or substantive conversational revision. Changing a duration, pin, or exclusion should trigger immediate local recalculation without another AI call. Abort requests when cancelled and ignore results for stale draft generations. API failure or a missing key leaves manual planning and existing Today views available.

## Persistence and write boundaries

Draft generation and refinement do not change vault notes or calendars. Build the draft snapshot with calendar reads that skip automatic task-link synchronisation. Today already reconciles links when opened; keep that existing behaviour distinct and capture plan versions after any such reconciliation. A link needing repair is not a reason for the AI to repair it implicitly.

Recommended persistence:

- Cache the in-progress draft locally per vault, date, and timezone so a restart can resume it. Revalidate it before applying; a cache is never a second authority for task completion or calendar state. Clear it with a Discard action and document retention.
- Save accepted plans as `0. Home/Daily Plans/YYYY-MM-DD.md`, containing a readable priorities list, timeline, excluded work, assumptions, and links to tasks. Use a versioned managed section for planner state; preserve user-written content outside it. Existing unrelated files at that path require a different filename or explicit choice.
- Keep task properties in task notes and calendar links in their current records. A saved plan is a dated plan, not evidence that work happened. Opening it later refreshes live status separately.

The action boundaries are deliberately visible:

| Action | Effect |
| --- | --- |
| Generate / revise | Update the local draft only; selected context goes to the configured AI provider. |
| Save plan | Create or update the Markdown day plan using a version check and the existing note journal. |
| Apply to tasks | Save the plan and apply only the displayed changes to selected tasks. For eligible unlinked one-off tasks, set date-only Planned by default; existing timed Planned values require an explicit displayed change. |
| Save selected estimates | Optional part of the apply preview; update `estimated_minutes` for the selected tasks. |
| Book selected blocks | Optional, initially off; create linked calendar blocks for eligible tasks at the accepted times. Booking itself sets timed Planned. Do not first overwrite Planned separately, which would spoil the scheduler's saved pre-booking value. |
| Replan remaining day | Produce a new draft. Applying any resulting changes is a separate explicit action. |

Excluded tasks keep their dates. Deadlines never change as a side effect of planning. Existing bookings remain fixed in version one; explicitly moving one can use the established task-block workflow before replanning. Recurring occurrences may appear in the draft and saved plan, but initial bulk apply does not reschedule their dates or book them. Their existing occurrence controls remain available.

## Applying and recovering

Bind an apply request to the exact reviewed plan revision, selected actions, task versions, occurrence identities, calendar destination, and accepted durations. Resolve actions from that validated plan on the backend; do not trust raw renderer or model mutation payloads.

Preflight all selected records and refresh calendar availability. If any relevant input changed, show the affected changes and refresh the preview before starting. Also check versions immediately before each mutation and availability immediately before each booking; preflight alone cannot prevent intervening edits or calendar races.

Apply operations serially through existing task and scheduling APIs. Do not use parallel calendar writes: scheduling already has a per-vault exclusive guard. Add an apply coordinator that prevents overlapping apply attempts, without nesting the same non-reentrant scheduling guard or holding a filesystem lock across network requests. Suppress or report conflicting refreshes during application.

Persist an operation ID and per-action outcome before remote writes. Use existing calendar-block identities and recovery markers. On retries, inspect prior results and pending links rather than creating another event. Recognise `alreadyLinked` as a state to verify, not proof that a newly requested time was booked. An accepted estimate edit changes a task version; subsequent actions must use the version produced by that verified edit, without accepting intervening external edits.

On a failure or cancellation, stop further actions and show **Applied**, **Pending recovery**, and **Not applied** per item. Already completed writes remain visible. Save the actual outcomes in the day plan when possible; if that write fails, retain the recovery ledger and report the plan note as unsynchronised. Reopening the app can inspect and resume the operation safely.

Ordinary note edits use existing version-checked undo. Calendar changes use existing move/remove/repair actions; do not promise a single atomic undo across calendar events and multiple notes. Refresh-derived availability is still subject to upstream calendar lag and concurrent bookings, as in current scheduling.

## Implementation sequence

| Stage | Deliverable |
| --- | --- |
| 1. Planning foundation | Optional duration property; full candidate snapshot; shared availability/interval logic; deterministic capacity and placement; manual draft editing. |
| 2. AI proposal | Restricted planner session; structured proposal validation; source-backed reasons, provisional estimates, prioritisation, and conversational revision. |
| 3. Today experience | A dedicated planner panel opened from Today, chat, and voice; timeline, priorities, overflow, pins, local recalculation, and draft persistence. |
| 4. Save and apply | Markdown day plans; reviewed task changes; optional calendar booking; serial application, durable outcome reporting, and recovery. |
| 5. Replanning and release checks | Preserve fixed and started work; stale-input handling; browser/Electron checks, live disposable-vault checks, and user documentation. |

Suggested modules: `day-planner.cjs` for snapshots/validation/allocation, `day-planner-ai.cjs` for constrained model interaction, `day-plans.cjs` for persistence/apply coordination, and `day-planner-ui.js` for the panel. Reuse `providers.cjs`, `calendar-time.cjs`, the scheduler, vault journal, and existing preload/main IPC patterns. File boundaries are implementation recommendations, not a reason to duplicate existing helpers.

Update the planning/Today/task-scheduling guides, provider/privacy notes, vault format, starter templates, cookbook, and development documentation when the feature ships. The optional Daily Plans folder must not become a requirement that invalidates existing vaults.

## Acceptance criteria

- A fully booked day produces no invented free slots. Overlapping events and duplicate calendar sources are counted correctly. Breaks, reserve time, current time, working-day overrides, fragmentation, and daylight-saving transitions have meaningful offline coverage.
- Important undated work can be proposed. Past Planned and real Deadline remain distinct. Candidate truncation, missing estimates, and unreadable sources are visible.
- AI cannot invent task identities, use mutating tools during drafting, or make provider calls on ordinary Today refresh. Test malformed output, unsupported paths, embedded instructions, cancellation, and stale responses with mocked providers.
- Duration edits and pins recalculate locally. Infeasible constraints yield a clear explanation. User pins survive AI revisions; contradictory new instructions require an explicit resolution.
- Generating/revising a draft leaves task notes and calendars unchanged. Saving changes only the plan note. Apply writes exactly the selected changes and preserves unrelated Markdown/YAML content.
- Stale notes, a recurring occurrence advancing, external calendar moves, double-click apply, retries, restart during a pending booking, and partial failure cannot silently overwrite edits or create duplicate blocks.
- Missing AI access still permits manual drafts. Missing calendar coverage permits qualified prioritisation but cannot become a claim of free time or bypass booking checks.
- Browser previews use fictional records and cover keyboard use, narrow panels, long titles, loading, empty, stale, overflow, and partial-failure states. Run relevant offline tests and the full `npm test` suite for implementation; distinguish those results from live model and Google Calendar checks.

## Later extensions

After the single-day workflow is reliable: multiple sessions per task, recurring occurrence booking, weekly capacity planning, explicit task dependencies, learned estimates from user-recorded work sessions, optional habit time blocks, and user-enabled reminders. None is needed to deliver the initial AI-assisted daily plan.
