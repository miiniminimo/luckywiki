# 서버 API (기준 문서)

기본 주소: `http://localhost:8787`. 화면(Vite)은 `/api`를 이 서버로 넘긴다.
**팀에서 화면과 서버를 나눠 만들 때 이 문서를 단일 기준으로 삼는다.**

| 메서드 | 경로 | 요청 | 응답 |
|---|---|---|---|
| GET | `/api/health` | — | `{ollama, stub, model, host, vault, notes}` |
| POST | `/api/ask` | `{question}` | `{question, answer, stub, model}` |
| POST | `/api/notes/preview` | `{question, answer}` | `{title, summary, tags[], body, links[], candidates[], stub}` |
| POST | `/api/notes` | `{title, summary, tags[], body, links[], question, raw}` | `{slug, file, path}` |
| GET | `/api/notes?q=` | — | `{notes: [{slug,title,tags,created,summary,links}]}` |
| GET | `/api/notes/:slug` | — | `{note, raw, file}` |
| GET | `/api/graph` | — | `{nodes:[{id,title,tags}], edges:[{from,to}]}` |
| POST | `/api/export/notion/:slug` | `{upload?: boolean}` | `{markdown, uploaded, url?, reason?}` |

## 규칙
- 링크는 **후보 목록(candidates) 안에 있는 제목만** 저장한다. 모델이 없는 노트를 지어내는 것을 막기 위해서다.
- Ollama에 연결되지 않거나 `LUCKY_STUB=1`이면 모든 응답의 `stub`이 `true`가 되고 모의 답변을 쓴다.
