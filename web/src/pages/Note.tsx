import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, NoteFull } from '../api';
import Markdown from '../Markdown';

export default function NotePage() {
  const { slug = '' } = useParams();
  const nav = useNavigate();
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<NoteFull | null>(null);
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
        setDraft(r.note);
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

      <div className="card row">
        <button onClick={() => setEdit((v) => !v)}>{edit ? '편집 닫기' : '고치기'}</button>
        <button
          onClick={async () => {
            if (!confirm('이 노트를 휴지통(vault/.trash)으로 옮길까요?')) return;
            await api.remove(slug);
            nav('/notes');
          }}
        >
          삭제
        </button>
        <div className="spacer" />
        <span className="meta">수정·삭제는 vault 폴더의 파일에 바로 반영됩니다</span>
      </div>

      {edit && draft && (
        <div className="card">
          <h2>고치기</h2>
          <label className="meta">제목</label>
          <input type="text" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <label className="meta" style={{ display: 'block', marginTop: 12 }}>한 줄 요약</label>
          <input type="text" value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
          <label className="meta" style={{ display: 'block', marginTop: 12 }}>태그 (쉼표로 구분)</label>
          <input
            type="text"
            value={draft.tags.join(', ')}
            onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
          />
          <label className="meta" style={{ display: 'block', marginTop: 12 }}>본문</label>
          <textarea rows={10} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          <div className="row" style={{ marginTop: 14 }}>
            <button
              className="primary"
              onClick={async () => {
                await api.update(slug, {
                  title: draft.title,
                  summary: draft.summary,
                  tags: draft.tags,
                  body: draft.body,
                });
                const r = await api.note(slug);
                setNote(r.note);
                setDraft(r.note);
                setRaw(r.raw);
                setEdit(false);
                setToast('저장했습니다');
                setTimeout(() => setToast(''), 2000);
              }}
            >
              저장
            </button>
            <button onClick={() => { setDraft(note); setEdit(false); }}>취소</button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>한 줄 요약</h2>
        <Markdown text={note.summary} />
      </div>

      <div className="card md">
        <h2>정리</h2>
        <Markdown text={note.body} />
      </div>

      {note.links.length > 0 && (
        <div className="card">
          <h2>연결</h2>
          {note.links.map((l) => (
            <Markdown key={l} text={`- [[${l}]]`} />
          ))}
        </div>
      )}

      <div className="card">
        <h2>원문 답변</h2>
        <details>
          <summary className="meta">모델이 처음 답한 원문 보기</summary>
          <div style={{ marginTop: 10 }}>
            <Markdown text={note.raw} />
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
