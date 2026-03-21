import { useState, useEffect, useCallback, useRef } from "react";
import { Upload, Trash2, Download, FolderOpen, File, RefreshCw } from "lucide-react";

const API = "/api/v1/files";

interface FileEntry {
  name: string;
  size: number;
  isDir: boolean;
  modTime: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

// ── Delete confirm modal ───────────────────────────────────────────────────────
function DeleteConfirm({
  name,
  onClose,
  onDeleted,
}: {
  name: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${API}/${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onDeleted();
    } catch (e) {
      setErr(String(e));
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl">
        <div className="px-5 py-4 border-b border-neutral-800">
          <span className="font-semibold text-sm">Delete File</span>
        </div>
        <div className="p-5">
          <p className="text-sm text-neutral-300">
            Delete <span className="font-mono text-white">{name}</span>? This cannot be undone.
          </p>
          {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-neutral-800">
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors"
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
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function FilesPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadProgress(`Uploading ${file.name}…`);
    try {
      const res = await fetch(`${API}/${encodeURIComponent(file.name)}`, {
        method: "PUT",
        body: file,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchFiles();
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  return (
    <>
      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); fetchFiles(); }}
        />
      )}

      <div
        className="min-h-screen flex flex-col"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Drop overlay */}
        {dragOver && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-blue-950/80 border-4 border-dashed border-blue-400 pointer-events-none">
            <p className="text-2xl font-semibold text-blue-300">Drop to upload</p>
          </div>
        )}

        <header className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Files</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchFiles}
              disabled={loading}
              className="text-sm px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <Upload size={14} />
              {uploading ? uploadProgress : "Upload"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        </header>

        <main className="flex-1 p-6">
          {error && (
            <div className="mb-4 text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-neutral-600">
              <FolderOpen size={48} strokeWidth={1} />
              <p className="text-sm">No files yet. Upload one or drop it here.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-neutral-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Size</th>
                    <th className="px-4 py-2.5 hidden sm:table-cell">Modified</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {files.map((f) => (
                    <tr key={f.name} className="hover:bg-neutral-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 font-mono text-neutral-200">
                          {f.isDir ? (
                            <FolderOpen size={16} className="text-yellow-500 shrink-0" />
                          ) : (
                            <File size={16} className="text-neutral-500 shrink-0" />
                          )}
                          <span className="truncate max-w-xs">{f.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-400 tabular-nums">
                        {f.isDir ? "—" : formatBytes(f.size)}
                      </td>
                      <td className="px-4 py-3 text-neutral-500 hidden sm:table-cell">
                        {formatDate(f.modTime)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {!f.isDir && (
                            <a
                              href={`${API}/${encodeURIComponent(f.name)}`}
                              download={f.name}
                              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                            >
                              <Download size={12} />
                              Download
                            </a>
                          )}
                          <button
                            onClick={() => setDeleteTarget(f.name)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-red-900 text-neutral-300 hover:text-red-300 transition-colors"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
