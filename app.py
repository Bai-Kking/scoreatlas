from __future__ import annotations

import csv
import io
import os
import random
import sqlite3
from statistics import mean
from typing import Any

from flask import Flask, Response, g, jsonify, redirect, render_template, request, url_for

SUBJECT_META = [
    ("chinese", "语文", 150),
    ("math", "数学", 150),
    ("english", "英语", 150),
    ("physics", "物理", 100),
    ("chemistry", "化学", 100),
    ("biology", "生物", 100),
]

SUBJECT_CODES = [code for code, _, _ in SUBJECT_META]
SUBJECT_LABELS = {code: label for code, label, _ in SUBJECT_META}
SUBJECT_MAX = {code: max_score for code, _, max_score in SUBJECT_META}
LABEL_TO_CODE = {label: code for code, label, _ in SUBJECT_META}
TOTAL_EXPR = "(chinese + math + english + physics + chemistry + biology)"
TOTAL_MAX = 750

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "scores.db")

SURNAMES = [
    "王", "李", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴", "徐", "孙", "胡", "朱", "高", "林",
    "何", "郭", "马", "罗", "梁", "宋", "郑", "谢", "韩", "唐", "冯", "于", "董", "萧", "程", "曹",
    "袁", "邓", "许", "傅", "沈", "曾", "彭", "吕", "苏", "卢", "蒋", "蔡", "贾", "丁", "魏", "薛",
]
GIVEN_CHARS = [
    "子", "宇", "浩", "晨", "泽", "嘉", "俊", "博", "奕", "铭", "思", "雅", "欣", "雨", "诗", "依",
    "雪", "语", "文", "轩", "航", "宁", "清", "彦", "昊", "瑶", "可", "涵", "安", "辰", "悦", "彤",
    "远", "睿", "哲", "楠", "楷", "逸", "祺", "琪", "雯", "然", "霖", "妍", "珂", "宸", "凡", "阳",
]

TIER_CONFIG = [
    {
        "prob": 0.18,
        "mean": 675,
        "std": 24,
        "range": (620, 730),
        "mins": [92, 90, 90, 58, 56, 56],
    },
    {
        "prob": 0.57,
        "mean": 545,
        "std": 40,
        "range": (470, 620),
        "mins": [55, 52, 52, 32, 32, 30],
    },
    {
        "prob": 0.25,
        "mean": 410,
        "std": 42,
        "range": (300, 500),
        "mins": [35, 30, 30, 18, 18, 18],
    },
]


def clamp(value: float, low: int, high: int) -> int:
    return int(max(low, min(high, value)))


def pearson(xs: list[float], ys: list[float]) -> float:
    if len(xs) != len(ys) or len(xs) < 2:
        return 0.0
    mx = sum(xs) / len(xs)
    my = sum(ys) / len(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den_x = sum((x - mx) ** 2 for x in xs) ** 0.5
    den_y = sum((y - my) ** 2 for y in ys) ** 0.5
    if den_x == 0 or den_y == 0:
        return 0.0
    return round(num / (den_x * den_y), 4)


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        g.db = conn
    return g.db


def close_db(_: Any = None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    db = get_db()
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            chinese INTEGER NOT NULL CHECK(chinese >= 0 AND chinese <= 150),
            math INTEGER NOT NULL CHECK(math >= 0 AND math <= 150),
            english INTEGER NOT NULL CHECK(english >= 0 AND english <= 150),
            physics INTEGER NOT NULL CHECK(physics >= 0 AND physics <= 100),
            chemistry INTEGER NOT NULL CHECK(chemistry >= 0 AND chemistry <= 100),
            biology INTEGER NOT NULL CHECK(biology >= 0 AND biology <= 100),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TRIGGER IF NOT EXISTS trg_students_updated_at
        AFTER UPDATE ON students
        FOR EACH ROW
        BEGIN
            UPDATE students SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
        END;
        """
    )
    db.commit()


def generate_names(count: int) -> list[str]:
    names: list[str] = []
    used = set()
    attempts = 0
    max_attempts = count * 60

    while len(names) < count and attempts < max_attempts:
        surname = random.choice(SURNAMES)
        given_len = 1 if random.random() < 0.25 else 2
        given = "".join(random.choice(GIVEN_CHARS) for _ in range(given_len))
        full_name = f"{surname}{given}"
        if full_name not in used:
            names.append(full_name)
            used.add(full_name)
        attempts += 1

    while len(names) < count:
        fallback = f"学生{len(names) + 1:02d}"
        if fallback not in used:
            names.append(fallback)
            used.add(fallback)

    return names


def sample_tier() -> dict[str, Any]:
    p = random.random()
    total = 0.0
    for tier in TIER_CONFIG:
        total += tier["prob"]
        if p <= total:
            return tier
    return TIER_CONFIG[-1]


def weighted_dirichlet(alpha: list[float]) -> list[float]:
    raw = [random.gammavariate(a, 1.0) for a in alpha]
    total = sum(raw)
    if total == 0:
        return [1 / len(alpha)] * len(alpha)
    return [v / total for v in raw]


def rebalance_scores(scores: list[int], target_total: int, mins: list[int], maxs: list[int]) -> list[int]:
    adjusted = [clamp(s, mins[i], maxs[i]) for i, s in enumerate(scores)]
    diff = target_total - sum(adjusted)
    guard = 0

    while diff != 0 and guard < 10000:
        if diff > 0:
            candidates = [i for i in range(len(adjusted)) if adjusted[i] < maxs[i]]
            if not candidates:
                break
            idx = random.choice(candidates)
            adjusted[idx] += 1
            diff -= 1
        else:
            candidates = [i for i in range(len(adjusted)) if adjusted[i] > mins[i]]
            if not candidates:
                break
            idx = random.choice(candidates)
            adjusted[idx] -= 1
            diff += 1
        guard += 1

    return adjusted


def generate_student_record(name: str) -> dict[str, Any]:
    tier = sample_tier()
    low, high = tier["range"]
    target_total = clamp(random.gauss(tier["mean"], tier["std"]), low, high)

    mins = tier["mins"]
    maxs = [SUBJECT_MAX[code] for code in SUBJECT_CODES]

    alpha = [3.3, 3.3, 3.1, 2.1, 1.9, 1.8]
    strength_count = 2 if random.random() < 0.42 else 1
    for idx in random.sample(range(len(SUBJECT_CODES)), k=strength_count):
        alpha[idx] += random.uniform(0.8, 1.7)

    weak_idx = random.randrange(len(SUBJECT_CODES))
    alpha[weak_idx] *= random.uniform(0.72, 0.92)

    weights = weighted_dirichlet(alpha)
    raw_scores = [int(target_total * w) for w in weights]
    raw_scores = rebalance_scores(raw_scores, target_total, mins, maxs)

    noisy_scores = [
        clamp(raw_scores[i] + random.randint(-3, 3), mins[i], maxs[i])
        for i in range(len(raw_scores))
    ]
    final_scores = rebalance_scores(noisy_scores, target_total, mins, maxs)

    record = {"name": name}
    for i, code in enumerate(SUBJECT_CODES):
        record[code] = final_scores[i]
    return record


def seed_sample_data(count: int = 40, clear_existing: bool = True) -> int:
    db = get_db()
    if clear_existing:
        db.execute("DELETE FROM students")

    names = generate_names(count)
    records = [generate_student_record(name) for name in names]

    db.executemany(
        """
        INSERT INTO students (name, chinese, math, english, physics, chemistry, biology)
        VALUES (:name, :chinese, :math, :english, :physics, :chemistry, :biology)
        """,
        records,
    )
    db.commit()
    return len(records)


def ensure_seeded() -> None:
    db = get_db()
    count = db.execute("SELECT COUNT(1) FROM students").fetchone()[0]
    if count == 0:
        seed_sample_data(40, clear_existing=False)


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "chinese": int(row["chinese"]),
        "math": int(row["math"]),
        "english": int(row["english"]),
        "physics": int(row["physics"]),
        "chemistry": int(row["chemistry"]),
        "biology": int(row["biology"]),
        "total": int(row["total"]),
    }


def fetch_students(
    keyword: str = "",
    min_total: int = 0,
    max_total: int = TOTAL_MAX,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    db = get_db()
    sql = f"""
    SELECT
        id,
        name,
        chinese,
        math,
        english,
        physics,
        chemistry,
        biology,
        {TOTAL_EXPR} AS total
    FROM students
    WHERE {TOTAL_EXPR} BETWEEN ? AND ?
    """
    params: list[Any] = [min_total, max_total]

    if keyword:
        sql += " AND name LIKE ?"
        params.append(f"%{keyword}%")

    sql += " ORDER BY total DESC, chinese DESC, math DESC, english DESC, id ASC"

    if limit is not None:
        sql += " LIMIT ?"
        params.append(limit)

    rows = db.execute(sql, params).fetchall()
    return [row_to_dict(row) for row in rows]


def parse_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def validate_score(subject: str, score: Any) -> int:
    if subject not in SUBJECT_MAX:
        raise ValueError(f"未知学科：{subject}")
    try:
        val = int(score)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{SUBJECT_LABELS[subject]}成绩必须是整数") from exc

    max_score = SUBJECT_MAX[subject]
    if val < 0 or val > max_score:
        raise ValueError(f"{SUBJECT_LABELS[subject]}成绩范围应为 0-{max_score}")
    return val


def normalize_subject(subject: str) -> str:
    if subject in SUBJECT_CODES:
        return subject
    if subject in LABEL_TO_CODE:
        return LABEL_TO_CODE[subject]
    raise ValueError("无效学科，请使用语文/数学/英语/物理/化学/生物")


def parse_student_payload(payload: dict[str, Any], require_all: bool = True) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("请求体必须是 JSON 对象")

    name = str(payload.get("name", "")).strip()
    if not name:
        raise ValueError("姓名不能为空")

    cleaned: dict[str, Any] = {"name": name}
    for subject in SUBJECT_CODES:
        if require_all and subject not in payload:
            raise ValueError(f"缺少学科字段：{subject}")
        if subject in payload:
            cleaned[subject] = validate_score(subject, payload[subject])

    if require_all and any(subject not in cleaned for subject in SUBJECT_CODES):
        raise ValueError("学科字段不完整")

    return cleaned


def build_stats(keyword: str = "", min_total: int = 0, max_total: int = TOTAL_MAX) -> dict[str, Any]:
    students = fetch_students(keyword=keyword, min_total=min_total, max_total=max_total)
    if not students:
        return {
            "count": 0,
            "avgTotal": 0,
            "maxTotal": 0,
            "minTotal": 0,
            "excellentRate": 0,
            "qualifiedRate": 0,
            "subjectAverages": [],
            "segments": [],
            "histogram": [],
            "top10": [],
            "scatter": [],
            "subjectSeries": {},
            "correlations": [],
        }

    totals = [s["total"] for s in students]
    count = len(students)

    subject_series_code = {code: [s[code] for s in students] for code in SUBJECT_CODES}
    subject_averages = [
        {
            "code": code,
            "label": SUBJECT_LABELS[code],
            "avg": round(mean(subject_series_code[code]), 2),
            "max": SUBJECT_MAX[code],
        }
        for code in SUBJECT_CODES
    ]

    segments = [
        {"label": "350以下", "count": sum(1 for t in totals if t < 350)},
        {"label": "350-449", "count": sum(1 for t in totals if 350 <= t <= 449)},
        {"label": "450-549", "count": sum(1 for t in totals if 450 <= t <= 549)},
        {"label": "550-649", "count": sum(1 for t in totals if 550 <= t <= 649)},
        {"label": "650及以上", "count": sum(1 for t in totals if t >= 650)},
    ]

    step = 25
    hist_start = max(0, (min(totals) // step) * step)
    hist_end = min(TOTAL_MAX + step, ((max(totals) // step) + 2) * step)
    histogram = []
    for left in range(hist_start, hist_end, step):
        right = left + step
        if right >= hist_end:
            count_in_bin = sum(1 for t in totals if left <= t <= right)
        else:
            count_in_bin = sum(1 for t in totals if left <= t < right)
        histogram.append(
            {
                "label": f"{left}-{right - 1}",
                "left": left,
                "count": count_in_bin,
            }
        )

    top10 = students[:10]
    scatter = [
        {
            "name": s["name"],
            "math": s["math"],
            "english": s["english"],
            "total": s["total"],
        }
        for s in students
    ]

    subject_series_labeled = {SUBJECT_LABELS[code]: values for code, values in subject_series_code.items()}

    correlations = []
    for code_x, label_x, _ in SUBJECT_META:
        for code_y, label_y, _ in SUBJECT_META:
            correlations.append(
                {
                    "x": label_x,
                    "y": label_y,
                    "value": pearson(subject_series_code[code_x], subject_series_code[code_y]),
                }
            )

    return {
        "count": count,
        "avgTotal": round(mean(totals), 2),
        "maxTotal": max(totals),
        "minTotal": min(totals),
        "excellentRate": round(sum(1 for t in totals if t >= 600) * 100 / count, 2),
        "qualifiedRate": round(sum(1 for t in totals if t >= 450) * 100 / count, 2),
        "subjectAverages": subject_averages,
        "segments": segments,
        "histogram": histogram,
        "top10": top10,
        "scatter": scatter,
        "subjectSeries": subject_series_labeled,
        "correlations": correlations,
    }


def create_app() -> Flask:
    app = Flask(__name__)
    os.makedirs(DATA_DIR, exist_ok=True)

    @app.after_request
    def apply_cors_headers(response: Response) -> Response:
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
        return response

    app.teardown_appcontext(close_db)

    with app.app_context():
        init_db()
        ensure_seeded()

    @app.route("/")
    def root() -> Response:
        return redirect(url_for("dashboard"))

    @app.route("/dashboard")
    def dashboard() -> str:
        return render_template("dashboard.html", active_page="dashboard")

    @app.route("/manage")
    def manage() -> str:
        return render_template("manage.html", active_page="manage")

    @app.route("/analytics")
    def analytics() -> str:
        return render_template("analytics.html", active_page="analytics")

    @app.route("/api/health")
    def health() -> Response:
        return jsonify({"status": "ok"})

    @app.route("/api/students", methods=["GET"])
    def list_students() -> Response:
        keyword = request.args.get("keyword", "").strip()
        min_total = clamp(parse_int(request.args.get("min_total"), 0), 0, TOTAL_MAX)
        max_total = clamp(parse_int(request.args.get("max_total"), TOTAL_MAX), 0, TOTAL_MAX)
        if min_total > max_total:
            min_total, max_total = max_total, min_total

        limit_arg = request.args.get("limit")
        limit = None
        if limit_arg is not None and limit_arg != "":
            limit = max(1, parse_int(limit_arg, 20))

        students = fetch_students(keyword=keyword, min_total=min_total, max_total=max_total, limit=limit)
        return jsonify({"students": students})

    @app.route("/api/students", methods=["POST"])
    def add_student() -> Response:
        payload = request.get_json(silent=True) or {}
        try:
            cleaned = parse_student_payload(payload, require_all=True)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        db = get_db()
        try:
            cursor = db.execute(
                """
                INSERT INTO students (name, chinese, math, english, physics, chemistry, biology)
                VALUES (:name, :chinese, :math, :english, :physics, :chemistry, :biology)
                """,
                cleaned,
            )
            db.commit()
        except sqlite3.IntegrityError:
            return jsonify({"error": "学生姓名已存在，请勿重复添加"}), 409

        row = db.execute(
            f"SELECT id, name, chinese, math, english, physics, chemistry, biology, {TOTAL_EXPR} AS total FROM students WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
        return jsonify({"message": "新增成功", "student": row_to_dict(row)}), 201

    @app.route("/api/students/<int:student_id>/subject", methods=["PATCH"])
    def patch_student_subject(student_id: int) -> Response:
        payload = request.get_json(silent=True) or {}
        subject_raw = str(payload.get("subject", "")).strip()

        try:
            subject = normalize_subject(subject_raw)
            score = validate_score(subject, payload.get("score"))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        db = get_db()
        cursor = db.execute(f"UPDATE students SET {subject} = ? WHERE id = ?", (score, student_id))
        if cursor.rowcount == 0:
            return jsonify({"error": "学生不存在"}), 404
        db.commit()

        row = db.execute(
            f"SELECT id, name, chinese, math, english, physics, chemistry, biology, {TOTAL_EXPR} AS total FROM students WHERE id = ?",
            (student_id,),
        ).fetchone()
        return jsonify({"message": "修改成功", "student": row_to_dict(row)})

    @app.route("/api/students/<int:student_id>", methods=["DELETE"])
    def delete_student(student_id: int) -> Response:
        db = get_db()
        cursor = db.execute("DELETE FROM students WHERE id = ?", (student_id,))
        if cursor.rowcount == 0:
            return jsonify({"error": "学生不存在"}), 404
        db.commit()
        return jsonify({"message": "删除成功"})

    @app.route("/api/seed", methods=["POST"])
    def seed_students() -> Response:
        payload = request.get_json(silent=True) or {}
        count = parse_int(payload.get("count", 40), 40)
        count = clamp(count, 10, 120)
        inserted = seed_sample_data(count=count, clear_existing=True)
        return jsonify({"message": f"已重置并生成 {inserted} 名学生"})

    @app.route("/api/stats", methods=["GET"])
    def stats() -> Response:
        keyword = request.args.get("keyword", "").strip()
        min_total = clamp(parse_int(request.args.get("min_total"), 0), 0, TOTAL_MAX)
        max_total = clamp(parse_int(request.args.get("max_total"), TOTAL_MAX), 0, TOTAL_MAX)
        if min_total > max_total:
            min_total, max_total = max_total, min_total

        result = build_stats(keyword=keyword, min_total=min_total, max_total=max_total)
        return jsonify(result)

    @app.route("/api/export/csv", methods=["GET"])
    def export_csv() -> Response:
        students = fetch_students()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["排名", "姓名", "语文", "数学", "英语", "物理", "化学", "生物", "总分"])
        for idx, s in enumerate(students, start=1):
            writer.writerow([
                idx,
                s["name"],
                s["chinese"],
                s["math"],
                s["english"],
                s["physics"],
                s["chemistry"],
                s["biology"],
                s["total"],
            ])

        csv_data = output.getvalue()
        response = Response(csv_data, mimetype="text/csv; charset=utf-8")
        response.headers["Content-Disposition"] = "attachment; filename=score_atlas_export.csv"
        return response

    @app.route("/api/export/json", methods=["GET"])
    def export_json() -> Response:
        students = fetch_students()
        return jsonify({"students": students, "count": len(students)})

    @app.route("/api/import/json", methods=["POST"])
    def import_json() -> Response:
        payload = request.get_json(silent=True) or {}
        replace = bool(payload.get("replace", True))
        students = payload.get("students")

        if not isinstance(students, list):
            return jsonify({"error": "students 字段必须为数组"}), 400

        cleaned_list = []
        names_seen = set()
        for idx, item in enumerate(students, start=1):
            try:
                cleaned = parse_student_payload(item, require_all=True)
            except ValueError as exc:
                return jsonify({"error": f"第 {idx} 条记录错误：{exc}"}), 400

            if cleaned["name"] in names_seen:
                return jsonify({"error": f"第 {idx} 条记录姓名重复：{cleaned['name']}"}), 400
            names_seen.add(cleaned["name"])
            cleaned_list.append(cleaned)

        db = get_db()
        try:
            with db:
                if replace:
                    db.execute("DELETE FROM students")
                db.executemany(
                    """
                    INSERT INTO students (name, chinese, math, english, physics, chemistry, biology)
                    VALUES (:name, :chinese, :math, :english, :physics, :chemistry, :biology)
                    """,
                    cleaned_list,
                )
        except sqlite3.IntegrityError:
            return jsonify({"error": "导入失败：存在重复姓名或非法数据"}), 409

        return jsonify({"message": f"成功导入 {len(cleaned_list)} 条数据"})

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)