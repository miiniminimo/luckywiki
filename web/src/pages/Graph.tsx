import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

type Node = { id: string; title: string; tags: string[] };
type Edge = { from: string; to: string };

export default function Graph() {
  const nav = useNavigate();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    api.graph().then((g) => {
      setNodes(g.nodes);
      setEdges(g.edges);
    });
  }, []);

  // 노트를 원형으로 배치한다 (노트 수가 적어 이 정도면 충분히 보인다)
  const W = 820;
  const H = 460;
  const R = Math.min(W, H) / 2 - 70;
  const pos = new Map(
    nodes.map((n, i) => {
      const a = (i / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
      return [n.id, { x: W / 2 + R * Math.cos(a), y: H / 2 + R * Math.sin(a) }];
    }),
  );

  return (
    <>
      <h1>연결 그래프</h1>
      <p className="sub">
        노트 {nodes.length}개 · 연결 {edges.length}개. 점을 누르면 그 노트로 갑니다. 옵시디언 그래프 뷰에서도
        같은 모양으로 보입니다.
      </p>

      <div className="card">
        {nodes.length === 0 ? (
          <div className="empty">아직 노트가 없습니다.</div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="노트 연결 그래프">
            {edges.map((e, i) => {
              const a = pos.get(e.from);
              const b = pos.get(e.to);
              if (!a || !b) return null;
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#cfcfe8" strokeWidth={1.6} />;
            })}
            {nodes.map((n) => {
              const p = pos.get(n.id)!;
              const deg = edges.filter((e) => e.from === n.id || e.to === n.id).length;
              return (
                <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/notes/${n.id}`)}>
                  <circle cx={p.x} cy={p.y} r={10 + deg * 2} fill="#7c5cff" opacity={0.85} />
                  <text x={p.x} y={p.y + 26} textAnchor="middle" fontSize="12" fill="#1f2328">
                    {n.title.length > 14 ? `${n.title.slice(0, 14)}…` : n.title}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </>
  );
}
