# Privacy and data

[Documentation](README.md) · [Getting started](getting-started.md)

Vault Orb reads a vault on your Mac and uses OpenAI for conversational intelligence. Local storage does not mean all processing stays on your device.

## Where information goes

| Information | Handling |
| --- | --- |
| Microphone audio | Sent to OpenAI while voice is connected. Orb does not save recordings locally. |
| Typed messages and conversation context | Sent to OpenAI to answer requests. |
| Notes and task/goal records | Relevant retrieved content is sent with tool results. Task and goal lists can include several records, not only one note. |
| Habit records | Conversational tools return definition labels/targets, daily boolean completions and paths, versions, and weekly totals for the selected year and recent weeks. Record bodies are not included. Direct Habits controls are local and do not make an assistant request. |
| Spreadsheet data | Inspected metadata and requested ranges are returned to the assistant; Excel formulas are not recalculated. |
| Calendar events | Queried event details can be sent to OpenAI. The calendar reader fetches configured feeds and/or the local plugin API. |
| Today dashboard | Read directly by the app from configured task, goal, habit, and calendar sources. Merely opening Today does not send the assembled dashboard to OpenAI or write to the vault. Calendar sources are still contacted as described above. |
| OpenAI API key | Encrypted by Electron safeStorage, backed by macOS Keychain. Used by the main process, not returned to the renderer or model. |
| Calendar token and private feed URLs | Used locally by the integration; not deliberately included in event tool results sent to the model. |
| Note edits | Written into your selected vault; any configured Obsidian/iCloud sync can then synchronize them. |

Typed and deeper reasoning requests use `store: false` in the Responses API. OpenAI's applicable service data policies still apply; this setting is not a claim that no service-side processing or retention occurs.

## Local storage

App settings and change history live under:

```text
~/Library/Application Support/Vault Orb/
```

Settings include the vault path, folder configuration, behavior options, and encrypted credentials. The change journal stores paths, timestamps, hashes, and **the previous contents of edited notes** so undo can restore them. The journal is stored as local JSON, not encrypted note storage. Treat it as private vault data and include it in your own device protection and backup decisions.

Conversation transcripts remain in memory rather than being saved as a persistent transcript file. They are not a durable place to store a decision; explicitly append it to a note or save a goal review if you want it retained.

`shortcut-status.json` contains shortcut status/diagnostics and modifier/gesture counts. The Control shortcut checks public modifier state every 8 milliseconds; it does not record typed text. It does not require Input Monitoring or Accessibility permission.

## Vault access and edits

General note/file tools restrict access to visible supported files inside the selected vault and reject symbolic links and traversal paths. Calendar integration separately reads its known Full Calendar Remastered settings file under `.obsidian` to discover sources and server configuration. Hidden plugin files are not exposed through general note search.

The habits feature separately reads its configured visible dashboard `.js` file as literal data to obtain habit definitions. It never executes that JavaScript.

Note content is treated as reference data, not authorization to perform actions. The configured Task rules note is intentionally included as trusted assistant guidance: keep only conventions you want Orb to follow there.

Edits use note versions and an undo journal. These reduce accidental overwrites, but the journal is not a replacement for vault backups, and simultaneous edits in multiple apps should be avoided. [Changes and undo](features/changes-and-undo.md) explains the scope, including why calendar events cannot be undone through this journal.

## Connections and stopping

The app contacts OpenAI for assistant requests, including requests selected from Explore. Opening Today itself is a direct app read and does not make an assistant request. Calendar reads inside Today and conversational calendar requests contact the configured HTTPS feed hosts; Google integration talks to Full Calendar's authenticated local server at `127.0.0.1`, with Obsidian handling its Google connection. Feeds are cached in memory for five minutes.

Escape or × hides Orb and stops voice and pending work. Finishing or hiding a conversation does not reverse a write that already succeeded. Muting stops microphone input being sent from its track while keeping the voice connection open; end the conversation to close the connection.

## Sharing the project or reporting a problem

Use fictional notes and data in issues, screenshots, and tests. Do not commit your vault, API key, calendar token, private feed URL, or app support directory. The sample vault and documentation examples are fictional. Before sharing a screenshot, check both the companion panel and transcript for private content.

See [Contributing](../CONTRIBUTING.md) for useful, reproducible bug reports.
