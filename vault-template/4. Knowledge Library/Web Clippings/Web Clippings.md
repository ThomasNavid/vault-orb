# Web Clippings

Save source notes in Websites, Videos, or X Posts. Preserve the source URL, author when known, and capture date. Set `topic` to the main subject; link other related subjects in the body.

```dataview
TABLE topic AS Topic, source AS Source, created AS Created
FROM "4. Knowledge Library/Web Clippings"
WHERE contains(tags, "knowledge")
SORT created DESC, file.name ASC
```

See [[99. System/Web Clipper Setup|Web Clipper Setup]].
