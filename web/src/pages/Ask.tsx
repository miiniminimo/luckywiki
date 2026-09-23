import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Preview } from '../api';

const SAMPLES = ['프로세스랑 스레드 차이가 뭐야?', 'RAG가 뭐야?'];

export default function Ask() {
  const nav = useNavigate();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState<'' | 'ask' | 'preview' | 'save'>('');
  const [toast, setToast] = useState('');

  const note = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  async function onAsk() {
    if (!question.trim()) return;
    setBusy('ask');
    setAnswer('');
    setPreview(null);
    try {
      const r = await api.ask(question);
      setAnswer(r.answer);
    } catch (e) {
      note(String(e));
    } finally {
      setBusy('');
    }
  }

  async function onPreview() {
    setBusy('preview');
    try {
      const p = await api.preview(question, answer);
      setPreview(p);
      setPicked(p.links);
    } catch (e) {
      note(String(e));
    } finally {
      setBusy('');
    }
  }

  async function onSave() {
    if (!preview) return;
    setBusy('save');
    try {
      const saved = await api.save({
        title: preview.title,
        summary: preview.summary,
        tags: preview.tags,
        body: preview.body,
        links: picked,
        question,
        raw: answer,
      });
      nav(`/notes/${saved.slug}`);
    } catch (e) {
      note(String(e));
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <h1>물어보고, 남기기</h1>
      <p className="sub">
        LLM에게 물어본 내용은 보통 그냥 지나갑니다. 답을 받은 뒤 <b>저장할지 고르면</b> 요약·태그·연결까지
        만들어 마크다운 노트로 쌓습니다.
      </p>

      <div className="card">
        <textarea
          rows={3}
          placeholder="궁금한 것을 물어보세요"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onAsk();
          }}
        />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={onAsk} disabled={busy !== '' || !question.trim()}>
            {busy === 'ask' ? '생각하는 중…' : '물어보기'}
          </button>
          <span className="meta">Ctrl + Enter</span>
          <div className="spacer" />
          {SAMPLES.map((s) => (
            <button key={s} onClick={() => setQuestion(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {answer && (
        <div className="card">
          <h2>답변</h2>
          <div className="answer">{answer}</div>
          <div className="row" style={{ marginTop: 16 }}>
            <b>이 내용을 위키에 저장할까요?</b>
            <div className="spacer" />
            <button className="primary" onClick={onPreview} disabled={busy !== ''}>
              {busy === 'preview' ? '정리하는 중…' : '정리해서 저장하기'}
            </button>
            <button onClick={() => setAnswer('')} disabled={busy !== ''}>
              그냥 넘기기
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div className="card">
          <h2>저장 전 확인</h2>
          <p className="sub">모델이 정리한 내용입니다. 고쳐서 저장할 수 있습니다.</p>

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
            <button className="primary" onClick={onSave} disabled={busy !== ''}>
              {busy === 'save' ? '저장 중…' : '마크다운으로 저장'}
            </button>
            <button onClick={() => setPreview(null)}>취소</button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
