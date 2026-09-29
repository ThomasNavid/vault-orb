# Calendar

[Documentation](../README.md) · [Things to ask Orb](../things-to-ask.md) · [Tasks](tasks.md)

Ask about your calendar, inspect a month and day agenda, optionally include task dates, create and edit single Google Calendar events, and [book linked task blocks](task-scheduling.md) through Obsidian's Full Calendar Remastered plugin.

[![Calendar panel](../images/calendar-view.png)](../images/calendar-view.png)

## Setup

### Read calendar feeds

Install and configure **Full Calendar Remastered** in the same vault Orb uses. Add your HTTPS iCal sources in the plugin's calendar settings. Orb reads the plugin's saved sources; do not paste private feed URLs into the conversation.

An iCal subscription is read-only, including a private Google `.ics` subscription. Planned/Deadline dates from vault tasks work without the plugin when you ask to include tasks.

### Connect Google Calendar for event creation

1. In **Obsidian Settings → Community plugins → Full Calendar Remastered → Calendars**, choose **Google calendar** under Manage calendars and click **+**. Sign in and connect the intended calendar.
2. Confirm you can create an event on that Google calendar in Obsidian. Keep an iCal feed for recurring Google events; Orb hides matching single-event copies when both sources return them.
3. In the plugin's **Integrations** tab, enable **Local REST Server**. It listens on `127.0.0.1`, default port `8540`. Obsidian must remain open while Orb uses it.
4. Under **Personal Access Tokens → Generate Token**, create a Vault Orb token with **Read events** (`events:read`), **Write events** (`events:write`), and **Read providers** (`providers:read`). The plugin shows it once.
5. In **Vault Orb Settings → Integrations → Google Calendar**, paste the token, select the default calendar for new events, and save. If the calendar list is stale after connecting, reopen Orb Settings.

The token is encrypted in app settings. Keep it out of notes, screenshots, commits, and chat messages. Settings labels above describe the integration Orb currently expects; see [Troubleshooting](../troubleshooting.md) if your plugin version behaves differently.

## Things to ask

The event-creation examples write real events. Use them only with your intended calendar and dates.

| Ask | Expected result | Changes data? |
| --- | --- | --- |
| “What's on my calendar today?” | Calendar events for today. | Existing link reconciliation only |
| “Show my calendar next week.” | A month grid and selectable day agenda for that range. | Existing link reconciliation only |
| “Show my calendar next week, including planned tasks and deadlines.” | Calendar events plus unfinished task dates. | Existing link reconciliation only |
| “Show my planned tasks and deadlines on a calendar for the next two weeks.” | Includes task notes; no external plugin is required for the task entries themselves. | Existing link reconciliation only |
| “Add a Google Calendar event called Portfolio review tomorrow from 2pm to 3pm.” | Creates one timed event on the default calendar. | Google Calendar |
| “Move Portfolio review to Friday from 2pm to 3pm.” | Reads its identity/version and edits that single event. | Google Calendar |
| “Add an all-day event called Studio closed on 20 November 2026.” | Creates a date-only event. | Google Calendar |
| “Add an all-day event called Annual leave from 16 November through 20 November 2026.” | Creates an all-day event covering those dates inclusively. | Google Calendar |

You can specify a connected calendar by its exact name instead of using the default. Ask Orb to report the destination. If a timed request lacks a start or end time, Orb needs the missing detail; it does not choose a duration for you.

For free-slot searches, configure working hours in Orb Settings and matching Google iCal feeds as described in [Task scheduling](task-scheduling.md#setup).

Reads may update Planned on already-linked tasks after a calendar move. They never book a new block. See [refresh behavior](task-scheduling.md#what-stays-in-sync).

## What happens

Calendar reads normally show events only. Tasks appear when you explicitly ask to include them. Month arrows navigate within the queried range, and selecting a day shows its agenda. Task titles open their notes in Obsidian. Event entries display their source calendar, times, and available location.

Orb reads configured HTTPS iCal feeds locally, caches them in memory for five minutes, expands recurring events, and uses the plugin's display timezone. With a Google token configured it also queries connected Google calendars through the local API. Retain iCal for recurring Google event reads. Matching entries with the same title, start, and end are hidden across the Google and iCal sources.

Creating an event checks the chosen calendar for an existing event with the same title/start/end. An exact match is reported as already existing. This is not a guarantee against every possible duplicate or an uncertain timed-out write.

## Walkthrough: schedule an explicit event

1. **“Show my calendar tomorrow.”** Inspect the agenda.
2. Choose a time yourself and say **“Add a Google Calendar event called Portfolio review tomorrow from 2pm to 3pm.”**
3. Expect a confirmed result naming the calendar. If a calendar panel is visible, it refreshes after a successful creation.
4. **“Show my calendar tomorrow.”** Verify the event.

To reserve time for a task, ask “Find me 45 minutes this week for Draft proposal,” then “Book the first slot.” [Linked task scheduling](task-scheduling.md) creates a durable connection: moving the block updates Planned, and task completion appears alongside it in Orb. Standalone events remain independent. Setting Planned alone does not book time.

## Limits

- Event reads cover up to **93 days per query**. The panel shows up to **300 entries** and warns when truncated. Ask for a narrower period if necessary.
- Calendar creation supports single timed or all-day Google events, with whole-minute times. Single events can be read and edited by their returned identity and version. Recurring event editing/creation and general event deletion are not supported; linked task blocks can be removed explicitly.
- [Linked task blocks](task-scheduling.md) support free-slot suggestions, explicit booking, and synchronization on refresh. Invitee management and background synchronization are not supported.
- **Calendar writes cannot use ordinary note undo.** Edit standalone events through Orb or their calendar app. Reverse linked bookings by removing the block, or reverse a move by moving it back; see [recovery and undo](task-scheduling.md#partial-writes-and-recovery).
- Feed URLs must be HTTPS; redirects are rejected, and individual feeds are limited to 5 MB.
- Calendar display times use the plugin timezone. Vault task dates are local values without stored timezone information; check the plugin setting if mixing them looks wrong.

## Troubleshooting

**No events or a warning:** the view may be incomplete. Verify the source in Full Calendar, the queried dates, and any feed error. An empty result with a source warning does not prove you are free.

**Cannot reach Full Calendar:** keep Obsidian open with the same vault, enable its Local REST Server, and check the port and token scopes.

**Calendar not found:** reconnect/select it in the plugin, reopen Orb Settings, and save the intended calendar. The integration checks that the open vault's provider matches the chosen calendar.

**A write timed out:** inspect Google Calendar before retrying. The event might have been created even if Orb did not receive confirmation.

**A recent feed edit is missing:** iCal data may be cached for five minutes. The local Google API is a separate source.

Implementation: [calendar.cjs](../../src/calendar.cjs), [google-calendar.cjs](../../src/google-calendar.cjs), and [calendar tests](../../test/calendar.test.cjs).
