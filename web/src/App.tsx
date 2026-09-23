import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { api, Health } from './api';
import Ask from './pages/Ask';
import Notes from './pages/Notes';
import NotePage from './pages/Note';
import Graph from './pages/Graph';

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  return (
    <>
      <header className="top">
        <div className="logo">
          Lucky<span>Wiki</span>
        </div>
        <nav className="nav">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'on' : '')} end>
            묻기
          </NavLink>
          <NavLink to="/notes" className={({ isActive }) => (isActive ? 'on' : '')}>
            노트
          </NavLink>
          <NavLink to="/graph" className={({ isActive }) => (isActive ? 'on' : '')}>
            그래프
          </NavLink>
        </nav>
        <div className="status">
          {health ? (
            <>
              <span className={`badge ${health.stub ? 'stub' : 'live'}`}>
                {health.stub ? '모의 모드' : `연결됨 · ${health.model}`}
              </span>
              <span className="badge">노트 {health.notes}개</span>
            </>
          ) : (
            <span className="badge">서버 확인 중…</span>
          )}
        </div>
      </header>

      <main className="wrap">
        <Routes>
          <Route path="/" element={<Ask />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/notes/:slug" element={<NotePage />} />
          <Route path="/graph" element={<Graph />} />
        </Routes>
      </main>
    </>
  );
}
