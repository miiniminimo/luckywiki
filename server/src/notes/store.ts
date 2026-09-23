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
