# Goals and weekly reviews

[Documentation](../README.md) · [Things to ask Orb](../things-to-ask.md) · [Goal internals](../goals.md)

Goals describe outcomes. Tasks describe actions that move them forward. Orb helps you define a finish line, keep a concrete next action, and record weekly check-ins in your existing Obsidian notes.

[![Goal cards using fictional example data](../images/goals-view.png)](../images/goals-view.png)

## Setup

Set Goals folder in Settings, normally `0. Home/Goals`. It must be separate from both task folders. Create it in Obsidian before creating a goal; leave the setting blank to disable the feature. A missing goal folder does not prevent other features from working. An older custom task layout overlapping the default Goals path starts with goals disabled until a separate folder is selected.

The [sample goal](../../vault-template/0.%20Home/Goals/Example%20portfolio%20goal.md) starts in **Someday**. Ask for all goals to see it. The sample also includes a [Goals page](../../vault-template/0.%20Home/Goals.md), [Bases views](../../vault-template/0.%20Home/Goals.base), and [manual template](../../vault-template/Templates/Goal%20Template.md). Orb reads Markdown notes directly and does not require Bases or Templater.

## Things to ask

| Ask | Expected result | Changes data? |
| --- | --- | --- |
| “Show my active goals.” | Active goal cards with finish lines and linked tasks. | No |
| “Which goals need a review?” | Active goals with missing Review dates or dates today/earlier. | No |
| “Show all my goals, including Someday.” | Includes Active, Paused, Someday, and Achieved. | No |
| “Help me create a goal to launch a portfolio.” | A conversation to make the finish line and next action concrete; creation once enough information is supplied. | Vault note when created |
| “Create a Someday goal called Read six novels, with a finish line of reading six novels and writing one sentence about each. No target date yet.” | Creates the named goal with no Review date while inactive. | Vault note |
| “Make Example portfolio goal active.” | Changes status; assigns a review one week ahead if missing. | Vault note |
| “Link Example project task as the next task for Example portfolio goal.” | Stores a link to that unfinished task. | Vault note |
| “Move Example portfolio goal's target to 20 November 2026.” | Changes Target, leaving task deadlines unchanged. | Vault note |
| “Let's review my goals.” | Starts a review conversation, one goal at a time. | Only when a check-in is ready to save |
| “Pause Example portfolio goal.” | Sets Paused and clears Review. | Vault note |
| “Mark Example portfolio goal achieved.” | Explicitly sets Achieved and clears Review. | Vault note |

Choose dates that match your actual plans. An existing completed task cannot be assigned as a new next action. Orb should ask you to disambiguate task titles when needed.

## What happens

The Goals panel provides **Active**, **Review due**, **Other**, and **All** filters. Each card shows the recorded finish line, status, optional Target, Review for active goals, and linked next task with its Planned/Deadline dates. Source buttons open notes in Obsidian. New goal and review buttons start conversational requests.

Missing or completed next tasks, broken/ambiguous links, missing reviews, and passed targets produce prompts to reassess. A passed target is not a task deadline. The panel does not calculate an invented percentage-complete score.

Aim for **one to three active goals**, often milestones reachable in **6–12 weeks**. These are recommendations, not enforced limits. A fourth goal is allowed; Orb can suggest pausing something to make room.

## A complete weekly review

Starting in the sample vault:

1. **“Make Example portfolio goal active.”** It already links Example project task. Review defaults to next week.
2. **“Help me review Example portfolio goal now.”** Orb reads its state and asks about progress, obstacles, and your next decision/action.
3. Supply what actually happened. For a fictional practice review: **“I chose three projects. My obstacle is time for writing. I will continue and use Example project task as the next action. Save this check-in.”**
4. Expect a dated entry under Weekly check-ins and a Review date one week ahead. You can instead specify another Review date.
5. **“Show my active goals.”** Inspect the card and recorded check-ins, or open the note.

This is an illustrative conversation, not a live test transcript. The wording and follow-up questions can vary.

A review request authorizes saving its check-in once you have supplied progress, obstacle, and decision/next action. Simply opening or abandoning a review writes nothing. The check-in and goal metadata are one undoable note edit. Creating or planning a linked task is a separate edit and requires that action to be requested.

## Habit evidence

For goals supported by repeated actions, use [Habits](habits.md) to log days and inspect weekly totals. Ask Orb to read that history during a review. Recorded days are evidence, not automatic goal completion. The [This Week planning note](habits.md#goals-and-this-week) holds manually chosen weekly outcomes.

## Limits and date behavior

- Target is optional and adjustable. It never becomes the linked task's Deadline.
- Review defaults to seven calendar days ahead for new active goals, reactivation without a Review, and saved active reviews. Explicit dates override the default.
- Paused, Someday, and Achieved goals do not need Review; changing to these states clears it.
- Completing a task never automatically achieves the goal. Orb flags the completed next task so you can choose another.
- There is no scheduled reminder service, background vault watcher, goal rename/delete tool, or automatic progress scoring.
- Conversation state is transient. Saved check-ins remain in Markdown; an unfinished review is not a durable workflow you can resume after restarting.
- Folder-triggered automatic templates require your own Obsidian plugin configuration. Orb creates complete notes and does not execute Templater scripts.

## Troubleshooting

**No goals appear:** check the selected filter and [goal properties](../vault-format.md#goal-properties). The example begins in Someday. A missing folder shows setup guidance.

**Next task not found or ambiguous:** give Orb the exact path to an unfinished task in one of the two configured folders. A rename in Obsidian may require repairing the link.

**An external edit is not visible:** select a filter or ask again to reread the vault. Orb's own edits and undo refresh the panel automatically.

**A task was created but linking failed:** the task and goal are separate edits. Reuse the existing task and retry the link after rereading the goal; do not create another copy. See [Changes and undo](changes-and-undo.md).

Implementation and validation: [Goals contributor guide](../goals.md).
