# Vault Orb

A compact Mac voice assistant for your Obsidian vault. Talk or type to find notes, manage tasks, work towards goals, track habits, review your calendar, and explore data. Orb shows a companion panel when a task list, goal card, calendar, or chart helps.

Your vault stays in Markdown. Orb reads it directly and records its note edits with undo. Voice uses OpenAI Realtime; typed requests and deeper reasoning use GPT-6 Sol through your own OpenAI API key.

[![Vault Orb showing goals with fictional example data](docs/images/goals-view.png)](docs/images/goals-view.png)

## Quick start

You need an **Apple Silicon Mac**, **Node.js 22+**, **npm**, **Xcode Command Line Tools**, an Obsidian vault folder, and an OpenAI API key with access to `gpt-realtime-2.1` and `gpt-6-sol`. API billing is separate from a ChatGPT subscription. Windows, Linux, and Intel Macs are not supported.

From a checkout of this repository:

```sh
npm ci
npm run build:native
npm start
```

In Settings, choose your vault and enter your API key. The vault must already contain **two separate task folders**, even if you only want note search. Defaults are `0. Home/Life Tasks` and `0. Home/Business Tasks`; both are configurable. Clear the optional Task rules note field if you do not have one.

For a first try, copy [the fictional sample vault](vault-template/) to a separate folder and select that copy. Click the keyboard icon and ask **“Show my tasks.”** Voice additionally needs macOS microphone permission.

See [Getting started](docs/getting-started.md) for the complete setup, optional goals and calendar integration, and the first five minutes with Orb.

## What can I ask?

These are natural-language examples, not fixed commands. Orb uses current vault data and may ask for missing details. Requests to create or edit items make real changes; each guide explains the destination and prerequisites.

| Feature | Try saying | Guide |
| --- | --- | --- |
| Today and discovery | Click **Today** or **Explore** beneath the orb. | [Today and Explore](docs/features/today-and-explore.md) |
| Tasks | “Show today's tasks.” | [Tasks](docs/features/tasks.md) |
| Goals | “Let's review my goals.” | [Goals and weekly reviews](docs/features/goals.md) |
| Habits | “Show my habits.” | [Habits and heatmaps](docs/features/habits.md) |
| Calendar | “What's on my calendar next week?” | [Calendar](docs/features/calendar.md) |
| Notes | “Find my notes about pricing.” | [Finding and updating notes](docs/features/notes.md) |
| Data and charts | “Chart the balances in Finance/Example savings.csv.” | [Spreadsheets and visuals](docs/features/spreadsheets-and-visuals.md) |
| Planning | “What can I do today to move my goals forward?” | [Planning across notes](docs/features/planning.md) |
| Voice and controls | Double-tap Control to summon Orb. | [Voice and controls](docs/features/voice-and-controls.md) |
| Change history | “Undo your last note edit.” | [Changes and undo](docs/features/changes-and-undo.md) |

The [Things to ask Orb cookbook](docs/things-to-ask.md) has copyable examples and complete workflows using sample files. The [documentation index](docs/README.md) lists all guides.

## Everyday use

Click the menu-bar Orb, use the Dock icon, or double-tap Control. **⌘⇧Space** is the fallback shortcut. Click the orb to talk or the keyboard icon to type. **Today** opens a read-only daily dashboard, while **Explore** shows useful starting prompts without requiring you to memorize commands. **Escape** or × hides Orb and stops voice and pending work. Settings contains Recent changes and the conversation transcript.

Today brings together tasks planned or due today, past deadlines, active goals, habit progress, and calendar events. Its sections stay independent, so an unavailable optional integration is reported without hiding the rest of the day. Goals, habits with heatmaps, task lists, calendar agendas, and charts also appear beside the orb as needed. Source links open Markdown notes in Obsidian; spreadsheet links open in the default local application.

## Your data and current limits

Your API key and optional calendar token are encrypted locally. During use, microphone audio and relevant retrieved vault content are sent to OpenAI. This is not an offline assistant. The app does not store recorded audio, and conversation transcripts remain in memory. See [Privacy and data](docs/privacy.md) for local files, the edit journal, calendar connections, and sharing precautions.

Task support requires one Markdown note per task in two configured folders. Orb can create Google Calendar events after setup, but cannot edit/delete calendar events or undo them. Spreadsheets are read-only. Goals have a weekly review workflow, but no background reminder scheduler. Feature guides describe the precise limits.

## Contributing and development

Start with [CONTRIBUTING.md](CONTRIBUTING.md). [Development](docs/development.md) covers architecture, tests, browser previews, native builds, packaging, and updating a locally installed app. Run `npm test` for offline tests using temporary vaults and fictional data.

[Vault format](docs/vault-format.md) documents the supported properties and conventions. [Troubleshooting](docs/troubleshooting.md) covers setup, missing notes/tasks, voice, calendars, and edit conflicts.

## License and distribution

The app source and fictional sample vault are released under the [MIT license](LICENSE). The repository contains no real vault, API key, or private calendar feed. `private: true` in package.json prevents accidental npm publication; the source is open.

This is a source project with a local Mac build workflow, not a signed or notarized public app release. Packaging creates an app under `dist`; it does not replace an installed copy. See [Build and install](docs/development.md#build-and-install) for details.
