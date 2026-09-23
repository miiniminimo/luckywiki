# LuckyWiki

> LLM에게 물어본 것을 **자체 마크다운 위키**로 남기는 로컬 도구
> 2026 인공지능프로젝트 · Ollama `exaone3.5:2.4b` · React + Express

사람들은 LLM에게 묻고 필요한 부분만 보고 지나갑니다. 답은 어디에도 남지 않아 같은 걸 또 묻게 됩니다.
LuckyWiki는 답을 받은 뒤 **저장할지 물어보고**, 저장한다면 요약·태그·관련 노트 연결까지 만들어 마크다운 파일로 쌓습니다.
저장 폴더를 옵시디언으로 열면 그대로 위키가 되고, 노션으로 내보낼 수도 있습니다.

## 화면

| 화면 | 하는 일 |
|---|---|
| 묻기 | 질문 → 답변 → **"이 내용을 위키에 저장할까요?"** → 정리 미리보기(제목·요약·태그·본문·연결) → 저장 |
| 노트 | 저장한 노트 목록, 제목·요약·태그로 찾기 |
| 노트 상세 | 요약·정리·원문 답변·연결, 노션용 마크다운 내보내기, 저장된 원본 보기 |
| 그래프 | 노트 사이 연결을 점과 선으로 |

## 빠른 시작

```bash
npm run install:all      # 루트 + server + web 의존성 설치
cp .env.example .env     # (선택) 모델·폴더·노션 설정
npm run dev              # 화면 http://localhost:5173 · 서버 http://localhost:8787
```

- **Ollama가 없어도 됩니다.** 연결되지 않으면 자동으로 **모의 모드**로 돌아가고 화면 위쪽에 배지가 뜹니다. 시연·화면 작업은 이 상태로 전부 할 수 있습니다.
- Ollama가 있는 컴퓨터에서는 `ollama pull exaone3.5:2.4b` 후 `ollama serve`만 켜면 실제 모델이 답합니다.
- 일부러 모의 모드로 쓰려면 `.env`에 `LUCKY_STUB=1`.

## 구조

```
server/   Express + TypeScript
  src/llm/       ollama.ts(호출·연결 확인) · stub.ts(모의 답변) · prompts.ts(프롬프트)
  src/notes/     format.ts(마크다운 규격) · store.ts(파일 저장) · link.ts(연결 후보) · graph.ts
  src/export/    notion.ts(위키링크 변환 · API 업로드)
web/      React + Vite + TypeScript (pages: Ask · Notes · Note · Graph)
vault/    노트가 쌓이는 폴더 (옵시디언으로 열면 됨)
docs/     format.md(마크다운 규격) · api.md(API 기준 문서)
scripts/  smoke.mjs (전체 흐름 자동 검사)
```

## 검사

```bash
npm run dev            # 다른 터미널에서 서버를 띄워 두고
npm run smoke          # 25항목: 저장·규격·연결·목록·그래프·내보내기
npm --prefix server run typecheck
```

## 팀 작업 나누기

파일이 기능별로 나뉘어 있어 충돌이 적습니다. API 형식은 `docs/api.md`를 단일 기준으로 삼습니다.

| 몫 | 파일 |
|---|---|
| ① 모델·프롬프트 | `server/src/llm/*` |
| ② 노트 저장·규격 | `server/src/notes/format.ts`, `store.ts`, `docs/format.md` |
| ③ 연결·그래프 | `server/src/notes/link.ts`, `web/src/pages/Graph.tsx` |
| ④ 화면 | `web/src/pages/*`, `web/src/styles.css` |
| ⑤ 노션 내보내기 | `server/src/export/notion.ts`, `web/src/pages/Note.tsx` |

## 남은 것 (다음 단계 후보)

- 실제 Ollama로 답변 품질·속도 확인 (모델이 있는 컴퓨터에서)
- 노트 수정·삭제 화면
- 같은 제목이 이미 있을 때 새 노트 대신 이어 쓰기
- 노션 API 업로드 실제 계정으로 확인 (`NOTION_TOKEN`, `NOTION_DB_ID`)
- 임베딩 기반 연결 추천 (지금은 제목·태그 겹침 + 모델 선택)
