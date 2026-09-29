# Focus sessions — proposed implementation plan

Status: implemented. See the [user guide](features/focus-sessions.md) for the delivered scope. Decisions taken: progress is logged in the task note, the orb reappears without taking focus and a notification is posted, and there is no `focus_minutes` frontmatter total.

## Intended experience

Say or type “Give me 25 minutes on Draft proposal.” Smith confirms in one short sentence and a thin progress ring appears around the orb. The ring fills clockwise from 12 o'clock as time passes. The orb keeps behaving normally: it can be hidden, summoned, and talked to without affecting the timer.

When time is up, the orb comes back into view without taking focus, jumps, and the ring bursts into a few sparks. A small card appears: “25 minutes on Draft proposal”, with **Log progress**, **Mark done**, **+5 min** and **Done**. Log progress takes a one-line note and appends it to the task note's `## Focus log`, as one undoable change.

## Version-one scope

- One session at a time, from 1 to 180 minutes. The default is 25 when no length is given.
- A session is linked to an existing task note, or has a free-text title only (“20 minutes on email”). Only task-linked sessions can log progress. Title-only sessions end with Done or +5 min.
- Start from voice, chat, a **Focus** button on each unfinished task row in task tables, or a **Focus session** entry in the command palette. The palette entry asks for a title and length.
- Controls: pause, resume, extend, and stop. Available from the status line under the orb and through Smith.
- No breaks, Pomodoro cycles, statistics dashboards, calendar blocking, sounds, or Do Not Disturb integration in this version.

## Behaviour contract

| Situation | Behaviour |
| --- | --- |
| “this task” with a task in view or just discussed | Smith uses that exact path. If more than one task could be meant, or none, Smith asks instead of guessing. |
| Start while a session is running | Refuse with the current session's name and remaining time. The user can stop it first, or explicitly replace it. |
| Orb hidden during the session | The timer keeps running in the main process. The menu bar tray shows the minutes left, for example `18m`. |
| Session ends while hidden | Use `showInactive()` to show the orb without stealing focus, then play the celebration. Also post a macOS notification if the app is not focused. |
| Mac sleeps or the app quits mid-session | Timing uses absolute timestamps and is saved to `userData/focus.json`. On wake or relaunch, a running session resumes. If its end time has already passed, the completion card appears once. |
| Pause | Freeze the remaining time. The ring dims to half opacity and the status line reads “Paused”. |
| Voice conversation during focus | The timer is unaffected. The listening and speaking ring moves outward so the two rings do not overlap (see Orb visuals). |
| Task edited, completed or deleted mid-session | The session continues. On completion Log progress reads the note fresh. If the note is gone, the card shows the reason and offers only Done. |
| Log progress | Append under `## Focus log`, creating the heading at the end of the note if it is missing: `- 2026-09-29 14:30 · 25 min — drafted the intro`. An empty note logs the time alone. Undoable through Recent changes. |
| Mark done | Uses the existing `updateTask` path, so recurring tasks advance an occurrence as they already do. |
| Reduced motion | No springs or sparks. The ring updates about once a second, and on completion it glows full and fades. |

## Architecture

### Main process — `src/focus.cjs` (new)

`FocusTimer` is a small state machine with an injectable clock so it can be tested without real time.

- State: `{id, title, path|null, minutes, startedAt, endsAt, pausedAt|null, status: 'running'|'paused'|'completed'}`.
- Methods: `start`, `pause`, `resume`, `extend(minutes)`, `stop`, `complete`, `status()` and `restore()`.
- One `setTimeout` targets `endsAt`, and `powerMonitor` `resume` re-arms it. Each change is persisted atomically to `focus.json` and emitted through the existing `recordActivity({kind:'focus', session})`.
- The session lives in main, not the renderer, because hidden panel windows throttle renderer timers.

### Vault — `vault.logFocus({path, minutes, note, at})`

- Accept only task-folder notes. Read the note fresh and insert under `## Focus log`, or create the heading, then `commit(...,'Focus logged')` so undo works.
- The agent variant takes `version` like the other write tools. The UI button reads the current version itself, because the card is the explicit user action.

### IPC and preload

Add a `focus` handle with actions `status|start|pause|resume|extend|stop|log|done`, and expose it as `window.orb.focus`. `main.cjs` wires `FocusTimer` to the tray title, `showInactive()` and `Notification`.

### Agent — `src/agent.cjs`

Add three tools. Voice reaches them through `run_task`, as with every other vault action.

- `start_focus` `{path: nullable, title: nullable, minutes: integer, replace: boolean}` — needs either `path` or `title`. Read `list_tasks` first to get an exact path.
- `focus` `{action: 'status'|'pause'|'resume'|'extend'|'stop', minutes: nullable}`
- `log_focus` `{path, version, note}` — only when the user supplies progress, and never inferred.

Add instruction lines for these tools. Resolve “this task” from the visible or last-discussed task and ask when it is ambiguous. Keep confirmations to one short sentence, and never mark a task complete because a session ended.

### Orb visuals — `src/orb.js`

- Add `window.orbVisual.setFocus({startedAt, endsAt, pausedAt}|null)` and `window.orbVisual.celebrate()`.
- **Ring:** add two SVG circles at `r = R+9`. The first is a faint full track at 12% opacity. The second is a 2px progress arc drawn with `stroke-dasharray` on the path length and `stroke-linecap: round`, rotated −90° so it starts at 12 o'clock. The stroke uses the palette's `light` tone, so it follows the orb colour setting. The ring shares the halo's lean and jump translate so it follows the jelly but does not squash. It fades in over about 400ms.
- **Voice ring:** while focus is active, move the listening and speaking ring from `R+13` to `R+18`, so its 7px voice swell stays clear of the focus ring. The tool orbit sits at a 102px radius, outside both.
- **Celebrate:** kick the existing springs (`jump.v -= 260`, `squash.v += 3`) and briefly tilt the glasses upward. The progress arc flashes to full opacity, then 10–12 small circles radiate from its edge for about 900ms and fade out. The orb then settles back to idle.
- Progress is computed in the existing `render()` loop from timestamps. No extra animation loop is added.

### Renderer — `src/renderer.js`, `src/visual-renderer.js`, `src/index.html`, `src/style.css`

- Route `kind:'focus'` activity to `visual.setFocus`. The status line shows “Focus · Draft proposal · 18 min left”, with pause and stop icon buttons that appear on hover or focus.
- The completion card is a small panel mode, `focus-done`, with the note input and the four actions. It is keyboard accessible, and Escape dismisses it as Done.
- Add a Focus button to unfinished task rows in `taskList`, defaulting to 25 minutes. Add a palette entry in `exploreCommands`.
- Add a preview-mode stub for `api.focus`, so the browser preview can demo a 10-second session.

## Tests

- `test/focus.test.cjs`
  - Timer state machine with a fake clock: start, pause, resume, extend and stop.
  - Refuse a second session.
  - Restore after a restart, including a session that ended while the app was quit.
  - `logFocus` creates the heading, appends under an existing heading, and rejects non-task paths.
  - Undo reverses a logged entry.
- `test/agent.test.cjs`
  - Tool schemas validate.
  - `start_focus` requires a path or a title, and `minutes` is bounded.
  - `log_focus` rejects a stale version.
- Manual browser-preview check:
  - Ring progress, pause dimming, and the celebration with reduced motion on and off.
  - Status line and completion card in light and dark themes.

## Documentation

- `docs/features/focus-sessions.md`
- Additions to `docs/things-to-ask.md` and to the `vault-template` Assistant Guide.
- Add a `Focus log` example to `Task Rules.md` if we want Dataview to surface it.

## Open decisions

1. **Where progress is logged.** The plan appends to the task note. The alternative is a daily log note, which would also cover title-only sessions.
2. **Showing the orb on completion.** The plan shows the orb without taking focus and posts a notification. The alternative is a notification only, leaving the orb hidden.
3. **Focus minutes in frontmatter.** Should the task also keep a running `focus_minutes` total? That makes Dataview totals easy, but it adds a frontmatter field that the Task Rules do not currently cover.
