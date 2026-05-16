import { type ReactNode } from 'react';

// Tiny markdown renderer — enough for our problem statements.
// Supports: # h1, ## h2, paragraphs, fenced code blocks ```...```, inline `code`, bullet lists.

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let buffer = '';
  let i = 0;
  let keyCounter = 0;
  while (i < text.length) {
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end === -1) { buffer += text[i]; i++; continue; }
      if (buffer) { parts.push(buffer); buffer = ''; }
      parts.push(<code key={`c${keyCounter++}`}>{text.slice(i + 1, end)}</code>);
      i = end + 1;
    } else if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end === -1) { buffer += text[i]; i++; continue; }
      if (buffer) { parts.push(buffer); buffer = ''; }
      parts.push(<strong key={`b${keyCounter++}`}>{text.slice(i + 2, end)}</strong>);
      i = end + 2;
    } else {
      buffer += text[i];
      i++;
    }
  }
  if (buffer) parts.push(buffer);
  return parts;
}

export function Markdown({ source }: { source: string }): ReactNode {
  const lines = source.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const start = i + 1;
      let end = start;
      while (end < lines.length && !lines[end].startsWith('```')) end++;
      const codeText = lines.slice(start, end).join('\n');
      blocks.push(
        <pre key={key++}><code className={lang ? `lang-${lang}` : undefined}>{codeText}</code></pre>
      );
      i = end + 1;
      continue;
    }

    if (line.startsWith('# ')) {
      blocks.push(<h1 key={key++}>{renderInline(line.slice(2))}</h1>);
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(<h2 key={key++}>{renderInline(line.slice(3))}</h2>);
      i++;
      continue;
    }

    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <ul key={key++}>
          {items.map((it, idx) => <li key={idx}>{renderInline(it)}</li>)}
        </ul>
      );
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    // paragraph
    const paraLines: string[] = [];
    while (i < lines.length &&
           lines[i].trim() !== '' &&
           !lines[i].startsWith('#') &&
           !lines[i].startsWith('- ') &&
           !lines[i].startsWith('```')) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(<p key={key++}>{renderInline(paraLines.join(' '))}</p>);
  }

  return <div className="md">{blocks}</div>;
}
