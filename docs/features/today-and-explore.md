# Today and Explore

[Documentation](../README.md) · [Getting started](../getting-started.md) · [Voice and controls](voice-and-controls.md)

The controls beneath the orb provide two direct starting points. **Today** assembles a daily dashboard from configured vault and calendar sources. **Explore** is a searchable list of views and example requests, so you do not need to memorize features or special wording.

## Open Today

Click **Today** beneath the orb. The dashboard can contain:

- unfinished tasks planned or due today;
- unfinished tasks with a past Deadline;
- active goals, review-due badges, and linked next actions;
- today's habit records and current-week counts;
- today's calendar events.

The task list removes duplicate rows when a task is both planned today and past its deadline. It still labels that task as a past deadline. A future Deadline does not turn a task planned today into “Due today.”

Opening or refreshing Today reconciles existing calendar-linked task times. It does not create notes, record habits, edit goals, or add calendar events. Source titles open their Markdown notes. Section actions either open an existing native view or submit the displayed request through the normal assistant flow.

## Independent sections and warnings

Each section is read independently. A missing Goals folder, invalid habit definition, unavailable calendar feed, or absent Google token is shown in that section without hiding successfully read task data. An empty section is only described as empty when its sources were read successfully; warnings mean the result may be incomplete.

Calendar data follows the normal [Calendar](calendar.md) connection and privacy rules. Today may fetch configured calendar sources, but it does not send the dashboard to an AI provider. Selecting an assistant action does send that request and any subsequently retrieved relevant content under the normal [privacy rules](../privacy.md).

Use **Refresh** after changing notes in Obsidian. If two refreshes overlap, Orb keeps the newest result and ignores the older response.

## Use Explore

Click **Explore** or press ⌘K. Category filters separate everyday tools from connected services and assistant requests:

- **Planning** opens Today, Plan my day, Recurring tasks, Goals, and Habits. Plan my day uses AI when you request a plan.
- **Knowledge** opens Knowledge, Writing portfolio, and Knowledge graph.
- **Connectors** holds Trading 212 and Google Calendar. Each shows its setup state. Configured services open directly; **Set up** takes you to that service in Settings. Trading 212 browsing and calendar browsing do not require an AI-provider key. “Configured” means the prerequisites are saved, not that a live connection has just been tested.
- **Try asking** contains example requests. Selecting one sends it through the normal assistant flow, with the same prerequisites, model use, write boundaries, and confirmations.
- **Orb**, in the All view, opens Chats, Conversation, Recent changes, and Settings.

**All** shows tools and connectors, keeping example prompts in their own category until you search. Search matches titles, descriptions, categories, and aliases such as `t212`, within the selected category. Select All to search everything; this searches commands, not vault contents.

Matching tools come before the freeform **Ask Orb** row. Return opens the selected match; use the arrow keys to choose a different result or Ask Orb. When nothing matches, Return sends your text to Orb. The action bar shows whether Return will Open, Set up, or Ask Orb. Escape clears the query first. Reopening Explore resets the category and search.

Google Calendar stays visible even before setup. Browsing requires a Google calendar in Obsidian Full Calendar, its local REST server, and a saved access token. A default calendar is only needed for creating events. Opening the connector shows the next 14 days from configured calendar sources without an AI request or changing task dates.

The Explore screen appears automatically once after initial setup. It remains available from the persistent button afterward. You can always ignore the examples and speak or type your own request.

## Trading 212 investments

Choose **Trading 212** in Connectors after connecting a read-only API key and secret in Settings → Integrations. Browse account totals, holdings and allocation, dividends, trade history, cash movements and pending orders. This does not need an AI-provider key. **Ask Orb about my investments** starts an assistant request and shares relevant retrieved financial data with the selected provider.

**Writing portfolio** in Explore opens your knowledge notes and working drafts; **Trading 212** opens your financial portfolio. Trading 212 is a separate view and is not included in Today. History starts with up to 50 records; load older records before treating a total as complete. See [Trading 212](trading212.md) for the full setup and limits.

## Limits

- Today is a daily overview, not a replacement for the complete task, goal, habit, or calendar views. Long sections show only a focused subset and provide a route to the full feature.
- Undated tasks are not included. A task needs Planned or Deadline today, or a past Deadline.
- Calendar tasks are not repeated in the calendar section; task dates already appear in the task section.
- Today does not prioritize work, schedule free time, or make changes. Ask Orb explicitly when you want a recommendation or edit.
- Explore examples are fixed starting prompts, not a history of personalized suggestions. Filtering searches command metadata and aliases; it does not search your vault.

## Troubleshooting

**A section says setup is needed:** follow the linked feature's setup guide. Optional setup problems do not prevent other Today sections from loading.

**A task appears under the wrong timing label:** inspect its `planned` and `due` properties. Planned is intended work; Deadline is the real latest date.

**External changes are missing:** click Refresh. Calendar feeds may also be cached for up to five minutes.

**A discovery request cannot run:** conversational prompts require a saved API key and the same feature prerequisites as a manually typed request.

Implementation: [today.cjs](../../src/today.cjs), [renderer.js](../../src/renderer.js), and [Today tests](../../test/today.test.cjs).

## Knowledge and revisits

Explore includes direct **Knowledge**, **Writing portfolio**, and **Knowledge graph** views. The small graph in the bottom-right corner is available across other panels and chats; expand it to inspect connections and collapse it to return. It is hidden while viewing the Trading 212 dashboard or a chat containing a financial card so it does not cover account data.

Today also shows Library or Portfolio notes whose explicit `revisit` date is today or earlier. Set or clear that date in a note's Knowledge view. Merely viewing a note changes nothing; no background reminders are scheduled. See [Knowledge](knowledge.md) for the complete capture, learning and creation workflow.

## Linked task blocks

Opening or refreshing Today reconciles existing calendar links before collecting task dates. Once Full Calendar has loaded an external move, Planned follows the block. The calendar section links back to the task and shows completion while retaining the scheduled block. Missing or conflicting links produce warnings. See [Task scheduling](task-scheduling.md).

## Plan my day

Choose **Plan my day** on Today or in Explore. It opens a manual daily draft without an AI call. Ask AI to prioritise, adjust task estimates and pins, inspect capacity and overflow, and choose whether to save Markdown, apply date-only task plans, or book selected calendar blocks. See [AI daily planner](daily-planner.md).
