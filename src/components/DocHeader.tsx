import { useEffect, useState } from "react";
import { LANGUAGES, type Doc, type Language } from "../lib/types";

interface DocHeaderProps {
  doc: Doc;
  onRename: (title: string) => void;
  onLanguage: (language: Language) => void;
  onDelete: () => void;
}

function when(timestamp: number): string {
  const delta = Date.now() - timestamp;
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function DocHeader({ doc, onRename, onLanguage, onDelete }: DocHeaderProps) {
  const [title, setTitle] = useState(doc.title);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setTitle(doc.title);
    setConfirming(false);
  }, [doc.id, doc.title]);

  return (
    <div className="flex h-10 shrink-0 items-center gap-3 bg-chrome px-4">
      <span className="text-[10px] tracking-[0.18em] text-muted uppercase">{doc.kind}</span>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => onRename(title)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setTitle(doc.title);
            event.currentTarget.blur();
          }
        }}
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent px-2 py-1 text-[13px] text-text outline-none hover:bg-surface focus:bg-surface"
      />
      <span className="text-[11px] text-muted">{when(doc.updatedAt)}</span>
      {doc.kind === "snippet" && (
        <select
          value={doc.language}
          onChange={(event) => onLanguage(event.target.value as Language)}
          className="bg-raised px-2 py-[3px] text-[11px] text-dim outline-none hover:text-text"
        >
          {LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {language}
            </option>
          ))}
        </select>
      )}
      {confirming ? (
        <span className="flex items-center gap-2 text-[11px]">
          <span className="text-dim">delete?</span>
          <button className="text-danger hover:underline" onClick={onDelete}>
            yes
          </button>
          <button className="text-dim hover:text-text" onClick={() => setConfirming(false)}>
            no
          </button>
        </span>
      ) : (
        <button
          className="text-[11px] text-muted hover:text-danger"
          onClick={() => setConfirming(true)}
        >
          delete
        </button>
      )}
    </div>
  );
}
