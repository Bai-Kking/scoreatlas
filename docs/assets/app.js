const API_BASE = (window.SCOREATLAS_API_BASE || "").replace(/\/$/, "");
let histChart;
let avgChart;

const mockData = {
  count: 40,
  avgTotal: 545.8,
  maxTotal: 703,
  excellentRate: 27.5,
  histogram: [
    { label: "300-349", count: 3 },
    { label: "350-399", count: 4 },
    { label: "400-449", count: 6 },
    { label: "450-499", count: 7 },
    { label: "500-549", count: 8 },
    { label: "550-599", count: 5 },
    { label: "600-649", count: 4 },
    { label: "650-699", count: 2 },
    { label: "700-749", count: 1 },
  ],
  subjectAverages: [
    { label: "语文", avg: 95.2, max: 150 },
    { label: "数学", avg: 97.9, max: 150 },
    { label: "英语", avg: 93.6, max: 150 },
    { label: "物理", avg: 63.4, max: 100 },
    { label: "化学", avg: 61.8, max: 100 },
    { label: "生物", avg: 63.9, max: 100 },
  ],
};

async function fetchStats() {
  if (!API_BASE) {
    setState("mock", "演示模式", "未配置 API_BASE，展示内置示例数据");
    return mockData;
  }

  try {
    const response = await fetch(`${API_BASE}/api/stats`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    setState("ok", "已连接后端", API_BASE);
    return data;
  } catch (error) {
    setState("err", "连接失败，已切换示例数据", `${API_BASE} · ${error.message}`);
    return mockData;
  }
}

function setState(type, text, extra) {
  const state = document.getElementById("conn-state");
  const base = document.getElementById("api-base");
  state.className = `state ${type}`;
  state.textContent = text;
  base.textContent = extra || "";
}

function renderMetrics(stats) {
  document.getElementById("m-count").textContent = stats.count ?? 0;
  document.getElementById("m-avg").textContent = Number(stats.avgTotal || 0).toFixed(1);
  document.getElementById("m-max").textContent = stats.maxTotal ?? 0;
  document.getElementById("m-excellent").textContent = `${Number(stats.excellentRate || 0).toFixed(1)}%`;
}

function renderHist(histogram) {
  const dom = document.getElementById("hist-chart");
  histChart = histChart || echarts.init(dom);

  histChart.setOption({
    grid: { left: 46, right: 16, top: 26, bottom: 42 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: histogram.map((h) => h.label),
      axisLabel: { color: "#45688f", rotate: 28 },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#45688f" },
      splitLine: { lineStyle: { color: "#e5eef9" } },
    },
    series: [
      {
        type: "bar",
        data: histogram.map((h) => h.count),
        barWidth: "62%",
        itemStyle: {
          borderRadius: [5, 5, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#2b73c1" },
            { offset: 1, color: "#78b6e9" },
          ]),
        },
      },
    ],
  });
}

function renderAvg(subjectAverages) {
  const dom = document.getElementById("avg-chart");
  avgChart = avgChart || echarts.init(dom);

  avgChart.setOption({
    grid: { left: 42, right: 14, top: 24, bottom: 34 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: subjectAverages.map((s) => s.label),
      axisLabel: { color: "#45688f" },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#45688f" },
      splitLine: { lineStyle: { color: "#e5eef9" } },
    },
    series: [
      {
        type: "bar",
        data: subjectAverages.map((s) => s.avg),
        barWidth: "50%",
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#12a08d" },
            { offset: 1, color: "#74d0c3" },
          ]),
        },
      },
    ],
  });
}

async function init() {
  const stats = await fetchStats();
  renderMetrics(stats);
  renderHist(stats.histogram || []);
  renderAvg(stats.subjectAverages || []);

  window.addEventListener("resize", () => {
    histChart && histChart.resize();
    avgChart && avgChart.resize();
  });
}

init();