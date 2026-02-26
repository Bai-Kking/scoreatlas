let allStudents = [];

async function loadManageData() {
  try {
    const res = await requestApi("/api/students");
    allStudents = res.students || [];
    renderManageTable(allStudents);
    hydrateStudentSelects(allStudents);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function renderManageTable(students) {
  const body = document.getElementById("manage-table-body");
  const countTag = document.getElementById("manage-count");

  if (!students.length) {
    body.innerHTML = '<tr><td class="empty-row" colspan="10">暂无数据</td></tr>';
    countTag.textContent = "0 条";
    return;
  }

  body.innerHTML = students.map((s, idx) => buildTableRow(s, idx, true)).join("");
  countTag.textContent = `${students.length} 条`;
}

function hydrateStudentSelects(students) {
  const updateSelect = document.getElementById("update-student");
  const deleteSelect = document.getElementById("delete-student");

  const options = students
    .map((s) => `<option value="${s.id}">${s.name}（总分 ${s.total}）</option>`)
    .join("");

  updateSelect.innerHTML = options;
  deleteSelect.innerHTML = options;
}

async function handleAdd(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);

  const payload = {
    name: String(fd.get("name") || "").trim(),
  };

  for (const meta of SUBJECT_META) {
    payload[meta.code] = safeNumber(fd.get(meta.code), 0);
  }

  try {
    await requestApi("/api/students", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    showToast("新增成功", "success");
    form.reset();
    loadManageData();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handlePatch(event) {
  event.preventDefault();
  const studentId = Number(document.getElementById("update-student").value);
  const subject = document.getElementById("update-subject").value;
  const score = safeNumber(document.getElementById("update-score").value, -1);

  if (!studentId) {
    showToast("请选择学生", "error");
    return;
  }

  if (score < 0 || score > subjectMaxByCode(subject)) {
    showToast(`成绩范围应为 0-${subjectMaxByCode(subject)}`, "error");
    return;
  }

  try {
    await requestApi(`/api/students/${studentId}/subject`, {
      method: "PATCH",
      body: JSON.stringify({ subject, score }),
    });
    showToast("修改成功", "success");
    loadManageData();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleDelete(event) {
  event.preventDefault();
  const studentId = Number(document.getElementById("delete-student").value);
  const confirmed = document.getElementById("delete-confirm").checked;

  if (!studentId) {
    showToast("请选择学生", "error");
    return;
  }

  if (!confirmed) {
    showToast("请先勾选删除确认", "error");
    return;
  }

  try {
    await requestApi(`/api/students/${studentId}`, { method: "DELETE" });
    showToast("删除成功", "success");
    document.getElementById("delete-confirm").checked = false;
    loadManageData();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleSeed() {
  const count = safeNumber(document.getElementById("seed-count").value, 40);
  if (count < 10 || count > 120) {
    showToast("样本数量应在 10-120", "error");
    return;
  }

  if (!confirm(`将清空当前数据并随机生成 ${count} 名学生，确认继续？`)) {
    return;
  }

  try {
    const res = await requestApi("/api/seed", {
      method: "POST",
      body: JSON.stringify({ count }),
    });
    showToast(res.message || "重置成功", "success");
    loadManageData();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleImport() {
  const input = document.getElementById("import-file");
  if (!input.files || !input.files.length) {
    showToast("请先选择 JSON 文件", "error");
    return;
  }

  const file = input.files[0];
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    let students = [];
    if (Array.isArray(parsed)) {
      students = parsed;
    } else if (Array.isArray(parsed.students)) {
      students = parsed.students;
    } else {
      throw new Error("JSON 格式错误，应为数组或包含 students 数组");
    }

    await requestApi("/api/import/json", {
      method: "POST",
      body: JSON.stringify({ replace: true, students }),
    });

    showToast(`导入成功，共 ${students.length} 条`, "success");
    input.value = "";
    loadManageData();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function bindManageEvents() {
  document.getElementById("add-form").addEventListener("submit", handleAdd);
  document.getElementById("update-form").addEventListener("submit", handlePatch);
  document.getElementById("delete-form").addEventListener("submit", handleDelete);

  document.getElementById("seed-btn").addEventListener("click", handleSeed);
  document.getElementById("import-btn").addEventListener("click", handleImport);

  document.getElementById("manage-table-body").addEventListener("click", async (event) => {
    const btn = event.target.closest(".js-delete");
    if (!btn) return;

    const id = Number(btn.dataset.id);
    const name = btn.dataset.name || "该学生";
    if (!confirm(`确认删除 ${name}？`)) return;

    try {
      await requestApi(`/api/students/${id}`, { method: "DELETE" });
      showToast("删除成功", "success");
      loadManageData();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  document.getElementById("update-subject").addEventListener("change", (event) => {
    const subject = event.target.value;
    const scoreInput = document.getElementById("update-score");
    scoreInput.max = String(subjectMaxByCode(subject));
    if (safeNumber(scoreInput.value, 0) > subjectMaxByCode(subject)) {
      scoreInput.value = String(subjectMaxByCode(subject));
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindManageEvents();
  loadManageData();
});