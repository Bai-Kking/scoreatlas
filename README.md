# ScoreAtlas (Full-Stack High School Score Manager)

ScoreAtlas is a complete full-stack project for high school score management.

- Backend: Flask + SQLite
- Frontend: HTML + CSS + JavaScript + ECharts
- Pages: Dashboard / Manage / Analytics

## Core Features

- Student fields: `name`, `chinese`, `math`, `english`, `physics`, `chemistry`, `biology`
- Total score rule: 750 points (`150+150+150+100+100+100`)
- Initial sample generation: 40 students, realistic tiered distribution
- CRUD:
  - add student
  - update one subject for one student
  - delete student
- Query and filtering:
  - name keyword
  - total score range
- Data transfer:
  - export CSV
  - export JSON
  - import JSON
- Analytics:
  - total score histogram
  - score segment chart
  - subject average chart
  - radar chart
  - box plot
  - scatter chart (math vs total, english mapped by color)
  - correlation heatmap

## Project Structure

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
  docs/
    index.html
    assets/
      style.css
      app.js
  .github/
    workflows/
      pages.yml
```

## Local Run

```bash
cd C:\Users\Kent_\Desktop\ScoreAtlas
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open:

- http://127.0.0.1:5050/dashboard

## API Endpoints

- `GET /api/health`
- `GET /api/students`
- `POST /api/students`
- `PATCH /api/students/<id>/subject`
- `DELETE /api/students/<id>`
- `POST /api/seed`
- `GET /api/stats`
- `GET /api/export/csv`
- `GET /api/export/json`
- `POST /api/import/json`

## Deployment Notes

### 1) Full-stack deployment (recommended)

GitHub Pages cannot host Python backend runtime.

Deploy `app.py` backend to a Python platform such as:
- Render
- Railway
- Fly.io
- VPS / cloud server

### 2) GitHub Pages deployment

This repo includes a static site in `docs/` and workflow `.github/workflows/pages.yml`.

After pushing to GitHub:
1. Ensure default branch is `main`.
2. Open GitHub repo -> `Settings` -> `Pages`.
3. Source: `GitHub Actions`.
4. Wait for workflow `Deploy GitHub Pages` to succeed.
5. Your site URL will be:
   - `https://<your-username>.github.io/<repo-name>/`

If you want `docs/` page to read real backend data, set API base in `docs/assets/app.js`:

```js
window.SCOREATLAS_API_BASE = "https://your-backend-domain";
```

## Git Commands Used

```bash
git init
git add .
git commit -m "feat: build ScoreAtlas full-stack grade management system"
```