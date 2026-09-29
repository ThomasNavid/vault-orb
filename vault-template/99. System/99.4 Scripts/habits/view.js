// Dataview view. Records are ordinary Markdown notes; no separate database.
const ROOT = "0. Home/Habit Log";
const compact = input?.compact === true;
const habits = [];
const today = dv.luxon.DateTime.local().startOf("day");
const iso = d => d.toISODate();
const parse = s => dv.luxon.DateTime.fromISO(s).startOf("day");
const weekStart = d => d.minus({ days: d.weekday - 1 });
const read = date => {
  const file = app.vault.getAbstractFileByPath(`${ROOT}/${date}.md`);
  return file ? (app.metadataCache.getFileCache(file)?.frontmatter || {}) : {};
};
const root = dv.container.createDiv({ cls: "habits-dashboard" });
const css = await dv.io.load("99. System/99.4 Scripts/habits/view.css");
root.createEl("style", { text: css });
let selected = iso(today);
let year = today.year;
let busy = false;
const overrides = new Map(); // Immediate feedback while Obsidian updates its metadata cache.
const record = date => overrides.get(date) || read(date);
const count = (start, end, key) => {
  let n = 0;
  for (let d = start; d <= end && d <= today; d = d.plus({ days: 1 })) {
    if (record(iso(d))[key] === true) n++;
  }
  return n;
};
const picker = root.createDiv({ cls: "habits-toolbar" });
const label = picker.createEl("label", { text: "Log a day " });
const dateInput = label.createEl("input", { type: "date", value: selected });
dateInput.max = selected;
const todayButton = picker.createEl("button", { text: "Today" });
const openButton = picker.createEl("button", { text: "Open daily record" });
const status = root.createDiv({ cls: "habits-status", attr: { "aria-live": "polite" } });
const checks = root.createDiv({ cls: "habits-checks" });
const summary = root.createDiv({ cls: "habits-summary" });
const maps = root.createDiv();
const history = root.createDiv({ cls: "habits-history" });

async function ensureFile(date) {
  const path = `${ROOT}/${date}.md`;
  let file = app.vault.getAbstractFileByPath(path);
  if (!file) {
    if (!app.vault.getAbstractFileByPath(ROOT)) await app.vault.createFolder(ROOT);
    try {
      file = await app.vault.create(path, `---\ntype: habit-log\ndate: ${date}\n${habits.map(h => `${h.key}: false`).join("\n")}\n---\n\n# ${date}\n\n[[Habits|Back to habits]]\n\n## Notes\n\n`);
    } catch (e) {
      file = app.vault.getAbstractFileByPath(path);
      if (!file) throw e;
    }
  }
  return file;
}
async function save(key, done) {
  if (busy) return;
  busy = true;
  const date = selected;
  renderChecks();
  status.textContent = "Saving…";
  try {
    const file = await ensureFile(date);
    let saved;
    await app.fileManager.processFrontMatter(file, fm => {
      fm[key] = done;
      saved = { ...fm };
    });
    overrides.set(date, saved);
    status.textContent = "Saved";
  } catch (e) {
    status.textContent = `Could not save: ${e.message}`;
  } finally {
    busy = false;
    render();
  }
}
function select(date) {
  const d = parse(date);
  if (!d.isValid || d > today || busy) { dateInput.value = selected; return; }
  selected = date;
  dateInput.value = selected;
  status.textContent = "";
  renderChecks();
}
dateInput.addEventListener("change", () => select(dateInput.value));
todayButton.addEventListener("click", () => select(iso(today)));
openButton.addEventListener("click", async () => {
  try {
    const file = await ensureFile(selected);
    await app.workspace.getLeaf(false).openFile(file);
  } catch (e) { status.textContent = `Could not open record: ${e.message}`; }
});
function renderChecks() {
  checks.replaceChildren();
  dateInput.disabled = todayButton.disabled = openButton.disabled = busy;
  checks.createDiv({ cls: "habits-date", text: parse(selected).toFormat("cccc, d LLLL yyyy") });
  for (const h of habits) {
    const row = checks.createEl("label", { cls: "habits-check" });
    const box = row.createEl("input", { type: "checkbox" });
    box.checked = record(selected)[h.key] === true;
    box.disabled = busy;
    row.createSpan({ text: h.label });
    row.createSpan({ cls: "habits-muted", text: h.cadence });
    box.addEventListener("change", () => save(h.key, box.checked));
  }
}
function render() {
  renderChecks();
  summary.replaceChildren();
  const start = weekStart(today);
  summary.createEl("h3", { text: `This week · ${start.toFormat("d LLL")}–${start.plus({ days: 6 }).toFormat("d LLL")}` });
  const cards = summary.createDiv({ cls: "habits-cards" });
  for (const h of habits) {
    const n = count(start, today, h.key);
    const card = cards.createDiv({ cls: "habits-card" });
    card.createDiv({ text: h.label });
    card.createEl("strong", { text: `${n} / ${h.target} days` });
    const progress = card.createEl("progress", { attr: { max: h.target, value: Math.min(n, h.target), "aria-label": `${h.label}: ${n} of ${h.target} days` } });
    progress.style.accentColor = h.color;
    card.createDiv({ cls: "habits-muted", text: n >= h.target ? "Weekly target reached" : `${h.target - n} more to reach this week’s target` });
  }
  maps.replaceChildren();
  history.replaceChildren();
  if (compact) return; // Home shows daily controls and weekly totals; Habits retains history.
  const controls = maps.createDiv({ cls: "habits-toolbar" });
  controls.createEl("h3", { text: "Your year" });
  const prev = controls.createEl("button", { text: "←", attr: { "aria-label": "Previous year" } });
  controls.createEl("strong", { text: String(year) });
  const next = controls.createEl("button", { text: "→", attr: { "aria-label": "Next year" } });
  next.disabled = year >= today.year;
  prev.onclick = () => { year--; render(); };
  next.onclick = () => { year++; render(); };
  for (const h of habits) {
    maps.createEl("h4", { text: h.label });
    const scroller = maps.createDiv({ cls: "habits-scroll" });
    const grid = scroller.createDiv({ cls: "habits-grid" });
    grid.style.setProperty("--habit-color", h.color);
    ["", "M", "T", "W", "T", "F", "S", "S"].forEach((t, i) => {
      grid.createSpan({ cls: "habits-axis", text: t, attr: { style: `grid-column:1;grid-row:${i + 1}` } });
    });
    const first = parse(`${year}-01-01`);
    const last = parse(`${year}-12-31`);
    let month = -1;
    for (let d = weekStart(first), col = 2; d <= last; d = d.plus({ days: 7 }), col++) {
      const inYear = d < first ? first : d;
      if (inYear.month !== month) {
        grid.createSpan({ cls: "habits-month", text: inYear.toFormat("LLL"), attr: { style: `grid-column:${col};grid-row:1` } });
        month = inYear.month;
      }
      for (let day = 0; day < 7; day++) {
        const current = d.plus({ days: day });
        if (current.year !== year) continue;
        const date = iso(current);
        const done = record(date)[h.key] === true;
        const future = current > today;
        const description = `${date} · ${h.label}: ${future ? "future date" : done ? "done" : "not recorded"}`;
        const cell = grid.createEl("button", { cls: `habits-cell${done ? " is-done" : ""}${future ? " is-future" : ""}${date === iso(today) ? " is-today" : ""}`, attr: { title: description, "aria-label": description, style: `grid-column:${col};grid-row:${day + 2}` } });
        cell.disabled = future;
        cell.onclick = () => { select(date); checks.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
      }
    }
    maps.createDiv({ cls: "habits-muted habits-legend", text: `Coloured = done · Empty = not recorded · Click a day to edit. ${count(first, last, h.key)} days recorded in ${year}.` });
  }
  history.replaceChildren();
  history.createEl("h3", { text: "Recent weeks" });
  const table = history.createEl("table");
  const header = table.createEl("thead").createEl("tr");
  ["Week beginning", ...habits.map(h => `${h.label} · ${h.target} days`)].forEach(t => header.createEl("th", { text: t }));
  const body = table.createEl("tbody");
  for (let i = 0; i < 8; i++) {
    const s = start.minus({ weeks: i });
    const row = body.createEl("tr");
    row.createEl("td", { text: s.toFormat("d LLL yyyy") + (i === 0 ? " · in progress" : "") });
    for (const h of habits) {
      const n = count(s, s.plus({ days: 6 }), h.key);
      row.createEl("td", { text: n ? `${n} / ${h.target}${n >= h.target ? " ✓" : ""}` : "—" });
    }
  }
}
render();

if (!habits.length) {
  picker.hidden = true;
  dv.paragraph("No habits chosen yet. Follow the habit setup guide in 99. System to add your own definitions.");
}
