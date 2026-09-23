import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, NoteSummary } from '../api';

export default function Notes() {
  const [q, setQ] = useState('');
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api
        .notes(q)
        .then((r) => setNotes(r.notes))
        .finally(() => setLoading(false));
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <h1>노트</h1>
      <p className="sub">저장한 노트는 마크다운 파일이라 옵시디언에서 그대로 열립니다.</p>

      <div className="card">
        <input
          type="text"
          placeholder="제목·요약·태그로 찾기"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="card">
        {loading && <div className="empty">불러오는 중…</div>}
        {!loading && notes.length === 0 && (
          <div className="empty">
            아직 노트가 없습니다. <Link to="/">묻기</Link>에서 질문하고 저장해 보세요.
          </div>
        )}
        {!loading &&
          notes.map((n) => (
            <div key={n.slug} className="note-item">
              <div className="title">
                <Link to={`/notes/${n.slug}`}>{n.title}</Link>
              </div>
              <div>{n.summary}</div>
              <div style={{ marginTop: 6 }}>
                {n.tags.map((t) => (
                  <span key={t} className="tag">
                    #{t}
                  </span>
                ))}
                <span className="meta">
                  {n.created}
                  {n.links.length > 0 && ` · 연결 ${n.links.length}개`}
                </span>
              </div>
            </div>
          ))}
      </div>
    </>
  );
}
