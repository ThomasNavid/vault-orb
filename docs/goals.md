# Goals: contributor guide

[Documentation](README.md) · [Goals user guide](features/goals.md) · [Development](development.md)

Goals use the same Markdown vault, task lists, change journal, and companion panel as the rest of Orb. There is no separate goal database. The public examples contain fictional data only.

## Data and setup

`Vault.goalsFolder` defaults to `0. Home/Goals`. An empty string disables the feature. When an older configuration has no goal setting and its task folders overlap the default goal path, goals start disabled instead of preventing startup. Explicitly configured overlapping paths are rejected. Settings accept an absent folder so an existing installation can upgrade without changing its vault; creating a goal requires the folder to exist. Paths must be visible, relative, within the vault, and separate from both task folders. Existing ancestors are checked for symlinks. Goals never alter Home, Bases, templates, or plugin settings in an existing vault.

The parser recognizes `.md` notes under this folder with `type: goal`, a supported `status`, and optional `target`, `review`, and `next_task`. Unknown frontmatter is preserved. Invalid notes produce warnings, rather than disappearing without explanation. Dates are local calendar days; `target` is never mapped to task `due`.

Goal titles come from filenames. The four level-two body headings are `Finish line`, `Why it matters`, `Starting point and milestones`, and `Weekly check-ins`. Editing a narrative field replaces only its section. Saving a review appends inside Weekly check-ins, before any subsequent section. Fenced code headings are ignored. Duplicate sections with the same managed heading must be resolved in Obsidian before writing that section.

## Tools and rendering

| Tool | Behavior |
| --- | --- |
| `list_goals` | Reads notes and linked tasks; displays the panel. Scopes: `active`, `review_due`, `other`, `all`. No writes. |
| `create_goal` | Creates a complete note with an observable finish line. Defaults to Active and a review one week ahead. |
| `update_goal` | Version-checked metadata and narrative changes. Null leaves a field unchanged; empty strings clear optional fields. |
| `review_goal` | Appends a dated progress/obstacle/decision entry and changes goal metadata in a single journaled write. |

Both Realtime and the deeper reasoning model receive these tools and the goal interaction instructions in `src/agent.cjs`. Those instructions distinguish read-only planning from authorized edits, require explicit achievement, and prohibit fabricated progress. A user's completed review conversation authorizes saving its check-in; simply asking to see or begin a review does not.

`src/goals.cjs` implements parsing, validation, link resolution, and writes through `Vault.commit`. `src/visuals.cjs` constructs the `goals` visual directly from parsed source records. `src/visual-renderer.js` renders text with DOM text nodes, with no Markdown HTML execution. Status filters use a read-only IPC handler and need no model request. New goal and review controls submit ordinary conversational requests. `show_visual` cannot fabricate a native goal panel.

Goal dates use the current local date. Active goals with `review <= today` or a missing review appear in Review due. Inactive goals are excluded. New active goals and completed reviews default to seven calendar days ahead; reactivation defaults a missing Review similarly. Inactive status clears Review. A target before today produces an advisory notice only.

## Links and refresh

The stored `next_task` is a quoted Obsidian wikilink. Writes require an exact vault-relative Markdown path to an unfinished task in one of the two configured lists. Existing full paths, unique short paths, aliases, and heading links are resolved for reading. Ambiguous or broken links are surfaced without selecting an arbitrary task. Task filenames containing wikilink delimiters cannot be assigned as next tasks until renamed.

Task completion leaves the goal active and flags its next action for replacement. Orb edits, appends, and undo refresh a visible Goals panel. A new goal outside the selected filter switches to All so the new note is visible. External Obsidian edits are reread on the next goal query or filter change; there is no filesystem watcher.

## Write guarantees and limits

Each goal mutation uses the existing note version hash, atomic file write, and undo journal. Review text and goal metadata form one edit. Task creation/scheduling and goal linking are separate edits, not a transaction across notes. If linking fails after a task was created, the assistant reports the partial result and retries linking that task; it must not create a duplicate. Undo restores the exact previous goal bytes and refuses to overwrite newer external changes.

There is no background reminder scheduler, automated status inference, progress score, goal rename/delete tool, or automatic Templater execution. Review conversation state is transient; recorded check-ins persist in Markdown. The parser does not interpret arbitrary Bases definitions. Users can change the sample Bases folder filters if they use a custom layout.

## Validation

Run `npm test` (or `node --test test/goals.test.cjs`) without credentials. Coverage includes custom folders, optional setup, boundary checks, active-count guidance, date filters, malformed notes, ambiguous and missing links, body preservation, atomic review saves, stale versions, undo, and task-to-goal panel refresh. API tests use mocked responses; they do not prove live model conversation behavior.

For a UI-only preview, serve `src` from localhost, open it in a browser, type “Show my goals”, and try the status filters and recorded check-ins. The preview is explicitly labeled with fictional data and never writes a vault. Check the layout at the app's expanded 870 × 560 size. Actual source opening, encrypted settings, and voice require the Electron app. For release validation, run `npm run package` on Apple Silicon macOS and use a disposable vault for a live create → task → review → undo walkthrough.
