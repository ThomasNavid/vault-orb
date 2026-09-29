# Today and Explore

[Documentation](../README.md) · [Getting started](../getting-started.md) · [Voice and controls](voice-and-controls.md)

The controls beneath the orb provide two direct starting points. **Today** assembles a read-only daily dashboard from configured vault and calendar sources. **Explore** is a searchable list of views and example requests, so you do not need to memorize features or special wording.

## Open Today

Click **Today** beneath the orb. The dashboard can contain:

- unfinished tasks planned or due today;
- unfinished tasks with a past Deadline;
- active goals, review-due badges, and linked next actions;
- today's habit records and current-week counts;
- today's calendar events.

The task list removes duplicate rows when a task is both planned today and past its deadline. It still labels that task as a past deadline. A future Deadline does not turn a task planned today into “Due today.”

Today is read-only. Opening or refreshing it does not create notes, record habits, edit goals, or add calendar events. Source titles open their Markdown notes. Section actions either open an existing native view or submit the displayed request through the normal assistant flow.

## Independent sections and warnings

Each section is read independently. A missing Goals folder, invalid habit definition, unavailable calendar feed, or absent Google token is shown in that section without hiding successfully read task data. An empty section is only described as empty when its sources were read successfully; warnings mean the result may be incomplete.

Calendar data follows the normal [Calendar](calendar.md) connection and privacy rules. Today may fetch configured calendar sources, but it does not send the dashboard to OpenAI. Selecting an assistant action does send that request and any subsequently retrieved relevant content under the normal [privacy rules](../privacy.md).

Use **Refresh** after changing notes in Obsidian. If two refreshes overlap, Orb keeps the newest result and ignores the older response.

## Use Explore

Click **Explore** or press ⌘K. The list has three groups:

- **Views** open Today, Goals, or Habits directly, without an assistant request.
- **Try asking** holds starting requests for planning, goals, habits, calendar, notes, and spreadsheets. Selecting one submits its request exactly as if you had typed it. It is not a privileged shortcut: the same prerequisites, model use, write boundaries, and confirmations apply.
- **Orb** opens Conversation, Recent changes, or Settings.

Type in the field at the top to filter the list. Once you have typed something, the first row becomes **Ask Orb** with your text; press Return to send it. Use the arrow keys to choose another row and Return to open it, or click a row. The action bar at the bottom shows what Return will do.

The Explore screen appears automatically once after initial setup. It remains available from the persistent button afterward. You can always ignore the examples and speak or type your own request.

## Limits

- Today is a daily overview, not a replacement for the complete task, goal, habit, or calendar views. Long sections show only a focused subset and provide a route to the full feature.
- Undated tasks are not included. A task needs Planned or Deadline today, or a past Deadline.
- Calendar tasks are not repeated in the calendar section; task dates already appear in the task section.
- Today does not prioritize work, schedule free time, or make changes. Ask Orb explicitly when you want a recommendation or edit.
- Explore examples are fixed starting prompts, not a history of personalized suggestions. Filtering matches row titles and descriptions only; it does not search your vault.

## Troubleshooting

**A section says setup is needed:** follow the linked feature's setup guide. Optional setup problems do not prevent other Today sections from loading.

**A task appears under the wrong timing label:** inspect its `planned` and `due` properties. Planned is intended work; Deadline is the real latest date.

**External changes are missing:** click Refresh. Calendar feeds may also be cached for up to five minutes.

**A discovery request cannot run:** conversational prompts require a saved API key and the same feature prerequisites as a manually typed request.

Implementation: [today.cjs](../../src/today.cjs), [renderer.js](../../src/renderer.js), and [Today tests](../../test/today.test.cjs).
