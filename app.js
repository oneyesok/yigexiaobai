const storageKey = "dailyWordMvp";

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, "0");
  const nd = String(dt.getDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

function loadData() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return { words: [], dailyGoal: 30, stats: {}, session: null };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      words: parsed.words || [],
      dailyGoal: parsed.dailyGoal || 30,
      stats: parsed.stats || {},
      session: parsed.session || null,
    };
  } catch (err) {
    return { words: [], dailyGoal: 30, stats: {}, session: null };
  }
}

function saveData(data) {
  localStorage.setItem(storageKey, JSON.stringify(data));
}

const state = {
  data: loadData(),
  filter: "all",
  autoPlay: false,
  autoMode: "today",
  autoQueue: [],
  autoIndex: 0,
};

const goalCount = document.getElementById("goal-count");
const addForm = document.getElementById("add-form");
const wordEn = document.getElementById("word-en");
const wordZh = document.getElementById("word-zh");
const wordEx = document.getElementById("word-ex");
const wordList = document.getElementById("word-list");
const todaySummary = document.getElementById("today-summary");
const startReview = document.getElementById("start-review");
const resetToday = document.getElementById("reset-today");
const reviewPanel = document.getElementById("review-panel");
const reviewWord = document.getElementById("review-word");
const reviewMeaning = document.getElementById("review-meaning");
const reviewExample = document.getElementById("review-example");
const btnKnow = document.getElementById("btn-know");
const btnDont = document.getElementById("btn-dont");
const btnSpeak = document.getElementById("btn-speak");
const btnAutoToday = document.getElementById("btn-auto-today");
const btnAutoAll = document.getElementById("btn-auto-all");
const btnStop = document.getElementById("btn-stop");
const speechRate = document.getElementById("speech-rate");
const speechRateValue = document.getElementById("speech-rate-value");
const autoStatus = document.getElementById("auto-status");
const filterAll = document.getElementById("filter-all");
const filterDue = document.getElementById("filter-due");
const clearAll = document.getElementById("clear-all");
const csvFile = document.getElementById("csv-file");
const importBtn = document.getElementById("import-btn");
const importRemote = document.getElementById("import-remote");
const importStatus = document.getElementById("import-status");
const remoteCsvUrl = "https://raw.githubusercontent.com/oneyesok/yigexiaobai/refs/heads/main/%E9%AB%98%E9%A2%91%E8%AF%8D%E5%BA%93_10000_%E5%90%AB%E4%B8%AD%E6%96%87.csv";

function ensureTodayStats() {
  const key = todayKey();
  if (!state.data.stats[key]) {
    state.data.stats[key] = {
      reviewed: 0,
      known: 0,
      unknown: 0,
      reviewedIds: [],
    };
  }
  return state.data.stats[key];
}

function getDueWords() {
  const key = todayKey();
  return state.data.words.filter((w) => !w.nextReview || w.nextReview <= key);
}

function getReviewedIds() {
  const stats = ensureTodayStats();
  return new Set(stats.reviewedIds || []);
}

function buildSession() {
  const goal = state.data.dailyGoal || 30;
  const reviewedIds = getReviewedIds();
  const due = getDueWords().filter((w) => !reviewedIds.has(w.id));
  const remaining = state.data.words.filter((w) => !reviewedIds.has(w.id) && !due.find((d) => d.id === w.id));
  const queue = [...due, ...remaining].slice(0, goal).map((w) => w.id);
  state.data.session = {
    date: todayKey(),
    queue,
    index: 0,
  };
  saveData(state.data);
}

function currentSession() {
  const session = state.data.session;
  if (!session || session.date !== todayKey()) {
    return null;
  }
  return session;
}

function renderSummary() {
  const stats = ensureTodayStats();
  const total = state.data.words.length;
  const due = getDueWords().length;
  todaySummary.innerHTML = `你已复习 <strong>${stats.reviewed}</strong> / ${state.data.dailyGoal} 个，认识 ${stats.known} 个，不认识 ${stats.unknown} 个。<br/>今日应复习 ${due} 个，当前词库 ${total} 个。`;
}

function renderList() {
  const dueIds = new Set(getDueWords().map((w) => w.id));
  const items = state.data.words
    .filter((w) => (state.filter === "due" ? dueIds.has(w.id) : true))
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

  wordList.innerHTML = "";
  if (items.length === 0) {
    wordList.innerHTML = "<li>暂时没有单词</li>";
    return;
  }
  for (const w of items) {
    const li = document.createElement("li");
    const next = w.nextReview || "今天";
    li.innerHTML = `
      <strong>${w.en}</strong> - ${w.zh}
      ${w.example ? `<div class="meta">${w.example}</div>` : ""}
      <div class="meta">下次复习：${next} | 连续认识：${w.successCount || 0} | 遇到困难：${w.failCount || 0}</div>
      <div class="actions">
        <button class="ghost" data-del="${w.id}">删除</button>
      </div>
    `;
    wordList.appendChild(li);
  }
}

function renderReview() {
  const session = currentSession();
  if (!session || session.queue.length === 0 || session.index >= session.queue.length) {
    reviewPanel.classList.add("hidden");
    if (state.autoPlay) {
      toggleAutoPlay(false);
    }
    return;
  }
  const id = session.queue[session.index];
  const word = state.data.words.find((w) => w.id === id);
  if (!word) {
    session.index += 1;
    saveData(state.data);
    renderReview();
    return;
  }
  reviewPanel.classList.remove("hidden");
  reviewWord.textContent = word.en;
  reviewMeaning.textContent = word.zh;
  reviewExample.textContent = word.example ? `例句：${word.example}` : "";
}

function renderAutoWord(word) {
  if (!word) return;
  reviewPanel.classList.remove("hidden");
  reviewWord.textContent = word.en;
  reviewMeaning.textContent = word.zh;
  reviewExample.textContent = word.example ? `例句：${word.example}` : "";
}

function speakText(text) {
  if (!("speechSynthesis" in window)) {
    alert("当前浏览器不支持语音朗读。");
    return;
  }
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  if (speechRate) {
    utter.rate = Number(speechRate.value) || 1;
  }
  utter.onend = () => {
    if (state.autoPlay) {
      moveAutoNext();
    }
  };
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

function addWord(en, zh, example) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const key = todayKey();
  state.data.words.unshift({
    id,
    en: en.trim(),
    zh: zh.trim(),
    example: example.trim(),
    createdAt: key,
    interval: 1,
    nextReview: key,
    lastReview: "",
    successCount: 0,
    failCount: 0,
  });
  saveData(state.data);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === "\"" && inQuotes && next === "\"") {
      cell += "\"";
      i += 1;
      continue;
    }
    if (ch === "\"") {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (cell.length > 0 || row.length > 0) {
        row.push(cell);
        rows.push(row);
      }
      row = [];
      cell = "";
      if (ch === "\r" && next === "\n") i += 1;
      continue;
    }
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function importCsv(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { added: 0, skipped: 0 };
  const header = rows[0].map((c) => c.trim().toLowerCase());
  const wordIdx = header.indexOf("word");
  const meaningIdx = header.indexOf("meaning");
  const exampleIdx = header.indexOf("example");
  const start = wordIdx === -1 ? 0 : 1;
  const existing = new Set(state.data.words.map((w) => w.en.toLowerCase()));
  let added = 0;
  let skipped = 0;
  for (let i = start; i < rows.length; i += 1) {
    const row = rows[i];
    const en = (row[wordIdx === -1 ? 0 : wordIdx] || "").trim();
    const zh = (row[meaningIdx === -1 ? 1 : meaningIdx] || "").trim();
    const ex = (row[exampleIdx === -1 ? 2 : exampleIdx] || "").trim();
    if (!en || !zh) {
      skipped += 1;
      continue;
    }
    const key = en.toLowerCase();
    if (existing.has(key)) {
      skipped += 1;
      continue;
    }
    addWord(en, zh, ex);
    existing.add(key);
    added += 1;
  }
  return { added, skipped };
}

function updateWordReview(word, known) {
  const key = todayKey();
  if (known) {
    word.successCount = (word.successCount || 0) + 1;
    word.interval = Math.min((word.interval || 1) * 2, 60);
  } else {
    word.failCount = (word.failCount || 0) + 1;
    word.interval = 1;
  }
  word.lastReview = key;
  word.nextReview = addDays(key, word.interval);
}

function recordToday(id, known) {
  const stats = ensureTodayStats();
  if (!stats.reviewedIds.includes(id)) {
    stats.reviewedIds.push(id);
  }
  stats.reviewed += 1;
  if (known) {
    stats.known += 1;
  } else {
    stats.unknown += 1;
  }
  saveData(state.data);
}

function finishSessionIfNeeded() {
  const session = currentSession();
  if (!session) return;
  if (session.index >= session.queue.length) {
    state.data.session = null;
    saveData(state.data);
  }
}

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addWord(wordEn.value, wordZh.value, wordEx.value || "");
  wordEn.value = "";
  wordZh.value = "";
  wordEx.value = "";
  renderSummary();
  renderList();
});

startReview.addEventListener("click", () => {
  buildSession();
  renderSummary();
  renderReview();
});

resetToday.addEventListener("click", () => {
  const key = todayKey();
  state.data.stats[key] = {
    reviewed: 0,
    known: 0,
    unknown: 0,
    reviewedIds: [],
  };
  state.data.session = null;
  saveData(state.data);
  renderSummary();
  renderReview();
});

btnKnow.addEventListener("click", () => {
  const session = currentSession();
  if (!session) return;
  const id = session.queue[session.index];
  const word = state.data.words.find((w) => w.id === id);
  if (word) {
    updateWordReview(word, true);
    recordToday(id, true);
  }
  session.index += 1;
  saveData(state.data);
  finishSessionIfNeeded();
  renderSummary();
  renderList();
  renderReview();
});

btnDont.addEventListener("click", () => {
  const session = currentSession();
  if (!session) return;
  const id = session.queue[session.index];
  const word = state.data.words.find((w) => w.id === id);
  if (word) {
    updateWordReview(word, false);
    recordToday(id, false);
  }
  session.index += 1;
  saveData(state.data);
  finishSessionIfNeeded();
  renderSummary();
  renderList();
  renderReview();
});

btnSpeak.addEventListener("click", () => {
  speakCurrentWord();
});

btnAutoToday.addEventListener("click", () => {
  startAuto("today");
});

btnAutoAll.addEventListener("click", () => {
  startAuto("all");
});

btnStop.addEventListener("click", () => {
  toggleAutoPlay(false);
});

speechRate.addEventListener("input", () => {
  speechRateValue.textContent = `${Number(speechRate.value).toFixed(1)}x`;
});

function speakCurrentWord() {
  const session = currentSession();
  if (!session) return;
  const id = session.queue[session.index];
  const word = state.data.words.find((w) => w.id === id);
  if (!word) return;
  const text = word.example ? `${word.en}. ${word.example}` : word.en;
  speakText(text);
}

function moveToNextWord() {
  const session = currentSession();
  if (!session) return;
  session.index += 1;
  saveData(state.data);
  finishSessionIfNeeded();
  renderSummary();
  renderList();
  renderReview();
}

function toggleAutoPlay(enabled) {
  state.autoPlay = enabled;
  btnAutoToday.classList.toggle("active", enabled && state.autoMode === "today");
  btnAutoAll.classList.toggle("active", enabled && state.autoMode === "all");
  if (!enabled && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  updateAutoStatus();
}

function startAuto(mode) {
  if (!currentSession()) return;
  state.autoMode = mode;
  if (mode === "today") {
    const session = currentSession();
    state.autoQueue = session ? [...session.queue] : [];
    state.autoIndex = session ? session.index : 0;
  } else {
    const nextQueue = state.data.words.map((w) => w.id);
    const canResume =
      state.autoMode === "all" &&
      state.autoQueue.length === nextQueue.length &&
      state.autoIndex > 0 &&
      state.autoIndex < nextQueue.length;
    state.autoQueue = nextQueue;
    state.autoIndex = canResume ? state.autoIndex : 0;
  }
  toggleAutoPlay(true);
  speakAutoCurrent();
}

function speakAutoCurrent() {
  if (!state.autoPlay) return;
  const id = state.autoQueue[state.autoIndex];
  const word = state.data.words.find((w) => w.id === id);
  if (!word) {
    moveAutoNext();
    return;
  }
  renderAutoWord(word);
  const text = word.example ? `${word.en}. ${word.example}` : word.en;
  speakText(text);
  if (state.autoMode === "today") {
    syncSessionIndex();
  }
  updateAutoStatus();
}

function moveAutoNext() {
  if (!state.autoPlay) return;
  state.autoIndex += 1;
  if (state.autoIndex >= state.autoQueue.length) {
    toggleAutoPlay(false);
    return;
  }
  if (state.autoMode === "today") {
    syncSessionIndex();
  }
  speakAutoCurrent();
}

function syncSessionIndex() {
  const session = currentSession();
  if (!session) return;
  session.index = Math.min(state.autoIndex, session.queue.length);
  saveData(state.data);
  renderReview();
}

function updateAutoStatus() {
  if (!autoStatus) return;
  if (!state.autoPlay) {
    autoStatus.textContent = "";
    return;
  }
  const total = state.autoQueue.length;
  const current = Math.min(state.autoIndex + 1, total);
  const label = state.autoMode === "today" ? "今日队列" : "全部词库";
  autoStatus.textContent = `自动朗读中：${label} ${current} / ${total}`;
}

wordList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.getAttribute("data-del");
  if (!id) return;
  state.data.words = state.data.words.filter((w) => w.id !== id);
  saveData(state.data);
  renderSummary();
  renderList();
});

filterAll.addEventListener("click", () => {
  state.filter = "all";
  filterAll.classList.add("active");
  filterDue.classList.remove("active");
  renderList();
});

filterDue.addEventListener("click", () => {
  state.filter = "due";
  filterDue.classList.add("active");
  filterAll.classList.remove("active");
  renderList();
});

clearAll.addEventListener("click", () => {
  if (!confirm("确定要清空全部单词吗？此操作不可撤销。")) return;
  state.data.words = [];
  state.data.session = null;
  saveData(state.data);
  renderSummary();
  renderList();
  renderReview();
});

importBtn.addEventListener("click", () => {
  const file = csvFile.files && csvFile.files[0];
  if (!file) {
    importStatus.textContent = "请先选择 CSV 文件。";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const result = importCsv(reader.result || "");
    importStatus.textContent = `导入完成：新增 ${result.added} 个，跳过 ${result.skipped} 个。`;
    renderSummary();
    renderList();
  };
  reader.onerror = () => {
    importStatus.textContent = "读取失败，请重试。";
  };
  reader.readAsText(file);
});

importRemote.addEventListener("click", async () => {
  importStatus.textContent = "正在从 GitHub 获取词库...";
  try {
    const resp = await fetch(remoteCsvUrl, { cache: "no-store" });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const text = await resp.text();
    const result = importCsv(text);
    importStatus.textContent = `导入完成：新增 ${result.added} 个，跳过 ${result.skipped} 个。`;
    renderSummary();
    renderList();
  } catch (err) {
    importStatus.textContent = "获取失败，请检查网络或链接。";
  }
});

function init() {
  goalCount.textContent = state.data.dailyGoal || 30;
  renderSummary();
  renderList();
  renderReview();
}

init();
