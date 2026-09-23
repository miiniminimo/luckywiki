// LuckyWiki 자체 마크다운 규격을 한 곳에 모은 파일.
// 규격을 바꿀 일이 생기면 이 파일만 고치면 된다. (docs/format.md와 같은 내용)

export type Note = {
  title: string;
  slug: string;
  created: string;
  updated: string;
  tags: string[];
  model: string;
  question: string;
  links: string[]; // 노트 제목 목록 (대괄호 없이 저장)
  summary: string;
  body: string; // 정리한 본문 (마크다운)
  raw: string; // 모델 원문 답변
};

const SECTION = {
  summary: '## 한 줄 요약',
  body: '## 정리',
  raw: '## 원문 답변',
  links: '## 연결',
};

export function toMarkdown(note: Note): string {
  const fm = [
    '---',
    `title: "${escapeQuotes(note.title)}"`,
    `slug: ${note.slug}`,
    `created: ${note.created}`,
    `updated: ${note.updated}`,
    `tags: [${note.tags.join(', ')}]`,
    `model: ${note.model}`,
    `question: "${escapeQuotes(note.question)}"`,
    `links: [${note.links.map((l) => `"[[${l}]]"`).join(', ')}]`,
    '---',
  ].join('\n');

  const linkLines = note.links.length
    ? note.links.map((l) => `- [[${l}]]`).join('\n')
    : '- (아직 없음)';

  return [
    fm,
    '',
    `# ${note.title}`,
    '',
    SECTION.summary,
    note.summary.trim(),
    '',
    SECTION.body,
    note.body.trim(),
    '',
    SECTION.raw,
    '<details><summary>모델이 처음 답한 원문 보기</summary>',
    '',
    note.raw.trim(),
    '',
    '</details>',
    '',
    SECTION.links,
    linkLines,
    '',
  ].join('\n');
}

export function parseMarkdown(text: string, fallbackSlug: string): Note {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  const fmText = m ? m[1] : '';
  const body = m ? text.slice(m[0].length) : text;
  const fm = Object.fromEntries(
    fmText
      .split('\n')
      .map((line) => {
        const i = line.indexOf(':');
        if (i < 0) return null;
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      })
      .filter(Boolean) as [string, string][],
  );

  return {
    title: unquote(fm.title ?? fallbackSlug),
    slug: fm.slug ?? fallbackSlug,
    created: fm.created ?? '',
    updated: fm.updated ?? fm.created ?? '',
    tags: parseList(fm.tags).map(unquote),
    model: fm.model ?? '',
    question: unquote(fm.question ?? ''),
    links: parseList(fm.links).map((s) => unquote(s).replace(/^\[\[|\]\]$/g, '')),
    summary: section(body, SECTION.summary),
    body: section(body, SECTION.body),
    raw: section(body, SECTION.raw)
      .replace(/<\/?details>|<summary>.*?<\/summary>/g, '')
      .trim(),
  };
}

/** 본문에서 [[위키링크]]를 모두 뽑는다 (그래프용) */
export function wikiLinksIn(text: string): string[] {
  return [...text.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim());
}

/** 한글 제목도 파일 이름으로 쓸 수 있게 정리 */
export function toSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^0-9a-z가-힣\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'note'
  );
}

function section(body: string, heading: string): string {
  const start = body.indexOf(heading);
  if (start < 0) return '';
  const after = body.slice(start + heading.length);
  const next = after.search(/\n## /);
  return (next < 0 ? after : after.slice(0, next)).trim();
}

function parseList(v?: string): string[] {
  if (!v) return [];
  return v
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const unquote = (s: string) => s.replace(/^"|"$/g, '');
const escapeQuotes = (s: string) => s.replace(/"/g, "'");
