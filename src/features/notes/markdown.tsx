import type { ReactNode } from "react";
export function safeLink(url: string) {
  return /^(https?:\/\/|mailto:)/i.test(url) ? url : null;
}
function inline(text: string): ReactNode[] {
  return text.split(/(\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
    const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    const href = m && safeLink(m[2]);
    return href ? (
      <a key={i} href={href} target="_blank" rel="noreferrer">
        {m![1]}
      </a>
    ) : (
      part
    );
  });
}
export function NotePreview({
  body,
  onChange,
}: {
  body: string;
  onChange?: (body: string) => void;
}) {
  return (
    <div className="note-preview">
      {body.split("\n").map((line, i) => {
        if (/^### /.test(line)) return <h4 key={i}>{inline(line.slice(4))}</h4>;
        if (/^## /.test(line)) return <h3 key={i}>{inline(line.slice(3))}</h3>;
        if (/^# /.test(line)) return <h2 key={i}>{inline(line.slice(2))}</h2>;
        if (/^> /.test(line))
          return <blockquote key={i}>{inline(line.slice(2))}</blockquote>;
        const check = /^- \[([ xX])\] (.*)$/.exec(line);
        if (check)
          return (
            <label key={i} className="check-control">
              <input
                type="checkbox"
                checked={check[1] !== " "}
                disabled={!onChange}
                onChange={(e) => {
                  const lines = body.split("\n");
                  lines[i] = `- [${e.target.checked ? "x" : " "}] ${check[2]}`;
                  onChange?.(lines.join("\n"));
                }}
              />
              {inline(check[2])}
            </label>
          );
        if (/^[-*] /.test(line))
          return (
            <ul key={i}>
              <li>{inline(line.slice(2))}</li>
            </ul>
          );
        const numbered = /^(\d+)\. (.*)$/.exec(line);
        if (numbered)
          return (
            <ol key={i} start={Number(numbered[1])}>
              <li>{inline(numbered[2])}</li>
            </ol>
          );
        return <p key={i}>{inline(line) || "\u00a0"}</p>;
      })}
    </div>
  );
}
