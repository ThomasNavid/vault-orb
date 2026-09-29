# Changes and undo

[Documentation](../README.md) · [Privacy](../privacy.md) · [Troubleshooting](../troubleshooting.md)

Orb journals its vault note edits so you can inspect what changed and undo a change when the file still matches the version Orb wrote.

## Setup

No separate setup is needed. The journal is stored locally in the app support directory and associated with the selected vault. It is separate from your vault files and contains previous note contents. See [Privacy and data](../privacy.md).

## Things to ask or click

| Request/action | Expected result |
| --- | --- |
| “Undo your last note edit.” | Undoes the latest applied journaled note edit if safe. |
| Settings → Recent changes | Shows up to the 30 most recent journal records with their status. |
| Undo beside a specific applied entry | Attempts to undo that exact change. |
| “Read Notes/Example meeting.md so I can check the appended decision.” | Reads the current source without changing it. |

End the active voice conversation and wait for typed work to finish before using Undo from Recent changes. Conversational undo is available as an explicit request through the assistant.

## What can be undone?

| Operation | Orb journal undo |
| --- | --- |
| Create a task or goal | Yes; removes the newly created file if unchanged. |
| Update task or goal properties | Yes; restores the previous note contents. |
| Edit a goal's managed narrative section | Yes. |
| Save a weekly goal review | Yes; restores both the prior check-ins and goal metadata. |
| Append to an existing Markdown note | Yes. |
| Create a Google Calendar event | **No.** Manage it in Google Calendar or Obsidian. |
| Edit a note directly in Obsidian or another application | No; it was not an Orb journaled change. |
| Change Orb Settings | No; use Settings to change them again. |

There is no redo tool. Undo of an older change on the same note usually requires undoing newer changes first so the expected version matches.

## What happens

Before writing, Orb reads a note version and checks it is still current. Writes preserve unrelated frontmatter and body sections; updates to goal narrative fields intentionally replace their named sections. The journal records the old contents, the new hash, action, timestamp, and status.

Undo verifies that the current file is still exactly the version produced by that edit. If another app has changed it, Orb refuses rather than overwrite that newer work. A failed or uncertain history entry is not presented as a normal applied edit available for undo.

Visible task and goal panels refresh after applicable edits and undo. Calendar panels including task dates refresh when those task records change. A panel-refresh warning can occur after a write succeeded; check the source note and Recent changes before repeating the edit.

## Walkthrough: undo only the latest change

Using a copy of the sample vault:

1. **“Plan Example errand for tomorrow.”** This creates one journal entry.
2. **“Mark Example errand complete.”** This creates a second entry.
3. **“Undo your last note edit.”** The task becomes unfinished again, retaining tomorrow's Planned date.
4. **“Undo your last note edit.”** The earlier Planned change is undone as well, unless another newer applied edit intervened.

For a goal review that also creates a task, the goal review and task creation are separate entries. Undoing the review does not remove the separately created task. Check each entry instead of assuming a whole conversation is a single transaction.

## Limits

- The journal is a recovery aid, not a replacement for vault backups or source control.
- Multi-note workflows are not atomic: successful earlier edits remain if a later operation fails or you cancel.
- Avoid simultaneous edits to the same note in Orb and Obsidian. Version checks reduce conflicts but are not a distributed lock.
- The journal is local to this Mac/app state. It does not automatically synchronize with your vault across devices. Changing the vault's root path can select a different journal.
- Calendar writes are external side effects. Stopping a conversation or asking for note undo does not cancel a created event.

## Troubleshooting

**“Note changed” before saving:** ask Orb to reread it and apply the intended edit to the new version.

**Undo refuses:** undo newer Orb changes to that note first, or inspect newer external edits in Obsidian. Do not delete the journal or overwrite the note merely to force undo.

**A multi-step request failed:** inspect Recent changes and the actual source notes. Reuse any task/goal already created when retrying the remaining step.

**The journal is damaged:** preserve the current notes and journal, then restore from a known backup or investigate the error. The app intentionally refuses further writes when history cannot be read safely.

Implementation: [vault.cjs](../../src/vault.cjs), [agent.cjs](../../src/agent.cjs), [vault tests](../../test/vault.test.cjs), and [goal tests](../../test/goals.test.cjs).

## Habit logging

Habit checkbox/voice edits and explicit creation of a missing daily record use the same journal. Undo restores all original note bytes, or removes a newly created record if it has not changed since. Date selection and heatmap browsing make no edit. External Obsidian edits are not in Orb’s history; they can block undo until reviewed. See [Habits](habits.md).
