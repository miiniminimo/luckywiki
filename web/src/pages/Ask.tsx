import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Preview, Turn, Used } from '../api';
import Markdown from '../Markdown';

const SAMPLES = ['프로세스랑 스레드 차이가 뭐야?', 'RAG가 뭐야?', '그럼 락은 왜 필요해?'];

type Msg = { role: 'user' | 'assistant'; content: string; used?: Used[] };

export default function Ask() {
  const nav = useNavigate();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [question, setQuestion] = useState('');
  const [useNotes, setUseNotes] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState<'' | 'ask' | 'preview' | 'save'>('');
  const [toast, setToast] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, busy]);

  const note = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2600);
  };

  /** 마지막 질문·답변 한 쌍 (노트로 저장할 대상) */
  function lastPair() {
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') {
        const q = msgs.slice(0, i).reverse().find((m) => m.role === 'user');
        return { question: q?.content ?? '', answer: msgs[i].content };
      }
    }
    return { question: '', answer: '' };
  }

  async function onAsk(text?: string) {
    const q = (text ?? question).trim();
    if (!q || busy) return;
    setQuestion('');
    setPreview(null);
    const history: Turn[] = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: 'user', content: q }]);
    setBusy('ask');
    try {
      const r = await api.ask(q, history, useNotes);
      setMsgs((m) => [...m, { role: 'assistant', content: r.answer, used: r.used }]);
    } catch (e) {
      note(String(e));
    } finally {
      setBusy('');
    }
  }

  async function onPreview() {
    const { question: q, answer } = lastPair();
    if (!answer) return;
    setBusy('preview');
    try {
      const p = await api.preview(q, answer);
      const others = p.candidates.filter((c) => c !== p.title);
      setPreview({ ...p, candidates: others });
      setPicked(p.links.filter((l) => others.includes(l)));
    } catch (e) {
      note(String(e));
    } finally {
      setBusy('');
    }
  }

  async function onSave(mode: 'new' | 'append') {
    if (!preview) return;
    const { question: q, answer } = lastPair();
    setBusy('save');
    try {
      const payload = {
        title: preview.title,
        summary: preview.summary,
        tags: preview.tags,
        body: preview.body,
        links: picked,
        question: q,
        raw: answer,
      };
      const saved =
        mode === 'append' && preview.existing
          ? await api.append(preview.existing.slug, payload)
          : await api.save(payload);
      nav(`/notes/${saved.slug}`);
    } catch (e) {
      note(String(e));
    } finally {
      setBusy('');
    }
  }

  const hasAnswer = msgs.some((m) => m.role === 'assistant');

  return (
    <>
      <h1>물어보고, 남기기</h1>
      <p className="sub">
        이어서 더 물어본 뒤, 마음에 드는 답을 <b>정리해서 노트로</b> 남기세요. 저장한 노트는 다음 질문의
        근거로도 쓰입니다.
      </p>

      {msgs.length === 0 && (
        <div className="card">
          <h2>이렇게 써 보세요</h2>
          <div className="row">
            {SAMPLES.map((s) => (
              <button key={s} onClick={() => onAsk(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {msgs.map((m, i) => (
        <div key={i} className={`card msg ${m.role}`}>
          {m.role === 'user' ? (
            <div className="qtext">{m.content}</div>
          ) : (
            <>
              <Markdown text={m.content} />
              {m.used && m.used.length > 0 && (
                <div className="used">
                  참고한 내 노트:{' '}
                  {m.used.map((u) => (
                    <a
                      key={u.slug}
                      href={`/notes/${u.slug}`}
                      onClick={(e) => {
                        e.preventDefault();
                        nav(`/notes/${u.slug}`);
                      }}
                    >
                      {u.title}
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ))}

      {busy === 'ask' && (
        <div className="card msg assistant">
          <span className="dots">
            <i />
            <i />
            <i />
          </span>
        </div>
      )}

      {hasAnswer && !preview && busy !== 'ask' && (
        <div className="card row">
          <b>이 내용을 위키에 저장할까요?</b>
          <div className="spacer" />
          <button className="primary" onClick={onPreview} disabled={busy !== ''}>
            {busy === 'preview' ? '정리하는 중…' : '정리해서 저장하기'}
          </button>
          <button onClick={() => setMsgs([])} disabled={busy !== ''}>
            대화 비우기
          </button>
        </div>
      )}

      {preview && (
        <div className="card">
          <h2>저장 전 확인</h2>
          {preview.existing && (
            <p className="hint">
              같은 주제의 노트가 이미 있습니다: <b>{preview.existing.title}</b>. 새로 만들지, 그 노트에 이어
              쓸지 고르세요.
            </p>
          )}

          <label className="meta">제목</label>
          <input
            type="text"
            value={preview.title}
            onChange={(e) => setPreview({ ...preview, title: e.target.value })}
          />

          <label className="meta" style={{ display: 'block', marginTop: 12 }}>
            한 줄 요약
          </label>
          <input
            type="text"
            value={preview.summary}
            onChange={(e) => setPreview({ ...preview, summary: e.target.value })}
          />

          <label className="meta" style={{ display: 'block', marginTop: 12 }}>
            태그 (쉼표로 구분)
          </label>
          <input
            type="text"
            value={preview.tags.join(', ')}
            onChange={(e) =>
              setPreview({ ...preview, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })
            }
          />

          <label className="meta" style={{ display: 'block', marginTop: 12 }}>
            정리된 본문
          </label>
          <textarea
            rows={8}
            value={preview.body}
            onChange={(e) => setPreview({ ...preview, body: e.target.value })}
          />

          <div style={{ marginTop: 14 }}>
            <label className="meta">연결할 노트</label>
            {preview.candidates.length === 0 && <div className="meta">아직 연결할 노트가 없습니다.</div>}
            {preview.candidates.map((c) => (
              <label key={c} className="check">
                <input
                  type="checkbox"
                  checked={picked.includes(c)}
                  onChange={(e) =>
                    setPicked(e.target.checked ? [...picked, c] : picked.filter((p) => p !== c))
                  }
                />
                [[{c}]]
              </label>
            ))}
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button className="primary" onClick={() => onSave('new')} disabled={busy !== ''}>
              {busy === 'save' ? '저장 중…' : '새 노트로 저장'}
            </button>
            {preview.existing && (
              <button onClick={() => onSave('append')} disabled={busy !== ''}>
                «{preview.existing.title}»에 이어 쓰기
              </button>
            )}
            <button onClick={() => setPreview(null)}>취소</button>
          </div>
        </div>
      )}

      <div className="composer">
        <textarea
          rows={2}
          placeholder={msgs.length ? '이어서 물어보기' : '궁금한 것을 물어보세요'}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onAsk();
            }
          }}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <label className="check" title="저장해 둔 노트에서 관련 내용을 찾아 근거로 씁니다">
            <input type="checkbox" checked={useNotes} onChange={(e) => setUseNotes(e.target.checked)} />
            내 노트 참고
          </label>
          <span className="meta">Enter 전송 · Shift+Enter 줄바꿈</span>
          <div className="spacer" />
          <button className="primary" onClick={() => onAsk()} disabled={busy !== '' || !question.trim()}>
            {busy === 'ask' ? '생각하는 중…' : '물어보기'}
          </button>
        </div>
      </div>

      <div ref={endRef} />
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
