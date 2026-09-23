import { readAll } from './store.js';

/**
 * 새 질문·답변과 겹치는 기존 노트를 고른다.
 * 1) 제목 단어 겹침 2) 태그 겹침 3) 최근 노트 순서로 후보를 만든다.
 * 모델에는 이 후보 목록만 주고, 목록 밖의 제목은 버린다(없는 노트를 지어내지 못하게).
 */
export function linkCandidates(text: string, limit = 6): string[] {
  const notes = readAll();
  const haystack = text.toLowerCase();

  const scored = notes.map((n) => {
    let score = 0;
    const words = n.title.toLowerCase().split(/[\s·,()]+/).filter((w) => w.length >= 2);
    for (const w of words) if (haystack.includes(w)) score += 2;
    for (const t of n.tags) if (haystack.includes(t.toLowerCase())) score += 1;
    return { title: n.title, score, updated: n.updated };
  });

  return scored
    .sort((a, b) => b.score - a.score || (a.updated < b.updated ? 1 : -1))
    .filter((s, i) => s.score > 0 || i < 3) // 겹치는 게 없어도 최근 3개는 후보로
    .slice(0, limit)
    .map((s) => s.title);
}
