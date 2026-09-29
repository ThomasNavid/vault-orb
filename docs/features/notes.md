# Finding and updating notes

[Documentation](../README.md) · [Things to ask Orb](../things-to-ask.md) · [Planning](planning.md)

Find notes by title or content, ask questions grounded in their text, compare options, and append a decision or thought to an existing Markdown note.

## Setup

Use any visible Markdown notes inside the selected vault. Ordinary notes do not need task or goal frontmatter. The app's two-task-folder setup requirement still applies when saving Settings.

The sample vault contains [Example launch options](../../vault-template/Notes/Example%20launch%20options.md) and [Example meeting](../../vault-template/Notes/Example%20meeting.md), which the examples below use. Plain `.txt` files can also be located by filename and read, but general content search scans Markdown.

## Things to ask

| Ask | Expected result | Changes data? |
| --- | --- | --- |
| “Find my notes about pricing.” | Keyword matches in Markdown titles and content, with excerpts and paths. | No |
| “Find the file called Example meeting.” | Filename matches from supported visible files. | No |
| “Read Notes/Example meeting.md and summarize the decisions.” | A summary grounded in the actual note. | No |
| “What questions remain open in Notes/Example meeting.md?” | Extracts unresolved questions without treating them as new tasks. | No |
| “Compare the options in Notes/Example launch options.md in a table.” | A sourced comparison beside the orb. | No |
| “Append ‘Decision: use the one-page pilot for the first launch.’ to Notes/Example meeting.md.” | Appends that text after checking the note version. | Existing Markdown note |
| “Undo your last note edit.” | Restores the note if it has not changed since that edit. | Existing Markdown note |

You can use different wording. Giving the full relative path helps when filenames are similar. Ask for an append explicitly when you want the summary or decision saved.

## What happens

Search returns candidate excerpts. Orb can read the matching files for context, then cite their paths in written answers; spoken answers use short titles. A comparison may appear as a table with source buttons. Markdown source links open in Obsidian; `.txt` source files open in the default local app.

Appending reads the current version, adds text at the end, and creates an undo entry. It does not replace earlier paragraphs or rewrite your note structure. Text inside a retrieved note is reference material, not permission to perform the actions it describes.

## Walkthrough: turn a discussion into a recorded decision

1. **“Read Notes/Example meeting.md. What has been decided and what is still open?”**
2. **“Read Notes/Example launch options.md and compare the choices against the priorities in the meeting note.”**
3. Choose an option yourself, then ask **“Append ‘Decision: use the one-page pilot for the first launch.’ to Notes/Example meeting.md.”**
4. Open the note to inspect the addition, or use Recent changes to undo it.

Asking for a summary or recommendation does not automatically save it. Asking to append a decision does not automatically create tasks for every action mentioned.

## Limits

- Content retrieval is keyword-based Markdown search, not a full semantic index. Related wording may need alternate searches.
- The filename finder supports `.md`, `.txt`, `.xlsx`, `.csv`, and `.tsv`. Spreadsheet reading has its own [guide](spreadsheets-and-visuals.md).
- General note reads accept Markdown and plain text up to **512 KB**. The assistant tool returns at most **50,000 characters** of a note with a truncation flag; narrow or split large source material when needed.
- There is no general-purpose create-note, rename, move, delete, or arbitrary text-replacement tool. Task and goal creation/editing use their dedicated tools. Generic text writes append to existing Markdown notes.
- PDFs, images, audio attachments, and legacy `.xls` contents are not parsed. Linked notes are not automatically all loaded; ask for the relevant sources.
- Hidden files and symbolic links are excluded from normal vault tools. Notes outside the selected vault are unavailable.

## Troubleshooting

**A search finds nothing:** try a distinctive word in the title, provide the path, or ask to find the filename. Content inside `.txt` and spreadsheets is not part of Markdown content search.

**The answer omits part of a long note:** check whether the read was truncated. Split it into smaller notes or identify a more focused source.

**An append failed:** verify the destination is an existing `.md` note and ask Orb to reread it if the version changed. Never treat a failed write as saved.

Implementation: [vault.cjs](../../src/vault.cjs), [agent.cjs](../../src/agent.cjs), and [Changes and undo](changes-and-undo.md).
