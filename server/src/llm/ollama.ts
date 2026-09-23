import { stubAnswer, stubOrganize } from './stub.js';
import { ANSWER_SYSTEM, organizePrompt } from './prompts.js';

export const HOST = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
export const MODEL = process.env.LUCKY_MODEL ?? 'exaone3.5:2.4b';
const FORCE_STUB = process.env.LUCKY_STUB === '1';

export type Organized = {
  title: string;
  summary: string;
  tags: string[];
  body: string;
  links: string[];
};

export async function ping(): Promise<boolean> {
  if (FORCE_STUB) return false;
  try {
    const res = await fetch(`${HOST}/api/tags`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function chat(prompt: string, system = ANSWER_SYSTEM, json = false): Promise<string> {
  const res = await fetch(`${HOST}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      ...(json ? { format: 'json' } : {}),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content?.trim() ?? '';
}

/** 질문에 답한다. 모델이 없으면 모의 답변으로 대신한다. */
export async function ask(question: string): Promise<{ answer: string; stub: boolean }> {
  if (!(await ping())) return { answer: stubAnswer(question), stub: true };
  try {
    return { answer: await chat(question), stub: false };
  } catch {
    return { answer: stubAnswer(question), stub: true };
  }
}

/** 질문·답변을 노트 형태로 정리한다. 후보 목록 밖의 링크는 버린다. */
export async function organize(
  question: string,
  answer: string,
  candidates: string[],
): Promise<{ result: Organized; stub: boolean }> {
  const clean = (o: Organized): Organized => ({
    ...o,
    tags: (o.tags ?? []).slice(0, 3),
    links: (o.links ?? []).filter((l) => candidates.includes(l)),
  });

  if (!(await ping())) return { result: clean(stubOrganize(question, answer, candidates)), stub: true };
  try {
    const text = await chat(organizePrompt(question, answer, candidates), ANSWER_SYSTEM, true);
    const parsed = JSON.parse(text) as Organized;
    return { result: clean(parsed), stub: false };
  } catch {
    return { result: clean(stubOrganize(question, answer, candidates)), stub: true };
  }
}
