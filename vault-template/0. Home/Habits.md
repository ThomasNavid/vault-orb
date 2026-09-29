# Habits

Sample habit definitions: Pull-ups daily and Study Mandarin twice weekly. These are fictional examples, not commitments or recorded activity. Adapt the definitions in `99. System/99.4 Scripts/habits/view.js` to your own habits, keeping property keys stable.

In Vault Orb, click **Habits** or ask “Show my habits.” In Obsidian, the dashboard below needs Dataview with JavaScript queries enabled, in Reading view or Live Preview. Orb does not require Dataview.

```dataviewjs
await dv.view("99. System/99.4 Scripts/habits/view");
```

Check a habit to record completion for the selected day; uncheck it to remove completion. Selecting a date or heatmap square does not record activity. Future dates cannot be logged. Only YAML boolean `true` counts, once per habit per day.

Progress cards show the current Monday–Sunday week, even when a past date is selected. Heatmaps show recorded days, with future days faded and today outlined. An empty day means not recorded, not necessarily skipped. Changing a target changes comparisons for past weeks too.

Records live in [[0. Home/Habit Log/README|Habit Log]]. Opening a missing daily record creates it with all habits false. Use [[This Week]] to choose weekly outcomes, and [[Goals]] to review longer-term progress. No goal is automatically achieved by a habit log.
