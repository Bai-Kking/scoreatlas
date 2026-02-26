# ScoreAtlas - 高中学生成绩管理系统

一个完整的全栈项目（后端 Flask + SQLite，前端 HTML/CSS/JavaScript + ECharts），支持成绩管理、统计分析、数据导入导出、多页面跳转。

## 功能概览

- 学生成绩字段：姓名、语文、数学、英语、物理、化学、生物（总分 750）
- 初始自动生成 40 名学生，成绩分层随机，贴近真实班级梯度
- 新增学生成绩
- 定向改单科（指定学生 + 指定学科）
- 删除学生
- 查询总成绩单（关键词 + 总分区间）
- 数据导出（CSV / JSON）
- 数据导入（JSON）
- 统计可视化：
  - 总分分布柱状图
  - 分数段分布图
  - 学科均分对比图
  - 学科雷达图
  - 学科箱线图
  - 数学 vs 总分散点图
  - 学科相关性热力图

## 项目结构

```text
ScoreAtlas/
  app.py
  requirements.txt
  .gitignore
  data/
  templates/
    base.html
    dashboard.html
    manage.html
    analytics.html
  static/
    css/style.css
    js/common.js
    js/dashboard.js
    js/manage.js
    js/analytics.js
```

## 本地运行

```bash
cd C:\Users\Kent_\Desktop\ScoreAtlas
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

浏览器访问：

- http://127.0.0.1:5050/dashboard

## API 简表

- `GET /api/students`
- `POST /api/students`
- `PATCH /api/students/<id>/subject`
- `DELETE /api/students/<id>`
- `POST /api/seed`
- `GET /api/stats`
- `GET /api/export/csv`
- `GET /api/export/json`
- `POST /api/import/json`

## 发布说明（GitHub / GitHub Pages）

当前项目是服务端渲染 + API 的全栈架构，适合部署到支持 Python 的平台（Render、Railway、Fly.io、云服务器等）。

如果你希望使用 GitHub Pages（纯静态托管），建议将前端改为完全静态并接入独立后端 API；本项目保留了这个扩展方向。