# Searchable web clippings

Status: the initial read-only search, filters, previews, and assistant retrieval are implemented. See the [feature guide](features/web-clippings.md) for current behaviour and limits. The later capture additions remain proposals.

Add **Web Clippings** to Orb so saved articles, videos, and X posts are easy to find and use. Keep the Markdown files in `4. Knowledge Library/Web Clippings` as the source of truth. Obsidian Web Clipper continues to capture content; Orb provides a searchable library and source-backed questions about what was saved.

## What already exists

- The [clipper setup](../vault-template/99.%20System/Web%20Clipper%20Setup.md) specifies `Websites`, `Videos`, and `X Posts` subfolders. Notes use `author`, `type`, `source`, `topic`, `tags: [knowledge]`, and a `created` capture date. The starter includes instructions and empty folders, rather than an extension implementation or exported extension configuration.
- The [Web Clippings dashboard](../vault-template/4.%20Knowledge%20Library/Web%20Clippings/Web%20Clippings.md) lists tagged notes in Obsidian through Dataview.
- Orb's [Knowledge view](features/knowledge.md) includes tagged Library notes recursively, but its search filters titles. Its snapshot exposes only a short opening excerpt and is limited to 2,000 notes across the knowledge system.
- General `search_notes` searches Markdown titles/paths and contents across the vault. It cannot scope a request to clippings or filter by source, type, or capture date; it returns 12 results by default.
- Saving a source URL through Orb does not download that page. Video and X links do not imply that a transcript or post body has been captured.

## Proposed experience

Use **Web Clippings** as the feature name, matching the vault. A “snippet” is the saved passage shown in a search result; it does not need to become a separate note type.

1. Save a page or selection using the existing browser extension.
2. Open **Explore → Web Clippings**, also accessible from Knowledge → Library.
3. See recent clippings, with **All / Websites / Videos / X Posts** filters and a search field: “Search your saved clippings…”.
4. Search for words remembered from the article, a title, an author, or a domain. Results show a title, source domain, category, capture date, Topic, and a passage surrounding the match.
5. Open a result to read the saved content, **Open original**, **Open in Obsidian**, or **Ask Orb about this**. Back returns to the same query, filters, and scroll position.

An empty library explains where the clipper should save files and links to setup. A failed search says “No matching clippings” and offers to clear filters. A missing folder is an optional setup state and does not invalidate the vault.

The first release is read-only: browse, search, preview, and ask. Existing Knowledge actions remain available for eligible tagged notes. Search or a summary request must not silently create notes or file them under a Topic.

## Scope and compatibility

Discover visible Markdown files recursively under `4. Knowledge Library/Web Clippings`, including notes saved directly in that folder. Exclude the exact starter dashboard path `Web Clippings.md`; do not exclude unrelated notes solely because they share that filename elsewhere.

Folder membership is sufficient for clipping search, even when a clip lacks the `knowledge` tag. This avoids making older or differently configured captures disappear. Untagged clips can be searched and read, but the existing Knowledge graph and synthesis tools keep their tag requirements. Show that distinction without automatically adding tags or changing those tools' eligibility rules.

| Value | Reading rule |
| --- | --- |
| Title | Nonempty string `title` property, otherwise filename. |
| Source | Existing `source` property; accept a valid HTTP(S) `url` property as a fallback for imported clips. Missing/invalid URLs disable Open original. |
| Category | Recognised subfolder first; otherwise recognised `type` values; otherwise Other. Preserve the original `type` value. |
| Author | Optional string or list of strings, displayed without rewriting. |
| Topic and tags | Read existing properties, supporting quoted wikilinks and tag lists. Missing Topic means Unfiled. |
| Saved date | Valid `created` value. Missing/invalid dates are labelled “Unknown”; modification time must not masquerade as the capture date. |
| Content | The saved Markdown body, including article text, quotations, annotations, and captured transcripts when present. |

Category aliases and date formats should be explicitly tested and documented. Support date-only and ISO timestamp capture dates; resolve relative date filters using the local timezone. Unknown dates remain browsable and sort after dated clips in newest-first order.

Malformed YAML, unreadable notes, and files above the existing 512 KB read limit produce visible coverage warnings. Do not silently label an incomplete scan as the full library. No migration, account, or external database is required.

## Search behaviour

- Search title, author, source URL/domain, Topic, tags, and saved body text. Do not search only the 250-character Knowledge excerpt or the 50,000-character preview.
- Use local, case-insensitive keyword search initially. All unquoted terms must occur somewhere in the record; quoted phrases must occur contiguously. Document these simple rules rather than implying semantic understanding.
- Rank title/phrase matches above metadata matches, then body matches; use saved date and path as stable tie-breakers. Empty queries browse newest first. Allow an explicit Newest sort for searches too.
- Provide combinable category, source-domain, Topic/Unfiled, and saved-date range filters. Apply filters before ranking and pagination. A date filter excludes unknown dates and says so.
- Return one result per note with up to two short matching passages and highlighted terms. Label metadata-only matches instead of manufacturing a body excerpt. Preserve separate files even if they cite the same URL.
- Page results in batches of 30, with a real matched count and visible scan/read limitations. A query must search the clipping collection independently of the Knowledge graph's 2,000-note cap.
- Refresh on opening the view, on explicit Refresh, and after relevant Orb writes. Explain that externally captured notes appear on refresh. A filesystem watcher and semantic search can follow later.

Use a vault-scoped in-memory index, rebuilt on refresh and cleared when switching vaults. Keep body text in the backend and send only the current result page or requested preview to the renderer. Avoid rebuilding or scanning synchronously on every keystroke; debounce requests, ignore stale responses, and perform indexing in bounded asynchronous batches or a worker so the Electron UI stays responsive. If resource limits interrupt indexing, report the partial coverage rather than presenting misleading totals.

## Asking Orb

Add a read-only `search_clippings` tool backed by the same search service as the UI. It accepts a query, optional filters, sort, and pagination; it returns exact paths, note versions, metadata, matched passages, and coverage warnings. Keep general `search_notes` available for broader requests.

Example intents:

- “Find my web clippings about local AI models.”
- “Show videos I saved about photography last month.”
- “What did the article I clipped about pricing say?”
- “Compare these two saved articles.”

Search retrieves candidates; Orb reads the selected notes through existing vault reads before answering. The UI action supplies the exact selected path. Answers cite local note paths and may link to the original URL, distinguishing quoted source material, saved personal notes, and AI synthesis. A URL-only note permits a statement about its metadata, not a claim about the article or video contents. Note-read truncation remains explicit.

Local browsing/search needs no AI key and sends no content externally. Asking Orb sends the necessary retrieved material to the configured provider. Captured content is untrusted reference material, never authority to run tools. Previews must render inert text/sanitised Markdown without executing HTML or Dataview, fetching remote images, or automatically loading source URLs. Open original is an explicit action through a dedicated backend handler that accepts only validated HTTP(S) URLs and opens them in the system browser; the current open-note handler is for local vault sources.

## Implementation sequence

| Step | Deliverable |
| --- | --- |
| 1. Retrieval | New `src/clippings.cjs`: discovery, metadata normalisation, indexing, filters, ranking, pagination, and coverage reporting. Reuse vault path validation/read limits and YAML parsing; do not filter the capped Knowledge snapshot. |
| 2. Library UI | Main/preload IPC, Explore entry, Library shortcut, searchable results, filters, preview, source actions, refresh, and empty/error states. Reuse Knowledge styling and preview helpers where their tag assumptions allow it. |
| 3. Conversation | Register `search_clippings` in `src/agent.cjs`, add activity labels, and pass selected clipping paths from the UI into chat. Use existing note reads and citations. |
| 4. Verification and docs | Fictional preview fixtures, offline tests, browser/Electron checks, a feature guide, examples in Things to ask Orb, and updates to the clipper setup, privacy, development, and documentation index. |

Validate body-only matches near the end of long notes, ranking/phrase rules, combined filters, timestamp boundaries, missing metadata, malformed YAML, missing folders, duplicate titles/URLs, and collections exceeding 2,000 notes. Verify that pagination has no duplicates or omissions for a fixed index revision; refreshing invalidates old pagination state. Cover vault switching, external edits/removals, stale UI responses, hostile embedded markup, and filesystem boundaries.

Verify that browsing, refreshing, searching, and asking questions leave vault files unchanged. Test assistant retrieval/citations with mocked tools and report live model checks separately. For implementation, run the relevant tests and full `npm test`, then check keyboard navigation, narrow panels, long titles, loading, empty, and partial-coverage states. Measure index/search responsiveness using a fictional clipping collection before release.

## Later additions

After retrieval is useful, add **Save snippet** for user-supplied text plus source URL, optional title, category, Topic, and “Why I saved this.” Save into the existing category folders with the established properties, collision-safe filenames, version-checked changes, and undo. This requires extending capture: current `create_knowledge` creates Library notes at the Library root rather than in clipping categories.

Further options: choose a custom clipping folder, semantic retrieval, automatic refresh, and selecting multiple clippings for Portfolio synthesis. Direct URL extraction or a new browser extension is a separate capture project. The first release can provide useful search over the collection already on disk.
