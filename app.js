"use strict";
const STORAGE_KEY = "wabb-habits-v1";
const SUPABASE_URL = "https://dhhgglfutxwhrzkjzyhd.supabase.co";
const SUPABASE_KEY = "sb_publishable_RJK3-RNUC_nk_kwFPUQP7w_OzWsEYRw";
const cloud = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);
let activeUser = null;
let accountReady = false;
let cloudSaving = false;
let cloudDirty = false;
let cloudRevision = 0;
let lastSavedRevision = 0;
let refreshTimer;
let saveTimer;
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
let state = loadState();
const guestState = JSON.parse(JSON.stringify(state));
function normalizeState(value) {
  if (!value || !Array.isArray(value.habits) || typeof value.completions !== "object" || !value.completions) return null;
  return {
    habits: value.habits.filter(h => typeof h?.id === "string" && typeof h?.name === "string").slice(0,8),
    completions: value.completions,
    dayOverrides: value.dayOverrides && typeof value.dayOverrides === "object" ? value.dayOverrides : {}
  };
}
function showStatus(message) { document.querySelector("#account-status").textContent = message; }
function authMessage(message) { document.querySelector("#auth-message").textContent = message; }
function showUser() {
  document.querySelector("#account-button").hidden = !!activeUser;
  document.querySelector("#sign-out-button").hidden = !activeUser;
  showStatus(activeUser ? "🍓 " + (activeUser.email || "Signed in") + (cloudDirty ? " · Sync pending" : " · Synced") : "Guest mode · saved on this device only");
}
async function readCloud() {
  const {data,error} = await cloud.from("habit_states").select("data").eq("user_id",activeUser.id).maybeSingle();
  if(error) throw error;
  return normalizeState(data?.data);
}
async function switchAccount(user) {
  clearTimeout(saveTimer);
  clearInterval(refreshTimer);
  accountReady = false; cloudDirty = false; cloudSaving = false; cloudRevision = 0; lastSavedRevision = 0;
  activeUser = user;
  if (!user) {
    state = JSON.parse(JSON.stringify(guestState));
    accountReady = true; showUser(); renderCalendar(); return;
  }
  showStatus("Loading your private habits…");
  try {
    const remote = await readCloud();
    if (activeUser?.id !== user.id) return;
    if (remote) state = remote;
    else {
      const prior = normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
      const importPrior = prior && confirm("Import habits saved in this browser into your new Wabb account? Choose Cancel to start fresh.");
      state = importPrior ? prior : {habits:defaultHabits.map(h=>({...h})),completions:{},dayOverrides:{}};
      const {error} = await cloud.from("habit_states").upsert({user_id:user.id,data:state},{onConflict:"user_id",ignoreDuplicates:true});
      if(error) throw error;
      const loaded = await readCloud();
      if (loaded) state = loaded;
    }
    accountReady = true; showUser(); renderCalendar();
    refreshTimer = setInterval(refreshCloud, 20000);
  } catch(error) {
    console.error("Wabb cloud load failed",error);
    showStatus("Cloud loading failed · retry by refreshing");
    renderCalendar();
  }
}
async function refreshCloud() {
  if (!accountReady || !activeUser || cloudDirty || cloudSaving || document.querySelector("#habit-dialog").open || document.querySelector("#day-dialog").open) return;
  const userId = activeUser.id;
  try {
    const remote = await readCloud();
    if (activeUser?.id === userId && !cloudDirty && remote) {state = remote; renderCalendar();}
  } catch(error) { console.warn("Wabb refresh failed",error); }
}
async function syncCloud() {
  if (!cloud || !activeUser || !accountReady || !cloudDirty || cloudSaving) return;
  cloudSaving = true;
  const userId = activeUser.id;
  const revision = cloudRevision;
  const snapshot = JSON.parse(JSON.stringify(state));
  try {
    const {error} = await cloud.from("habit_states").upsert({user_id:userId,data:snapshot},{onConflict:"user_id"});
    if (error) throw error;
    if (activeUser?.id !== userId) return;
    lastSavedRevision = revision;
    cloudDirty = cloudRevision !== revision;
    showUser();
  } catch(error) {
    console.warn("Wabb sync failed",error);
    if (activeUser?.id === userId) showStatus("Sync pending · check your connection");
  } finally {
    cloudSaving = false;
    if (activeUser?.id === userId && cloudDirty && navigator.onLine) saveTimer = setTimeout(syncCloud,2500);
  }
}
async function initAccount() {
  if (!cloud) {showStatus("Cloud sign-in unavailable · refresh to retry");return;}
  const {data,error} = await cloud.auth.getUser();
  if(error && error.name !== "AuthSessionMissingError") console.warn(error);
  await switchAccount(data?.user || null);
  cloud.auth.onAuthStateChange((event,session) => {
    if (event === "SIGNED_IN" && session?.user && session.user.id !== activeUser?.id) void switchAccount(session.user);
    if (event === "SIGNED_OUT") void switchAccount(null);
  });
}

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
  if (!accountReady) return;
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
  if (!accountReady) return;
  const input = document.querySelector("#new-day-habit");
  const name = input.value.trim(); if (!name) return;
  if (habitsForDay(editingDay).length >= 8) { alert("Maximum 8 habits per day."); return; }
  overrideFor(editingDay).added.push({id:"day-" + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random()),name});
  input.value = ""; updateDay(); input.focus();
}
function save() {
  if (activeUser) {
    if (!accountReady) return;
    cloudRevision++;
    cloudDirty = true;
    showUser();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(syncCloud, 350);
  } else {
    Object.assign(guestState,JSON.parse(JSON.stringify(state)));
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
    catch(error) {console.warn("Could not save guest habits",error);}
  }
}
function dateKey(year, month, day) {
  return [year, String(month + 1).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}
function isDone(key, habitId) { return Boolean(state.completions[key]?.[habitId]); }
function toggle(key, habitId) {
  if (!accountReady) return;
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
  if (!accountReady) return;
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
document.querySelector("#account-button").addEventListener("click",()=>document.querySelector("#auth-dialog").showModal());
document.querySelector("#close-auth").addEventListener("click",()=>document.querySelector("#auth-dialog").close());
document.querySelector("#sign-out-button").addEventListener("click",async()=>{
  if (cloudDirty) await syncCloud();
  if (cloudDirty) {alert("Your changes have not synced. Check your connection before signing out.");return;}
  const {error} = await cloud.auth.signOut();
  if(error) alert(error.message);
});
document.querySelector("#auth-form").addEventListener("submit", async event=>{
  event.preventDefault();
  authMessage("Signing in…");
  const email=document.querySelector("#auth-email").value.trim();
  const password=document.querySelector("#auth-password").value;
  const {error}=await cloud.auth.signInWithPassword({email,password});
  if(error) authMessage(error.message);
  else {authMessage("");document.querySelector("#auth-dialog").close();await switchAccount((await cloud.auth.getUser()).data.user);}
});
document.querySelector("#sign-up-submit").addEventListener("click",async()=>{
  const form=document.querySelector("#auth-form");
  if(!form.reportValidity()) return;
  const email=document.querySelector("#auth-email").value.trim();
  const password=document.querySelector("#auth-password").value;
  authMessage("Creating account…");
  const {data,error}=await cloud.auth.signUp({email,password,emailRedirectTo:location.origin+location.pathname});
  if(error) authMessage(error.message);
  else if(!data.session) authMessage("Account created! Check your email for a confirmation link, then sign in.");
  else {authMessage("Account created!");document.querySelector("#auth-dialog").close();await switchAccount(data.user);}
});
window.addEventListener("online",()=>{if(cloudDirty) void syncCloud();else void refreshCloud();});
document.addEventListener("visibilitychange",()=>{if(!document.hidden) void refreshCloud();});
document.querySelector("#previous-month").addEventListener("click", () => changeMonth(-1));
document.querySelector("#next-month").addEventListener("click", () => changeMonth(1));
document.querySelector("#today-button").addEventListener("click", () => {visibleYear = now.getFullYear(); visibleMonth = now.getMonth(); renderCalendar();});
document.querySelector("#manage-button").addEventListener("click", () => {if (!accountReady) return;renderEditor(); dialog.showModal();});
document.querySelector("#add-habit").addEventListener("click", addHabit);
document.querySelector("#new-habit").addEventListener("keydown", event => {if (event.key === "Enter") {event.preventDefault(); addHabit();}});
renderCalendar();
void initAccount();
