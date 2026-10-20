"use strict";
const STORAGE_KEY = "wabb-habits-v1";
const defaultHabits = [
  { id: "water", name: "Drink water" },
  { id: "read", name: "Read 20 minutes" },
  { id: "move", name: "Move my body" }
];
function loadState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (value && Array.isArray(value.habits) && value.completions && typeof value.completions === "object") {
      return { habits: value.habits.filter(h => typeof h.id === "string" && typeof h.name === "string"), completions: value.completions, dayOverrides: value.dayOverrides || {} };
    }
  } catch (error) { console.warn("Could not load saved habits", error); }
  return { habits: defaultHabits.map(h => ({...h})), completions: {}, dayOverrides: {} };
}
const state = loadState();
const now = new Date();
let visibleYear = now.getFullYear();
let visibleMonth = now.getMonth();
const calendar = document.querySelector("#calendar");
const dialog = document.querySelector("#habit-dialog");
const editor = document.querySelector("#habit-editor");

const dayDialog = document.querySelector("#day-dialog");
const dayEditor = document.querySelector("#day-habit-editor");
let editingDay = null;
function overrideFor(key) { return state.dayOverrides[key] ||= { removed: [], renamed: {}, added: [] }; }
function habitsForDay(key) {
  const o = state.dayOverrides[key];
  if (!o) return state.habits;
  return state.habits.filter(h => !(o.removed || []).includes(h.id))
    .map(h => ({ ...h, name: (o.renamed || {})[h.id] || h.name }))
    .concat(o.added || []);
}
function openDayEditor(key) {
  editingDay = key;
  const [y,m,d] = key.split("-").map(Number);
  document.querySelector("#day-dialog-title").textContent = "Edit " + new Date(y,m-1,d).toLocaleDateString(undefined,{month:"long",day:"numeric"}) + " 🍓";
  renderDayEditor(); dayDialog.showModal();
}
function updateDay() { save(); renderCalendar(); renderDayEditor(); }
function renderDayEditor() {
  dayEditor.replaceChildren();
  const o = overrideFor(editingDay);
  habitsForDay(editingDay).forEach(habit => {
    const row = document.createElement("div"); row.className = "habit-edit-row";
    const berry = document.createElement("span"); berry.textContent = "🍓";
    const input = document.createElement("input"); input.value = habit.name; input.maxLength = 45; input.setAttribute("aria-label","Habit name for this day");
    input.addEventListener("change", () => {
      const name = input.value.trim();
      if (!name) { input.value = habit.name; return; }
      if (state.habits.some(h => h.id === habit.id)) o.renamed[habit.id] = name;
      else { const item = o.added.find(h => h.id === habit.id); if (item) item.name = name; }
      updateDay();
    });
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "remove-habit"; remove.textContent = "×"; remove.setAttribute("aria-label","Remove " + habit.name + " from this day");
    remove.addEventListener("click", () => {
      if (state.habits.some(h => h.id === habit.id)) { if (!o.removed.includes(habit.id)) o.removed.push(habit.id); }
      else o.added = o.added.filter(h => h.id !== habit.id);
      updateDay();
    });
    row.append(berry,input,remove); dayEditor.append(row);
  });
}
function addDayHabit() {
  const input = document.querySelector("#new-day-habit");
  const name = input.value.trim(); if (!name) return;
  if (habitsForDay(editingDay).length >= 8) { alert("Maximum 8 habits per day."); return; }
  overrideFor(editingDay).added.push({id:"day-" + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random()),name});
  input.value = ""; updateDay(); input.focus();
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (error) { console.warn("Could not save habits", error); }
}
function dateKey(year, month, day) {
  return [year, String(month + 1).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}
function isDone(key, habitId) { return Boolean(state.completions[key]?.[habitId]); }
function toggle(key, habitId) {
  if (!state.completions[key]) state.completions[key] = {};
  state.completions[key][habitId] = !isDone(key, habitId);
  if (!Object.values(state.completions[key]).some(Boolean)) delete state.completions[key];
  save(); renderCalendar();
}
function renderCalendar() {
  calendar.replaceChildren();
  const heading = new Date(visibleYear, visibleMonth, 1);
  document.querySelector("#month-label").textContent = String(visibleYear);
  document.querySelector("#month-title").textContent = heading.toLocaleDateString(undefined, {month:"long"});
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  weekdays.forEach(name => {
    const el = document.createElement("div");
    el.className = "weekday"; el.textContent = name; calendar.append(el);
  });
  const offset = heading.getDay();
  const days = new Date(visibleYear, visibleMonth + 1, 0).getDate();
  const cells = Math.ceil((offset + days) / 7) * 7;
  let doneCount = 0;
  let total = 0;
  for (let i = 0; i < cells; i++) {
    const dayNumber = i - offset + 1;
    const date = new Date(visibleYear, visibleMonth, dayNumber);
    const inMonth = dayNumber >= 1 && dayNumber <= days;
    const key = dateKey(date.getFullYear(), date.getMonth(), date.getDate());
    const isToday = key === dateKey(now.getFullYear(), now.getMonth(), now.getDate());
    const cell = document.createElement("div");
    const dailyHabits = inMonth ? habitsForDay(key) : [];
    const dayComplete = inMonth && dailyHabits.length > 0 && dailyHabits.every(habit => isDone(key, habit.id));
    cell.className = "day" + (inMonth ? "" : " outside") + (isToday ? " today" : "") + (dayComplete ? " complete" : "");
    const bubble = document.createElement("span");
    bubble.className = "date-bubble"; bubble.textContent = String(date.getDate());
    cell.append(bubble);
    if (inMonth) {
      if (!dailyHabits.length) {
        const hint = document.createElement("span"); hint.className = "empty-message"; hint.textContent = "Add a habit to begin ♡"; cell.append(hint);
      }
      total += dailyHabits.length;
      dailyHabits.forEach(habit => {
        const checked = isDone(key, habit.id);
        if (checked) doneCount++;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "task" + (checked ? " done" : "");
        button.setAttribute("aria-pressed", String(checked));
        button.setAttribute("aria-label", habit.name + " on " + date.toLocaleDateString() + (checked ? ", complete" : ", incomplete"));
        const circle = document.createElement("span"); circle.className = "task-circle"; circle.setAttribute("aria-hidden", "true"); circle.textContent = checked ? "✓" : "";
        const label = document.createElement("span"); label.className = "task-label"; label.textContent = habit.name;
        button.append(circle, label);
        button.addEventListener("click", () => toggle(key, habit.id));
        cell.append(button);
      });
      const editButton = document.createElement("button"); editButton.type = "button"; editButton.className = "edit-day-button"; editButton.textContent = "+ Edit day"; editButton.setAttribute("aria-label","Edit habits for " + date.toLocaleDateString()); editButton.addEventListener("click", () => openDayEditor(key)); cell.append(editButton);
    }
    calendar.append(cell);
  }
  const percentage = total ? Math.round(doneCount / total * 100) : 0;
  document.querySelector("#summary").textContent = total ? percentage + "% of your monthly habits complete" : "Ready to bloom?";
  document.querySelector("#summary-detail").textContent = total ? doneCount + " of " + total + " little wins checked off ♡" : "Add your first habit to get started.";
  document.querySelector("#habit-count").textContent = state.habits.length + (state.habits.length === 1 ? " daily habit" : " daily habits");
}
function renderEditor() {
  editor.replaceChildren();
  state.habits.forEach(habit => {
    const row = document.createElement("div"); row.className = "habit-edit-row";
    const berry = document.createElement("span"); berry.textContent = "🍓";
    const input = document.createElement("input"); input.value = habit.name; input.maxLength = 45; input.setAttribute("aria-label", "Habit name");
    input.addEventListener("input", () => { const trimmed = input.value.trim(); if (trimmed) { habit.name = trimmed; save(); renderCalendar(); } });
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "remove-habit"; remove.textContent = "×"; remove.setAttribute("aria-label", "Remove " + habit.name);
    remove.addEventListener("click", () => { state.habits = state.habits.filter(h => h.id !== habit.id); save(); renderEditor(); renderCalendar(); });
    row.append(berry, input, remove); editor.append(row);
  });
}
function addHabit() {
  const input = document.querySelector("#new-habit");
  const name = input.value.trim();
  if (!name) return;
  if (state.habits.length >= 8) { alert("For a readable calendar, you can have up to 8 daily habits."); return; }
  state.habits.push({id: "habit-" + (globalThis.crypto?.randomUUID?.() || Date.now() + "-" + Math.random()), name});
  input.value = ""; save(); renderEditor(); renderCalendar(); input.focus();
}
function changeMonth(delta) {
  const date = new Date(visibleYear, visibleMonth + delta, 1);
  visibleYear = date.getFullYear(); visibleMonth = date.getMonth(); renderCalendar();
}
document.querySelector("#add-day-habit").addEventListener("click", addDayHabit);
document.querySelector("#new-day-habit").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addDayHabit(); } });
document.querySelector("#close-day-dialog").addEventListener("click", () => dayDialog.close());
document.querySelector("#done-day-dialog").addEventListener("click", () => dayDialog.close());
document.querySelector("#previous-month").addEventListener("click", () => changeMonth(-1));
document.querySelector("#next-month").addEventListener("click", () => changeMonth(1));
document.querySelector("#today-button").addEventListener("click", () => {visibleYear = now.getFullYear(); visibleMonth = now.getMonth(); renderCalendar();});
document.querySelector("#manage-button").addEventListener("click", () => {renderEditor(); dialog.showModal();});
document.querySelector("#add-habit").addEventListener("click", addHabit);
document.querySelector("#new-habit").addEventListener("keydown", event => {if (event.key === "Enter") {event.preventDefault(); addHabit();}});
renderCalendar();