# Getting started

[Documentation](README.md) · [Things to ask Orb](things-to-ask.md)

## What you need

- An Apple Silicon Mac. Windows, Linux, and Intel Macs are not currently supported.
- Node.js 22 or newer, npm, and Xcode Command Line Tools to build and run the source.
- A location for your Markdown vault; Orb creates it for you, including in an iCloud-synced folder if desired.
- Your own OpenAI or OpenRouter API key, a compatible tool model, and an internet connection. API charges are separate from consumer chat subscriptions. See [Models and providers](providers.md) for independent voice setup.
- Obsidian installed if you want source-note buttons to open Markdown notes there.

The app opens without an AI-provider key, but conversational requests need one. Typed requests do not need microphone permission. Calendar and Trading 212 integrations are optional; Trading 212 dashboard browsing needs only its own key pair.

## Install from source

Obtain a checkout of this repository, open a terminal in its root, and run:

```sh
npm ci
npm run build:native
npm start
```

For a packaged Mac app, see [Build and install](development.md#build-and-install). A packaged build and an installed app are separate copies; rebuilding does not update the installed copy automatically.

## Create and connect your vault

1. Open Settings and click **Create new…**. Choose a location and a new folder name. Orb refuses existing destinations so it cannot overwrite your files.
2. Orb creates the complete system and fills its paths automatically. Click **Save settings** to connect it. If you close Settings before saving, the folder remains available to connect later.
3. Choose a chat/tools provider and model, add its API key, and save. OpenRouter-only chat needs no OpenAI key. Configure voice separately if wanted. Today and direct habit controls do not require an AI-provider key. Direct Trading 212 browsing uses its own credentials.
4. Open the vault's README for the structure and setup instructions. Records start empty: create a Life/Business task, goal, or Hub only when you want one. Choose habits through the included Habit Setup guide.

**Connect existing…** requires the same Orb structure for newly selected vaults. It validates without moving or rewriting files. Existing installations keep their saved paths. For a manual installation, copy the complete [starter](../vault-template/) to a new folder. Do not select the private reference vault or merge the starter over personal files.

## Personalise the orb

In **Settings → Appearance**, choose a named colour or use the custom colour picker/hex field, then click **Apply colour**. You can do this before setting up a vault or API keys. The choice is saved on this Mac and also colours the small orb illustrations in chat. **Reset to blue** restores a preview of the original colour; apply it to save. See [colour controls](features/voice-and-controls.md#choose-your-orb-colour) for preview and save behaviour.

## Your knowledge system

Portfolio holds your thinking and outputs; Hubs map broad interests; Topics gather focused subjects; Knowledge Library holds source material. Topic `hub` and Knowledge `topic` properties connect the browsing structure. Portfolio cites supporting Library notes; its automatic incoming list shows Library notes that link back to it.

Try **“Create a Hub called Computing”**, then **“Create a Computer Architecture Topic linked to that Hub.”** Save your actual course notes to the Library and ask for a Portfolio draft only when you want one. These are optional example requests, not pre-created records. See [Knowledge](features/knowledge.md).

To work entirely in Obsidian, follow [Obsidian setup and standalone use](obsidian-only.md). The same guide ships inside every new vault. Dataview, Templater, and Bases power the relevant Obsidian views; calendar integration is optional and Charts is not required.

## Optional voice and calendar setup

Click the orb to start voice and allow macOS microphone access. Double-tap Control or use ⌘⇧Space to summon it later. The shortcut does not require Input Monitoring or Accessibility permissions. See [Voice and controls](features/voice-and-controls.md).

To read calendar feeds or create Google Calendar events, open **Settings → Integrations → Google Calendar** and follow [Calendar setup](features/calendar.md#setup). Setting a task's Planned date alone does not create an event. To reserve work time, set working hours and follow [linked task scheduling](features/task-scheduling.md).

## Optional Trading 212 setup

Open **Settings → Integrations → Trading 212**. Choose Live or Demo, enter your Trading 212 **API key and API secret** with read-only permissions, and click **Connect & save**. This saves the connection independently of the other Settings fields. The connection test reads the account summary; other views also need their relevant read permissions.

Open **Explore → Trading 212** for Overview, Holdings, Dividends and Activity. The connector supports Invest and Stocks ISA accounts and cannot place trades. This financial portfolio is separate from the knowledge system's **Portfolio** notes. Dashboard browsing makes no AI request; asking Orb about investments shares relevant account data with your selected AI provider. See [Trading 212](features/trading212.md) for key generation, permissions, history loading and disconnect behaviour.

If setup fails, start with [Troubleshooting](troubleshooting.md). For local storage and network use, see [Privacy and data](privacy.md).
