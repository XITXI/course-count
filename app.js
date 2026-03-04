/* 可可教学记录 - 单文件前端（无后端）
 * 功能：
 * 1) 学生首字母/姓名检索；回车给首位匹配学生 +步长课时
 * 2) 学生增删改；卡片内 +/- 快捷增减课时
 * 3) 周收入自动计算；可选日期范围保存为历史记录；历史记录可编辑/删除
 * 4) 学生数据按指定 JSON 格式导入/导出（不覆盖历史收入）
 */

(() => {
  "use strict";

  /** =========================
   *  DOM
   *  ========================= */
  const el = {
    lastUpdated: document.getElementById("lastUpdated"),
    weekIncome: document.getElementById("weekIncome"),
    rangeStart: document.getElementById("rangeStart"),
    rangeEnd: document.getElementById("rangeEnd"),
    btnSaveWeekIncome: document.getElementById("btnSaveWeekIncome"),
    btnFocusHistory: document.getElementById("btnFocusHistory"),

    searchInput: document.getElementById("searchInput"),
    stepInput: document.getElementById("stepInput"),
    btnResetWeek: document.getElementById("btnResetWeek"),

    btnAddStudent: document.getElementById("btnAddStudent"),
    btnOpenExport: document.getElementById("btnOpenExport"),
    btnOpenImport: document.getElementById("btnOpenImport"),

    studentCount: document.getElementById("studentCount"),
    studentSummary: document.getElementById("studentSummary"),
    studentList: document.getElementById("studentList"),

    historyPanel: document.getElementById("historyPanel"),
    historyCount: document.getElementById("historyCount"),
    historyTotal: document.getElementById("historyTotal"),
    historyList: document.getElementById("historyList"),

    // student modal
    studentModal: document.getElementById("studentModal"),
    studentModalTitle: document.getElementById("studentModalTitle"),
    studentForm: document.getElementById("studentForm"),
    formStudentName: document.getElementById("formStudentName"),
    formStudentPrice: document.getElementById("formStudentPrice"),
    formStudentColor: document.getElementById("formStudentColor"),
    formStudentHours: document.getElementById("formStudentHours"),
    btnDeleteStudent: document.getElementById("btnDeleteStudent"),

    // history modal
    historyModal: document.getElementById("historyModal"),
    historyModalTitle: document.getElementById("historyModalTitle"),
    historyForm: document.getElementById("historyForm"),
    formHistoryStart: document.getElementById("formHistoryStart"),
    formHistoryEnd: document.getElementById("formHistoryEnd"),
    formHistoryAmount: document.getElementById("formHistoryAmount"),
    formHistoryNote: document.getElementById("formHistoryNote"),
    btnDeleteHistory: document.getElementById("btnDeleteHistory"),

    // data modal
    dataModal: document.getElementById("dataModal"),
    dataModalTitle: document.getElementById("dataModalTitle"),
    dataTextarea: document.getElementById("dataTextarea"),
    btnImportData: document.getElementById("btnImportData"),
    btnGenerateData: document.getElementById("btnGenerateData"),
    btnCopyData: document.getElementById("btnCopyData"),
    btnDownloadData: document.getElementById("btnDownloadData"),

    toast: document.getElementById("toast"),
  };

  /** =========================
   *  Storage
   *  ========================= */
  const STORAGE_KEY = "keke_teaching_record_v3";

  const DEFAULT_IMPORT = {
    students: [
      {"name":"好好","price":33,"hours":0,"color":"black"},
      {"name":"岑岑","price":60,"hours":0,"color":"pink"},
      {"name":"赵艺然","price":40,"hours":0,"color":"black"},
      {"name":"李芷瑶","price":33,"hours":0,"color":"purple"},
      {"name":"龙婧妍","price":30,"hours":0,"color":"black"},
      {"name":"苏沐梓","price":33,"hours":0,"color":"black"},
      {"name":"邱泓鸣","price":35,"hours":0,"color":"black"},
      {"name":"莫琳筠","price":30,"hours":0,"color":"black"},
      {"name":"芷萱","price":40,"hours":0,"color":"black"},
      {"name":"林乐乐","price":38,"hours":0,"color":"black"},
      {"name":"张熙函","price":49.5,"hours":0,"color":"black"},
      {"name":"周芯卉","price":80,"hours":0,"color":"black"},
      {"name":"凯凯","price":38,"hours":0,"color":"black"},
      {"name":"谭妍希","price":38,"hours":0,"color":"black"},
      {"name":"万彦菲","price":38,"hours":0,"color":"black"},
      {"name":"陈子欣","price":40,"hours":0,"color":"black"},
      {"name":"唐烨","price":40,"hours":0,"color":"black"},
      {"name":"须堡堡","price":38,"hours":0,"color":"black"},
      {"name":"周雷煜","price":40,"hours":0,"color":"black"},
      {"name":"沈慧妍","price":40,"hours":0,"color":"black"},
      {"name":"陈红朵","price":35,"hours":0,"color":"black"},
      {"name":"李紫涵","price":40,"hours":0,"color":"black"},
      {"name":"杨娃娃","price":40,"hours":0,"color":"black"},
      {"name":"刘博睿","price":40,"hours":0,"color":"black"},
      {"name":"廖文睿","price":38,"hours":0,"color":"black"}
    ],
    exportTime: 1770180182636
  };

  /** =========================
   *  State
   *  ========================= */
  const state = {
    students: /** @type {Array<Student>} */ ([]),
    history: /** @type {Array<HistoryRecord>} */ ([]),
    settings: {
      step: 1,
      rangeStart: "",
      rangeEnd: "",
    },
    lastUpdated: 0,
    // modal editing targets
    editingStudentId: null,
    editingHistoryId: null,
  };

  /**
   * @typedef {{
   *  id: string;
   *  name: string;
   *  price: number;
   *  hours: number;
   *  color?: string;
   *  initials: string; // computed
   *  searchKey: string; // computed
   * }} Student
   */

  /**
   * @typedef {{
   *  id: string;
   *  start: string; // yyyy-mm-dd
   *  end: string;   // yyyy-mm-dd
   *  amount: number;
   *  note?: string;
   *  createdAt: number;
   * }} HistoryRecord
   */

  /** =========================
   *  Utils
   *  ========================= */
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const now = () => Date.now();

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  }

  function safeNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function roundToQuarter(n) {
    // 0.25 step rounding
    return Math.round(n * 4) / 4;
  }

  function formatMoney(n) {
    const v = safeNumber(n, 0);
    return `${v.toFixed(2)}元`;
  }

  function formatDateHuman(iso) {
    if (!iso) return "--";
    const [y, m, d] = iso.split("-");
    return `${y}.${m}.${d}`;
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const pad = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function isISODate(s) {
    return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  function compareISO(a, b) {
    // lexicographic works for ISO date
    return a.localeCompare(b);
  }

  function withinRange(dateIso, startIso, endIso) {
    if (!isISODate(dateIso) || !isISODate(startIso) || !isISODate(endIso)) return false;
    return compareISO(dateIso, startIso) >= 0 && compareISO(dateIso, endIso) <= 0;
  }

  /** Toast */
  let toastTimer = null;
  function toast(message, type = "ok") {
    if (!message) return;
    el.toast.textContent = message;
    el.toast.classList.toggle("error", type === "error");
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove("show");
    }, 2200);
  }

  /** =========================
   *  Chinese initials (GB2312 range mapping - common approach)
   *  说明：用于“首字母检索”足够好用；并非 100% 完整拼音库
   *  ========================= */
  const LETTER_BOUNDARIES = [
    { l: "a", v: -20319 },
    { l: "b", v: -20283 },
    { l: "c", v: -19775 },
    { l: "d", v: -19218 },
    { l: "e", v: -18710 },
    { l: "f", v: -18526 },
    { l: "g", v: -18239 },
    { l: "h", v: -17922 },
    { l: "j", v: -17417 },
    { l: "k", v: -16474 },
    { l: "l", v: -16212 },
    { l: "m", v: -15640 },
    { l: "n", v: -15165 },
    { l: "o", v: -14922 },
    { l: "p", v: -14914 },
    { l: "q", v: -14630 },
    { l: "r", v: -14149 },
    { l: "s", v: -14090 },
    { l: "t", v: -13318 },
    { l: "w", v: -12838 },
    { l: "x", v: -12556 },
    { l: "y", v: -11847 },
    { l: "z", v: -11055 },
  ];

  // Heuristic method: use a well-known mapping by comparing char to boundary chars.
  // To keep it simple and robust without external libs, we use a "pinyin first letter" algorithm
  // based on the Unicode code point ranges that roughly match GB2312 order via boundary chars.
  // This approach is commonly used in address book apps.
  const boundaryChars = "啊芭擦搭蛾发噶哈机喀垃妈拿哦啪期然撒塌挖昔压匝";
  const boundaryLetters = "abcdefghjklmnopqrstwxyz";

  function firstLetterOfChineseChar(ch) {
    if (!ch) return "";
    // ASCII
    if (/^[a-z0-9]$/i.test(ch)) return ch.toLowerCase();
    // CJK
    if (!/[\u4e00-\u9fff]/.test(ch)) return "";
    // Compare with boundary chars by localeCompare (pinyin-like collation in many environments)
    for (let i = 0; i < boundaryChars.length - 1; i++) {
      const b1 = boundaryChars[i];
      const b2 = boundaryChars[i + 1];
      if (ch.localeCompare(b1, "zh-CN") >= 0 && ch.localeCompare(b2, "zh-CN") < 0) {
        return boundaryLetters[i];
      }
    }
    return "z"; // chars >= last boundary char map to "z"
  }

  function initialsOfName(name) {
    const s = (name || "").trim();
    if (!s) return "";
    // Split by spaces for english names
    const parts = s.split(/\s+/).filter(Boolean);
    const letters = [];
    if (parts.length > 1) {
      for (const p of parts) letters.push((p[0] || "").toLowerCase());
      return letters.join("");
    }
    for (const ch of s) {
      const l = firstLetterOfChineseChar(ch);
      if (l) letters.push(l);
    }
    return letters.join("");
  }

  /** =========================
   *  Data normalize
   *  ========================= */
  function normalizeStudent(raw) {
    const name = String(raw?.name ?? "").trim();
    const price = safeNumber(raw?.price, 0);
    const hours = roundToQuarter(clamp(safeNumber(raw?.hours, 0), 0, 9999));
    const color = String(raw?.color ?? "black").trim() || "black";
    const id = String(raw?.id ?? "") || uuid();
    const initials = initialsOfName(name);
    const searchKey = `${name.toLowerCase()}|${initials.toLowerCase()}`;
    return /** @type {Student} */ ({
      id,
      name,
      price,
      hours,
      color,
      initials,
      searchKey,
    });
  }

  function normalizeHistory(raw) {
    const id = String(raw?.id ?? "") || uuid();
    const start = isISODate(raw?.start) ? raw.start : "";
    const end = isISODate(raw?.end) ? raw.end : "";
    const amount = safeNumber(raw?.amount, 0);
    const note = String(raw?.note ?? "").trim();
    const createdAt = safeNumber(raw?.createdAt, now());
    return /** @type {HistoryRecord} */ ({ id, start, end, amount, note, createdAt });
  }

  function toStudentExportPayload() {
    return {
      students: state.students.map(s => ({
        name: s.name,
        price: s.price,
        hours: s.hours,
        color: s.color || "black",
      })),
      exportTime: now(),
    };
  }

  /** =========================
   *  Persistence
   *  ========================= */
  function saveStorage() {
    const payload = {
      version: 3,
      students: state.students,
      history: state.history,
      settings: state.settings,
      lastUpdated: state.lastUpdated,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function loadStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    try {
      const obj = JSON.parse(raw);
      const students = Array.isArray(obj?.students) ? obj.students.map(normalizeStudent) : null;
      if (!students) return false;

      state.students = students;
      state.history = Array.isArray(obj?.history) ? obj.history.map(normalizeHistory) : [];
      state.settings.step = safeNumber(obj?.settings?.step, 1) || 1;
      state.settings.rangeStart = isISODate(obj?.settings?.rangeStart) ? obj.settings.rangeStart : "";
      state.settings.rangeEnd = isISODate(obj?.settings?.rangeEnd) ? obj.settings.rangeEnd : "";
      state.lastUpdated = safeNumber(obj?.lastUpdated, 0);
      return true;
    } catch {
      return false;
    }
  }

  function seedDefault() {
    state.students = DEFAULT_IMPORT.students.map(normalizeStudent);
    state.history = [];
    state.settings.step = 1;
    state.lastUpdated = now();
    const { start, end } = getThisWeekRange();
    state.settings.rangeStart = start;
    state.settings.rangeEnd = end;
    saveStorage();
  }

  /** =========================
   *  Week range defaults
   *  ========================= */
  function toISODate(d) {
    const pad = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function getThisWeekRange() {
    // Week starts Monday
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0 Sun .. 6 Sat
    const diffToMon = (day === 0 ? -6 : 1 - day);
    const start = new Date(d);
    start.setDate(d.getDate() + diffToMon);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: toISODate(start), end: toISODate(end) };
  }

  /** =========================
   *  Compute
   *  ========================= */
  function computeWeekIncome() {
    return state.students.reduce((sum, s) => sum + safeNumber(s.hours, 0) * safeNumber(s.price, 0), 0);
  }

  function computeStudentIncome(s) {
    return safeNumber(s.hours, 0) * safeNumber(s.price, 0);
  }

  /** =========================
   *  Render
   *  ========================= */
  function renderHeader() {
    el.lastUpdated.textContent = state.lastUpdated ? `上次更新：${formatTime(state.lastUpdated)}` : "上次更新：--";
  }

  function renderIncome() {
    el.weekIncome.textContent = formatMoney(computeWeekIncome());
  }

  function renderStudents() {
    const q = (el.searchInput.value || "").trim().toLowerCase();
    const step = safeNumber(el.stepInput.value, state.settings.step || 1) || 1;

    // Sort: hours desc then initials then name
    const list = [...state.students].sort((a, b) => {
      const ha = safeNumber(a.hours, 0);
      const hb = safeNumber(b.hours, 0);
      if (hb !== ha) return hb - ha;
      const ia = (a.initials || "").localeCompare(b.initials || "");
      if (ia !== 0) return ia;
      return (a.name || "").localeCompare(b.name || "", "zh-CN");
    });

    const filtered = q
      ? list.filter(s => s.searchKey.includes(q))
      : list;

    el.studentCount.textContent = String(filtered.length);

    const totalPeople = state.students.length;
    const activePeople = state.students.filter(s => safeNumber(s.hours, 0) > 0).length;
    const hoursTotal = state.students.reduce((sum, s) => sum + safeNumber(s.hours, 0), 0);

    el.studentSummary.textContent = `共 ${totalPeople} 人 · 本周有课 ${activePeople} 人 · 课时合计 ${roundToQuarter(hoursTotal)}`;

    el.studentList.innerHTML = "";
    if (filtered.length === 0) {
      const div = document.createElement("div");
      div.className = "empty";
      div.textContent = "没有匹配的学生。你可以修改检索词，或点击“添加学生”。";
      el.studentList.appendChild(div);
      return;
    }

    for (const s of filtered) {
      el.studentList.appendChild(renderStudentCard(s, step));
    }
  }

  function renderStudentCard(s, step) {
    const card = document.createElement("div");
    card.className = "student-card";

    const dotColor = normalizeColor(s.color);

    card.innerHTML = `
      <div class="student-head">
        <div class="name-row">
          <span class="price-dot" style="background:${escapeHtml(dotColor)}" title="${escapeAttr(s.initials || "")}"></span>
          <div style="min-width:0">
            <h3 title="${escapeAttr(s.name)}">${escapeHtml(s.name)}</h3>
            <div class="price">单价：${escapeHtml(String(s.price))} 元/课时</div>
          </div>
        </div>
        <button class="icon-edit" type="button" title="编辑">✎</button>
      </div>

      <div class="hours-row">
        <div class="hours-label">课时</div>
        <div class="hours-box">
          <button class="round minus" type="button" aria-label="减少">−</button>
          <div class="hours-value">${escapeHtml(String(s.hours))}</div>
          <button class="round plus" type="button" aria-label="增加">+</button>
        </div>
      </div>

      <div class="student-foot">
        <span>收入</span>
        <span class="tag">${escapeHtml(formatMoney(computeStudentIncome(s)).replace("元",""))}</span>
      </div>
    `;

    const btnEdit = card.querySelector(".icon-edit");
    const btnMinus = card.querySelector(".minus");
    const btnPlus = card.querySelector(".plus");

    btnEdit.addEventListener("click", () => openStudentModal("edit", s.id));
    btnMinus.addEventListener("click", () => adjustStudentHours(s.id, -step));
    btnPlus.addEventListener("click", () => adjustStudentHours(s.id, +step));

    // Mobile convenience: tap on hours value => +step
    const hoursValue = card.querySelector(".hours-value");
    hoursValue.addEventListener("click", () => adjustStudentHours(s.id, +step));

    return card;
  }

  function renderHistory() {
    const list = [...state.history].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    el.historyCount.textContent = String(list.length);

    const total = list.reduce((sum, r) => sum + safeNumber(r.amount, 0), 0);
    el.historyTotal.textContent = `累计 ${formatMoney(total)}`;

    el.historyList.innerHTML = "";
    if (list.length === 0) {
      const div = document.createElement("div");
      div.className = "empty";
      div.textContent = "还没有历史收入记录。你可以先在上方选择日期范围，再点击“保存本周收入”。";
      el.historyList.appendChild(div);
      return;
    }

    for (const r of list) {
      const item = document.createElement("div");
      item.className = "history-item";
      item.innerHTML = `
        <div class="history-top">
          <div class="history-range">${escapeHtml(formatDateHuman(r.start))} - ${escapeHtml(formatDateHuman(r.end))}</div>
          <div class="history-amount">${escapeHtml(formatMoney(r.amount))}</div>
        </div>
        <div class="history-note">${escapeHtml(r.note || "—")}</div>
        <div class="history-actions">
          <button class="action-btn btn-soft" type="button">编辑</button>
          <button class="action-btn btn-danger" type="button">删除</button>
        </div>
      `;

      const btnEdit = item.querySelector(".btn-soft");
      const btnDel = item.querySelector(".btn-danger");
      btnEdit.addEventListener("click", () => openHistoryModal("edit", r.id));
      btnDel.addEventListener("click", () => {
        if (!confirm("确定删除这条历史收入记录吗？")) return;
        deleteHistory(r.id);
      });

      el.historyList.appendChild(item);
    }
  }

  function renderAll() {
    renderHeader();
    renderIncome();
    renderStudents();
    renderHistory();
  }

  /** =========================
   *  Actions - students
   *  ========================= */
  function adjustStudentHours(studentId, delta) {
    const s = state.students.find(x => x.id === studentId);
    if (!s) return;

    const next = roundToQuarter(clamp(safeNumber(s.hours, 0) + delta, 0, 9999));
    s.hours = next;

    state.lastUpdated = now();
    saveStorage();
    renderIncome();
    renderStudents(); // re-render for sorting and hours update
    renderHeader();
  }

  function openStudentModal(mode, studentId) {
    state.editingStudentId = mode === "edit" ? studentId : null;

    if (mode === "add") {
      el.studentModalTitle.textContent = "添加学生";
      el.formStudentName.value = "";
      el.formStudentPrice.value = "";
      el.formStudentColor.value = "black";
      el.formStudentHours.value = "0";
      el.btnDeleteStudent.style.visibility = "hidden";
      openModal("studentModal");
      setTimeout(() => el.formStudentName.focus(), 0);
      return;
    }

    const s = state.students.find(x => x.id === studentId);
    if (!s) return;

    el.studentModalTitle.textContent = "编辑学生";
    el.formStudentName.value = s.name || "";
    el.formStudentPrice.value = String(s.price ?? "");
    el.formStudentColor.value = s.color || "black";
    el.formStudentHours.value = String(s.hours ?? 0);
    el.btnDeleteStudent.style.visibility = "visible";
    openModal("studentModal");
    setTimeout(() => el.formStudentName.focus(), 0);
  }

  function upsertStudentFromForm() {
    const name = String(el.formStudentName.value || "").trim();
    const price = safeNumber(el.formStudentPrice.value, NaN);
    const color = String(el.formStudentColor.value || "black").trim() || "black";
    const hours = roundToQuarter(clamp(safeNumber(el.formStudentHours.value, 0), 0, 9999));

    if (!name) {
      toast("学生姓名不能为空", "error");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast("请输入正确的课时单价", "error");
      return;
    }

    // unique name check
    const sameName = state.students.find(s => s.name === name && s.id !== state.editingStudentId);
    if (sameName) {
      if (!confirm(`已存在同名学生「${name}」。确定仍要保存吗？（建议改名区分）`)) return;
    }

    if (state.editingStudentId) {
      const idx = state.students.findIndex(s => s.id === state.editingStudentId);
      if (idx < 0) return;

      const old = state.students[idx];
      state.students[idx] = normalizeStudent({ ...old, name, price, hours, color, id: old.id });
      state.lastUpdated = now();
      saveStorage();
      closeModal("studentModal");
      toast("已保存学生信息");
      renderAll();
      return;
    }

    state.students.push(normalizeStudent({ name, price, hours, color }));
    state.lastUpdated = now();
    saveStorage();
    closeModal("studentModal");
    toast("已添加学生");
    renderAll();
  }

  function deleteStudent(studentId) {
    const idx = state.students.findIndex(s => s.id === studentId);
    if (idx < 0) return;
    const target = state.students[idx];
    if (!confirm(`确定删除学生「${target.name}」吗？（该学生本周课时会一并删除）`)) return;

    state.students.splice(idx, 1);
    state.lastUpdated = now();
    saveStorage();
    closeModal("studentModal");
    toast("已删除学生");
    renderAll();
  }

  /** =========================
   *  Actions - history
   *  ========================= */
  function openHistoryModal(mode, historyId) {
    state.editingHistoryId = mode === "edit" ? historyId : null;

    if (mode === "add") {
      el.historyModalTitle.textContent = "新增历史收入";
      el.formHistoryStart.value = el.rangeStart.value || "";
      el.formHistoryEnd.value = el.rangeEnd.value || "";
      el.formHistoryAmount.value = String(computeWeekIncome().toFixed(2));
      el.formHistoryNote.value = "手动新增";
      el.btnDeleteHistory.style.visibility = "hidden";
      openModal("historyModal");
      setTimeout(() => el.formHistoryStart.focus(), 0);
      return;
    }

    const r = state.history.find(x => x.id === historyId);
    if (!r) return;

    el.historyModalTitle.textContent = "编辑历史收入";
    el.formHistoryStart.value = r.start || "";
    el.formHistoryEnd.value = r.end || "";
    el.formHistoryAmount.value = String(safeNumber(r.amount, 0).toFixed(2));
    el.formHistoryNote.value = r.note || "";
    el.btnDeleteHistory.style.visibility = "visible";
    openModal("historyModal");
    setTimeout(() => el.formHistoryStart.focus(), 0);
  }

  function saveWeekIncomeAsHistory() {
    const start = el.rangeStart.value;
    const end = el.rangeEnd.value;

    if (!isISODate(start) || !isISODate(end)) {
      toast("请先选择开始/结束日期", "error");
      return;
    }
    if (compareISO(start, end) > 0) {
      toast("开始日期不能晚于结束日期", "error");
      return;
    }

    const amount = computeWeekIncome();
    const record = normalizeHistory({
      start,
      end,
      amount: Number(amount.toFixed(2)),
      note: "自动保存（可编辑）",
      createdAt: now(),
    });

    state.history.push(record);
    state.lastUpdated = now();
    saveStorage();
    toast("已保存到历史收入");
    renderAll();
  }

  function upsertHistoryFromForm() {
    const start = el.formHistoryStart.value;
    const end = el.formHistoryEnd.value;
    const amount = safeNumber(el.formHistoryAmount.value, NaN);
    const note = String(el.formHistoryNote.value || "").trim();

    if (!isISODate(start) || !isISODate(end)) {
      toast("日期格式不正确", "error");
      return;
    }
    if (compareISO(start, end) > 0) {
      toast("开始日期不能晚于结束日期", "error");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      toast("请输入正确的收入金额", "error");
      return;
    }

    if (state.editingHistoryId) {
      const idx = state.history.findIndex(r => r.id === state.editingHistoryId);
      if (idx < 0) return;
      const old = state.history[idx];
      state.history[idx] = normalizeHistory({ ...old, start, end, amount: Number(amount.toFixed(2)), note, id: old.id });
      state.lastUpdated = now();
      saveStorage();
      closeModal("historyModal");
      toast("已保存历史记录");
      renderAll();
      return;
    }

    state.history.push(normalizeHistory({ start, end, amount: Number(amount.toFixed(2)), note, createdAt: now() }));
    state.lastUpdated = now();
    saveStorage();
    closeModal("historyModal");
    toast("已新增历史记录");
    renderAll();
  }

  function deleteHistory(historyId) {
    const idx = state.history.findIndex(r => r.id === historyId);
    if (idx < 0) return;
    state.history.splice(idx, 1);
    state.lastUpdated = now();
    saveStorage();
    toast("已删除历史记录");
    renderAll();
  }

  /** =========================
   *  Import / Export
   *  ========================= */
  let dataMode = "export"; // export | import
  function openDataModal(mode) {
    dataMode = mode;
    if (mode === "export") {
      el.dataModalTitle.textContent = "导出学生数据";
      el.dataTextarea.value = JSON.stringify(toStudentExportPayload(), null, 2);
      openModal("dataModal");
      setTimeout(() => {
        el.dataTextarea.focus();
        el.dataTextarea.select();
      }, 0);
    } else {
      el.dataModalTitle.textContent = "导入学生数据（覆盖学生列表）";
      el.dataTextarea.value = "";
      openModal("dataModal");
      setTimeout(() => el.dataTextarea.focus(), 0);
    }
  }

  function doImportStudents() {
    const text = String(el.dataTextarea.value || "").trim();
    if (!text) {
      toast("请粘贴 JSON 后再导入", "error");
      return;
    }

    let obj;
    try {
      obj = JSON.parse(text);
    } catch {
      toast("JSON 解析失败，请检查格式", "error");
      return;
    }

    if (!obj || !Array.isArray(obj.students)) {
      toast("格式不正确：需要 {students:[...], exportTime:?}", "error");
      return;
    }

    const students = obj.students.map(normalizeStudent).filter(s => s.name);
    if (students.length === 0) {
      toast("导入失败：没有有效学生数据", "error");
      return;
    }

    if (!confirm(`将覆盖当前学生列表（${state.students.length} 人 → ${students.length} 人）。继续吗？`)) return;

    state.students = students;
    state.lastUpdated = now();

    // 保留历史收入（符合需求：导入导出仅针对学生）
    saveStorage();
    closeModal("dataModal");
    toast("已导入学生数据");
    renderAll();
  }

  function doGenerateExport() {
    el.dataTextarea.value = JSON.stringify(toStudentExportPayload(), null, 2);
    toast("已生成导出 JSON");
    setTimeout(() => {
      el.dataTextarea.focus();
      el.dataTextarea.select();
    }, 0);
  }

  async function doCopyExport() {
    const text = String(el.dataTextarea.value || "");
    if (!text.trim()) {
      toast("没有可复制的内容", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast("已复制到剪贴板");
    } catch {
      // fallback
      el.dataTextarea.focus();
      el.dataTextarea.select();
      toast("无法直接写入剪贴板：已帮你选中内容，可手动复制");
    }
  }

  function doDownloadExport() {
    const text = String(el.dataTextarea.value || "");
    if (!text.trim()) {
      toast("没有可下载的内容", "error");
      return;
    }
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `students-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("已下载 JSON");
  }

  /** =========================
   *  Search shortcut
   *  ========================= */
  function quickAddFirstMatch() {
    const q = (el.searchInput.value || "").trim().toLowerCase();
    if (!q) return;

    const step = safeNumber(el.stepInput.value, state.settings.step || 1) || 1;
    const list = state.students
      .filter(s => s.searchKey.includes(q))
      .sort((a, b) => {
        // prefer exact name match first
        const ea = a.name.toLowerCase() === q ? 1 : 0;
        const eb = b.name.toLowerCase() === q ? 1 : 0;
        if (eb !== ea) return eb - ea;
        return (a.name || "").localeCompare(b.name || "", "zh-CN");
      });

    if (list.length === 0) {
      toast("没有匹配学生", "error");
      return;
    }

    adjustStudentHours(list[0].id, +step);
    toast(`+${step} 课时：${list[0].name}`);
  }

  /** =========================
   *  Reset week
   *  ========================= */
  function resetWeekHours() {
    const totalHours = state.students.reduce((sum, s) => sum + safeNumber(s.hours, 0), 0);
    if (totalHours <= 0) {
      toast("本周课时已是 0");
      return;
    }
    if (!confirm("确定将所有学生本周课时重置为 0 吗？")) return;

    for (const s of state.students) s.hours = 0;
    state.lastUpdated = now();
    saveStorage();
    toast("已重置本周课时");
    renderAll();
  }

  /** =========================
   *  Modals
   *  ========================= */
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove("hidden");
    m.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add("hidden");
    m.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function bindModalClose() {
    document.querySelectorAll("[data-close]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const target = /** @type {HTMLElement} */ (e.currentTarget).getAttribute("data-close");
        if (target) closeModal(target);
      });
    });

    // click backdrop to close
    [el.studentModal, el.historyModal, el.dataModal].forEach(m => {
      m.addEventListener("click", (e) => {
        if (e.target === m) closeModal(m.id);
      });
    });

    // esc to close
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!el.studentModal.classList.contains("hidden")) closeModal("studentModal");
      if (!el.historyModal.classList.contains("hidden")) closeModal("historyModal");
      if (!el.dataModal.classList.contains("hidden")) closeModal("dataModal");
    });
  }

  /** =========================
   *  Security helpers (basic)
   *  ========================= */
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
  function escapeAttr(str) {
    return escapeHtml(str).replaceAll("\n", " ");
  }

  function normalizeColor(color) {
    const c = String(color || "").trim().toLowerCase();
    if (!c) return "black";
    if (c === "black") return "#1f2b3c";
    if (c === "pink") return "#f47696";
    if (c === "purple") return "#7c5cff";
    if (c === "green") return "#56b240";
    // hex or css color
    return c;
  }

  /** =========================
   *  Bind events
   *  ========================= */
  function bindEvents() {
    // search
    el.searchInput.addEventListener("input", () => renderStudents());
    el.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        quickAddFirstMatch();
      }
    });

    // step
    el.stepInput.addEventListener("change", () => {
      const v = clamp(safeNumber(el.stepInput.value, 1), 0.25, 99);
      state.settings.step = v;
      el.stepInput.value = String(v);
      saveStorage();
      renderStudents();
    });

    // date range
    const onRangeChange = () => {
      state.settings.rangeStart = el.rangeStart.value || "";
      state.settings.rangeEnd = el.rangeEnd.value || "";
      saveStorage();
    };
    el.rangeStart.addEventListener("change", onRangeChange);
    el.rangeEnd.addEventListener("change", onRangeChange);

    // top buttons
    el.btnAddStudent.addEventListener("click", () => openStudentModal("add"));
    el.btnOpenExport.addEventListener("click", () => openDataModal("export"));
    el.btnOpenImport.addEventListener("click", () => openDataModal("import"));

    // weekly actions
    el.btnResetWeek.addEventListener("click", resetWeekHours);
    el.btnSaveWeekIncome.addEventListener("click", saveWeekIncomeAsHistory);
    el.btnFocusHistory.addEventListener("click", () => {
      el.historyPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      toast("已定位到历史收入");
    });

    // student form
    el.studentForm.addEventListener("submit", (e) => {
      e.preventDefault();
      upsertStudentFromForm();
    });
    el.btnDeleteStudent.addEventListener("click", () => {
      if (!state.editingStudentId) return;
      deleteStudent(state.editingStudentId);
    });

    // history form
    el.historyForm.addEventListener("submit", (e) => {
      e.preventDefault();
      upsertHistoryFromForm();
    });
    el.btnDeleteHistory.addEventListener("click", () => {
      if (!state.editingHistoryId) return;
      if (!confirm("确定删除这条历史收入记录吗？")) return;
      deleteHistory(state.editingHistoryId);
      closeModal("historyModal");
    });

    // data modal actions
    el.btnImportData.addEventListener("click", doImportStudents);
    el.btnGenerateData.addEventListener("click", doGenerateExport);
    el.btnCopyData.addEventListener("click", doCopyExport);
    el.btnDownloadData.addEventListener("click", doDownloadExport);

    bindModalClose();
  }

  /** =========================
   *  Init
   *  ========================= */
  function init() {
    const ok = loadStorage();
    if (!ok) seedDefault();

    // ensure range defaults exist
    if (!state.settings.rangeStart || !state.settings.rangeEnd) {
      const { start, end } = getThisWeekRange();
      state.settings.rangeStart = start;
      state.settings.rangeEnd = end;
    }

    el.stepInput.value = String(state.settings.step || 1);
    el.rangeStart.value = state.settings.rangeStart;
    el.rangeEnd.value = state.settings.rangeEnd;

    bindEvents();
    renderAll();

    // focus search on desktop for speed
    setTimeout(() => {
      if (window.innerWidth >= 900) el.searchInput.focus();
    }, 80);
  }

  init();
})();