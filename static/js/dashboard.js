let histogramChart;
let segmentChart;
let subjectAvgChart;

async function loadDashboard() {
  const keyword = document.getElementById("keyword").value.trim();
  const minTotal = safeNumber(document.getElementById("min-total").value, 0);
  const maxTotal = safeNumber(document.getElementById("max-total").value, 750);

  const params = new URLSearchParams({
    keyword,
    min_total: String(Math.max(0, Math.min(minTotal, 750))),
    max_total: String(Math.max(0, Math.min(maxTotal, 750))),
  });

  try {
    const [studentRes, stats] = await Promise.all([
      requestApi(`/api/students?${params.toString()}`),
      requestApi(`/api/stats?${params.toString()}`),
    ]);

    const students = studentRes.students || [];
    renderMetrics(stats);
    renderScoreTable(students);
    renderHistogram(stats.histogram || []);
    renderSegments(stats.segments || []);
    renderSubjectAverages(stats.subjectAverages || []);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function renderMetrics(stats) {
  document.getElementById("metric-count").textContent = stats.count ?? 0;
  document.getElementById("metric-avg").textContent = Number(stats.avgTotal || 0).toFixed(1);
  document.getElementById("metric-max").textContent = stats.maxTotal ?? 0;
  document.getElementById("metric-excellent").textContent = toPercent(stats.excellentRate || 0);
  document.getElementById("metric-qualified").textContent = toPercent(stats.qualifiedRate || 0);
}

function renderScoreTable(students) {
  const body = document.getElementById("score-table-body");
  const countTag = document.getElementById("table-count");
  if (!students.length) {
    body.innerHTML = '<tr><td class="empty-row" colspan="9">没有匹配数据</td></tr>';
    countTag.textContent = "0 条";
    return;
  }

  body.innerHTML = students.map((s, idx) => buildTableRow(s, idx, false)).join("");
  countTag.textContent = `${students.length} 条`;
}

function renderHistogram(histogram) {
  const dom = document.getElementById("histogram-chart");
  histogramChart = histogramChart || echarts.init(dom);

  histogramChart.setOption({
    grid: { left: 46, right: 20, top: 30, bottom: 42 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: histogram.map((h) => h.label),
      axisLabel: { color: "#3f5f83", rotate: 35 },
      axisLine: { lineStyle: { color: "#aac1de" } },
    },
    yAxis: {
      type: "value",
      name: "人数",
      axisLabel: { color: "#3f5f83" },
      splitLine: { lineStyle: { color: "#e8f0fb" } },
    },
    series: [
      {
        type: "bar",
        data: histogram.map((h) => h.count),
        barWidth: "68%",
        itemStyle: {
          borderRadius: [5, 5, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#2f86d2" },
            { offset: 1, color: "#71b1e7" },
          ]),
        },
      },
    ],
  });
}

function renderSegments(segments) {
  const dom = document.getElementById("segment-chart");
  segmentChart = segmentChart || echarts.init(dom);

  segmentChart.setOption({
    tooltip: { trigger: "item" },
    legend: { bottom: 0, textStyle: { color: "#3f5f83" } },
    series: [
      {
        type: "pie",
        radius: ["34%", "68%"],
        center: ["50%", "46%"],
        itemStyle: { borderColor: "#fff", borderWidth: 2 },
        label: { color: "#2f4f74" },
        data: segments.map((s) => ({ name: s.label, value: s.count })),
      },
    ],
    color: ["#f09f3f", "#59c0bf", "#3f8bcf", "#2c67a7", "#7ac1a8"],
  });
}

function renderSubjectAverages(subjectAverages) {
  const dom = document.getElementById("subject-avg-chart");
  subjectAvgChart = subjectAvgChart || echarts.init(dom);

  subjectAvgChart.setOption({
    grid: { left: 42, right: 20, top: 24, bottom: 34 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: subjectAverages.map((s) => s.label),
      axisLabel: { color: "#3f5f83" },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#3f5f83" },
      splitLine: { lineStyle: { color: "#e8f0fb" } },
    },
    series: [
      {
        type: "bar",
        name: "平均分",
        data: subjectAverages.map((s) => s.avg),
        barWidth: "46%",
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#1ea091" },
            { offset: 1, color: "#6fd0c2" },
          ]),
        },
      },
      {
        type: "line",
        name: "满分",
        data: subjectAverages.map((s) => s.max),
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { width: 2, color: "#d69d2a" },
        itemStyle: { color: "#d69d2a" },
      },
    ],
  });
}

function bindEvents() {
  document.getElementById("apply-filter").addEventListener("click", loadDashboard);
  document.getElementById("reset-filter").addEventListener("click", () => {
    document.getElementById("keyword").value = "";
    document.getElementById("min-total").value = "0";
    document.getElementById("max-total").value = "750";
    loadDashboard();
  });

  window.addEventListener("resize", () => {
    histogramChart && histogramChart.resize();
    segmentChart && segmentChart.resize();
    subjectAvgChart && subjectAvgChart.resize();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  loadDashboard();
});