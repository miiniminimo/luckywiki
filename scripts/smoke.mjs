// 모의 모드로 전체 흐름을 한 번 돌리는 검사.
// 사용법: 서버를 띄운 뒤  node scripts/smoke.mjs
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.LUCKY_BASE ?? 'http://localhost:8787';
const VAULT = path.resolve('vault');
let pass = 0;
let fail = 0;

function check(name, ok, extra = '') {
  if (ok) {
    pass++;
    console.log(`  OK  ${name}`);
  } else {
    fail++;
    console.log(`  NG  ${name} ${extra}`);
  }
}

async function post(url, body) {
  const res = await fetch(BASE + url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}
const get = async (url) => (await fetch(BASE + url)).json();


console.log('1) health');
const health = await get('/api/health');
check('server up', health.ok === true);
check('mode reported', typeof health.stub === 'boolean', `(stub=${health.stub})`);

console.log('2) ask → preview → save (1번 노트)');
const a1 = await post('/api/ask', { question: '프로세스랑 스레드 차이가 뭐야?' });
check('answer returned', a1.answer.length > 20);
const p1 = await post('/api/notes/preview', { question: a1.question, answer: a1.answer });
check('preview has title/summary/tags', !!p1.title && !!p1.summary && p1.tags.length > 0);
const s1 = await post('/api/notes', { ...p1, question: a1.question, raw: a1.answer, links: [] });
check('note saved', !!s1.slug);

console.log('3) 저장된 파일 규격');
const file1 = path.join(VAULT, s1.file);
const md1 = fs.readFileSync(file1, 'utf-8');
for (const key of ['title:', 'slug:', 'created:', 'updated:', 'tags:', 'model:', 'question:', 'links:']) {
  check(`frontmatter ${key}`, md1.includes(key));
}
for (const sec of ['## 한 줄 요약', '## 정리', '## 원문 답변', '## 연결']) {
  check(`section ${sec}`, md1.includes(sec));
}

console.log('4) 두 번째 노트에서 링크 후보 → 연결');
const a2 = await post('/api/ask', { question: 'RAG가 뭐야?' });
const p2 = await post('/api/notes/preview', { question: a2.question, answer: a2.answer });
check('candidates include note 1', p2.candidates.includes(p1.title), `(${p2.candidates.join(', ')})`);
const s2 = await post('/api/notes', { ...p2, question: a2.question, raw: a2.answer, links: [p1.title] });
const md2 = fs.readFileSync(path.join(VAULT, s2.file), 'utf-8');
check('wikilink written', md2.includes(`[[${p1.title}]]`));

console.log('5) 목록·검색');
const list = await get('/api/notes');
check('list has 2+ notes', list.notes.length >= 2); // 같은 날 같은 제목이면 덮어쓰므로 총 개수로 센다
const filtered = await get(`/api/notes?q=${encodeURIComponent(p1.tags[0] ?? '')}`);
check('filter works', filtered.notes.length >= 1);

console.log('6) 그래프');
const graph = await get('/api/graph');
check('nodes >= 2', graph.nodes.length >= 2);
check('edge >= 1', graph.edges.length >= 1);

console.log('7) 노션 내보내기');
const exp = await post(`/api/export/notion/${s2.slug}`, {});
check('no wikilink in export', !exp.markdown.includes('[['));
check('no frontmatter in export', !exp.markdown.startsWith('---'));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail === 0 ? 0 : 1);
