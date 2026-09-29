# Web Clippings

[Documentation](../README.md) · [Knowledge](knowledge.md) · [Clipper setup](../../vault-template/99.%20System/Web%20Clipper%20Setup.md)

Open **Explore → Web Clippings** to browse and search saved articles, videos, and X posts. Knowledge → Library also has a Web Clippings shortcut. Search works locally without an AI key. Your Markdown files remain the source of truth.

## Save and find a clipping

1. Use Obsidian Web Clipper to save an article or selected passage into `4. Knowledge Library/Web Clippings/Websites`, `Videos`, or `X Posts`.
2. Open Web Clippings, or click **Refresh** after capturing something in the browser.
3. Search for words from the title or saved content. All words must match somewhere in the note; put a phrase in double quotes to match consecutive words.
4. Filter by category, source domain, Topic/Unfiled, or capture dates. Empty search lists newest first; searches rank title matches above metadata and body matches. **Newest** is also available as an explicit sort.
5. Open a result to read its saved content, open the original URL in your browser, open the note in Obsidian, or **Ask Smith about this**.

Results show matching passages and highlight search terms. Title/metadata-only matches are labelled. **Load more** adds the next 30 results. Back preserves the current query, filters, and position. Escape returns from the preview, then closes the library; ⌘F focuses search. Tab stays within the library while it is open.

## What is included

All visible Markdown files inside Web Clippings and its subfolders are searchable, including untagged files and files saved directly under the root. The exact starter `Web Clippings.md` dashboard, hidden files, and symbolic links are excluded. Notes elsewhere in the vault remain accessible through general note search.

Properties are optional:

| Property | Behaviour |
| --- | --- |
| `title` | Display title; filename is the fallback. |
| `source` | Original HTTP(S) URL; a valid `url` property is accepted as a fallback. Links with embedded credentials are not opened. |
| `author` | String or list of names. |
| `type` | Fallback category when the subfolder does not identify one. |
| `topic` | Primary subject, including a quoted Obsidian wikilink. Missing values are Unfiled. |
| `tags` | Searchable tags. `knowledge` includes the clip in the existing Knowledge system. |
| `created` | Capture date: `YYYY-MM-DD` or ISO date/time with seconds, optional milliseconds, and optional timezone. |

Websites/Videos/X Posts folders determine category before `type`. Accepted type aliases are `website`, `websites`, `article`, `web`; `video`, `videos`, `youtube`; and `x post`, `x posts`, `tweet`, `twitter`, `x`, ignoring case. Everything else is Other.

Missing or invalid capture dates display as Unknown and sort last in newest order. Date filters use the local calendar date, including timezone conversion for timestamps, and exclude unknown dates. File modification time is not treated as capture time. Duplicate URLs and titles remain separate notes; no files are merged, moved, or retagged.

Untagged clips are searchable here but retain the existing tag requirements for Knowledge graph and Portfolio synthesis. Add `knowledge` in Obsidian if you want that integration.

## Ask Smith

| Request | Result | Changes data? |
| --- | --- | --- |
| “Find my web clippings about local AI models.” | Searches only saved clippings and returns matching candidates. | No |
| “Show videos I saved about photography last month.” | Searches saved video notes within the capture-date range. | No |
| “What did the article I clipped about pricing say?” | Finds candidates, reads relevant saved notes, and answers with local source citations. | No |
| “Compare these two saved articles: [exact paths].” | Reads the specified notes and compares the saved evidence. | No |

**Ask Smith about this** starts a chat that reads the exact selected clipping and explains its main points. The assistant is instructed to cite the local note, distinguish source material from personal notes and synthesis, and acknowledge missing or truncated evidence. Asking needs a configured provider and shares relevant retrieved material with that provider.

A saved URL alone is not the article's content. Video links do not provide transcripts. Capture the content or add your notes before asking content questions. No webpage, video, image, or X post is automatically fetched by this feature.

## Limits and troubleshooting

- Search covers the full body of readable notes, not just the preview. Each note must fit the existing 512 KB read limit. Previews and assistant note reads show up to 50,000 characters and report truncation; open long notes in Obsidian for the complete text.
- The independent in-memory index covers up to 10,000 notes / 64 MB of source text, 100,000 directory entries, and 24 nested folder levels. It is not constrained by the Knowledge graph's 2,000-note cap. Coverage warnings identify skipped files and partial scans; result totals then describe only indexed notes.
- Invalid YAML and unreadable or oversized files appear as warnings. Fix the source file and Refresh. A missing clipping folder is optional setup, not an invalid vault.
- Opening the library, explicit Refresh, relevant Orb changes, and a new assistant clipping search refresh the index. External Obsidian/browser changes need refresh. Pagination belongs to one index revision; a stale page asks you to refresh.
- Search is keyword-based, not semantic. Try fewer words, another phrase, or clear filters. PDF, audio, image, and uncaptured video contents are not searched.
- Previews show inert saved text, including Markdown notation. Embedded HTML and Dataview are not executed; remote images are not loaded. **Open original** opens only the freshly read, validated source URL through your system browser.
- Browsing, searching, previewing, and asking questions make no vault edits. This release does not add a browser extension or a Save snippet action in Orb. Keep using Obsidian Web Clipper for capture.
