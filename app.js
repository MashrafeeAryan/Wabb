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
      return { habits: value.habits.filter(h => typeof h.id === "string" && typeof h.name === "string"), completions: value.completions };
    }
  } catch (error) { console.warn("Could not load saved habits", error); }
  return { habits: defaultHabits.map(h => ({...h})), completions: {} };
}
const state = loadState();
const now = new Date();
let visibleYear = now.getFullYear();
let visibleMonth = now.getMonth();
const calendar = document.querySelector("#calendar");
const dialog = document.querySelector("#habit-dialog");
const editor = document.querySelector("#habit-editor");
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
  for (let i = 0; i < cells; i++) {
    const dayNumber = i - offset + 1;
    const date = new Date(visibleYear, visibleMonth, dayNumber);
    const inMonth = dayNumber >= 1 && dayNumber <= days;
    const key = dateKey(date.getFullYear(), date.getMonth(), date.getDate());
    const isToday = key === dateKey(now.getFullYear(), now.getMonth(), now.getDate());
    const cell = document.createElement("div");
    const dayComplete = inMonth && state.habits.length > 0 && state.habits.every(habit => isDone(key, habit.id));
    cell.className = "day" + (inMonth ? "" : " outside") + (isToday ? " today" : "") + (dayComplete ? " complete" : "");
    const bubble = document.createElement("span");
    bubble.className = "date-bubble"; bubble.textContent = String(date.getDate());
    cell.append(bubble);
    if (inMonth) {
      if (!state.habits.length) {
        const hint = document.createElement("span"); hint.className = "empty-message"; hint.textContent = "Add a habit to begin ♡"; cell.append(hint);
      }
      state.habits.forEach(habit => {
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
    }
    calendar.append(cell);
  }
  const total = days * state.habits.length;
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
document.querySelector("#previous-month").addEventListener("click", () => changeMonth(-1));
document.querySelector("#next-month").addEventListener("click", () => changeMonth(1));
document.querySelector("#today-button").addEventListener("click", () => {visibleYear = now.getFullYear(); visibleMonth = now.getMonth(); renderCalendar();});
document.querySelector("#manage-button").addEventListener("click", () => {renderEditor(); dialog.showModal();});
document.querySelector("#add-habit").addEventListener("click", addHabit);
document.querySelector("#new-habit").addEventListener("keydown", event => {if (event.key === "Enter") {event.preventDefault(); addHabit();}});
renderCalendar();