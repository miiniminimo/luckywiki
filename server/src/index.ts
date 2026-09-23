import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ask, organize, ping, MODEL, HOST } from './llm/ollama.js';
import { buildGraph, readAll, readOne, saveNote, VAULT_DIR } from './notes/store.js';
import { linkCandidates } from './notes/link.js';
import { asContext, searchNotes } from './notes/search.js';
import { appendToNote, deleteNote, updateNote } from './notes/store.js';
import { toNotionMarkdown, uploadToNotion } from './export/notion.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT ?? 8787);

app.get('/api/health', async (_req, res) => {
  const ollama = await ping();
  res.json({
    ok: true,
    ollama,
    stub: !ollama,
    model: MODEL,
    host: HOST,
    vault: VAULT_DIR,
    notes: readAll().length,
  });
});

app.post('/api/ask', async (req, res) => {
  const question = String(req.body?.question ?? '').trim();
  if (!question) return res.status(400).json({ error: '질문이 비어 있습니다' });

  const history = Array.isArray(req.body?.history)
    ? req.body.history
        .filter((t: any) => t?.role === 'user' || t?.role === 'assistant')
        .map((t: any) => ({ role: t.role, content: String(t.content ?? '') }))
    : [];

  // 저장해 둔 노트에서 근거를 찾아 프롬프트에 붙인다 (useNotes가 false면 건너뜀)
  const useNotes = req.body?.useNotes !== false;
  const hits = useNotes ? searchNotes(question) : [];
  const { answer, stub } = await ask(question, history, asContext(hits));

  res.json({
    question,
    answer,
    stub,
    model: stub ? 'stub' : MODEL,
    used: hits.map((h) => ({ slug: h.slug, title: h.title })),
  });
});

// 검색만 따로 (화면에서 '내 노트에 이미 있나?' 확인용)
app.get('/api/search', (req, res) => {
  res.json({ hits: searchNotes(String(req.query.q ?? '')) });
});

// 저장 전 미리보기: 모델이 제목·요약·태그·본문·링크 후보를 만든다
app.post('/api/notes/preview', async (req, res) => {
  const question = String(req.body?.question ?? '').trim();
  const answer = String(req.body?.answer ?? '').trim();
  if (!question || !answer) return res.status(400).json({ error: '질문과 답변이 필요합니다' });

  const candidates = linkCandidates(`${question}\n${answer}`);
  const { result, stub } = await organize(question, answer, candidates);

  // 같은 제목의 노트가 이미 있으면 '이어 쓰기'를 제안한다
  const same = readAll().find((n) => n.title.trim().toLowerCase() === result.title.trim().toLowerCase());
  res.json({
    ...result,
    candidates,
    stub,
    existing: same ? { slug: same.slug, title: same.title } : null,
  });
});

app.post('/api/notes', (req, res) => {
  const b = req.body ?? {};
  if (!b.title || !b.body) return res.status(400).json({ error: '제목과 본문이 필요합니다' });
  const saved = saveNote({
    title: String(b.title),
    tags: Array.isArray(b.tags) ? b.tags.map(String) : [],
    model: String(b.model ?? MODEL),
    question: String(b.question ?? ''),
    links: Array.isArray(b.links) ? b.links.map(String) : [],
    summary: String(b.summary ?? ''),
    body: String(b.body),
    raw: String(b.raw ?? ''),
  });
  res.json({ slug: saved.note.slug, file: saved.file, path: saved.path });
});

app.get('/api/notes', (req, res) => {
  const q = String(req.query.q ?? '').toLowerCase().trim();
  const notes = readAll()
    .filter((n) =>
      !q ? true : [n.title, n.summary, n.tags.join(' '), n.question].join(' ').toLowerCase().includes(q),
    )
    .map((n) => ({
      slug: n.slug,
      title: n.title,
      tags: n.tags,
      created: n.created,
      summary: n.summary,
      links: n.links,
    }));
  res.json({ notes });
});

app.get('/api/notes/:slug', (req, res) => {
  const found = readOne(req.params.slug);
  if (!found) return res.status(404).json({ error: '노트를 찾지 못했습니다' });
  res.json({ note: found.note, raw: found.raw, file: found.file });
});

// 기존 노트에 이어 쓰기
app.post('/api/notes/:slug/append', (req, res) => {
  const b = req.body ?? {};
  const out = appendToNote(req.params.slug, {
    question: String(b.question ?? ''),
    summary: String(b.summary ?? ''),
    body: String(b.body ?? ''),
    raw: String(b.raw ?? ''),
    tags: Array.isArray(b.tags) ? b.tags.map(String) : [],
    links: Array.isArray(b.links) ? b.links.map(String) : [],
  });
  if (!out) return res.status(404).json({ error: '노트를 찾지 못했습니다' });
  res.json(out);
});

// 노트 고치기
app.put('/api/notes/:slug', (req, res) => {
  const out = updateNote(req.params.slug, req.body ?? {});
  if (!out) return res.status(404).json({ error: '노트를 찾지 못했습니다' });
  res.json(out);
});

// 노트 지우기 (되돌릴 수 있게 vault/.trash로 옮긴다)
app.delete('/api/notes/:slug', (req, res) => {
  const out = deleteNote(req.params.slug);
  if (!out) return res.status(404).json({ error: '노트를 찾지 못했습니다' });
  res.json(out);
});

app.get('/api/graph', (_req, res) => res.json(buildGraph()));

app.post('/api/export/notion/:slug', async (req, res) => {
  const found = readOne(req.params.slug);
  if (!found) return res.status(404).json({ error: '노트를 찾지 못했습니다' });
  const markdown = toNotionMarkdown(found.note, found.raw);
  const upload = req.body?.upload ? await uploadToNotion(found.note, markdown) : { uploaded: false, reason: '버튼만 누름' };
  res.json({ markdown, ...upload });
});

app.listen(PORT, () => {
  console.log(`[luckywiki] server  http://localhost:${PORT}`);
  console.log(`[luckywiki] vault   ${VAULT_DIR}`);
});
