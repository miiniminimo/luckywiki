export type Health = {
  ollama: boolean;
  stub: boolean;
  model: string;
  host: string;
  vault: string;
  notes: number;
};

export type Preview = {
  title: string;
  summary: string;
  tags: string[];
  body: string;
  links: string[];
  candidates: string[];
  stub: boolean;
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
  ask: (question: string) =>
    j<{ answer: string; stub: boolean; model: string }>('/api/ask', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
  preview: (question: string, answer: string) =>
    j<Preview>('/api/notes/preview', { method: 'POST', body: JSON.stringify({ question, answer }) }),
  save: (note: Record<string, unknown>) =>
    j<{ slug: string; file: string; path: string }>('/api/notes', {
      method: 'POST',
      body: JSON.stringify(note),
    }),
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
