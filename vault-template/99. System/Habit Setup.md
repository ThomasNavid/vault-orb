# Habit Setup

The starter has no habits. Edit the `const habits = [];` line in `99. System/99.4 Scripts/habits/view.js` to add the habits you choose. For example, if you decide to track reading:

```js
const habits = [
  { key: "reading", label: "Read", target: 3, cadence: "Three days a week", color: "#31995b" }
];
```

Use up to 12 definitions. Keys must be unique lowercase letters/digits/underscores starting with a letter; do not use date, type, constructor, prototype, or __proto__. Labels are up to 80 characters, targets are integer days per week from 1–7, and colors are six-digit hex. Use this literal syntax; Orb parses the array as data and does not execute the script.

Keep keys stable: changing a key does not migrate old history. Changing a target changes historical comparisons too. Records and table columns are generated from the array, so no other code changes are needed. Reopen or refresh Habits after editing definitions.

In Obsidian, enable Dataview JavaScript Queries and use Reading view or Live Preview. Orb's habit panel needs no Obsidian plugin. Both use the same records; each app's undo applies only to edits it made.
