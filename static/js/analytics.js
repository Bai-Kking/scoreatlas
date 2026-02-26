let radarChart;
let boxplotChart;
let scatterChart;
let heatmapChart;

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;

  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function toBoxData(series) {
  const sorted = [...series].sort((a, b) => a - b);
  if (!sorted.length) return [0, 0, 0, 0, 0];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  return [min, q1, median, q3, max];
}

function renderRadar(subjectAverages) {
  const dom = document.getElementById("radar-chart");
  radarChart = radarChart || echarts.init(dom);

  const indicators = subjectAverages.map((s) => ({ name: s.label, max: s.max }));
  const values = subjectAverages.map((s) => Number(s.avg || 0));

  radarChart.setOption({
    tooltip: {},
    radar: {
      indicator: indicators,
      axisName: { color: "#345a84" },
      splitArea: { areaStyle: { color: ["#f8fbff", "#eef6ff"] } },
      splitLine: { lineStyle: { color: "#d4e2f3" } },
    },
    series: [
      {
        type: "radar",
        data: [{
          value: values,
          name: "班级均分",
          areaStyle: { color: "rgba(31, 95, 174, 0.28)" },
          lineStyle: { color: "#1f5fae", width: 2 },
          itemStyle: { color: "#1f5fae" },
        }],
      },
    ],
  });
}

function renderBoxplot(subjectSeries) {
  const dom = document.getElementById("boxplot-chart");
  boxplotChart = boxplotChart || echarts.init(dom);

  const labels = Object.keys(subjectSeries || {});
  const boxData = labels.map((label) => toBoxData(subjectSeries[label] || []));

  boxplotChart.setOption({
    tooltip: { trigger: "item" },
    grid: { left: 46, right: 20, top: 30, bottom: 38 },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: { color: "#3f5f83" },
      axisLine: { lineStyle: { color: "#aac1de" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#3f5f83" },
      splitLine: { lineStyle: { color: "#e8f0fb" } },
    },
    series: [
      {
        name: "成绩分布",
        type: "boxplot",
        data: boxData,
        itemStyle: {
          color: "#7bbbe8",
          borderColor: "#2c6dad",
          borderWidth: 1.3,
        },
      },
    ],
  });
}

function renderScatter(scatterData) {
  const dom = document.getElementById("scatter-chart");
  scatterChart = scatterChart || echarts.init(dom);

  scatterChart.setOption({
    grid: { left: 52, right: 60, top: 30, bottom: 46 },
    tooltip: {
      formatter: (params) => {
        const [x, y, english, name] = params.data;
        return `${name}<br/>数学：${x}<br/>总分：${y}<br/>英语：${english}`;
      },
    },
    xAxis: {
      type: "value",
      name: "数学",
      min: 0,
      max: 150,
      axisLabel: { color: "#3f5f83" },
      splitLine: { lineStyle: { color: "#e8f0fb" } },
    },
    yAxis: {
      type: "value",
      name: "总分",
      min: 0,
      max: 750,
      axisLabel: { color: "#3f5f83" },
      splitLine: { lineStyle: { color: "#e8f0fb" } },
    },
    visualMap: {
      min: 0,
      max: 150,
      dimension: 2,
      right: 0,
      top: "middle",
      text: ["英语高", "英语低"],
      calculable: true,
      inRange: {
        color: ["#d5e9ff", "#73ace5", "#1f5fae"],
      },
    },
    series: [
      {
        type: "scatter",
        symbolSize: 13,
        data: scatterData.map((s) => [s.math, s.total, s.english, s.name]),
      },
    ],
  });
}

function renderHeatmap(correlations) {
  const dom = document.getElementById("heatmap-chart");
  heatmapChart = heatmapChart || echarts.init(dom);

  const labels = ["语文", "数学", "英语", "物理", "化学", "生物"];
  const indexMap = Object.fromEntries(labels.map((label, idx) => [label, idx]));
  const matrix = (correlations || []).map((c) => [indexMap[c.x], indexMap[c.y], Number(c.value)]);

  heatmapChart.setOption({
    tooltip: {
      formatter: (params) => {
        const [x, y, value] = params.data;
        return `${labels[y]} vs ${labels[x]}<br/>相关系数：${value.toFixed(3)}`;
      },
    },
    grid: { left: 66, right: 32, top: 30, bottom: 56 },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: { color: "#3f5f83" },
      splitArea: { show: true },
    },
    yAxis: {
      type: "category",
      data: labels,
      axisLabel: { color: "#3f5f83" },
      splitArea: { show: true },
    },
    visualMap: {
      min: -1,
      max: 1,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 8,
      inRange: {
        color: ["#2f67a5", "#edf5ff", "#e2a62b"],
      },
    },
    series: [
      {
        type: "heatmap",
        data: matrix,
        label: {
          show: true,
          formatter: (params) => Number(params.data[2]).toFixed(2),
          color: "#163a66",
        },
      },
    ],
  });
}

async function loadAnalytics() {
  try {
    const stats = await requestApi("/api/stats");
    renderRadar(stats.subjectAverages || []);
    renderBoxplot(stats.subjectSeries || {});
    renderScatter(stats.scatter || []);
    renderHeatmap(stats.correlations || []);
  } catch (err) {
    showToast(err.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadAnalytics();
  window.addEventListener("resize", () => {
    radarChart && radarChart.resize();
    boxplotChart && boxplotChart.resize();
    scatterChart && scatterChart.resize();
    heatmapChart && heatmapChart.resize();
  });
});