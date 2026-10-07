# Privacy and data

[Documentation](README.md) · [Getting started](getting-started.md)

Vault Orb reads a vault on your Mac and uses your selected providers for conversational intelligence. Local storage does not mean all processing stays on your device.

## Where information goes

| Information | Handling |
| --- | --- |
| Microphone audio | Sent to OpenAI in Realtime mode, or Deepgram as recorded turns in independent voice mode. Orb does not save recordings locally. |
| Typed messages and conversation context | Sent to your selected chat/reasoning provider. OpenRouter also routes requests to the chosen model host. |
| Notes and task/goal records | Relevant retrieved content is sent with tool results. Task and goal lists can include several records, not only one note. |
| Habit records | Conversational tools return definition labels/targets, daily boolean completions and paths, versions, and weekly totals for the selected year and recent weeks. Record bodies are not included. Direct Habits controls are local and do not make an assistant request. |
| Spreadsheet data | Inspected metadata and requested ranges are returned to the assistant; Excel formulas are not recalculated. |
| Calendar events | Queried event details can be sent to the selected chat/reasoning providers. The calendar reader fetches configured feeds and/or the local plugin API. |
| Apple Reminders | Optional native EventKit access reads/writes only the two lists selected for sync (list discovery shows writable list/account names). macOS grants full Reminders permission, but the sync service limits operations to those lists. Task titles, deadlines, completion, category and venture are sent to Reminders and may sync through its account, such as iCloud. Sync itself makes no AI request. Imported reminder text becomes ordinary vault content and can later be retrieved by Smith. |
| Today dashboard | Read directly by the app from configured task, goal, habit, and calendar sources. Merely opening Today does not send the assembled dashboard to an AI provider or write to the vault. Calendar sources are still contacted as described above. |
| Weather | Forecasts come from Open-Meteo, which needs no account. Orb sends coordinates rounded to about 1 km, or the place name you asked about. Opening the card from Explore or Today makes no AI request. Weather questions send the forecast and advice to the selected AI providers. The home location is stored in local `settings.json`. |
| Trading 212 account data | Dashboard browsing reads the API directly without an AI request. Investment questions send relevant retrieved financial data to the selected AI providers; typed answers and financial cards may be saved in local chat history. |
| Trading 212 API key and secret | Encrypted with macOS-backed safeStorage and used by the main process for API authentication. Saved credentials are never returned to the renderer or included in model tool results. |
| Provider API keys | Encrypted by Electron safeStorage, backed by macOS Keychain. Used by the main process, not returned to the renderer or model. |
| Calendar token and private feed URLs | Used locally by the integration; not deliberately included in event tool results sent to the model. |
| Note edits | Written into your selected vault; any configured Obsidian/iCloud sync can then synchronize them. |

OpenAI text requests use `store: false` in the Responses API. OpenRouter requests use Chat Completions and the account/model host's data policies. The app does not claim zero retention for any provider. In independent voice mode, ElevenLabs receives the answer text to synthesize speech; that text may include facts retrieved from your vault or connected Trading 212 account. In Realtime mode, OpenAI receives delegated tool results to speak them. A different reasoning provider can receive the delegated request, context, and tool results too.

Find models contacts the selected provider's catalog (OpenRouter's catalog is public). Test model sends a small, billable synthetic prompt to check tool calling; it sends no vault data. Saved keys stay in the main process. The renderer accepts newly entered keys only for saving or testing and clears them after saving.

## Local storage

App settings, change history, and typed chats live under:

```text
~/Library/Application Support/Vault Orb/
```

Settings include the vault path, folder configuration, behavior options, the orb colour, and encrypted credentials. The orb colour is a local appearance preference in `settings.json`; changing it sends no network request and writes no vault note. The change journal stores paths, timestamps, hashes, and **the previous contents of edited notes** so undo can restore them. The journal is stored as local JSON, not encrypted note storage. Treat it as private vault data and include it in your own device protection and backup decisions.

Typed chats are saved as plain JSON in `chats/`, one file per chat, including messages, recorded tool steps, and any saved visuals. They are not stored in the Markdown vault. Recent chats are deleted after 90 days of inactivity; Archived chats are kept until you restore or delete them. Sending a message, renaming, or restoring a chat restarts its 90-day period. There is no automatic message limit within a chat. You can delete a chat from the Archived list.

On the first launch after upgrading, Orb moves chats from the former `chats.json` file into `chats/` and removes the old file after migration succeeds. Existing Recent chats get at least 90 days from that upgrade before expiry. The former 300-chat cap no longer applies.

Voice conversation transcripts, including messages typed while voice is connected, remain in memory for that session and are not saved to `chats/`. For a decision you need to keep, explicitly append it to a note or save a goal review.

`focus.json` holds the current [focus session](features/focus-sessions.md): its length and times, plus a title and linked task path if you gave them. It exists only while a session is running or waiting to be closed. The timer makes no network requests. Logged progress goes into the task note, where Recent changes can undo it.

`shortcut-status.json` contains shortcut status/diagnostics and modifier/gesture counts. The Control shortcut checks public modifier state every 8 milliseconds; it does not record typed text. It does not require Input Monitoring or Accessibility permission.

## Vault access and edits

Apple Reminders connector settings store the selected list IDs and vault path. Its `reminders/` directory stores per-vault identities, task paths, previous synced titles/dates/completion, and recovery state as unencrypted JSON. Task notes keep `reminders_key`; reminder notes keep a labelled identity/category block. Pause the connector to stop background sync; hiding Orb only stops voice, not Reminders sync. See [Apple Reminders](features/apple-reminders.md) for conflict handling, exclusions and undo limits.

General note/file tools restrict access to visible supported files inside the selected vault and reject symbolic links and traversal paths. Calendar integration separately reads its known Full Calendar Remastered settings file under `.obsidian` to discover sources and server configuration. Hidden plugin files are not exposed through general note search.

The habits feature separately reads its configured visible dashboard `.js` file as literal data to obtain habit definitions. It never executes that JavaScript.

Note content is treated as reference data, not authorization to perform actions. The configured Task rules note is intentionally included as trusted assistant guidance: keep only conventions you want Orb to follow there.

Edits use note versions and an undo journal. These reduce accidental overwrites, but the journal is not a replacement for vault backups, and simultaneous edits in multiple apps should be avoided. [Changes and undo](features/changes-and-undo.md) explains the scope, including why calendar events cannot be undone through this journal.

## Connections and stopping

The app contacts the selected providers for assistant requests, including requests selected from Explore. Opening Today itself is a direct app read and does not make an assistant request. Calendar reads inside Today and conversational calendar requests contact the configured HTTPS feed hosts; Google integration talks to Full Calendar's authenticated local server at `127.0.0.1`, with Obsidian handling its Google connection. Feeds are cached in memory for five minutes.

Escape or × hides Orb and stops voice and pending work. Finishing or hiding a conversation does not reverse a write that already succeeded. Muting stops microphone input being sent from its track while keeping the voice connection open; end the conversation to close the connection.

## Sharing the project or reporting a problem

Use fictional notes and data in issues, screenshots, and tests. Do not commit your vault, API key, calendar token, private feed URL, or app support directory. The starter is empty; documentation examples are illustrative. Private reference vaults are excluded from Git and packaging. Before sharing a screenshot, check both the companion panel and transcript for private content.

See [Contributing](../CONTRIBUTING.md) for useful, reproducible bug reports.

## Knowledge browser and graph

The knowledge index, note previews, graph layout, and connection suggestions are calculated locally from tagged notes in the four knowledge folders. Opening these views makes no AI-provider call and does not download source URLs. UI capture and workbench edits use the same version checks and change journal as other note writes. A Portfolio draft with supporting sources creates multiple journal entries: the output plus one backlink per source.

Asking a Topic question, starting a quiz/refresher, or choosing Draft with Smith starts an AI conversation. Relevant linked note content is sent to the selected AI provider through the existing assistant tools. These conversations follow the normal chat/transcript storage rules above. Graph contents are not uploaded merely by expanding the graph.

Dismissed connection suggestions are stored in a vault-scoped `knowledge-<hash>.json` file alongside change history in the app's `changes` directory. It contains suggestion hashes derived from note paths and versions, not a copy of the source content. This is a local preference, outside vault-note undo. Graph layout and filters are held in memory for the current session.

## Trading 212

The optional [Trading 212 connector](features/trading212.md) stores its API key and secret encrypted with macOS-backed Electron `safeStorage` in `settings.json`. Decrypted credentials remain in the main process; renderer Settings receives only connection status and environment. New credentials pass from the password fields to trusted IPC for testing/saving and are cleared from the form after saving or leaving Settings. API requests use HTTPS Basic authentication to the fixed Live or Demo Trading 212 host. The connector only allows specific GET endpoints and refuses redirects or history-page links to other resources.

Opening Explore → Trading 212 contacts Trading 212 directly and makes no AI request. Ordinary browsing uses memory caches. **Track performance on this Mac** is a separate opt-in: it records account observations, projected events and sync coverage under `app.getPath('userData')/trading212/` (normally `~/Library/Application Support/Vault Orb/trading212/`). Collection continues while Orb runs and the Mac is awake, including while its window is hidden; it stops on pause, disconnect or quit. Sleep gaps are not fabricated.

`history.sqlite` stores financial payloads encrypted with AES-256-GCM and account/record binding. A separate `key` file contains the data key protected by macOS-backed `safeStorage`. Opaque account hashes, record kinds/IDs and timestamps remain in database indexes; this is encrypted payload storage, not whole-file encryption. Summary observations, events (including correction versions) and coverage remain until deleted; detailed holding observations expire after 90 days. Encryption failure does not fall back to plaintext. Restore the database and key together.

Disconnect removes credentials and clears live caches but retains encrypted history. **Delete history** removes the chosen account's local records and stops its collection; it does not delete old chats, notes, exports or backups. **Export JSON** deliberately writes an unencrypted financial file to a location chosen in a save dialog. Neither action revokes the broker key or changes broker data. These local data controls are separate from vault-note undo.

Asking Orb investment questions sends relevant retrieved financial data to the configured AI providers. Typed replies and financial visuals may be stored in local chat files under the normal retention policy; this content is not encrypted by the credential storage mechanism. Saving account information to a vault note is an explicit, separate request. Do not include real account screenshots or financial chat files in public bug reports.

## Linked task scheduling

Booking sends the task title, chosen times/timezone, and an opaque block UUID in the event description to Google through Full Calendar’s local API. It does not put the task body or vault path into the event. Task/link IDs, block timing, and pending recovery state live in task YAML and the existing local note journal. Reading tasks/calendar or refreshing Today may reconcile already-linked task metadata; no background monitor is installed. Working hours are saved in Orb settings. See [Task scheduling](features/task-scheduling.md).

## Web Clippings

Clipping browsing, filters, and full-content search run locally. The vault-scoped index lives only in memory and is cleared when changing vaults or quitting. No remote images, pages, or transcripts are loaded by previews; Open original explicitly opens the validated source URL in your system browser. Asking Orb sends the relevant retrieved clipping content to the configured AI provider, like other note questions. Browsing and search do not require a provider key and do not change vault files.

## AI daily planner

Opening and manually editing a daily draft runs locally; fetching configured calendars follows the existing calendar rules. Requesting AI planning sends up to 60 candidate task records, relevant excerpts from up to 20 task notes (1,200 characters each), active goal context, planning preferences, and busy intervals to the selected reasoning or chat provider. Event descriptions and private feed URLs are not needed in that request. Suggestions and estimates remain distinct from user-recorded facts.

Drafts, reviewed operations, and per-action recovery outcomes are stored under `changes/day-plans-<vault-hash>/` in Orb’s local application support directory. These files contain task metadata and planning text, not provider credentials. The same folder keeps `preferences.json` with your last start and finish times, free-time percentage, task list and breaks, so the next day starts from them. Ordinary caches expire after 30 days without a write; unfinished operations remain available for recovery. Discard removes only the local draft. Explicitly saved Markdown plans stay in the vault. Removing a cache or undoing a note edit does not remove calendar events; use the existing linked-block controls.

## Places and location

The optional Geoapify key is encrypted in local settings. Nearby search sends a requested category and starting coordinates to Geoapify; address lookup sends the supplied area or selected place name/address. Walking routes send origin and destination coordinates. Map tiles reveal the viewed area to Geoapify. Private note bodies are not sent to Geoapify. Asking Smith about places shares the bounded result summary and relevant note quotations with your selected AI provider.

Use current location requests a single macOS Core Location fix only after a click. Device coordinates stay in ephemeral service/UI state; they are excluded from persisted map visuals and are never written to place notes. There is no background location tracking. A default starting area is stored only through Places settings. Five-minute provider caches stay in memory and are cleared on vault/provider changes. Directions opens Apple Maps or Google Maps with destination coordinates/address and, for a live search, the selected origin.

Saved place notes contain destination facts and attribution, not route history. Typed chat snapshots may include destinations, note paths, quotations, and historical walking durations; they omit device origins and temporary result IDs. Ordinary typed text still follows normal chat retention. Browser-only UI previews request real tiles from OpenStreetMap for fictional examples; production uses Geoapify.
