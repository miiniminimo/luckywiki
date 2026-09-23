// 모의 모드: Ollama가 없을 때도 화면·저장·링크·그래프를 끝까지 검사할 수 있게 한다.
// 시연 중에는 화면 위쪽에 "모의 모드" 배지가 뜬다.
import type { Organized } from './ollama.js';

const CANNED: { match: RegExp; answer: string }[] = [
  {
    match: /프로세스|스레드|thread/i,
    answer: `프로세스는 **실행 중인 프로그램**입니다. 자기만의 메모리 공간(주소 공간)을 가집니다.
스레드는 그 프로세스 **안에서 나뉜 실행 흐름**입니다. 메모리를 함께 쓰고 스택만 따로 가집니다.

- 프로세스끼리는 서로의 메모리를 볼 수 없어 안전하지만, 만들고 전환하는 비용이 큽니다.
- 스레드는 가볍고 데이터를 바로 주고받을 수 있지만, 같은 변수를 동시에 건드리면 값이 깨질 수 있습니다(경쟁 조건).
- 그래서 스레드를 쓸 때는 락 같은 동기화 장치가 필요합니다.`,
  },
  {
    match: /rag|검색 증강|임베딩/i,
    answer: `RAG(Retrieval-Augmented Generation)는 **먼저 찾아보고 답하게 만드는 방식**입니다.

1. 문서를 잘라 임베딩(숫자 벡터)으로 바꿔 저장합니다.
2. 질문이 오면 비슷한 조각을 찾아옵니다.
3. 그 조각을 프롬프트에 붙여 모델이 근거를 보고 답하게 합니다.

모델이 모르는 최신 정보나 사내 문서를 다룰 때 씁니다. 찾아온 조각이 엉뚱하면 답도 엉뚱해지므로, 검색 품질이 곧 답변 품질입니다.`,
  },
];

const DEFAULT_ANSWER = (q: string) => `(모의 모드) "${q}"에 대한 예시 답변입니다.

Ollama가 실행 중이면 exaone3.5:2.4b 모델이 실제로 답합니다. 지금은 모델 없이도 저장·정리·연결 흐름을 확인할 수 있도록 미리 준비된 문장을 보여 줍니다.

- 핵심 1: 질문한 내용을 노트로 남기면 다음에 다시 찾을 수 있습니다.
- 핵심 2: 노트끼리 연결해 두면 관련 주제를 함께 볼 수 있습니다.`;

export function stubAnswer(question: string, context = ''): string {
  const base = CANNED.find((c) => c.match.test(question))?.answer ?? DEFAULT_ANSWER(question);
  if (!context) return base;
  return `${base}

> 저장해 둔 노트를 참고했습니다. (모의 모드에서는 참고한 노트 제목만 아래에 표시됩니다)`;
}

export function stubOrganize(question: string, answer: string, candidates: string[]): Organized {
  const title = question.replace(/[?？]/g, '').trim().slice(0, 20) || '제목 없는 노트';
  const lines = answer
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const bullets = lines.filter((l) => l.startsWith('-')).slice(0, 4);
  const body = [
    '### 핵심',
    bullets.length ? bullets.join('\n') : `- ${lines[0] ?? answer.slice(0, 80)}`,
    '',
    '### 더 알아볼 것',
    '- (모의 모드에서 채운 항목입니다)',
  ].join('\n');

  return {
    title,
    summary: lines[0]?.replace(/[*#]/g, '').slice(0, 80) ?? '요약 없음',
    tags: guessTags(question + ' ' + answer),
    body,
    links: candidates.slice(0, 2),
  };
}

function guessTags(text: string): string[] {
  const table: [RegExp, string][] = [
    [/프로세스|스레드|운영체제|메모리/i, 'os'],
    [/rag|llm|모델|임베딩|ai/i, 'ai'],
    [/네트워크|tcp|http/i, 'network'],
    [/리액트|자바스크립트|서버|api/i, 'dev'],
  ];
  const tags = table.filter(([re]) => re.test(text)).map(([, t]) => t);
  return tags.length ? tags.slice(0, 3) : ['note'];
}
