export type Health = {
  ollama: boolean;
  stub: boolean;
  model: string;
  host: string;
  vault: string;
  notes: number;
};

export type Turn = { role: 'user' | 'assistant'; content: string };
export type Used = { slug: string; title: string };

export type Preview = {
  title: string;
  summary: string;
  tags: string[];
  body: string;
  links: string[];
  candidates: string[];
  stub: boolean;
  existing: { slug: string; title: string } | null;
};

export type NoteSummary = {
  slug: string;
  title: string;
  tags: string[];
  created: string;
  summary: string;
  links: string[];
};

export type NoteFull = {
  title: string;
  slug: string;
  created: string;
  tags: string[];
  model: string;
  question: string;
  links: string[];
  summary: string;
  body: string;
  raw: string;
};

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `요청 실패 (${res.status})`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => j<Health>('/api/health'),
  ask: (question: string, history: Turn[] = [], useNotes = true) =>
    j<{ answer: string; stub: boolean; model: string; used: Used[] }>('/api/ask', {
      method: 'POST',
      body: JSON.stringify({ question, history, useNotes }),
    }),
  preview: (question: string, answer: string) =>
    j<Preview>('/api/notes/preview', { method: 'POST', body: JSON.stringify({ question, answer }) }),
  save: (note: Record<string, unknown>) =>
    j<{ slug: string; file: string; path: string }>('/api/notes', {
      method: 'POST',
      body: JSON.stringify(note),
    }),
  append: (slug: string, note: Record<string, unknown>) =>
    j<{ slug: string; file: string; appended: boolean }>(`/api/notes/${slug}/append`, {
      method: 'POST',
      body: JSON.stringify(note),
    }),
  update: (slug: string, patch: Record<string, unknown>) =>
    j<{ slug: string; updated: boolean }>(`/api/notes/${slug}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  remove: (slug: string) => j<{ slug: string; movedTo: string }>(`/api/notes/${slug}`, { method: 'DELETE' }),
  notes: (q = '') => j<{ notes: NoteSummary[] }>(`/api/notes?q=${encodeURIComponent(q)}`),
  note: (slug: string) => j<{ note: NoteFull; raw: string; file: string }>(`/api/notes/${slug}`),
  graph: () =>
    j<{ nodes: { id: string; title: string; tags: string[] }[]; edges: { from: string; to: string }[] }>(
      '/api/graph',
    ),
  exportNotion: (slug: string, upload = false) =>
    j<{ markdown: string; uploaded: boolean; url?: string; reason?: string }>(
      `/api/export/notion/${slug}`,
      { method: 'POST', body: JSON.stringify({ upload }) },
    ),
};
