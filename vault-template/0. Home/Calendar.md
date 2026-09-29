```fc-calendar
type: calendar
view: timeGridWeek
height: 800px
width: 100%
weather: false
slotDuration: 00:30:00
slotLabelInterval: 01:00:00
```

## Coming up

### Planned work

```dataview
TABLE WITHOUT ID file.link AS Task, planned AS When, choice(file.folder = "0. Home/Business Tasks", "Business", "Life") AS Area
FROM "0. Home/Life Tasks" OR "0. Home/Business Tasks"
WHERE type = "task" AND completed != true AND planned >= date(today) AND planned < date(today) + dur(14 days)
SORT planned ASC
```

### Deadlines

```dataview
TABLE WITHOUT ID file.link AS Task, due AS Due, choice(file.folder = "0. Home/Business Tasks", "Business", "Life") AS Area
FROM "0. Home/Life Tasks" OR "0. Home/Business Tasks"
WHERE type = "task" AND completed != true AND due >= date(today) AND due < date(today) + dur(14 days)
SORT due ASC
```

[[Today|Today and past deadlines]] · [[Home|All tasks]]
