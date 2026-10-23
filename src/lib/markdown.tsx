import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

// A deliberately tiny, safe text formatter: paragraphs, headings, quotes, lists, **bold**,
// *italic*, [links](https://…) and [[Note links]]. It builds React elements, never raw HTML.

type LinkResolver = (title: string) => string | null;

function inline(text: string, resolve?: LinkResolver): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[\[([^\]]+)\]\]|\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|(https?:\/\/[^\s<]+)/g;
  let last = 0; let m: RegExpExecArray | null; let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      const to = resolve?.(m[1]);
      out.push(to ? <Link key={k++} className="wikilink" to={to}>{m[1]}</Link> : <span key={k++} className="wikilink missing" title="This note hasn't been planted yet">{m[1]}</span>);
    } else if (m[2]) out.push(<a key={k++} href={m[3]} target="_blank" rel="noopener noreferrer">{m[2]}</a>);
    else if (m[4]) out.push(<strong key={k++}>{m[4]}</strong>);
    else if (m[5]) out.push(<em key={k++}>{m[5]}</em>);
    else if (m[6]) out.push(<a key={k++} href={m[6]} target="_blank" rel="noopener noreferrer">{m[6].replace(/^https?:\/\//, '').slice(0, 50)}</a>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Prose({ text, resolve, className = 'prose' }: { text?: string; resolve?: LinkResolver; className?: string }) {
  const blocks = (text ?? '').replace(/\r/g, '').split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        const t = b.trim();
        if (!t) return null;
        if (t.startsWith('### ')) return <h4 key={i}>{inline(t.slice(4), resolve)}</h4>;
        if (t.startsWith('## ')) return <h3 key={i}>{inline(t.slice(3), resolve)}</h3>;
        if (t.startsWith('# ')) return <h2 key={i}>{inline(t.slice(2), resolve)}</h2>;
        if (t.startsWith('> ')) return <blockquote key={i}>{inline(t.replace(/^> ?/gm, ''), resolve)}</blockquote>;
        if (/^[-*] /.test(t)) return <ul key={i}>{t.split('\n').map((l, j) => <li key={j}>{inline(l.replace(/^[-*] /, ''), resolve)}</li>)}</ul>;
        return <p key={i}>{t.split('\n').map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l, resolve)}</Fragment>)}</p>;
      })}
    </div>
  );
}

export const wikiLinks = (text = '') => [...text.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim());
