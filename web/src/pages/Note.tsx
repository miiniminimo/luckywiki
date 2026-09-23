import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, NoteFull } from '../api';

export default function NotePage() {
  const { slug = '' } = useParams();
  const [note, setNote] = useState<NoteFull | null>(null);
  const [raw, setRaw] = useState('');
  const [file, setFile] = useState('');
  const [notion, setNotion] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    api
      .note(slug)
      .then((r) => {
        setNote(r.note);
        setRaw(r.raw);
        setFile(r.file);
      })
      .catch((e) => setToast(String(e)));
  }, [slug]);

  async function onNotion() {
    const r = await api.exportNotion(slug);
    setNotion(r.markdown);
    await navigator.clipboard?.writeText(r.markdown).catch(() => {});
    setToast('노션용 마크다운을 복사했습니다');
    setTimeout(() => setToast(''), 2500);
  }

  if (!note) return <div className="empty">{toast || '불러오는 중…'}</div>;

  return (
    <>
      <p className="meta">
        <Link to="/notes">← 노트 목록</Link>
      </p>
      <h1>{note.title}</h1>
      <p className="sub">
        {note.created} · {note.model}
        {note.tags.map((t) => (
          <span key={t} className="tag" style={{ marginLeft: 8 }}>
            #{t}
          </span>
        ))}
      </p>

      <div className="card">
        <h2>한 줄 요약</h2>
        <div>{note.summary}</div>
      </div>

      <div className="card md">
        <h2>정리</h2>
        <div className="answer">{note.body}</div>
      </div>

      {note.links.length > 0 && (
        <div className="card">
          <h2>연결</h2>
          {note.links.map((l) => (
            <div key={l}>[[{l}]]</div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>원문 답변</h2>
        <details>
          <summary className="meta">모델이 처음 답한 원문 보기</summary>
          <div className="answer" style={{ marginTop: 10 }}>
            {note.raw}
          </div>
        </details>
      </div>

      <div className="card">
        <div className="row">
          <button onClick={onNotion}>노션용 마크다운 내보내기</button>
          <div className="spacer" />
          <span className="mono">vault/{file}</span>
        </div>
        {notion && (
          <textarea rows={8} readOnly value={notion} style={{ marginTop: 12 }} />
        )}
      </div>

      <details className="card">
        <summary className="meta">저장된 마크다운 원본 보기</summary>
        <textarea rows={14} readOnly value={raw} style={{ marginTop: 12 }} />
      </details>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
