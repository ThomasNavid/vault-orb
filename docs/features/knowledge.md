# Knowledge, Portfolio and graph

[Documentation](../README.md) · [Vault format](../vault-format.md) · [Obsidian-only use](../obsidian-only.md)

Orb connects **Capture → Explore → Create** using your existing Markdown files. Hubs map broad interests, Topics gather subjects, Knowledge Library holds learning and source material, and Portfolio holds your ideas and outputs. No Obsidian plugin or separate database is required for the app's browser and graph.

## Open and browse

Choose **Explore → Knowledge**, **Portfolio**, or **Knowledge graph**. In Knowledge, follow a Hub to its Topics and a Topic to linked Library and Portfolio notes. Tabs also let you browse each type directly, search titles, and review connection suggestions. Notes have a readable preview, source URL and reason when supplied, and **Open in Obsidian**. Dataview blocks are omitted from previews; their underlying relationships appear as linked-note lists.

The numbered folders and matching tags identify records:

| Folder | Required tag | Purpose |
| --- | --- | --- |
| `1. Portfolio` | `portfolio` | Original thinking and outputs |
| `2. Hubs` | `hub` | Broad subject maps |
| `3. Topics` | `topic` | Focused subjects |
| `4. Knowledge Library` | `knowledge` | Source material and learning |

Nested folders are included. Untagged folder guides are excluded. Existing notes are never moved or retagged automatically. General note search remains available outside this structure.

## Capture

Click **+ Capture**, choose a type, and enter a title and optional content. Library captures can include a source URL, a Topic and “Why I saved this.” **Keep unfiled** saves a Library note with no Topic so you can file it later. Creating a Topic requires an existing Hub. **+ Capture here** on a Topic or Hub preselects its relationship.

Voice and text support the same writes. For example:

> Save a Library note called “CPU lecture” under Computer Architecture: registers hold the values used by instructions. The source is https://example.com/course.

> Save an unfiled Library note called “Article to revisit” with this text: [your supplied notes].

> Create a Portfolio idea called “A better onboarding checklist” with these thoughts: [your thoughts].

Orb saves supplied material or an explicitly requested draft; saving a URL does not fetch or read the webpage. Use Web Clipper or supply the source content yourself. Same-name creation chooses a numbered filename instead of overwriting a note.

## Learn within a subject

Open a Topic or Hub and use **Ask Orb**, **Quiz me**, or **5-minute refresher**. These open a chat with the exact subject path. The assistant reads the note and connected material, cites note paths, and is instructed to separate source claims from its own synthesis. Clickable Markdown source citations open in Obsidian.

Quizzes ask one question at a time and wait for your answer before feedback. Refreshers use approximately five minutes of material, not a timer. Learning conversations do not save grades, mark progress, or change notes. Missing or truncated evidence must be acknowledged; a saved link is not evidence that a source was read.

## Create from selected notes

Select up to 30 Library notes in the Library tab or a Topic's related list. Click **Create from these notes**, choose Explanation, Comparison, Framework, or Cheat sheet, give the output a title and your angle, then choose **Draft with Orb**.

This starts a chat request to read the selected sources and save an AI-assisted Portfolio draft at stage **Developing**. Its Related Documents section cites those sources. Each selected Library note also receives a `Supports: [[Portfolio path]]` backlink, which makes it appear in the Portfolio template's Dataview knowledge list. The original source content is preserved.

Creation and backlinks are separate journal entries. A failed backlink does not roll back the saved Portfolio note or earlier links. Orb returns the saved path, completed changes, and warnings. Retry the missing connection using that path, rather than creating another draft. Undo the backlinks first, then the Portfolio creation, to remove the whole workflow without leaving dangling links.

## Develop Portfolio work

Portfolio notes have **Idea → Developing → Ready** stages. Changing the stage is an explicit, undoable note edit. Old notes without a stage display as Idea without being rewritten.

**Continue working** reads the existing work and supporting sources for a discussion. Empty templates are identified as needing content; the assistant should establish the purpose before drafting. **Edit draft & questions** saves dedicated Working draft and Open questions sections alongside the original body. It preserves unrelated prose, properties and Dataview. Editing an existing original section directly remains an Obsidian action.

Library and Portfolio notes also have a Primary Topic selector and an optional **Revisit on Today** date. Save a date to surface the note on Today on or after that day. Clear or change it when finished; merely viewing it never advances the date. This is an on-demand dashboard, not a background notification scheduler.

## Connections and housekeeping

The Connections tab lists unfiled captures and possible Topic/Portfolio connections based on shared words in titles and note excerpts. These are simple lexical suggestions, not semantic judgments or proof that a source supports a claim.

Review the notes before choosing **File under Topic** or **Add connection**. Filing sets the Library note's primary Topic; additional connections append a body link. Accepting requires both notes' current versions. **Dismiss** stores a local preference scoped to this vault and note versions; the suggestion can reappear after a source changes. Dismissal changes no vault note and is not part of note undo.

## Corner graph

A small graph preview stays in the bottom-right corner while an Orb panel or chat is open. It is hidden in the bare compact Orb. Click it to expand; **Collapse** or Escape returns to the previous view.

- Blue Hubs, purple Topics, neutral Library notes, and green Portfolio nodes have distinct sizes.
- Full graph shows the knowledge system; local graph shows one or two steps around a note.
- Filter by type, Hub, title search, or unlinked notes; adjust spacing.
- Drag nodes or the background, scroll to zoom, or use + / − / Reset.
- Click a node for a preview; double-click or choose Focus here for its neighbourhood. Explore note returns to the knowledge browser.
- Graph nodes are keyboard focusable: Tab to a node and press Enter to preview it.

Solid lines represent `hub` and `topic` property links. Dotted lines represent other property/body links. The graph recognises incoming and outgoing links, wikilink labels and headings, exact vault paths, unique short filenames, and ordinary relative Markdown links. Ambiguous short filenames are not guessed. Fenced code, inline code, HTML comments, external URLs and Dataview-generated results do not create edges. Connections outside the four indexed knowledge folders are not drawn.

## Limits and troubleshooting

The local index exposes up to 2,000 tagged notes and warns when incomplete; each graph view draws at most 300 matching nodes. Narrow the graph with a Hub or local view. Assistant listings return at most 200 records; use search for narrower retrieval. Topic context includes up to 16 notes and 60,000 characters overall, with at most 12,000 characters per note. Selected-source synthesis reads up to 30 Library notes together, capped at 90,000 characters overall and 12,000 per source. Note previews are capped at 50,000 characters. Truncation is explicit.

Orb refreshes after its own writes and on opening Knowledge. Use the graph's **Refresh** or reopen Knowledge after edits made in Obsidian. Graph layout/filter choices last for the current app session. No automatic file watcher or Obsidian graph-settings import is provided.

If a note is missing, check its folder and tag. If a primary relationship is missing, quote the wikilink in YAML and use a unique/exact path. Malformed YAML and unresolved primary links appear as warnings. If a save reports that a note changed, reopen it to get a current version before retrying. See [Changes and undo](changes-and-undo.md) for restoration limits.

Browsing, graph layout, capture forms, stage changes, filing, draft editing, and suggestion review work locally. AI questions, quizzes and draft generation need a configured AI provider and send relevant retrieved notes to the selected provider. No source URL is downloaded by knowledge tools. See [Privacy](../privacy.md).
