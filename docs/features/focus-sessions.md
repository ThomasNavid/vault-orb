# Focus sessions

[Documentation](../README.md) · [Things to ask Smith](../things-to-ask.md) · [Vault format](../vault-format.md#focus-log)

A focus session is a timer. Say **“Give me 25 minutes”** and it starts: there's no task or title to choose. A thin progress ring appears around the orb and fills clockwise from 12 o'clock. When the time is up, the orb jumps and the ring bursts into a few sparks. If you linked the session to a task, a small card also offers to log what you got done.

## Setup

No setup is needed. The timer runs in the Mac app itself, so it keeps going while the orb is hidden, while you talk to Smith, and through sleep or a restart. Voice and typed requests need the usual model setup. The task-row button and the **Focus session** entry in Explore work without it.

## Start a session

- **Ask Smith for a length:** “Give me 25 minutes.” The timer starts straight away, and Smith doesn't ask what it's for.
- **Link a task (optional):** “25 minutes on Draft proposal”, or “on this task” while a task is in view. The session is linked to that task, so you can log progress when it ends. If Smith can't tell which task you mean, it starts a plain timer instead of asking.
- **From a task list:** hover over an unfinished task and press the clock beside its title. This starts 25 minutes linked to that task.
- **From Explore:** choose **Focus session**, pick 15, 25, 45 or 60 minutes, and press **Start focus**. The “What are you working on?” label is optional.

Sessions can run from 1 to 180 minutes, and 25 is the default. Only one session runs at a time. Smith refuses to start another unless you ask to replace the current one.

## During a session

- The status line under the orb reads, for example, **Focus · Draft proposal · 18 min left**. Pause/resume and end buttons sit beside it.
- The menu bar icon shows the minutes left, for example `18m`, or **Paused**. This keeps the time visible while the orb is hidden.
- While paused, the ring dims and the time left stays frozen.
- Voice conversations leave the timer alone. The voice ring steps outward a little so the two rings do not overlap.
- If reduced motion is on in macOS, the ring updates about once a second without animation.

## When time is up

- If the orb is hidden, it comes back into view without taking over your keyboard. If Vault Orb is not the active app, macOS also shows a notification.
- The card offers four actions:
  - **Log progress** adds a dated line under `## Focus log` in the task note, with your optional note. Recent changes can undo it.
  - **Mark done** completes the task, the same way as completing it anywhere else. A recurring task moves on to its next occurrence.
  - **+5 min** starts the session again for five more minutes.
  - **Done** closes the card.
- Sessions not linked to a task offer only **+5 min** and **Done**.
- If a session ends while the chat window is open, a short notice appears there. The card opens when you close chat.
- If a session ends while Vault Orb is quit, the card appears the next time the app starts.

Finishing a session never marks the task done by itself.

## Things to ask

| Request | Result |
| --- | --- |
| “Give me 25 minutes.” | Starts a plain 25-minute timer. |
| “Focus for 45 minutes.” | Starts a plain 45-minute timer. |
| “20 minutes on email.” | Starts a timer labelled “email”, not linked to a task. |
| “Give me 25 minutes on Draft proposal.” | Finds the exact task and links the session to it, so you can log progress afterwards. |
| “How long is left?” | Reports the remaining time. |
| “Pause my focus session.” / “Resume.” | Pauses or resumes the session. |
| “Add 10 minutes.” | Extends the running session. |
| “Stop the timer.” | Ends the session without logging anything. |
| “Log that I drafted the intro.” (after a session ends) | **Writes:** adds a line to that task's Focus log, using the session's minutes. |

Voice requests reach these tools through Smith's usual `run_task` delegation.

## Walkthrough

1. Say or type “Show today's tasks”, then press the clock beside a task.
2. Hide the orb. The menu bar shows the minutes counting down.
3. When the session ends, the orb reappears and the ring bursts.
4. Type “Outlined the three sections” and press **Log progress**. The task note now ends with:

   ```markdown
   ## Focus log

   - 2026-09-29 14:30 · 25 min — Outlined the three sections
   ```

5. Press **Done**.

## Limits

- Only one session at a time. There are no breaks, Pomodoro cycles, statistics, sounds or Do Not Disturb integration.
- Focus sessions do not add calendar events. Use [task scheduling](task-scheduling.md) to book time.
- Ending a session early with the stop button does not log anything. You can still ask Smith to log minutes for a task.
- Logging needs a task note in one of the task folders. Plain timers and labelled sessions are not recorded in the vault.
- Session state is stored only on this Mac, in `focus.json` in the app's data folder.

## Troubleshooting

- **The ring did not appear.** Check the status line for an error. If you linked a task, it may already be completed, or it may not be in a task folder.
- **“A focus session is already running.”** End the current session with the stop button or ask Smith to replace it.
- **Log progress failed.** The task note may have been moved or deleted. Its name and location are read again when you log.
- **No notification appeared.** Allow notifications for Vault Orb in macOS System Settings → Notifications.

Implementation: [focus.cjs](../../src/focus.cjs) holds the timer. `Vault.logFocus` in [vault.cjs](../../src/vault.cjs) writes the log. The `start_focus`, `focus` and `log_focus` tools are in [agent.cjs](../../src/agent.cjs), and the ring is drawn in [orb.js](../../src/orb.js). Tests are in [focus.test.cjs](../../test/focus.test.cjs).
