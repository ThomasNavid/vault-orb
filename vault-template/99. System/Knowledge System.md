# Knowledge System

Separate what you collect, how you organise it, and what you create from it.

| Area | Purpose | Contents |
| --- | --- | --- |
| Portfolio | Your thinking and outputs | Ideas, principles, frameworks, summaries, cheat sheets, developed work |
| Hubs | Broad maps of interests | Broad fields you choose |
| Topics | Focused subjects | Subjects within those fields |
| Knowledge Library | Material you learn from | Books, courses, papers, videos, lectures, meetings, practice, clippings |

Browse **Hubs → Topics → Knowledge**. Develop learning into your own work in **Portfolio**. The folders hold each file once; links allow it to support several subjects and outputs.

## Connections

- A Topic's `hub` property links to its Hub: `hub: "[[2. Hubs/Computing Hub]]"`.
- A Knowledge note's `topic` links to its main Topic: `topic: "[[3. Topics/Computer Architecture]]"`.
- Portfolio can link to a Hub, Topic, and supporting Library notes. Quote wikilinks in YAML.
- Hub and Topic template queries list notes in the relevant folders whose outgoing links point back to the page; body links count too.
- Portfolio's automatic Links to Knowledge table lists **Library notes linking to the Portfolio note**. It is not the list of sources the Portfolio note cites. Put outgoing citations under Related Documents; add a backlink in the source note if you want it in the automatic table.

Illustration only: Computing Hub → Computer Architecture → course notes about CPUs. A separate Portfolio explanation, “How CPUs work”, can cite those course notes. None of these example records is pre-created.

## Filing decisions

- Saved or learned from a source → Knowledge Library.
- Gather everything about one subject → Topic.
- Map a broad field → Hub.
- Your developed idea or useful output → Portfolio.

Use the corresponding template in `99. System/99.1 Templates`. Templates contain writing prompts, not completed work. Keep source quotations, your conclusions, and AI-assisted drafts distinguishable; preserve source links.

## In Orb

Open Explore → Knowledge to browse, capture, and preview notes. Library captures can stay unfiled until you choose a Topic. Portfolio uses Idea → Developing → Ready stages, with a working draft and open questions. Select Library notes and choose Create from these notes to develop an AI-assisted output; Orb saves outgoing citations and appends backlinks to the supporting sources. Each write has its own undo entry.

A small knowledge graph sits in the corner of open Orb panels and chats. Expand it to filter, zoom, and explore one or two steps around a note. The knowledge graph uses actual property/body links and does not execute Dataview. While a task list is displayed, the corner graph instead shows those to-dos grouped by their displayed venture or task list. These area connections do not write links to notes. Switching context clears the previous graph focus and filters. Topic questions, quizzes, and refreshers read your linked notes; they do not save grades or progress. A user-chosen revisit date surfaces a note on Today until cleared or changed.
