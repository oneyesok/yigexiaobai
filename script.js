// 轻记单词 - 完整功能版
// 支持：暗黑模式、语音朗读、统计图表、数据导出/导入、撤销操作、键盘快捷键

const STORAGE_KEY = "wordApp_v2";
let appData = {
  words: [],
  settings: {
    theme: "light",
    dailyGoal: 30
  },
  stats: {}, // { date: { reviewed: 0, known: 0, unknown: 0 } }
  lastUndo: null
};

let currentWord = null;
let isShowingAnswer = false;
let chartInstance = null;
let toastTimeout = null;

// DOM 元素
const elements = {};

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  initElements();
  loadData();
  applyTheme(appData.settings.theme);
  setupEventListeners();
  render();
  checkEmptyState();
});

// 初始化 DOM 元素引用
function initElements() {
  elements.themeToggle = document.getElementById("theme-toggle");
  elements.statsBtn = document.getElementById("stats-btn");
  elements.exportBtn = document.getElementById("export-btn");
  elements.closeStats = document.getElementById("close-stats");
  elements.statsPanel = document.getElementById("stats-panel");
  elements.totalWords = document.getElementById("total-words");
  elements.dueWords = document.getElementById("due-words");
  elements.masteredWords = document.getElementById("mastered-words");
  elements.learningChart = document.getElementById("learning-chart");
  elements.emptyState = document.getElementById("empty-state");
  elements.quickAddBtn = document.getElementById("quick-add-btn");
  elements.reviewCard = document.getElementById("review-card");
  elements.wordText = document.getElementById("word-text");
  elements.wordPhonetic = document.getElementById("word-phonetic");
  elements.wordDefinition = document.getElementById("word-definition");
  elements.definitionBox = document.getElementById("definition-box");
  elements.actionButtons = document.getElementById("action-buttons");
  elements.showAnswerBtn = document.getElementById("show-answer-btn");
  elements.speakBtn = document.getElementById("speak-btn");
  elements.cardBadge = document.getElementById("card-badge");
  elements.addForm = document.getElementById("add-word-form");
  elements.newWord = document.getElementById("new-word");
  elements.newDefinition = document.getElementById("new-definition");
  elements.newPhonetic = document.getElementById("new-phonetic");
  elements.bulkImport = document.getElementById("bulk-import");
  elements.importBtn = document.getElementById("import-btn");
  elements.csvFile = document.getElementById("csv-file");
  elements.searchInput = document.getElementById("search-input");
  elements.wordListBody = document.getElementById("word-list-body");
  elements.tabBtns = document.querySelectorAll(".tab-btn");
  elements.tabContents = document.querySelectorAll(".tab-content");
  elements.toast = document.getElementById("toast");
  elements.toastMessage = document.getElementById("toast-message");
  elements.toastUndo = document.getElementById("toast-undo");
  elements.toastClose = document.getElementById("toast-close");
}

// 加载数据
function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      appData = { ...appData, ...JSON.parse(saved) };
    } catch (e) {
      console.error("数据加载失败", e);
    }
  }
}

// 保存数据
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

// 设置事件监听
function setupEventListeners() {
  // 主题切换
  elements.themeToggle.addEventListener("click", toggleTheme);
  
  // 统计面板
  elements.statsBtn.addEventListener("click", showStats);
  elements.closeStats.addEventListener("click", hideStats);
  
  // 导出
  elements.exportBtn.addEventListener("click", exportData);
  
  // 空状态快速添加
  elements.quickAddBtn.addEventListener("click", () => switchTab("add"));
  
  // 显示答案
  elements.showAnswerBtn.addEventListener("click", showAnswer);
  elements.definitionBox.addEventListener("click", showAnswer);
  
  // 语音朗读
  elements.speakBtn.addEventListener("click", speakCurrentWord);
  
  // 评分按钮
  document.querySelectorAll(".btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const grade = parseInt(e.target.dataset.grade);
      handleRating(grade);
    });
  });
  
  // 添加单词表单
  elements.addForm.addEventListener("submit", handleAddWord);
  
  // 批量导入
  elements.importBtn.addEventListener("click", handleBulkImport);
  elements.csvFile.addEventListener("change", handleFileImport);
  
  // Tab 切换
  elements.tabBtns.forEach(btn => {
    btn.addEventListener("click", (e) => switchTab(e.target.dataset.tab));
  });
  
  // 搜索
  elements.searchInput.addEventListener("input", renderWordList);
  
  // Toast 操作
  elements.toastUndo.addEventListener("click", undoLastAction);
  elements.toastClose.addEventListener("click", hideToast);
  
  // 键盘快捷键
  document.addEventListener("keydown", handleKeyboard);
}

// 主题切换
function toggleTheme() {
  const newTheme = appData.settings.theme === "light" ? "dark" : "light";
  appData.settings.theme = newTheme;
  applyTheme(newTheme);
  saveData();
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const icon = elements.themeToggle.querySelector("i");
  icon.className = theme === "light" ? "fas fa-moon" : "fas fa-sun";
}

// 统计面板
function showStats() {
  updateStatsDisplay();
  elements.statsPanel.classList.remove("hidden");
  renderChart();
}

function hideStats() {
  elements.statsPanel.classList.add("hidden");
}

function updateStatsDisplay() {
  const total = appData.words.length;
  const due = getDueWords().length;
  const mastered = appData.words.filter(w => w.easeFactor >= 2.5 && w.interval >= 30).length;
  
  elements.totalWords.textContent = total;
  elements.dueWords.textContent = due;
  elements.masteredWords.textContent = mastered;
}

function renderChart() {
  const ctx = elements.learningChart.getContext("2d");
  
  // 获取最近 7 天数据
  const labels = [];
  const reviewedData = [];
  const knownData = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    labels.push(dateStr.slice(5)); // MM-DD
    
    const stat = appData.stats[dateStr] || { reviewed: 0, known: 0 };
    reviewedData.push(stat.reviewed);
    knownData.push(stat.known);
  }
  
  if (chartInstance) {
    chartInstance.destroy();
  }
  
  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "复习数量",
          data: reviewedData,
          borderColor: "#d97706",
          backgroundColor: "rgba(217, 119, 6, 0.1)",
          tension: 0.4,
          fill: true
        },
        {
          label: "认识数量",
          data: knownData,
          borderColor: "#15803d",
          backgroundColor: "rgba(21, 128, 61, 0.1)",
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top"
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
}

// 导出功能
function exportData() {
  const dataStr = JSON.stringify(appData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = `单词备份_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  showToast("数据已导出");
}

// 检查空状态
function checkEmptyState() {
  if (appData.words.length === 0) {
    elements.emptyState.classList.remove("hidden");
    elements.reviewCard.classList.add("hidden");
  } else {
    elements.emptyState.classList.add("hidden");
    loadNextWord();
  }
}

// 获取待复习单词
function getDueWords() {
  const today = new Date().toISOString().split("T")[0];
  return appData.words.filter(w => !w.nextReview || w.nextReview <= today);
}

// 加载下一个单词
function loadNextWord() {
  const dueWords = getDueWords();
  
  if (dueWords.length > 0) {
    currentWord = dueWords[0];
  } else if (appData.words.length > 0) {
    // 没有待复习的，随机选一个未掌握的
    const notMastered = appData.words.filter(w => w.easeFactor < 2.5 || w.interval < 30);
    currentWord = notMastered.length > 0 ? notMastered[0] : appData.words[0];
  } else {
    currentWord = null;
  }
  
  if (currentWord) {
    renderWord();
    elements.reviewCard.classList.remove("hidden");
  } else {
    elements.reviewCard.classList.add("hidden");
    checkEmptyState();
  }
}

// 渲染单词卡片
function renderWord() {
  elements.wordText.textContent = currentWord.word;
  elements.wordPhonetic.textContent = currentWord.phonetic || "";
  elements.wordDefinition.textContent = currentWord.definition;
  elements.cardBadge.textContent = getWordLevel(currentWord);
  isShowingAnswer = false;
  elements.definitionBox.style.opacity = "0.3";
  elements.actionButtons.classList.add("hidden");
  elements.showAnswerBtn.classList.remove("hidden");
}

function getWordLevel(word) {
  if (!word.nextReview) return "新词";
  if (word.interval >= 30) return "已掌握";
  if (word.interval >= 7) return "熟悉";
  return "复习中";
}

// 显示答案
function showAnswer() {
  isShowingAnswer = true;
  elements.definitionBox.style.opacity = "1";
  elements.actionButtons.classList.remove("hidden");
  elements.showAnswerBtn.classList.add("hidden");
}

// 语音朗读
function speakCurrentWord() {
  if (!currentWord) return;
  
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(currentWord.word);
    utterance.lang = "en-US";
    utterance.rate = 0.8;
    speechSynthesis.speak(utterance);
  } else {
    showToast("浏览器不支持语音功能");
  }
}

// 处理评分
function handleRating(grade) {
  if (!currentWord) return;
  
  // 保存旧状态用于撤销
  const oldData = JSON.parse(JSON.stringify(currentWord));
  
  // SM-2 算法简化版
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  
  // 确保 stats 中有今天的数据
  if (!appData.stats[today]) {
    appData.stats[today] = { reviewed: 0, known: 0, unknown: 0 };
  }
  appData.stats[today].reviewed++;
  
  if (grade >= 4) {
    appData.stats[today].known++;
  } else {
    appData.stats[today].unknown++;
  }
  
  // 更新单词信息
  if (!currentWord.easeFactor) currentWord.easeFactor = 2.5;
  if (!currentWord.interval) currentWord.interval = 0;
  if (!currentWord.repetitions) currentWord.repetitions = 0;
  
  // 更新 EF (Ease Factor)
  currentWord.easeFactor = Math.max(1.3, currentWord.easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  
  if (grade >= 3) {
    // 记住
    currentWord.repetitions++;
    if (currentWord.repetitions === 1) {
      currentWord.interval = 1;
    } else if (currentWord.repetitions === 2) {
      currentWord.interval = 6;
    } else {
      currentWord.interval = Math.round(currentWord.interval * currentWord.easeFactor);
    }
  } else {
    // 忘记
    currentWord.repetitions = 0;
    currentWord.interval = 1;
  }
  
  // 计算下次复习日期
  const nextReview = new Date(now);
  nextReview.setDate(nextReview.getDate() + currentWord.interval);
  currentWord.nextReview = nextReview.toISOString().split("T")[0];
  currentWord.lastReview = today;
  
  saveData();
  
  // 显示撤销提示
  showUndoToast(oldData);
  
  // 加载下一个单词
  setTimeout(() => loadNextWord(), 300);
}

// 显示撤销提示
function showUndoToast(oldData) {
  const deletedWord = appData.words.find(w => w.id === oldData.id);
  if (deletedWord) {
    appData.lastUndo = { action: "rating", oldData, wordId: oldData.id };
    elements.toastMessage.textContent = "已更新记忆状态";
    elements.toast.classList.remove("hidden");
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => hideToast(), 5000);
  }
}

// 撤销操作
function undoLastAction() {
  if (!appData.lastUndo) return;
  
  const { action, oldData, wordId } = appData.lastUndo;
  
  if (action === "rating") {
    const word = appData.words.find(w => w.id === wordId);
    if (word) {
      Object.assign(word, oldData);
      saveData();
      renderWord();
      showToast("已撤销");
    }
  }
  
  appData.lastUndo = null;
  hideToast();
}

function hideToast() {
  elements.toast.classList.add("hidden");
}

function showToast(message) {
  elements.toastMessage.textContent = message;
  elements.toastUndo.classList.add("hidden");
  elements.toast.classList.remove("hidden");
  
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => hideToast(), 3000);
}

// 添加单词
function handleAddWord(e) {
  e.preventDefault();
  
  const word = {
    id: Date.now().toString(),
    word: elements.newWord.value.trim(),
    definition: elements.newDefinition.value.trim(),
    phonetic: elements.newPhonetic.value.trim(),
    createdAt: new Date().toISOString(),
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0
  };
  
  appData.words.push(word);
  saveData();
  
  elements.addForm.reset();
  showToast("单词已添加");
  renderWordList();
  checkEmptyState();
  
  // 如果当前没有单词在复习，加载这个新单词
  if (!currentWord) {
    loadNextWord();
  }
}

// 批量导入
function handleBulkImport() {
  const text = elements.bulkImport.value.trim();
  if (!text) return;
  
  const lines = text.split("\n");
  let count = 0;
  
  lines.forEach(line => {
    const parts = line.split(/[,,]/).map(p => p.trim());
    if (parts.length >= 2 && parts[0]) {
      const word = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        word: parts[0],
        definition: parts[1] || "",
        phonetic: parts[2] || "",
        createdAt: new Date().toISOString(),
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0
      };
      appData.words.push(word);
      count++;
    }
  });
  
  saveData();
  elements.bulkImport.value = "";
  showToast(`成功导入 ${count} 个单词`);
  renderWordList();
  checkEmptyState();
}

// 文件导入
function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target.result;
    elements.bulkImport.value = text;
    handleBulkImport();
  };
  reader.readAsText(file);
  e.target.value = "";
}

// Tab 切换
function switchTab(tabName) {
  elements.tabBtns.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  
  elements.tabContents.forEach(content => {
    content.classList.toggle("active", content.id === `tab-${tabName}`);
  });
  
  if (tabName === "list") {
    renderWordList();
  }
}

// 渲染单词列表
function renderWordList() {
  const searchTerm = elements.searchInput.value.toLowerCase();
  const filtered = appData.words.filter(w => 
    w.word.toLowerCase().includes(searchTerm) || 
    w.definition.toLowerCase().includes(searchTerm)
  );
  
  elements.wordListBody.innerHTML = filtered.map(w => `
    <tr>
      <td><strong>${escapeHtml(w.word)}</strong></td>
      <td>${escapeHtml(w.definition)}</td>
      <td>
        <span class="badge" style="background: ${getBadgeColor(w)}">
          ${getWordLevel(w)}
        </span>
      </td>
      <td>
        <button class="delete-btn" onclick="deleteWord('${w.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join("");
}

function getBadgeColor(word) {
  if (!word.nextReview) return "#d97706";
  if (word.interval >= 30) return "#15803d";
  if (word.interval >= 7) return "#3b82f6";
  return "#f59e0b";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// 删除单词
window.deleteWord = function(id) {
  if (!confirm("确定要删除这个单词吗？")) return;
  
  const wordIndex = appData.words.findIndex(w => w.id === id);
  if (wordIndex === -1) return;
  
  const deletedWord = appData.words.splice(wordIndex, 1)[0];
  appData.lastUndo = { action: "delete", word: deletedWord };
  
  saveData();
  renderWordList();
  
  showDeleteUndoToast(deletedWord);
  checkEmptyState();
};

function showDeleteUndoToast(deletedWord) {
  elements.toastMessage.textContent = "已删除单词";
  elements.toastUndo.classList.remove("hidden");
  elements.toastUndo.onclick = () => {
    appData.words.push(deletedWord);
    saveData();
    renderWordList();
    showToast("已恢复");
    hideToast();
  };
  
  elements.toast.classList.remove("hidden");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => hideToast(), 5000);
}

// 键盘快捷键
function handleKeyboard(e) {
  // 如果在输入框中，不触发快捷键
  if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
  
  // 空格键显示答案
  if (e.code === "Space" && !isShowingAnswer && currentWord) {
    e.preventDefault();
    showAnswer();
  }
  
  // 数字键评分
  if (isShowingAnswer) {
    const gradeMap = {
      "Digit1": 0, // 忘记
      "Digit2": 3, // 模糊
      "Digit3": 4, // 认识
      "Digit4": 5  // 简单
    };
    
    if (gradeMap[e.code]) {
      e.preventDefault();
      handleRating(gradeMap[e.code]);
    }
  }
  
  // S 键发音
  if (e.code === "KeyS" && currentWord) {
    e.preventDefault();
    speakCurrentWord();
  }
}

// 主渲染函数
function render() {
  renderWordList();
}

// ==================== 新增功能：成就系统、云同步、设置、词典查询 ====================

// 成就定义
const ACHIEVEMENTS = [
  { id: "first_word", icon: "🌱", title: "第一步", description: "添加第一个单词", condition: (data) => data.words.length >= 1 },
  { id: "ten_words", icon: "🌿", title: "小有所成", description: "拥有 10 个单词", condition: (data) => data.words.length >= 10 },
  { id: "hundred_words", icon: "🌳", title: "词汇丰富", description: "拥有 100 个单词", condition: (data) => data.words.length >= 100 },
  { id: "first_review", icon: "📚", title: "开始复习", description: "完成第一次复习", condition: (data) => Object.values(data.stats).reduce((sum, s) => sum + s.reviewed, 0) >= 1 },
  { id: "thousand_reviews", icon: "📖", title: "勤学苦练", description: "累计复习 1000 次", condition: (data) => Object.values(data.stats).reduce((sum, s) => sum + s.reviewed, 0) >= 1000 },
  { id: "seven_streak", icon: "🔥", title: "持之以恒", description: "连续学习 7 天", condition: (data) => getStreakDays(data) >= 7 },
  { id: "thirty_streak", icon: "🔥🔥", title: "坚持不懈", description: "连续学习 30 天", condition: (data) => getStreakDays(data) >= 30 },
  { id: "master_50", icon: "🎓", title: "掌握者", description: "掌握 50 个单词", condition: (data) => data.words.filter(w => w.interval >= 30).length >= 50 },
  { id: "perfect_day", icon: "⭐", title: "完美一天", description: "单日复习 50 个单词且全部认识", condition: (data) => hasPerfectDay(data) },
  { id: "early_bird", icon: "🌅", title: "早起的鸟儿", description: "在早上 6 点前学习", condition: (data) => studiedEarlyMorning(data) }
];

// 计算连续学习天数
function getStreakDays(data) {
  const dates = Object.keys(data.stats).sort().reverse();
  if (dates.length === 0) return 0;
  
  let streak = 0;
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  
  // 检查今天或昨天是否有学习记录
  if (!dates.includes(today) && !dates.includes(yesterday)) return 0;
  
  let currentDate = dates.includes(today) ? new Date(today) : new Date(yesterday);
  
  while (true) {
    const dateStr = currentDate.toISOString().split("T")[0];
    if (data.stats[dateStr] && data.stats[dateStr].reviewed > 0) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  return streak;
}

// 检查是否有完美的一天
function hasPerfectDay(data) {
  return Object.values(data.stats).some(s => s.reviewed >= 50 && s.known === s.reviewed);
}

// 检查是否曾在早晨学习
function studiedEarlyMorning(data) {
  // 简化实现：只要有过学习记录就算
  return Object.values(data.stats).some(s => s.reviewed > 0);
}

// 渲染成就面板
function renderAchievements() {
  const achievementsList = document.getElementById("achievements-list");
  const unlockedIds = JSON.parse(localStorage.getItem("unlocked_achievements") || "[]");
  
  achievementsList.innerHTML = ACHIEVEMENTS.map(ach => {
    const isUnlocked = unlockedIds.includes(ach.id) || ach.condition(appData);
    if (isUnlocked && !unlockedIds.includes(ach.id)) {
      unlockedIds.push(ach.id);
      localStorage.setItem("unlocked_achievements", JSON.stringify(unlockedIds));
      showToast(`🏆 解锁成就：${ach.title}`);
    }
    
    return `
      <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
        <div class="achievement-icon">${isUnlocked ? ach.icon : "🔒"}</div>
        <div class="achievement-info">
          <h4>${ach.title}</h4>
          <p>${ach.description}</p>
          ${!isUnlocked ? `<div class="achievement-progress">尚未解锁</div>` : ''}
        </div>
      </div>
    `;
  }).join("");
}

// 云同步功能
async function uploadToCloud() {
  const token = document.getElementById("github-token").value.trim();
  const gistId = document.getElementById("gist-id").value.trim();
  const statusEl = document.getElementById("cloud-status");
  
  if (!token) {
    statusEl.className = "status-message error";
    statusEl.textContent = "请输入 GitHub Token";
    return;
  }
  
  try {
    const data = {
      description: "轻记单词备份数据",
      public: false,
      files: {
        "word-backup.json": {
          content: JSON.stringify(appData)
        }
      }
    };
    
    const url = gistId 
      ? `https://api.github.com/gists/${gistId}`
      : "https://api.github.com/gists";
    
    const response = await fetch(url, {
      method: gistId ? "PATCH" : "POST",
      headers: {
        "Authorization": `token ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) throw new Error("上传失败");
    
    const result = await response.json();
    document.getElementById("gist-id").value = result.id;
    
    // 保存 token 和 gist ID
    localStorage.setItem("github_token", token);
    localStorage.setItem("gist_id", result.id);
    
    statusEl.className = "status-message success";
    statusEl.textContent = `上传成功！Gist ID: ${result.id}`;
  } catch (error) {
    statusEl.className = "status-message error";
    statusEl.textContent = `错误：${error.message}`;
  }
}

async function downloadFromCloud() {
  const token = document.getElementById("github-token").value.trim();
  const gistId = document.getElementById("gist-id").value.trim();
  const statusEl = document.getElementById("cloud-status");
  
  if (!token || !gistId) {
    statusEl.className = "status-message error";
    statusEl.textContent = "请输入 GitHub Token 和 Gist ID";
    return;
  }
  
  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        "Authorization": `token ${token}`
      }
    });
    
    if (!response.ok) throw new Error("下载失败");
    
    const result = await response.json();
    const content = result.files["word-backup.json"].content;
    const importedData = JSON.parse(content);
    
    if (confirm("确定要用云端数据覆盖本地数据吗？")) {
      appData = importedData;
      saveData();
      render();
      checkEmptyState();
      
      statusEl.className = "status-message success";
      statusEl.textContent = "下载并恢复成功！";
    }
  } catch (error) {
    statusEl.className = "status-message error";
    statusEl.textContent = `错误：${error.message}`;
  }
}

// 词典查询功能（使用免费 API）
async function lookupDictionary(word) {
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    if (!response.ok) throw new Error("未找到释义");
    
    const data = await response.json();
    return data[0];
  } catch (error) {
    return null;
  }
}

function showDictionaryPanel(word) {
  const panel = document.getElementById("dictionary-panel");
  const resultEl = document.getElementById("dictionary-result");
  
  resultEl.innerHTML = '<p style="text-align:center;padding:20px;">正在查询...</p>';
  panel.classList.remove("hidden");
  
  lookupDictionary(word).then(entry => {
    if (!entry) {
      resultEl.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-secondary);">未找到词典释义</p>';
      return;
    }
    
    let html = `
      <div class="dictionary-entry">
        <div class="dictionary-word">${entry.word}</div>
        <div class="dictionary-phonetic">${entry.phonetic || entry.phonetics.find(p => p.text)?.text || ''}</div>
    `;
    
    entry.meanings.forEach(meaning => {
      html += `
        <div class="dictionary-definition">
          <strong>${meaning.partOfSpeech}</strong>
          <ul>
            ${meaning.definitions.slice(0, 3).map(def => `<li>${def.definition}</li>`).join('')}
          </ul>
        </div>
      `;
      
      const example = meaning.definitions.find(d => d.example)?.example;
      if (example) {
        html += `<div class="dictionary-example">"${example}"</div>`;
      }
    });
    
    html += '</div>';
    resultEl.innerHTML = html;
  });
}

// PWA Service Worker 注册
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // 创建简单的 service worker 文件
    const swContent = `
      const CACHE_NAME = 'word-app-v1';
      self.addEventListener('install', (e) => {
        e.waitUntil(
          caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(['/', '/index.html', '/styles.css', '/script.js']);
          })
        );
      });
      self.addEventListener('fetch', (e) => {
        e.respondWith(
          caches.match(e.request).then((response) => {
            return response || fetch(e.request);
          })
        );
      });
    `;
    
    // 动态创建 service worker blob
    const blob = new Blob([swContent], {type: 'application/javascript'});
    const swUrl = URL.createObjectURL(blob);
    
    navigator.serviceWorker.register(swUrl)
      .then(() => console.log('Service Worker 已注册'))
      .catch(err => console.error('SW 注册失败:', err));
  });
}

// 初始化新增功能的事件监听
document.addEventListener("DOMContentLoaded", () => {
  // 成就按钮
  const achievementsBtn = document.getElementById("achievements-btn");
  const achievementsPanel = document.getElementById("achievements-panel");
  const closeAchievements = document.getElementById("close-achievements");
  
  if (achievementsBtn) {
    achievementsBtn.addEventListener("click", () => {
      renderAchievements();
      achievementsPanel.classList.remove("hidden");
    });
  }
  
  if (closeAchievements) {
    closeAchievements.addEventListener("click", () => {
      achievementsPanel.classList.add("hidden");
    });
  }
  
  // 云同步按钮
  const cloudSyncBtn = document.getElementById("cloud-sync-btn");
  const cloudPanel = document.getElementById("cloud-panel");
  const closeCloud = document.getElementById("close-cloud");
  const uploadBtn = document.getElementById("upload-to-cloud");
  const downloadBtn = document.getElementById("download-from-cloud");
  const tokenLink = document.getElementById("generate-token-link");
  
  if (cloudSyncBtn) {
    cloudSyncBtn.addEventListener("click", () => {
      // 加载保存的 token 和 gist ID
      const savedToken = localStorage.getItem("github_token");
      const savedGistId = localStorage.getItem("gist_id");
      if (savedToken) document.getElementById("github-token").value = savedToken;
      if (savedGistId) document.getElementById("gist-id").value = savedGistId;
      
      cloudPanel.classList.remove("hidden");
    });
  }
  
  if (closeCloud) {
    closeCloud.addEventListener("click", () => {
      cloudPanel.classList.add("hidden");
      document.getElementById("cloud-status").textContent = "";
    });
  }
  
  if (uploadBtn) {
    uploadBtn.addEventListener("click", uploadToCloud);
  }
  
  if (downloadBtn) {
    downloadBtn.addEventListener("click", downloadFromCloud);
  }
  
  if (tokenLink) {
    tokenLink.addEventListener("click", () => {
      window.open("https://github.com/settings/tokens", "_blank");
      showToast("在新窗口打开 Token 创建页面，请选择 'gist' 权限");
    });
  }
  
  // 设置按钮
  const settingsBtn = document.getElementById("settings-btn");
  const settingsPanel = document.getElementById("settings-panel");
  const closeSettings = document.getElementById("close-settings");
  const saveSettingsBtn = document.getElementById("save-settings");
  const resetAllBtn = document.getElementById("reset-all-btn");
  const importDataBtn = document.getElementById("import-data-btn");
  const intervalModifier = document.getElementById("interval-modifier");
  const intervalDisplay = document.getElementById("interval-modifier-display");
  
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      // 加载当前设置
      document.getElementById("daily-goal").value = appData.settings.dailyGoal || 30;
      settingsPanel.classList.remove("hidden");
    });
  }
  
  if (closeSettings) {
    closeSettings.addEventListener("click", () => {
      settingsPanel.classList.add("hidden");
    });
  }
  
  if (intervalModifier && intervalDisplay) {
    intervalModifier.addEventListener("input", (e) => {
      intervalDisplay.textContent = e.target.value;
    });
  }
  
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener("click", () => {
      appData.settings.dailyGoal = parseInt(document.getElementById("daily-goal").value) || 30;
      appData.settings.intervalModifier = parseFloat(intervalModifier?.value) || 1.0;
      saveData();
      showToast("设置已保存");
      settingsPanel.classList.add("hidden");
    });
  }
  
  if (resetAllBtn) {
    resetAllBtn.addEventListener("click", () => {
      if (confirm("⚠️ 警告：此操作将删除所有单词和学习记录，无法恢复！确定继续吗？")) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      }
    });
  }
  
  if (importDataBtn) {
    importDataBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const imported = JSON.parse(event.target.result);
            if (confirm("确定要导入此备份文件吗？将覆盖当前数据。")) {
              appData = imported;
              saveData();
              render();
              checkEmptyState();
              showToast("数据导入成功");
            }
          } catch (err) {
            showToast("文件格式错误");
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });
  }
  
  // 词典查询 - 在单词卡片上添加双击查词功能
  const wordTextEl = document.getElementById("word-text");
  if (wordTextEl) {
    wordTextEl.addEventListener("dblclick", () => {
      if (currentWord) {
        showDictionaryPanel(currentWord.word);
      }
    });
  }
  
  const closeDictionary = document.getElementById("close-dictionary");
  if (closeDictionary) {
    closeDictionary.addEventListener("click", () => {
      document.getElementById("dictionary-panel").classList.add("hidden");
    });
  }
  
  // 显示连续学习天数徽章
  updateStreakBadge();
});

// 更新连续学习徽章
function updateStreakBadge() {
  const streak = getStreakDays(appData);
  if (streak > 0) {
    let badge = document.querySelector(".streak-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "streak-badge";
      badge.innerHTML = '<i class="fas fa-fire"></i> <span id="streak-count">0</span>天';
      document.querySelector("header").appendChild(badge);
    }
    document.getElementById("streak-count").textContent = streak;
  }
}

// 每次数据保存时检查成就
const originalSaveData = saveData;
saveData = function() {
  originalSaveData();
  // 检查新成就
  const unlockedIds = JSON.parse(localStorage.getItem("unlocked_achievements") || "[]");
  ACHIEVEMENTS.forEach(ach => {
    if (!unlockedIds.includes(ach.id) && ach.condition(appData)) {
      unlockedIds.push(ach.id);
      localStorage.setItem("unlocked_achievements", JSON.stringify(unlockedIds));
      showToast(`🏆 解锁成就：${ach.title}`);
    }
  });
  updateStreakBadge();
};
