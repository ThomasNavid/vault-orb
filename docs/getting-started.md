# Getting started

[Documentation](README.md) · [Things to ask Orb](things-to-ask.md)

## What you need

- An Apple Silicon Mac. Windows, Linux, and Intel Macs are not currently supported.
- Node.js 22 or newer, npm, and Xcode Command Line Tools to build and run the source.
- A local Obsidian vault folder, including a folder synced with iCloud if desired.
- Your own OpenAI API key with access to `gpt-realtime-2.1` and `gpt-6-sol`, and an internet connection. API charges are separate from ChatGPT subscription charges; no OpenRouter account is used.
- Obsidian installed if you want source-note buttons to open Markdown notes there.

The app opens without a key, but conversational requests need one. Typed requests do not need microphone permission. Calendar integration is optional.

## Install from source

Obtain a checkout of this repository, open a terminal in its root, and run:

```sh
npm ci
npm run build:native
npm start
```

For a packaged Mac app, see [Build and install](development.md#build-and-install). A packaged build and an installed app are separate copies; rebuilding does not update the installed copy automatically.

## Prepare a vault

For an isolated first try, copy the entire [vault-template](../vault-template/) directory to a separate folder, then open that folder as a vault in Obsidian. The sample contains fictional tasks, a Someday goal, meeting and planning notes, a small CSV, and goal templates/Bases. These examples have no connection to your real plans.

For your own vault, create two separate task folders first. Their default paths are:

```text
0. Home/Life Tasks
0. Home/Business Tasks
```

Both folders must exist before Settings can be saved, even if you only want general note search. They cannot be the same folder or contain one another. Existing checkbox lists do not become Orb task records automatically; use one Markdown note per task with `type: task`. See [Vault format](vault-format.md).

## Configure Settings

| Field | What to enter |
| --- | --- |
| Obsidian vault | Choose the vault root folder. |
| Personal tasks folder | Its path relative to the vault, such as `0. Home/Life Tasks`. |
| Work tasks folder | A separate relative path, such as `0. Home/Business Tasks`. |
| Goals folder | Optional; defaults to `0. Home/Goals`. Create it before creating goals, or leave blank to disable. |
| Habit log folder | Optional; defaults to `0. Home/Habit Log`. Create it before logging, or leave blank to disable. |
| Habit dashboard script | Defaults to `99. System/99.4 Scripts/habits/view.js`; supplies the actual habit definitions. |
| Task rules note | Optional existing Markdown note. The default is `0. Home/Task Rules.md`; clear it if absent. |
| API key | Enter the key here. Leaving the field blank on later saves keeps the saved key. |
| Start listening when I summon Orb | Enabled by default when a key is saved. Disable if you prefer to start voice manually. |

Click Save settings. Keys are stored encrypted under the app's support directory. Do not put them in notes or example files.

A missing Goals folder does not prevent setup. If an older custom task layout overlaps the default Goals path, goals start disabled until you choose a separate folder. More details are in [Goals](features/goals.md).

## Your first five minutes

Using your copy of the sample vault:

1. Click **Explore** beneath the orb. Inspect the starting requests, then open **Today** for a read-only overview of the sample tasks, goal, habits, and optional calendar state.
2. Click the keyboard icon and type **“Show my tasks.”** Expect two sample tasks and links to their notes.
3. Ask **“Show all my goals, including Someday.”** Expect the fictional portfolio goal linked to Example project task.
4. Ask **“Read Notes/Example launch options.md and compare the two options in a table.”** Expect a comparison citing the note.
5. Ask **“Chart the balances in Finance/Example savings.csv in GBP.”** Expect a chart and a View data table.
6. To try an edit, ask **“Plan Example errand for tomorrow.”** Then ask **“Undo your last note edit.”** Check Recent changes for both results.

These examples demonstrate reading, visuals, and reversible note edits. Calendar examples require separate integration setup and can create real external events.

From Today, click **Open habits** to try the sample’s empty heatmaps and local logging controls. See [Habits setup and walkthrough](features/habits.md). Today and the direct habit controls do not require an API key; Explore prompts do.

## Optional voice and calendar setup

Click the orb to start voice and allow macOS microphone access. Double-tap Control or use ⌘⇧Space to summon it later. The shortcut does not require Input Monitoring or Accessibility permissions. See [Voice and controls](features/voice-and-controls.md).

To read calendar feeds or create Google Calendar events, follow [Calendar setup](features/calendar.md#setup). Setting a task's Planned date does not create a calendar event.

If setup fails, start with [Troubleshooting](troubleshooting.md). For local storage and network use, see [Privacy and data](privacy.md).
