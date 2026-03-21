import { useState, useEffect, useCallback } from "react";
import { Pencil, Trash2, Plus, X, Check } from "lucide-react";

const API = "/api/v1";

// ── Modal ──────────────────────────────────────────────────────────────────────
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg bg-black/50 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <span className="font-semibold text-sm">{title}</span>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── CreateModal ────────────────────────────────────────────────────────────────
function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (key: string) => void;
}) {
  const [keyName, setKeyName] = useState("");
  const [jsonText, setJsonText] = useState("{\n  \n}");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async () => {
    setErr(null);
    if (!keyName.trim()) { setErr("Key name is required."); return; }
    let parsed: unknown;
    try { parsed = JSON.parse(jsonText); } catch { setErr("Invalid JSON."); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/keys/${encodeURIComponent(keyName.trim())}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onCreated(keyName.trim());
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New Key" onClose={onClose}>
      <div className="p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-neutral-400 font-medium">Key</label>
          <input
            autoFocus
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="e.g. game:42"
            className="bg-white/8 border border-white/15 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-neutral-500 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-neutral-400 font-medium">Value (JSON)</label>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={10}
            spellCheck={false}
            className="bg-white/8 border border-white/15 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-neutral-500 transition-colors resize-y"
          />
        </div>
        {err && <p className="text-xs text-red-400">{err}</p>}
      </div>
      <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/10">
        <button
          onClick={onClose}
          className="text-sm px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          <Check size={14} />
          {saving ? "Saving…" : "Create"}
        </button>
      </div>
    </Modal>
  );
}

// ── EditModal ──────────────────────────────────────────────────────────────────
function EditModal({
  keyName,
  initialValue,
  onClose,
  onSaved,
}: {
  keyName: string;
  initialValue: unknown;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [jsonText, setJsonText] = useState(() => JSON.stringify(initialValue, null, 2));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async () => {
    setErr(null);
    let parsed: unknown;
    try { parsed = JSON.parse(jsonText); } catch { setErr("Invalid JSON."); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/keys/${encodeURIComponent(keyName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onSaved();
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Edit — ${keyName}`} onClose={onClose}>
      <div className="p-5 flex flex-col gap-4">
        <textarea
          autoFocus
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          rows={16}
          spellCheck={false}
          className="bg-white/8 border border-white/15 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-neutral-500 transition-colors resize-y"
        />
        {err && <p className="text-xs text-red-400">{err}</p>}
      </div>
      <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/10">
        <button
          onClick={onClose}
          className="text-sm px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          <Check size={14} />
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

// ── DeleteConfirm ──────────────────────────────────────────────────────────────
function DeleteConfirm({
  keyName,
  onClose,
  onDeleted,
}: {
  keyName: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${API}/keys/${encodeURIComponent(keyName)}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onDeleted();
    } catch (e) {
      setErr(String(e));
      setDeleting(false);
    }
  };

  return (
    <Modal title="Delete Key" onClose={onClose}>
      <div className="p-5 flex flex-col gap-3">
        <p className="text-sm text-neutral-300">
          Delete <span className="font-mono text-white">{keyName}</span>? This cannot be undone.
        </p>
        {err && <p className="text-xs text-red-400">{err}</p>}
      </div>
      <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/10">
        <button
          onClick={onClose}
          className="text-sm px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-sm px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          <Trash2 size={14} />
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </Modal>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
type ModalState =
  | { type: "create" }
  | { type: "edit"; key: string; value: unknown }
  | { type: "delete"; key: string }
  | null;

export default function DbViewer() {
  const [keys, setKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [value, setValue] = useState<unknown>(null);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [loadingValue, setLoadingValue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

  const fetchKeys = useCallback(async () => {
    setLoadingKeys(true);
    setError(null);
    try {
      const res = await fetch(`${API}/keys`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const selectKey = async (key: string) => {
    setSelectedKey(key);
    setValue(null);
    setLoadingValue(true);
    setError(null);
    try {
      const res = await fetch(`${API}/keys/${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setValue(data.value);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingValue(false);
    }
  };

  const handleCreated = (key: string) => {
    setModal(null);
    fetchKeys();
    selectKey(key);
  };

  const handleSaved = () => {
    setModal(null);
    if (selectedKey) selectKey(selectedKey);
  };

  const handleDeleted = () => {
    setModal(null);
    setSelectedKey(null);
    setValue(null);
    fetchKeys();
  };

  return (
    <>
      {modal?.type === "create" && (
        <CreateModal onClose={() => setModal(null)} onCreated={handleCreated} />
      )}
      {modal?.type === "edit" && (
        <EditModal
          keyName={modal.key}
          initialValue={modal.value}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
      {modal?.type === "delete" && (
        <DeleteConfirm
          keyName={modal.key}
          onClose={() => setModal(null)}
          onDeleted={handleDeleted}
        />
      )}

      <div className="min-h-screen flex flex-col pt-12">
        <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">DB Editor</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchKeys}
              className="text-sm px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => setModal({ type: "create" })}
              className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-1.5"
            >
              <Plus size={14} />
              New Key
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Key list */}
          <aside className="w-72 border-r border-white/10 flex flex-col overflow-hidden">
            <div className="px-4 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-white/10">
              Keys {!loadingKeys && `(${keys.length})`}
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingKeys ? (
                <div className="p-4 text-sm text-neutral-500">Loading…</div>
              ) : keys.length === 0 ? (
                <div className="p-4 text-sm text-neutral-500">No keys found.</div>
              ) : (
                keys.map((key) => (
                  <button
                    key={key}
                    onClick={() => selectKey(key)}
                    className={`w-full text-left px-4 py-2.5 text-sm font-mono truncate transition-colors ${
                      selectedKey === key
                        ? "bg-neutral-700 text-white"
                        : "text-neutral-300 hover:bg-white/8"
                    }`}
                  >
                    {key}
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* Value panel */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {selectedKey ? (
              <>
                <div className="px-5 py-2 border-b border-white/10 flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider font-mono">
                    {selectedKey}
                  </span>
                  {!loadingValue && value !== null && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setModal({ type: "edit", key: selectedKey, value })}
                        title="Edit value"
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-neutral-300 transition-colors"
                      >
                        <Pencil size={12} />
                        Edit
                      </button>
                      <button
                        onClick={() => setModal({ type: "delete", key: selectedKey })}
                        title="Delete key"
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/8 hover:bg-red-900 text-neutral-300 hover:text-red-300 transition-colors"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-auto p-5">
                  {loadingValue ? (
                    <span className="text-sm text-neutral-500">Loading…</span>
                  ) : error ? (
                    <span className="text-sm text-red-400">{error}</span>
                  ) : (
                    <pre className="text-sm text-green-300 font-mono whitespace-pre-wrap break-all">
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-neutral-600">
                Select a key to view its value.
              </div>
            )}

            {error && !loadingValue && !selectedKey && (
              <div className="p-4 text-sm text-red-400">{error}</div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
