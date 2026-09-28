import type { Doc } from "../lib/types";
import type { SaveStatus } from "../store/workspace";

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: "",
  modified: "modified",
  saving: "saving…",
  saved: "saved",
  error: "save failed",
};

function countLines(body: string) {
  let lines = 1;
  for (let i = 0; i < body.length; i++) if (body.charCodeAt(i) === 10) lines++;
  return lines;
}

export function StatusBar({
  doc,
  status,
  docCount,
}: {
  doc: Doc | null;
  status: SaveStatus;
  docCount: number;
}) {
  // Counted rather than split: this runs on every keystroke, and splitting
  // allocates an array the size of the document each time.
  const lines = doc ? countLines(doc.body) : 0;
  return (
    <div className="flex h-6 shrink-0 items-center gap-4 bg-chrome px-3 text-[11px] text-muted">
      <span>{doc ? doc.language : "no document"}</span>
      {doc && (
        <>
          <span>
            {lines} {lines === 1 ? "line" : "lines"}
          </span>
          <span>{doc.body.length} chars</span>
        </>
      )}
      <span className="flex-1" />
      <span className={status === "error" ? "text-danger" : status === "modified" ? "text-accent" : ""}>
        {STATUS_TEXT[status]}
      </span>
      <span>{docCount} local</span>
      <span>offline</span>
    </div>
  );
}
