import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { api } from './api';

/**
 * 마크다운을 화면에 그린다.
 * [[위키링크]]는 같은 제목의 노트로 가는 링크로 바꾼다. 없는 노트면 점선 표시만 한다.
 */
export default function Markdown({ text }: { text: string }) {
  const nav = useNavigate();
  const [slugByTitle, setSlugByTitle] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!text.includes('[[')) return;
    api
      .notes()
      .then((r) => setSlugByTitle(Object.fromEntries(r.notes.map((n) => [n.title, n.slug]))))
      .catch(() => {});
  }, [text]);

  // [[제목]] → [제목](wiki:제목) 으로 바꿔 두고 아래 a 처리에서 가로챈다
  const prepared = text.replace(/\[\[([^\]]+)\]\]/g, (_, t: string) => `[${t}](wiki:${encodeURIComponent(t)})`);

  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children, ...rest }) {
            if (href?.startsWith('wiki:')) {
              const title = decodeURIComponent(href.slice(5));
              const slug = slugByTitle[title];
              return slug ? (
                <a
                  className="wikilink"
                  href={`/notes/${slug}`}
                  onClick={(e) => {
                    e.preventDefault();
                    nav(`/notes/${slug}`);
                  }}
                >
                  {children}
                </a>
              ) : (
                <span className="wikilink missing" title="아직 없는 노트">
                  {children}
                </span>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer" {...rest}>
                {children}
              </a>
            );
          },
        }}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
}
