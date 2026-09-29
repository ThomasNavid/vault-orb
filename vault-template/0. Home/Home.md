# Home

Your daily starting point: what needs attention, what is coming up, and what you have saved.

[[Today]] · [[Inbox|Capture a task]] · [[Calendar]] · [[Habits]] · [[Goals]] · [[4. Knowledge Library/Web Clippings/Web Clippings|Web Clippings]]

```dataviewjs
await dv.view("99. System/99.4 Scripts/home/view", { section: "overview" });
```

## Focus today

Open tasks planned or due today, with past deadlines first. Click a task to update it, or use the editable task tables below. A past Planned date alone is not an overdue deadline.

```dataviewjs
await dv.view("99. System/99.4 Scripts/home/view", { section: "focus" });
```

[[Today|Open Today]] · [[#All open tasks|Browse all open tasks]]

## Habits

Record what you actually did. These controls update the same daily notes as [[Habits]].

```dataviewjs
await dv.view("99. System/99.4 Scripts/habits/view", { compact: true });
```

[[Habits|Habit history and yearly heatmaps]]

## This week's direction

![[This Week#Objectives]]

### Active goals

![[Goals.base#Active]]

### Reviews due

![[Goals.base#Review due]]

[[Goals|Manage goals]] · [[This Week#Sunday review / Monday reset|Weekly review]]

## Calendar

Appointments from your configured calendar sources. Use the arrows to browse weeks; **today** returns to this week.

```fc-calendar
type: calendar
view: listWeek
height: 360px
width: 100%
weather: false
```

[[Calendar|Open the full calendar]]

### Tasks in the next 7 days

Tomorrow through the following seven days; today's work is above. Planned and Deadline are separate dates, and these task notes do not create calendar events.

```dataviewjs
await dv.view("99. System/99.4 Scripts/home/view", { section: "upcoming" });
```

[[Calendar#Coming up|See the next 14 days]]

## Recent web clippings

The eight most recently saved clips, ordered by **Created**, rather than publication date. Older clips without that property use the file's creation date.

```dataviewjs
await dv.view("99. System/99.4 Scripts/home/view", { section: "clippings" });
```

[[4. Knowledge Library/Web Clippings/Web Clippings|Browse all clippings]] · [[99. System/Web Clipper Setup|Clipper setup]]

## All open tasks

Edit properties here and tick **Done** when finished. **Planned** is when you intend to act; **Deadline** is the latest it can be done. Dates do not send notifications.

### Life tasks

![[Life Tasks.base#Open]]

### Business tasks

![[Business Tasks.base#Open]]

[[Life Tasks.base|Life tasks, including completed]] · [[Business Tasks.base|Business tasks, including completed]] · [[Task Rules|Task conventions]]

## Your knowledge system

[[0. Home/Knowledge|Browse your knowledge]] · [[99. System/Knowledge System|How to organise it]]

Hubs → Topics → Knowledge Library is your browsing structure. Portfolio is where you develop your own ideas and outputs from what you learn.

## Around the vault

[[6. Life Admin/Life Admin|Life Admin]] · [[README|Vault guide]] · [[99. System/Obsidian Setup|Use this vault in Obsidian]] · [[99. System/Assistant Guide|Working with assistants]]

## Recurring tasks

Complete or skip occurrences here; the next date is calculated inside Obsidian. These controls require desktop Obsidian and Dataview JavaScript. [[Recurring Tasks|Create, edit schedules and browse all history]] · [[99. System/Recurring Tasks Setup|Setup]]

```dataviewjs
await dv.view("99. System/99.4 Scripts/recurring-tasks/view", { compact: true });
```
