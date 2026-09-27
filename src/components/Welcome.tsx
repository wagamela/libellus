import type { Doc } from "../lib/types";
import { docLabel } from "../store/workspace";

interface WelcomeProps {
  recent: Doc[];
  onOpen: (id: string) => void;
  onNewNote: () => void;
  onNewSnippet: () => void;
}

const SHORTCUTS: [string, string][] = [
  ["command palette", "Ctrl K"],
  ["quick open", "Ctrl P"],
  ["new note", "Ctrl N"],
  ["new snippet", "Ctrl Shift N"],
  ["save", "Ctrl S"],
  ["close tab", "Ctrl W"],
];

export function Welcome({ recent, onOpen, onNewNote, onNewSnippet }: WelcomeProps) {
  return (
    <div className="flex h-full items-start justify-center overflow-y-auto px-8 py-20">
      <div className="grid w-full max-w-2xl grid-cols-[1fr_auto] gap-x-16 gap-y-10">
        <div className="col-span-2">
          <div className="text-[22px] tracking-[0.3em] text-text">libellus</div>
          <div className="mt-2 text-[12px] text-muted">
            a local workspace for notes, snippets and the small things you keep losing.
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10px] tracking-[0.18em] text-muted uppercase">recent</div>
          {recent.length === 0 ? (
            <div className="text-[12px] text-muted">
              nothing yet —{" "}
              <button className="text-accent hover:underline" onClick={onNewNote}>
                create a note
              </button>{" "}
              or{" "}
              <button className="text-accent hover:underline" onClick={onNewSnippet}>
                a snippet
              </button>
              .
            </div>
          ) : (
            <div className="border-t border-line">
              {recent.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => onOpen(doc.id)}
                  className="flex w-full items-baseline gap-3 border-b border-line py-[6px] text-left hover:bg-surface"
                >
                  <span className="w-8 shrink-0 text-[10px] text-muted">
                    {doc.kind === "note" ? "md" : doc.language.slice(0, 2)}
                  </span>
                  <span className="flex-1 truncate text-[12px] text-dim hover:text-text">
                    {docLabel(doc)}
                  </span>
                  <span className="text-[11px] text-muted">
                    {new Date(doc.updatedAt).toISOString().slice(0, 10)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 text-[10px] tracking-[0.18em] text-muted uppercase">keys</div>
          <table className="text-[11px]">
            <tbody>
              {SHORTCUTS.map(([label, keys]) => (
                <tr key={label}>
                  <td className="py-[3px] pr-8 text-dim">{label}</td>
                  <td className="py-[3px] text-muted">{keys}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
