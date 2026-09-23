"""
LLM 응답 비교·발췌 도구 — 데모판 (한 시나리오만 도는 최소 구현)

줄인 것: Next.js·PostgreSQL·Alembic·인증·Docker (데모 속도 우선)
남긴 것: 여러 모델 동시 호출 + 모델별 SSE 스트리밍 + 드래그 발췌 저장(SQLite) + Markdown/JSON/CSV 내보내기
실제 모델: OLLAMA_BASE_URL이 살아 있으면 Ollama를 쓰고, 없으면 mock 응답으로 같은 흐름이 돈다.
"""
import asyncio
import csv
import io
import json
import os
import sqlite3
import time
from contextlib import closing

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

DB = os.path.join(os.path.dirname(__file__), "demo.db")
OLLAMA = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")

MODELS = [
    {"id": "mock-gpt", "provider": "OpenAI", "model": "gpt-4o-mini"},
    {"id": "mock-claude", "provider": "Anthropic", "model": "claude-sonnet"},
    {"id": "mock-gemini", "provider": "Google", "model": "gemini-2.0-flash"},
    {"id": "openai", "provider": "OpenAI(실호출)", "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini")},
    {"id": "ollama", "provider": "Ollama(실호출)", "model": os.environ.get("LLM_MODEL", "exaone3.5:2.4b")},
]

MOCK = {
    "mock-gpt": """양자컴퓨터는 **큐비트**로 계산하는 컴퓨터입니다.

- 기존 비트는 0 또는 1 중 하나지만, 큐비트는 두 상태가 겹친 **중첩** 상태를 가질 수 있습니다.
- 중첩은 여러 가능성이 동시에 존재하는 상태입니다. 그래서 경우의 수가 많은 문제를 한 번에 훑을 수 있습니다.
- 다만 모든 계산이 빨라지는 것은 아니고, 소인수분해·양자 시뮬레이션처럼 구조가 맞는 문제에서만 이득이 큽니다.""",
    "mock-gemini": """양자컴퓨터는 **확률을 계산에 쓰는 기계**입니다.

핵심만 셋:
1. 큐비트는 0과 1을 동시에 담고, 측정하는 순간 하나로 정해집니다.
2. 계산이란 원하는 답의 확률만 크게 키우는 과정입니다(간섭).
3. 지금 기계는 오류가 많아 실험 단계이며, 암호·신약·배터리 설계 쪽에서 먼저 쓰일 것으로 봅니다.

한 줄로: 빠른 컴퓨터가 아니라 **다른 방식으로 푸는** 컴퓨터입니다.""",
    "mock-claude": """쉽게 말하면 **동전 던지기**를 떠올리면 됩니다.

기존 컴퓨터가 비트를 사용하는 반면 양자컴퓨터는 큐비트를 사용합니다. 돌아가는 동전은 앞도 뒤도 아닌 중간 상태이고, 손으로 덮는 순간 하나로 정해집니다.

1. 큐비트 여러 개를 **얽어** 두면 하나를 재는 순간 나머지도 정해집니다.
2. 이 성질로 답을 좁혀 가는 것이 양자 알고리즘입니다.
3. 소음에 약해서 오류 정정이 가장 큰 숙제입니다.""",
}


def db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    with closing(db()) as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions(
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              prompt TEXT NOT NULL,
              created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS responses(
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
              provider TEXT, model TEXT, content TEXT,
              status TEXT, latency_ms INTEGER, error_message TEXT
            );
            CREATE TABLE IF NOT EXISTS excerpts(
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
              response_id INTEGER REFERENCES responses(id) ON DELETE CASCADE,
              provider TEXT, model TEXT,
              selected_text TEXT, start_offset INTEGER, end_offset INTEGER,
              context_before TEXT, context_after TEXT,
              note TEXT DEFAULT '', tags TEXT DEFAULT '',
              sort_order INTEGER DEFAULT 0,
              created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_exc_session ON excerpts(session_id);
            """
        )
        con.commit()


app = FastAPI(title="LLM 응답 비교·발췌 (데모)")
init_db()


@app.get("/", response_class=HTMLResponse)
def index():
    with open(os.path.join(os.path.dirname(__file__), "static", "index.html"), encoding="utf-8") as f:
        return f.read()


@app.get("/api/models")
def models():
    return {"models": MODELS}


async def stream_mock(mid: str):
    """mock 모델: 준비된 답을 조각내 흘려보낸다"""
    text = MOCK.get(mid, "예시 응답입니다.")
    for i in range(0, len(text), 12):
        await asyncio.sleep(0.05)
        yield text[i : i + 12]


async def stream_openai(model: str, prompt: str, key: str = ""):
    """실제 OpenAI 호출. 키는 환경변수에서만 읽는다(코드·저장소에 남기지 않음)."""
    import httpx

    key = key or os.environ.get("OPENAI_API_KEY", "")
    if not key:
        raise RuntimeError("OPENAI_API_KEY 없음")
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST",
            "https://api.openai.com/v1/chat/completions",
            headers={"authorization": f"Bearer {key}"},
            json={"model": model, "messages": [{"role": "user", "content": prompt}], "stream": True},
        ) as r:
            if r.status_code >= 400:
                await r.aread()
                raise RuntimeError(f"OpenAI {r.status_code}")
            async for line in r.aiter_lines():
                if not line.startswith("data: "):
                    continue
                payload = line[6:].strip()
                if payload == "[DONE]":
                    break
                delta = json.loads(payload)["choices"][0].get("delta", {}).get("content")
                if delta:
                    yield delta


async def stream_ollama(model: str, prompt: str):
    import httpx

    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST",
            f"{OLLAMA}/api/chat",
            json={"model": model, "messages": [{"role": "user", "content": prompt}], "stream": True},
        ) as r:
            async for line in r.aiter_lines():
                if not line.strip():
                    continue
                data = json.loads(line)
                chunk = data.get("message", {}).get("content", "")
                if chunk:
                    yield chunk


@app.post("/api/generate")
async def generate(req: Request):
    body = await req.json()
    prompt = (body.get("prompt") or "").strip()[:2000]
    user_key = (body.get("openai_key") or "").strip()  # 화면에서 붙여 넣은 키 (저장하지 않음)
    picked = body.get("models") or ["mock-gpt", "mock-claude", "mock-gemini"]

    with closing(db()) as con:
        cur = con.execute("INSERT INTO sessions(prompt) VALUES (?)", (prompt,))
        session_id = cur.lastrowid
        con.commit()

    async def events():
        queue: asyncio.Queue = asyncio.Queue()

        async def run(spec):
            started = time.time()
            with closing(db()) as con:
                cur = con.execute(
                    "INSERT INTO responses(session_id,provider,model,content,status) VALUES (?,?,?,?,'streaming')",
                    (session_id, spec["provider"], spec["model"], ""),
                )
                rid = cur.lastrowid
                con.commit()
            await queue.put(
                {"event": "model_started", "response_id": rid, "provider": spec["provider"], "model": spec["model"]}
            )
            buf = []
            try:
                if spec["id"] == "openai":
                    gen = stream_openai(spec["model"], prompt, user_key)
                elif spec["id"] == "ollama":
                    gen = stream_ollama(spec["model"], prompt)
                else:
                    gen = stream_mock(spec["id"])
                async for chunk in gen:
                    buf.append(chunk)
                    await queue.put({"event": "token", "response_id": rid, "text": chunk})
                content = "".join(buf)
                ms = int((time.time() - started) * 1000)
                with closing(db()) as con:
                    con.execute(
                        "UPDATE responses SET content=?, status='done', latency_ms=? WHERE id=?", (content, ms, rid)
                    )
                    con.commit()
                await queue.put({"event": "model_completed", "response_id": rid, "latency_ms": ms})
            except Exception as e:  # 한 모델이 실패해도 나머지는 계속 간다
                msg = f"{type(e).__name__}: 호출 실패 (설정을 확인하세요)"
                with closing(db()) as con:
                    con.execute("UPDATE responses SET status='error', error_message=? WHERE id=?", (msg, rid))
                    con.commit()
                await queue.put({"event": "model_failed", "response_id": rid, "error": msg})

        specs = [m for m in MODELS if m["id"] in picked]
        tasks = [asyncio.create_task(run(s)) for s in specs]
        yield sse({"event": "generation_started", "session_id": session_id, "models": specs})

        done = asyncio.gather(*tasks)
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=0.2)
                yield sse(item)
            except asyncio.TimeoutError:
                if done.done() and queue.empty():
                    break
        yield sse({"event": "generation_completed", "session_id": session_id})

    return StreamingResponse(events(), media_type="text/event-stream")


def sse(obj: dict) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


@app.post("/api/excerpts")
async def add_excerpt(req: Request):
    b = await req.json()
    with closing(db()) as con:
        n = con.execute(
            "SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM excerpts WHERE session_id=?", (b["session_id"],)
        ).fetchone()["n"]
        cur = con.execute(
            """INSERT INTO excerpts(session_id,response_id,provider,model,selected_text,start_offset,end_offset,
               context_before,context_after,note,tags,sort_order)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                b["session_id"], b["response_id"], b.get("provider"), b.get("model"),
                b["selected_text"][:4000], b.get("start_offset", 0), b.get("end_offset", 0),
                b.get("context_before", ""), b.get("context_after", ""), b.get("note", ""),
                ",".join(b.get("tags", [])), n,
            ),
        )
        con.commit()
        return {"id": cur.lastrowid, "sort_order": n}


@app.patch("/api/excerpts/{eid}")
async def patch_excerpt(eid: int, req: Request):
    b = await req.json()
    with closing(db()) as con:
        if "note" in b:
            con.execute("UPDATE excerpts SET note=? WHERE id=?", (b["note"][:1000], eid))
        if "tags" in b:
            con.execute("UPDATE excerpts SET tags=? WHERE id=?", (",".join(b["tags"]), eid))
        if "sort_order" in b:
            con.execute("UPDATE excerpts SET sort_order=? WHERE id=?", (b["sort_order"], eid))
        con.commit()
    return {"ok": True}


@app.delete("/api/excerpts/{eid}")
def delete_excerpt(eid: int):
    with closing(db()) as con:
        con.execute("DELETE FROM excerpts WHERE id=?", (eid,))
        con.commit()
    return {"ok": True}


@app.get("/api/sessions/{sid}/excerpts")
def list_excerpts(sid: int):
    with closing(db()) as con:
        rows = con.execute(
            "SELECT * FROM excerpts WHERE session_id=? ORDER BY sort_order", (sid,)
        ).fetchall()
        return {"excerpts": [dict(r) for r in rows]}


@app.get("/api/sessions/{sid}/export")
def export(sid: int, format: str = "markdown"):
    with closing(db()) as con:
        s = con.execute("SELECT * FROM sessions WHERE id=?", (sid,)).fetchone()
        rows = [dict(r) for r in con.execute(
            "SELECT * FROM excerpts WHERE session_id=? ORDER BY sort_order", (sid,)
        ).fetchall()]

    if format == "json":
        return JSONResponse({"session": dict(s), "excerpts": rows})

    if format == "csv":
        buf = io.StringIO()
        w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()) if rows else ["id"])
        w.writeheader()
        w.writerows(rows)
        return PlainTextResponse(buf.getvalue(), media_type="text/csv")

    out = [f"# 질문\n\n{s['prompt']}\n"]
    for r in rows:
        out.append(f"## {r['provider']} · {r['model']} 발췌\n")
        out.append("> " + r["selected_text"].replace("\n", "\n> ") + "\n")
        if r["note"]:
            out.append(f"메모: {r['note']}\n")
        if r["tags"]:
            out.append(f"태그: {r['tags']}\n")
    return PlainTextResponse("\n".join(out), media_type="text/markdown")


app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")
