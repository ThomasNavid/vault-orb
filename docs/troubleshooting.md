# Troubleshooting

[Documentation](README.md) · [Getting started](getting-started.md)

Start with the exact error or visible result. A failed tool call is not a successful edit; a failed panel refresh can happen after the note was already saved. Check Recent changes and the source before repeating a write.

## Installation and Settings

| Symptom | Check or action |
| --- | --- |
| Native build fails | Use Apple Silicon macOS, Node.js 22+, and Xcode Command Line Tools. The build needs Node headers next to the installed Node distribution. See [Development](development.md). |
| Cannot save the vault | Use Create new for an automatically prepared vault, or connect a complete Orb starter. New connections require the standard task and knowledge folders, Home, templates, and habit script. Existing saved layouts retain their paths. |
| General notes work but tasks do not appear | Tasks need one Markdown note each with `type: task` in the configured folders. See [Vault format](vault-format.md). |
| Goals setup says create a folder | Create the configured Goals folder in Obsidian, then ask again. A missing folder is allowed during setup but not creation. |
| Goals disabled after upgrading a custom layout | This is a preserved legacy setting. Keep the existing vault or create a new standard vault; Orb does not relocate old notes. |
| The new feature is missing from the app | Verify which app copy is running. `npm run package` writes `dist` and does not replace an installed app. Follow [Build and install](development.md#build-and-install). |
| Key field looks empty after saving | It deliberately does not display the saved key. A “Key saved” placeholder indicates a saved credential. Blank on a later save preserves it. |
| AI-provider API 401 or access error | Check the key, supported model access, account API billing, and network. A ChatGPT subscription does not supply API credit. |

## Voice and window controls

**Microphone denied:** check macOS System Settings → Privacy & Security → Microphone for the current app copy. End and reconnect voice after fixing permission. You can still type requests.

**Double-tap Control fails:** try ⌘⇧Space or the menu-bar icon. In Settings, Retry restarts an unavailable native listener. If running from source, build the native module. Do not enable unrelated keyboard permissions; this shortcut does not require them.

**Voice stopped on its own:** five quiet minutes end a voice session. Network failure/disconnection also ends it. Click Talk to reconnect. Opening Settings ends voice too.

**A new request will not send:** wait for the current typed answer or current tool work. During voice you can interrupt by speaking. Escape hides Orb and stops pending work, but does not roll back successful edits.

## Today and Explore

**One Today section shows setup or a warning:** sections load independently. Follow that feature's setup message; available task, goal, habit, and calendar sections should still appear. A calendar warning means the schedule may be incomplete, not that the day is free.

**Today looks stale:** click Refresh after external note edits. Calendar feeds can remain cached for up to five minutes. Orb ignores an older overlapping refresh when a newer Today request has started.

**An Explore suggestion cannot run:** Explore suggestions submit normal assistant requests. Save a working API key and configure any feature-specific folder or calendar source the request needs.

## Tasks and goals

**Missing tasks:** check `type: task`, `completed`, folder, and filter. Today matches Planned or Deadline today, while past deadlines are separate. Checkbox lines do not become task records.

**Missing goals:** check `type: goal`, supported status, valid date-only properties, and filter. The starter contains no goals; create one before expecting cards. Invalid YAML or unsupported status/date values can produce warnings.

**Next task is ambiguous or broken:** give the exact path to an unfinished task in a configured task folder. Repair a renamed link rather than creating a duplicate task.

**A completed task did not achieve its goal:** this is intentional. Choose another next task or explicitly ask to mark the goal Achieved.

**An Obsidian edit is not visible:** ask again, or select a Goals filter. There is no background filesystem watcher. Orb's own edits and undo refresh applicable visible panels.

## Calendar

**No calendars/events:** verify Full Calendar Remastered sources in the same vault, the queried date range, and any warnings. Task dates only appear when you ask to include them. An incomplete view is not proof of free time.

**Cannot create an event:** iCal subscriptions only provide reads. Follow [Google setup](features/calendar.md#connect-google-calendar-for-event-creation), including a Google provider, local server, token, scopes, default calendar, and keeping Obsidian open.

**Wrong or missing calendar option:** reopen Orb Settings after changing calendars in Obsidian and choose the intended default. An event request can also name a connected calendar explicitly.

**A write timed out:** check Google Calendar before retrying. The event may exist even though Orb did not receive confirmation. Note undo cannot remove it.

**Recurring events or new feed edits are missing:** keep the iCal source for recurring Google events. Feed data is cached for five minutes. Source failures, feed limits, and display timezone can also affect the result.

## Trading 212

| Symptom | Check or action |
| --- | --- |
| Cannot find the connector | Open Settings → Integrations → Trading 212. If the card is absent, launch the updated checkout with `npm start` or update the installed app as described above. |
| Key or secret rejected | Enter both credentials and match the Live/Demo environment where the pair was generated. An AI-provider key does not connect Trading 212. |
| Connection test passes but a view is denied | Inspect the per-capability checks. Enable the named read permission and check IP restrictions; one successful capability does not imply all views work. Orb does not need trading permissions. |
| Entered credentials were not saved | Use **Connect & save** inside the Trading 212 card. **Test connection** does not save; the general **Save settings** button does not save this pair. |
| Dividend total or year is missing | Use Income for period queries over tracked history; inspect sync coverage in Settings. Raw payment filters only use manually loaded records. Different currencies stay separate. |
| “Connection changed” when loading history | Refresh that financial view before loading older records. This prevents mixing an older snapshot with a new connection or app session. |
| Data looks stale or a refresh is rate-limited | Check the displayed update time and wait before refreshing. The connector briefly caches responses; Trading 212 limits are shared across apps using the same account. Opt-in background tracking only runs while Orb and the Mac are awake. Large scans can lag current values; check history coverage as well as fetch time. |
| One Overview section is unavailable | Read its warning. Other sections can still load; a permission or network error does not mean the missing section has no data. |
| Portfolio opens knowledge notes | Choose **Trading 212** for investments. **Portfolio** is the separate knowledge workspace. |
| Today is unavailable | Enable tracking; inspect the opening valuation and both cash/fill coverage. A missed midnight baseline cannot be recovered from current values. Try Since tracking began. |
| Disconnect did not delete history | Disconnect retains encrypted local investment history and old chats/notes. Use Delete history for the selected local ledger, and the separate chat/note controls for those copies. It does not revoke the key. |

See [Trading 212 setup and limits](features/trading212.md). Browser preview data is fictional and cannot connect to an account.

## Notes, spreadsheets, and visuals

**Search misses a known file:** try a distinctive filename term or its exact relative path. Content search is Markdown keyword search, not a universal document index.

**A source is incomplete:** general note reads have a 512 KB limit and assistant text is truncated at 50,000 characters. Spreadsheet files are limited to 20 MB, and ranges to 4,000 cells. Narrow the source or range.

**A chart looks wrong:** inspect View data, source units, chronological ordering, and cached Excel formulas. Missing numeric values should remain missing. Orb cannot recalculate or edit a workbook.

**No chart appears:** comparable sourced values may be absent. Ask explicitly for a supported table, line, area, or bar chart and name the source/range. A single isolated number can be answered without a visual.

## Edits, undo, and partial results

**“Note changed” or “Goal changed”:** reread the current note before retrying. Another app or previous edit changed the expected version.

**Undo refuses:** an older edit cannot overwrite newer contents. Undo newer Orb changes to that note first, or inspect external edits in Obsidian. Preserve the journal if it reports damage.

**“Reached the tool limit”:** split the request into smaller pieces. If it included writes, check Recent changes; successful edits remain.

**A task was created but the goal update failed:** link the already created task after rereading the goal. Task creation and goal changes are separate journal entries.

See [Changes and undo](features/changes-and-undo.md) for exactly what is reversible.

## Reporting a bug

Include macOS version/architecture, Node version if running from source, how you launched Orb, the error, steps to reproduce, and expected/actual behavior. Use fictional note contents or a minimal sample vault. Mention whether any writes already succeeded.

Do not attach credentials, private feeds, a real vault, or the app support directory. It contains settings and previous note contents in the journal. [Contributing](../CONTRIBUTING.md) has the contributor workflow.

## Habits are missing or show the wrong totals

Check the Habit log folder and Habit dashboard script in Settings. The folder must exist, and the script must contain supported literal definitions. Orb never guesses missing habit names. Click Refresh after changing records or definitions in Obsidian. Only boolean true in an exact date filename counts. Current-week cards stay on this week while browsing old dates. See [Habits troubleshooting](features/habits.md#troubleshooting).

## Linked task blocks

**Free time cannot be confirmed:** add matching Google HTTPS iCal feeds for every connected Google calendar so recurring events are covered. Resolve source warnings and use a shorter range if results are truncated. Availability uses the calendars actually configured.

**A moved block has not updated Planned:** refresh Full Calendar in Obsidian first, then ask for tasks/calendar or refresh Today. A separately edited Planned value requires explicit repair. Missing blocks are not assumed deleted.

**Booking, moving, or removal is pending:** inspect the event, refresh the task, and follow [task scheduling recovery](features/task-scheduling.md#partial-writes-and-recovery). Never create another copy merely because a write timed out. Calendar-linked changes require calendar actions instead of note undo.
