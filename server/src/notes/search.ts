import { readAll } from './store.js';
import type { Note } from './format.js';

export type Hit = { slug: string; title: string; score: number; excerpt: string };

/**
 * 저장한 노트에서 질문과 관련된 부분을 찾는다.
 * 임베딩 없이 단어 겹침으로 센다 — 노트 수가 많지 않고, 모델 없이도 동작해야 하기 때문.
 * (다음 단계 후보: 임베딩 기반 검색)
 */
export function searchNotes(query: string, limit = 3): Hit[] {
  const words = tokenize(query);
  if (words.length === 0) return [];

  return readAll()
    .map((n) => {
      const hay = `${n.title}\n${n.summary}\n${n.body}\n${n.tags.join(' ')}`.toLowerCase();
      let score = 0;
      for (const w of words) {
        if (n.title.toLowerCase().includes(w)) score += 3;
        if (n.tags.some((t) => t.toLowerCase() === w)) score += 2;
        if (hay.includes(w)) score += 1;
      }
      return { slug: n.slug, title: n.title, score, excerpt: excerptFor(n, words) };
    })
    .filter((h) => h.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** 찾은 노트를 프롬프트에 붙일 형태로 만든다 */
export function asContext(hits: Hit[]): string {
  if (hits.length === 0) return '';
  return [
    '아래는 사용자가 예전에 저장해 둔 노트다. 답할 때 참고하고, 참고한 내용은 자연스럽게 녹여서 쓴다.',
    ...hits.map((h, i) => `[노트 ${i + 1}] ${h.title}\n${h.excerpt}`),
  ].join('\n\n');
}

function excerptFor(note: Note, words: string[], max = 300): string {
  const lines = `${note.summary}\n${note.body}`.split('\n').filter((l) => l.trim());
  const hit = lines.find((l) => words.some((w) => l.toLowerCase().includes(w)));
  const base = [note.summary, hit].filter(Boolean).join('\n');
  return (base || lines.slice(0, 2).join('\n')).slice(0, max);
}

function tokenize(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^0-9a-z가-힣\s]/g, ' ')
        .split(/\s+/)
        .map((w) => w.replace(/(이|가|을|를|은|는|의|에|와|과|랑|이랑|에서|으로|로|뭐야|뭔데|알려줘)$/, ''))
        .filter((w) => w.length >= 2),
    ),
  ];
}
