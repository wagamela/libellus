import type { Doc } from "../lib/types";
import type { SaveStatus } from "../store/workspace";

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: "",
  modified: "modified",
  saving: "saving…",
  saved: "saved",
  error: "save failed",
};

export function StatusBar({
  doc,
  status,
  docCount,
}: {
  doc: Doc | null;
  status: SaveStatus;
  docCount: number;
}) {
  const lines = doc ? doc.body.split("\n").length : 0;
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
