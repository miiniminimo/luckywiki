import type { Note } from '../notes/format.js';

/** 노션은 [[위키링크]]를 모르므로 일반 마크다운 링크로 바꾼다. */
export function toNotionMarkdown(note: Note, raw: string): string {
  return raw
    .replace(/^---\n[\s\S]*?\n---\n/, '') // frontmatter 제거 (노션은 속성으로 관리)
    .replace(/\[\[([^\]]+)\]\]/g, (_, title: string) => `**${title}**`)
    .replace(/<\/?details>|<summary>.*?<\/summary>/g, '')
    .trim();
}

/** NOTION_TOKEN·NOTION_DB_ID가 있으면 페이지를 만든다. 없으면 건너뛴다. */
export async function uploadToNotion(note: Note, markdown: string) {
  const token = process.env.NOTION_TOKEN;
  const db = process.env.NOTION_DB_ID;
  if (!token || !db) return { uploaded: false, reason: 'NOTION_TOKEN 또는 NOTION_DB_ID가 없습니다' };

  const blocks = markdown
    .split('\n\n')
    .filter(Boolean)
    .slice(0, 90) // 노션 한 번에 100블록 제한
    .map((p) => ({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: p.slice(0, 1900) } }] },
    }));

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'notion-version': '2022-06-28',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      parent: { database_id: db },
      properties: { title: { title: [{ text: { content: note.title } }] } },
      children: blocks,
    }),
  });

  if (!res.ok) return { uploaded: false, reason: `notion ${res.status}: ${await res.text()}` };
  const data = (await res.json()) as { url?: string };
  return { uploaded: true, url: data.url };
}
