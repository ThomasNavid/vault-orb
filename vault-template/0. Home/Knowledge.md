# Knowledge

Collect in the Library, organise through Hubs and Topics, and develop your own work in Portfolio. See [[99. System/Knowledge System|the guide]] and [[99. System/Obsidian Setup|plugin setup]].

## Portfolio

```dataview
LIST FROM "1. Portfolio"
SORT file.name ASC
```

## Hubs

```dataview
LIST FROM "2. Hubs"
SORT file.name ASC
```

## Topics

```dataview
TABLE hub AS Hub FROM "3. Topics"
SORT file.name ASC
```

## Recent knowledge

```dataview
TABLE topic AS Topic, type AS Type FROM "4. Knowledge Library"
WHERE contains(tags, "knowledge")
SORT file.mtime DESC
LIMIT 20
```

Without Dataview, browse the same numbered folders and follow the links in your notes.
