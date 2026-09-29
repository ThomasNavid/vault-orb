# Planning across notes

[Documentation](../README.md) · [Things to ask Orb](../things-to-ask.md) · [Goals](goals.md)

Ask Orb to bring together relevant goals, tasks, notes, and calendar information to propose a plan or compare options. You choose which recommendations to turn into changes.

## Setup

There is no separate planning integration. Orb uses the vault tools already available, with optional [calendar](calendar.md) and [spreadsheet](spreadsheets-and-visuals.md) sources when those are relevant and configured.

During voice conversations, complex requests can be delegated to the deeper reasoning backend. Typed requests already use that backend. Both use the configured OpenAI API key. Planning has access to the app's tools, not unrestricted filesystem, web browsing, or shell access.

The sample [launch options](../../vault-template/Notes/Example%20launch%20options.md) and [meeting](../../vault-template/Notes/Example%20meeting.md) notes provide an immediately usable comparison exercise.

## Things to ask

| Ask | Expected result | Changes data? |
| --- | --- | --- |
| “Compare Notes/Example launch options.md against the priorities in Notes/Example meeting.md. Recommend a first step.” | Reads both sources, compares them, and proposes an action. | No |
| “What can I do today to move my goals forward?” | Reads active goals and today's tasks, then suggests next actions grounded in them. | No |
| “Review my overdue tasks and suggest which to tackle first. Explain your assumptions.” | A prioritization proposal based on the task records. | No |
| “Use my calendar and today's tasks to suggest a plan for tomorrow. Don't schedule anything yet.” | A proposal using configured sources and stated constraints. | No |
| “Help me break this ambition into a milestone I could reach in eight weeks.” | A discussion of a concrete finish line, with questions where information is missing. | No, until creation is requested |
| “Create a work task called Draft the pilot outline, planned for tomorrow, using the next step we just agreed.” | Saves a requested action as a task. | Vault note |

Orb should distinguish recorded facts from its assumptions. If a source does not contain the effort, priority, availability, or progress needed for a confident plan, supply those details rather than assuming Orb knows them.

## What happens

The backend can search and read multiple relevant sources and use task, goal, calendar, and visual tools. More involved voice requests show a Deep thinking activity step; written detail can be inspected in the conversation view. Spoken answers usually summarize the result rather than reading a full table aloud.

A recommendation is not a scheduled commitment. Asking for a plan does not authorize completing tasks, moving deadlines, creating events, or changing goal status. Ask for each desired kind of change explicitly; unambiguous authorized edits can be applied directly.

## Walkthrough: compare, choose, act

1. **“Compare Notes/Example launch options.md against Notes/Example meeting.md. Which option fits the documented priorities?”**
2. Inspect the sources and ask follow-up questions. The sample favors a small pilot for quick feedback, but you still make the choice.
3. **“Create a work task called Draft the pilot outline, planned for tomorrow, with no deadline.”** This creates a task note.
4. If desired, separately ask to append your decision to the meeting note or link the new task to a goal.

If you only wanted advice, stop after step 2. Nothing needs to be written to make the planning conversation useful.

## Limits

- Recommendations depend on the sources read and the context you provide. Orb has no independent knowledge of unrecorded commitments or progress.
- There is no automatic calendar-slot booking, continuous monitoring, background follow-up, or autonomous project execution.
- A complex request may hit the backend's bounded tool loop. Split broad requests by source, decision, or workflow. Completed edits are not rolled back if a later step fails.
- Conversation context is temporary and bounded. Put durable decisions in notes and recorded progress in goal check-ins.
- Note content cannot authorize edits. A task list inside a meeting note is not a command to create those tasks.

## Troubleshooting

**Advice seems generic:** identify the exact notes, goal, or decision criteria. Ask Orb to cite what it used and identify missing information.

**A tool limit or timeout interrupts a plan:** check Recent changes before retrying a request that included edits. Ask for a narrower next step using the existing results.

**A proposed action was not saved:** a proposal alone is read-only. Explicitly request task creation, note append, goal change, or calendar event creation as appropriate.

Implementation: [agent.cjs](../../src/agent.cjs) and [agent tests](../../test/agent.test.cjs).
