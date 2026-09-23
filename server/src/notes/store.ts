import fs from 'node:fs';
import path from 'node:path';
import { Note, parseMarkdown, toMarkdown, toSlug, wikiLinksIn } from './format.js';

export const VAULT_DIR = path.resolve(process.env.VAULT_DIR ?? path.join(process.cwd(), '..', 'vault'));

function ensureVault() {
  fs.mkdirSync(VAULT_DIR, { recursive: true });
}

export function listFiles(): string[] {
  ensureVault();
  return fs
    .readdirSync(VAULT_DIR)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .sort()
    .reverse();
}

export function readAll(): Note[] {
  return listFiles().map((file) => {
    const text = fs.readFileSync(path.join(VAULT_DIR, file), 'utf-8');
    return parseMarkdown(text, file.replace(/\.md$/, ''));
  });
}

export function readOne(slug: string): { note: Note; raw: string; file: string } | null {
  const file = listFiles().find((f) => f.replace(/\.md$/, '').endsWith(slug));
  if (!file) return null;
  const raw = fs.readFileSync(path.join(VAULT_DIR, file), 'utf-8');
  return { note: parseMarkdown(raw, slug), raw, file };
}

export function saveNote(input: Omit<Note, 'slug' | 'created' | 'updated'> & { slug?: string }): {
  note: Note;
  file: string;
  path: string;
} {
  ensureVault();
  const today = new Date().toISOString().slice(0, 10);
  const slug = input.slug?.trim() || toSlug(input.title);
  const note: Note = { ...input, slug, created: today, updated: today };
  const file = `${today}-${slug}.md`;
  const full = path.join(VAULT_DIR, file);
  fs.writeFileSync(full, toMarkdown(note), 'utf-8');
  return { note, file, path: full };
}

/** 노트 사이의 연결을 노드·엣지로 (그래프 화면용) */
export function buildGraph() {
  const notes = readAll();
  const byTitle = new Map(notes.map((n) => [n.title, n]));
  const nodes = notes.map((n) => ({ id: n.slug, title: n.title, tags: n.tags }));
  const edges: { from: string; to: string }[] = [];

  for (const n of notes) {
    const targets = new Set([...n.links, ...wikiLinksIn(n.body)]);
    for (const t of targets) {
      const target = byTitle.get(t);
      if (target && target.slug !== n.slug) edges.push({ from: n.slug, to: target.slug });
    }
  }
  return { nodes, edges };
}

/** 기존 노트에 새 문답을 절로 덧붙인다 (같은 주제를 또 물었을 때) */
export function appendToNote(
  slug: string,
  add: { question: string; summary: string; body: string; raw: string; tags: string[]; links: string[] },
) {
  const found = readOne(slug);
  if (!found) return null;

  const n = found.note;
  const today = new Date().toISOString().slice(0, 10);
  const merged: Note = {
    ...n,
    updated: today,
    tags: [...new Set([...n.tags, ...add.tags])],
    links: [...new Set([...n.links, ...add.links])].filter((l) => l !== n.title),
    body: [
      n.body,
      '',
      `### 추가 (${today})`,
      add.question ? `**물어본 것**: ${add.question}` : '',
      '',
      add.body.trim(),
    ]
      .filter((x) => x !== undefined)
      .join('\n'),
    raw: [n.raw, '', `--- ${today} ---`, add.raw.trim()].join('\n'),
  };

  fs.writeFileSync(path.join(VAULT_DIR, found.file), toMarkdown(merged), 'utf-8');
  return { slug: merged.slug, file: found.file, appended: true };
}

/** 노트 내용을 고친다 (제목·요약·태그·본문·연결) */
export function updateNote(slug: string, patch: Partial<Note>) {
  const found = readOne(slug);
  if (!found) return null;

  const merged: Note = {
    ...found.note,
    ...patch,
    slug: found.note.slug, // 파일 이름은 그대로 둔다 (링크가 깨지지 않게)
    updated: new Date().toISOString().slice(0, 10),
  };
  fs.writeFileSync(path.join(VAULT_DIR, found.file), toMarkdown(merged), 'utf-8');
  return { slug: merged.slug, file: found.file, updated: true };
}

/** 노트를 vault/.trash로 옮긴다 (바로 지우지 않는다) */
export function deleteNote(slug: string) {
  const found = readOne(slug);
  if (!found) return null;

  const trash = path.join(VAULT_DIR, '.trash');
  fs.mkdirSync(trash, { recursive: true });
  const target = path.join(trash, `${Date.now()}-${found.file}`);
  fs.renameSync(path.join(VAULT_DIR, found.file), target);
  return { slug, movedTo: target };
}
