export const ANSWER_SYSTEM = `너는 한국어로 설명하는 학습 도우미다.
- 쉬운 말로, 군더더기 없이 답한다.
- 전문 용어는 처음 나올 때 한 줄로 풀어 준다.
- 모르는 것은 모른다고 말한다.`;

export function organizePrompt(question: string, answer: string, candidates: string[]) {
  return `아래 질문과 답변을 위키 노트로 정리해라.
반드시 JSON만 출력한다. 설명 문장을 붙이지 마라.

형식:
{
  "title": "20자 이내 제목",
  "summary": "한 줄 요약",
  "tags": ["소문자 영문 태그", "최대 3개"],
  "body": "소제목(###)과 목록으로 정리한 마크다운 본문",
  "links": ["아래 후보 목록에 있는 제목만"]
}

관련 노트 후보(이 목록에 없는 제목은 절대 쓰지 마라): ${candidates.length ? candidates.join(' / ') : '(없음)'}

[질문]
${question}

[답변]
${answer}`;
}
