# Calendar Setup

Calendar is optional. Install and enable Full Calendar Remastered, then configure your own calendars in its settings. No accounts, tokens, or feed URLs ship with this vault.

For read-only feeds, add an ICS Remote URL source. A private ICS URL is a credential: put it in plugin settings, never in a public note. Plugin settings live in `.obsidian`, so protect vault backups and sync appropriately.

For Google event creation through Orb, connect Google in Full Calendar Remastered, enable its Local REST Server, and generate a token with Read events, Write events, and Read providers. Keep Obsidian open. In Orb Settings, paste that token and select the calendar. ICS alone does not enable writes.

In Obsidian alone, use the plugin's calendar interface and the operations supported by your chosen provider. The Calendar note contains an embedded calendar. Task Planned and Deadline properties remain separate; editing them never creates a Google event. There is no reminder scheduler in this vault.

## Linked task blocks in Orb

In Orb Settings → Integrations → Google Calendar, choose working hours/days (default weekdays 09:00–17:00 in the calendar timezone). Add a matching Google HTTPS iCal feed for each connected Google calendar so availability includes recurring commitments. Keep private feed URLs out of chat.

Create an unfinished non-recurring task, then ask “Find me 45 minutes this week for Draft proposal.” Book a returned slot explicitly, or say “Schedule Draft proposal for 45 minutes this week.” Moving its block updates Planned; completion appears alongside it in Orb. Refresh Full Calendar after Google changes, then refresh Today or ask for tasks/calendar.

Use “Remove Draft proposal’s calendar block” to reverse booking; ordinary note undo cannot undo a calendar change. Pending/missing links require refresh or explicit repair. Unlinking leaves any event in place. Keep the task UUID and calendar_block properties intact when renaming a note.
