const SUBJECT_META = [
  { code: "chinese", label: "语文", max: 150 },
  { code: "math", label: "数学", max: 150 },
  { code: "english", label: "英语", max: 150 },
  { code: "physics", label: "物理", max: 100 },
  { code: "chemistry", label: "化学", max: 100 },
  { code: "biology", label: "生物", max: 100 },
];

const SUBJECT_LABEL = Object.fromEntries(SUBJECT_META.map((s) => [s.code, s.label]));
const SUBJECT_MAX = Object.fromEntries(SUBJECT_META.map((s) => [s.code, s.max]));

async function requestApi(path, options = {}) {
  const init = { ...options };
  init.headers = {
    ...(options.headers || {}),
  };

  if (init.body && !init.headers["Content-Type"]) {
    init.headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${window.APP_CONFIG.apiBase}${path}`, init);
  let data = {};

  try {
    data = await response.json();
  } catch (_err) {
    data = {};
  }

  if (!response.ok) {
    const message = data.error || data.message || `请求失败 (${response.status})`;
    throw new Error(message);
  }

  return data;
}

function showToast(message, type = "info") {
  const host = document.getElementById("toast-host");
  if (!host) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  host.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(8px)";
  }, 2400);

  setTimeout(() => {
    toast.remove();
  }, 2800);
}

function toPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function buildTableRow(student, index, withAction = false) {
  const cells = [
    index + 1,
    student.name,
    student.chinese,
    student.math,
    student.english,
    student.physics,
    student.chemistry,
    student.biology,
    student.total,
  ];

  let html = `<tr>${cells.map((v) => `<td>${v}</td>`).join("")}`;
  if (withAction) {
    html += `<td><button class="btn btn-danger btn-small js-delete" data-id="${student.id}" data-name="${student.name}">删除</button></td>`;
  }
  html += "</tr>";
  return html;
}

function subjectMaxByCode(code) {
  return SUBJECT_MAX[code] || 150;
}