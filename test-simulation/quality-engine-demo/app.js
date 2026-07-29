export function taskKey(task) {
  return task.raw.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function parseLines(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((raw) => {
    const urgent = /(^|\s)!urgent\b/i.test(raw);
    const tags = ["work", "home"].filter((tag) => new RegExp(`(^|\\s)@${tag}\\b`, "i").test(raw));
    const taskText = raw.replace(/(^|\s)!urgent\b/ig, " ").replace(/(^|\s)@(work|home)\b/ig, " ").replace(/\s{2,}/g, " ").trim();
    return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, raw, text: taskText || raw, urgent, tags, complete: false };
  });
}

export function mergeTasks(existing, incoming) {
  const seen = new Set(existing.map(taskKey));
  const additions = incoming.filter((task) => {
    const key = taskKey(task);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...existing, ...additions];
}

if (typeof document !== "undefined") {
  "use strict";

  const STORAGE_KEY = "focus-deck:v1";
  const lanes = ["now", "next", "later"];
  const state = { tasks: [] };
  const input = document.querySelector("#task-input");
  const note = document.querySelector("#storage-note");

  const laneFor = (task) => task.urgent ? "now" : task.tags.includes("work") ? "next" : "later";

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks: state.tasks }));
      note.textContent = "已保存在这台设备的浏览器里。";
      return true;
    } catch {
      note.textContent = "浏览器未允许保存；本次打开期间仍可使用。";
      return false;
    }
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.tasks)) state.tasks = saved.tasks;
    } catch {
      note.textContent = "未能读取旧牌组；你可以从当前页面重新开始。";
    }
  }

  function makeTag(label, className = "") {
    const tag = document.createElement("span");
    tag.className = `tag ${className}`.trim();
    tag.textContent = label;
    return tag;
  }

  function render() {
    lanes.forEach((lane) => {
      const list = document.querySelector(`#${lane}-list`);
      const tasks = state.tasks.filter((task) => laneFor(task) === lane);
      document.querySelector(`#${lane}-count`).textContent = String(tasks.filter((task) => !task.complete).length);
      list.replaceChildren();
      if (!tasks.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = lane === "now" ? "没有必须抢先做的事。" : lane === "next" ? "工作会在这里等待。" : "给还不需要处理的事留个位置。";
        list.append(empty);
      }
      tasks.forEach((task) => {
        const card = document.createElement("article");
        card.className = `task-card${task.complete ? " is-complete" : ""}`;
        const body = document.createElement("div");
        const label = document.createElement("p");
        label.className = "task-text";
        label.textContent = task.text;
        const meta = document.createElement("div");
        meta.className = "task-meta";
        if (task.urgent) meta.append(makeTag("urgent", "urgent"));
        task.tags.forEach((tag) => meta.append(makeTag(`@${tag}`)));
        body.append(label, meta);
        const complete = document.createElement("button");
        complete.type = "button";
        complete.className = "complete-button";
        complete.setAttribute("aria-pressed", String(task.complete));
        complete.textContent = task.complete ? "已完成" : "完成";
        complete.addEventListener("click", () => { task.complete = !task.complete; save(); render(); });
        card.append(body, complete);
        list.append(card);
      });
    });
  }

  function organise() {
    const parsed = parseLines(input.value);
    if (!parsed.length) { note.textContent = "先写下一件想做的事，再整理。"; input.focus(); return; }
    const before = state.tasks.length;
    state.tasks = mergeTasks(state.tasks, parsed);
    const added = state.tasks.length - before;
    const saved = save();
    render();
    input.value = "";
    if (saved) note.textContent = added ? `已加入 ${added} 项；原有任务仍保留。` : "这些任务已在牌组中；原有状态仍保留。";
    document.querySelector("#now-list button, #next-list button, #later-list button")?.focus();
  }

  document.querySelector("#organize-button").addEventListener("click", organise);
  document.querySelector("#clear-button").addEventListener("click", () => {
    if (!window.confirm("这会移除牌组中的全部任务，且无法在此页面撤销。确定清空吗？")) return;
    state.tasks = [];
    const saved = save();
    render();
    if (saved) note.textContent = "牌组已清空。";
  });
  input.addEventListener("keydown", (event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); organise(); } });
  load();
  render();
}
