# Habits

Choose your habits using [[99. System/Habit Setup|Habit Setup]]. The starter has no predefined habits or activity history.

```dataviewjs
await dv.view("99. System/99.4 Scripts/habits/view");
```

Record what you actually did. Only boolean true counts, once per habit per day. Missing means not recorded. Weeks run Monday–Sunday; targets apply to past weeks too.

Records live in `0. Home/Habit Log/YYYY-MM-DD.md`. Viewing creates nothing; ticking a habit or explicitly opening a missing record creates that day's note. Edit the same properties in Obsidian or use Orb. Obsidian edits do not enter Orb's undo history.
