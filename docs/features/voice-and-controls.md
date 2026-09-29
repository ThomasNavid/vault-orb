# Voice and controls

[Documentation](../README.md) · [Getting started](../getting-started.md) · [Privacy](../privacy.md)

Orb floats above your normal Mac windows. You can speak or type requests and inspect supporting information in a companion panel.

[![Vault Orb listening](../images/orb-listening.png)](../images/orb-listening.png)

## Setup

Save a working OpenAI API key in Settings. Voice also needs macOS microphone permission, requested when you start a conversation. Typed requests work without microphone access. The native shortcut is built with `npm run build:native` and included in packaged builds.

By default, summoning Orb starts listening when a key is saved. Turn off **Start listening when I summon Orb** in Settings if you prefer to click Talk manually.

## Controls

| Action | How |
| --- | --- |
| Summon Orb | Click the menu-bar Orb or Dock icon, double-tap Control, or press ⌘⇧Space. |
| Hide the focused orb | Double-tap Control again, press Escape, or click ×. |
| Start voice | Click the orb or microphone button. |
| End voice | Click the stop button, or hide Orb. |
| Mute input during voice | Click the mute button; click again to unmute. |
| Type | Click the keyboard icon, enter a message, and send. |
| Return to the controls | Click the back button beside typed input. |
| Review today | Click **Today** beneath the controls to combine today's tasks, past deadlines, active goals, habit progress, and calendar events. See [Today and Explore](today-and-explore.md). |
| Discover requests | Click **Explore** for starting prompts covering planning, goals, habits, calendar, notes, and spreadsheet data. See [Today and Explore](today-and-explore.md). |
| Move the window | Drag the small dots above the orb. |
| Open Settings | Click the sliders icon, use the menu-bar right-click menu, or ⌘,. |
| Inspect the last request's tools | Click the steps chip beneath the orb. |
| Read the conversation | Settings → Conversation. |
| Inspect/undo note edits | Settings → Recent changes. |
| Quit the app | Right-click the menu-bar icon and choose Quit Vault Orb. |

Double-tap Control reads public modifier state and rejects gestures mixed with other keys or mouse buttons. It does not record typed text and needs neither Input Monitoring nor Accessibility permission. ⌘⇧Space is a fallback if the native listener fails.

The Today dashboard is read-only. Each section reports its own setup or source warning, so a missing calendar connection or disabled optional feature does not prevent available task, goal, or habit data from appearing. Discovery prompts are ordinary assistant requests: selecting one uses the same voice/text tools, permissions, and write rules as typing it yourself.

## Things to ask

Voice and typing share the feature tools. Examples:

- **“Show today's tasks.”** Opens the task panel and gives a brief spoken summary.
- **“Show my goals.”** Opens goal cards with source links and filters.
- **“What's on my calendar next week?”** Reads configured calendars and opens the agenda.
- **“Compare the options in Notes/Example launch options.md.”** Can use deeper reasoning and a supporting table.
- **“Close the visual.”** Dismisses the companion visual; it does not quit the app.

These requests need the same files and integrations as their feature guides. There are no special voice-only phrases needed to unlock task or goal operations.

## What happens

The status below the orb shows listening, thinking, and speaking. Small labeled orbs appear while tools run, with a final check or warning. The steps view distinguishes running, successful, and failed tool calls. A visual panel appears when useful; routine spoken replies summarize its key point rather than reading every row.

While voice is active, typed messages are added to that voice conversation. When voice is not connected, typed messages use the reasoning backend directly. The interface prevents overlapping typed submissions; wait for an answer or interrupt voice by speaking. Muting leaves the connection open so you can still type.

## Walkthrough

1. Summon Orb and click Talk if it does not listen automatically.
2. Say **“Show my tasks.”** Inspect the result while hearing the summary.
3. Ask a follow-up, such as **“Which have past deadlines?”**
4. Click the steps chip to inspect which tools ran, or open Conversation in Settings to read the transcript. Opening Settings ends voice.
5. Press Escape to hide Orb and stop pending work.

An operation that already succeeded remains saved when you stop. Use [Recent changes and undo](changes-and-undo.md) for note edits.

## Limits

- Voice and typed assistant requests require network access and API billing; they are not covered by a ChatGPT subscription.
- Five quiet minutes end a connected voice conversation automatically. A failed/disconnected voice connection also needs reconnecting.
- Transcripts are kept in memory, not saved as permanent conversation history. Do not rely on them to retain a decision after restarting.
- The current UI does not expose a voice/model picker; it uses the models configured in the app source.
- A browser preview demonstrates visuals with fictional data; it cannot use the real microphone/backend or save app settings.

## Troubleshooting

**No microphone input:** check macOS System Settings → Privacy & Security → Microphone, check Orb's mute state, and reconnect. Typed requests remain available.

**Shortcut does nothing:** try ⌘⇧Space, open Settings, and use Retry if the native listener is unavailable. From source, build the native module first. See [Development](../development.md).

**Connection error:** verify the key, model access, network, and account API billing. An API error is not evidence that a requested edit succeeded.

Implementation: [renderer.js](../../src/renderer.js), [main.cjs](../../src/main.cjs), and [native shortcut](../../native/shortcut.cc).
