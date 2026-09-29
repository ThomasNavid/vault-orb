// Home summaries read existing notes; all edits remain in the source records.
const today = dv.luxon.DateTime.local().startOf("day");
const tomorrow = today.plus({ days: 1 });
function date(value) {
  if (!value) return null;
  try {
    const parsed = dv.date(value);
    return parsed?.isValid ? parsed : null;
  } catch { return null; }
}
const isToday = value => { const d = date(value); return !!d && d >= today && d < tomorrow; };
const isPast = value => { const d = date(value); return !!d && d < today; };
const tasks = dv.pages('"0. Home/Life Tasks" OR "0. Home/Business Tasks"')
  .where(p => p.type === "task" && p.completed !== true).array();
const dueToday = tasks.filter(p => isToday(p.planned) || isToday(p.due));
const overdue = tasks.filter(p => isPast(p.due));
const goals = dv.pages('"0. Home/Goals"').where(p => p.type === "goal" && p.status === "Active").array();
const reviews = goals.filter(p => { const d = date(p.review); return !d || d < tomorrow; });

if (input?.section === "overview") {
  const root = dv.container.createDiv({ cls: "home-overview" });
  root.createEl("style", { text: await dv.io.load("99. System/99.4 Scripts/home/view.css") });
  root.createDiv({ cls: "home-date", text: today.toFormat("cccc, d LLLL yyyy") });
  const cards = root.createDiv({ cls: "home-cards" });
  for (const [label, count, path] of [
    ["Planned / due today", dueToday.length, "0. Home/Today"],
    ["Past deadlines", overdue.length, "0. Home/Today#Past deadlines"],
    ["Open tasks", tasks.length, "0. Home/Home#All open tasks"],
    ["Goal reviews due", reviews.length, "0. Home/Goals#Reviews due"]
  ]) {
    const card = cards.createEl("a", { cls: "home-card internal-link", attr: { href: path, "data-href": path } });
    card.createEl("strong", { text: String(count) });
    card.createSpan({ text: label });
  }
  root.createDiv({ cls: "home-hint", text: "Counts can overlap: a task may be planned today and have a past deadline." });
  const missing = goals.filter(p => !p.next_task || !date(p.review));
  if (missing.length) dv.paragraph(`**Goal setup:** ${missing.map(p => p.file.link).join(", ")} — add a next task and review date where missing.`);
} else if (input?.section === "focus") {
  const focus = tasks.filter(p => isPast(p.due) || isToday(p.planned) || isToday(p.due));
  const when = p => Math.min(...[date(p.planned), date(p.due)].filter(Boolean).map(d => d.toMillis()));
  focus.sort((a, b) => Number(isPast(b.due)) - Number(isPast(a.due)) || when(a) - when(b) || a.file.name.localeCompare(b.file.name));
  if (!focus.length) dv.paragraph("No tasks planned or due today, and no past deadlines. Choose a next action from your goals or open tasks.");
  else dv.table(["Task", "Attention", "Planned", "Deadline", "Area"], focus.map(p => [
    p.file.link,
    [isPast(p.due) ? "Past deadline" : isToday(p.due) ? "Due today" : null, isToday(p.planned) ? "Planned today" : null].filter(Boolean).join(" · "),
    p.planned, p.due, p.file.folder === "0. Home/Business Tasks" ? "Business" : "Life"
  ]));
}

// Keep empty sections concise while retaining Dataview query semantics.
const summaries = {
  "upcoming": "TABLE WITHOUT ID file.link AS Task, planned AS Planned, due AS Deadline, choice(file.folder = \"0. Home/Business Tasks\", \"Business\", \"Life\") AS Area\nFROM \"0. Home/Life Tasks\" OR \"0. Home/Business Tasks\"\nWHERE type = \"task\" AND completed != true\nFLATTEN choice(planned >= date(today) + dur(1 day) AND planned < date(today) + dur(8 days), planned, null) AS nextPlanned\nFLATTEN choice(due >= date(today) + dur(1 day) AND due < date(today) + dur(8 days), due, null) AS nextDue\nWHERE nextPlanned OR nextDue\nFLATTEN choice(nextPlanned AND nextDue, min(nextPlanned, nextDue), default(nextPlanned, nextDue)) AS nextDate\nSORT nextDate ASC, file.name ASC\nLIMIT 10",
  "clippings": "TABLE WITHOUT ID file.link AS Clip, dateformat(saved, \"dd MMM yyyy\") AS Created, topic AS Topic, elink(source, \"Open source\") AS Source\nFROM \"4. Knowledge Library/Web Clippings/X Posts\" OR \"4. Knowledge Library/Web Clippings/Videos\" OR \"4. Knowledge Library/Web Clippings/Websites\"\nFLATTEN default(date(created), file.ctime) AS saved\nSORT saved DESC, file.name ASC\nLIMIT 8"
};
const emptyMessages = {
  upcoming: "No open tasks planned or due in the next seven days after today.",
  clippings: "No web clippings saved yet."
};
if (summaries[input?.section]) {
  const result = await dv.query(summaries[input.section]);
  if (!result.successful) dv.paragraph(`Could not load this section: ${result.error}`);
  else if (!result.value.values.length) dv.paragraph(emptyMessages[input.section]);
  else dv.table(result.value.headers, result.value.values);
}
