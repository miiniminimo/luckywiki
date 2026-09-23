# LLM 응답 비교 · 발췌 (데모)

2026 인공지능 프로젝트. 하나의 질문을 여러 LLM에 동시에 보내고, **각 답변에서 마음에 드는 문장만 드래그해 모아** 정리하는 도구.

한 사람이 여러 모델을 써 보고 좋은 부분만 손으로 긁어 옮기는 일을 화면 안에서 끝내는 것이 목적이다.

## 흐름
질문 입력 → 세 모델 동시 스트리밍(GPT·Claude·Gemini) → 문장 드래그 → **발췌에 추가** → 메모·태그 → **Markdown / JSON / CSV 내보내기**

## 실행
```bash
pip install fastapi uvicorn httpx
python run.py          # http://localhost:8100
```

`python -m uvicorn app:app --port 8100` 으로도 되지만, **반드시 `app.py`가 있는 폴더 안에서** 실행해야 한다.
다른 위치에서 실행하면 `Could not import module "app"` 오류가 난다. `run.py`는 위치와 상관없이 동작한다.

- 기본은 **mock 응답**이라 API 키 없이 전체 흐름이 돈다(시연용).
- 화면 아래 "OpenAI 키" 칸에 키를 넣고 `OpenAI(실호출)`을 체크하면 실제 호출. 키는 파일에 저장하지 않는다.
- Ollama가 있으면 `Ollama(실호출)` 칸으로 로컬 모델도 쓸 수 있다(`OLLAMA_BASE_URL`, 기본 `http://127.0.0.1:11434`).

## 파일
| 파일 | 내용 |
|---|---|
| `app.py` | FastAPI. 모델 병렬 호출(asyncio), SSE 스트리밍, SQLite 저장, 내보내기 |
| `static/index.html` | 화면 전부. 드래그 선택 → 발췌, 다크 모드 |

## 데이터
SQLite(`demo.db`) — `sessions` / `responses` / `excerpts`.
발췌에는 `response_id`, provider, model, 선택 위치, **앞뒤 문맥 60자**, 메모, 태그, 순서를 함께 저장한다.

## SSE 이벤트
`generation_started` · `model_started` · `token` · `model_completed` · `model_failed` · `generation_completed`
한 모델이 실패해도 나머지 모델의 생성은 계속된다.

## 데모판에서 뺀 것
Next.js, PostgreSQL·Alembic, 인증, Docker, 테스트, 세션 다시 열기.
발표에서 보이지 않는 것부터 뺐다. 확장할 때는 `stream_*` 함수를 provider 어댑터로 분리하면 된다.
