import { useState } from "react";
import { readSecret, secretsAvailable } from "../lib/secrets";
import { useWorkspace } from "../store/workspace";

/** The editor form's target: an existing secret's id, a new one, or nothing. */
type Editing = string | "new" | null;

const NEW: Editing = "new";

function message(error: unknown): string {
  // Every rejection here is one of the backend's fixed strings; nothing a
  // secret value could end up in.
  return error instanceof Error ? error.message : String(error);
}

/**
 * Secrets have a surface of their own rather than a tab: they are never
 * documents, never searched from the palette and never saved out, so they do
 * not appear anywhere a note or snippet can. A revealed value lives in this
 * component's state only and is gone when the panel closes.
 */
export function SecretsPanel({ onClose }: { onClose: () => void }) {
  const secrets = useWorkspace((s) => s.secrets);
  const { createSecret, updateSecret, deleteSecret } = useWorkspace.getState();
  const [filter, setFilter] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [armed, setArmed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const available = secretsAvailable();

  const shown = secrets
    .filter((s) => s.name.toLowerCase().includes(filter.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const attempt = async (work: () => Promise<void>) => {
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(message(err));
    }
  };

  const startEdit = (target: Editing) => {
    const current = secrets.find((s) => s.id === target);
    setEditing(target);
    setName(current?.name ?? filter.trim());
    setValue("");
    setArmed(null);
  };

  const submit = () =>
    attempt(async () => {
      if (!name.trim()) throw new Error("a secret needs a name");
      if (editing === NEW) {
        if (!value) throw new Error("a secret needs a value");
        await createSecret(name, value);
      } else if (editing) {
        // An empty value field keeps the stored value: it is never shown here.
        await updateSecret(editing, { name, value: value || undefined });
        setRevealed(({ [editing]: _, ...rest }) => rest);
      }
      setEditing(null);
      setValue("");
    });

  const toggleReveal = (id: string) =>
    attempt(async () => {
      if (id in revealed) {
        setRevealed(({ [id]: _, ...rest }) => rest);
        return;
      }
      const secret = await readSecret(id);
      if (secret === null) throw new Error("the keychain has no value for this secret");
      setRevealed((r) => ({ ...r, [id]: secret }));
    });

  // Deleting is irreversible, so it takes two presses like everywhere else.
  const remove = (id: string) => {
    if (armed !== id) {
      setArmed(id);
      return;
    }
    setArmed(null);
    void attempt(() => deleteSecret(id));
  };

  const field =
    "w-full rounded-sm bg-raised px-2.5 py-1.5 text-[12px] text-text outline-none placeholder:text-muted";
  const action =
    "rounded-sm px-1.5 py-0.5 text-[11px] text-muted hover:bg-surface hover:text-text active:bg-pressed";

  return (
    <div
      className="fixed inset-0 z-100 flex justify-center bg-black/45 pt-[12vh]"
      onMouseDown={onClose}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        if (editing) setEditing(null);
        else onClose();
      }}
    >
      <div
        className="h-fit w-[min(680px,90vw)] overflow-hidden rounded-xl bg-chrome shadow-[0_16px_48px_#00000080]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          autoFocus
          spellCheck={false}
          value={filter}
          placeholder="find a secret…"
          onChange={(event) => setFilter(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && available) {
              event.preventDefault();
              startEdit(NEW);
            }
          }}
          className="w-full bg-surface px-4 py-3 text-[13px] text-text outline-none placeholder:text-muted"
        />
        <div className="max-h-[52vh] overflow-y-auto p-1.5">
          {!available && (
            <div className="px-2.5 py-3 text-[12px] text-muted">
              secrets are kept in the system keychain and need the desktop app
            </div>
          )}
          {available && shown.length === 0 && (
            <div className="px-2.5 py-3 text-[12px] text-muted">
              {secrets.length === 0 ? "no secrets yet" : "no matches"}
            </div>
          )}
          {shown.map((secret) => (
            <div
              key={secret.id}
              className="group flex items-baseline gap-3 rounded-md px-2.5 py-[6px] hover:bg-raised"
            >
              <span className="min-w-0 flex-1 truncate text-[12px] text-text">
                {secret.name}
                <span className="block truncate text-[11px] text-muted select-text">
                  {secret.id in revealed ? revealed[secret.id] : "••••••••"}
                </span>
              </span>
              <span className="flex shrink-0 gap-1 self-center">
                <button className={action} onClick={() => void toggleReveal(secret.id)}>
                  {secret.id in revealed ? "hide" : "reveal"}
                </button>
                <button className={action} onClick={() => startEdit(secret.id)}>
                  edit
                </button>
                <button
                  className={`${action} ${armed === secret.id ? "bg-surface text-text" : ""}`}
                  onClick={() => remove(secret.id)}
                >
                  {armed === secret.id ? "delete?" : "delete"}
                </button>
              </span>
            </div>
          ))}
        </div>
        {available && (
          <div className="bg-surface p-3">
            {editing ? (
              <form
                className="flex flex-col gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <input
                  autoFocus
                  spellCheck={false}
                  value={name}
                  placeholder="name"
                  onChange={(event) => setName(event.target.value)}
                  className={field}
                />
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={value}
                  placeholder={editing === NEW ? "value" : "new value — leave empty to keep it"}
                  onChange={(event) => setValue(event.target.value)}
                  className={field}
                />
                <div className="flex justify-end gap-1">
                  <button type="button" className={action} onClick={() => setEditing(null)}>
                    cancel
                  </button>
                  <button type="submit" className={`${action} text-text`}>
                    {editing === NEW ? "add secret" : "save"}
                  </button>
                </div>
              </form>
            ) : (
              <button className={action} onClick={() => startEdit(NEW)}>
                new secret
              </button>
            )}
            {error && <div className="pt-2 text-[11px] text-danger">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
