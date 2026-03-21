import { useState, useEffect, useCallback, useRef } from "react";
import { Upload, Trash2, Download, FolderOpen, File, RefreshCw, FolderPlus, ChevronRight, House } from "lucide-react";

const API_BASE = "/api/v1/files";

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

/** Build a /api/v1/files/<seg1>/<seg2>/... URL. */
function filePath(...segments: string[]): string {
  return `${API_BASE}/${segments.map(encodeURIComponent).join("/")}`;
}

/** Build the listing URL for a given path array. */
function listUrl(pathSegments: string[]): string {
  if (pathSegments.length === 0) return API_BASE;
  return `${API_BASE}?path=${encodeURIComponent(pathSegments.join("/"))}`;
}

// ── Delete confirm modal ───────────────────────────────────────────────────────
function DeleteConfirm({
  name,
  isDir,
  currentPath,
  onClose,
  onDeleted,
}: {
  name: string;
  isDir: boolean;
  currentPath: string[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const url = filePath(...currentPath, name);
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onDeleted();
    } catch (e) {
      setErr(String(e));
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md bg-black/50 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl">
        <div className="px-5 py-4 border-b border-white/10">
          <span className="font-semibold text-sm">Delete {isDir ? "Folder" : "File"}</span>
        </div>
        <div className="p-5">
          <p className="text-sm text-neutral-300">
            Delete <span className="font-mono text-white">{name}</span>?
            {isDir && " This will delete the folder and all its contents."}
            {!isDir && " This cannot be undone."}
          </p>
          {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
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
      </div>
    </div>
  );
}

// ── New folder modal ───────────────────────────────────────────────────────────
function NewFolderModal({
  currentPath,
  onClose,
  onCreated,
}: {
  currentPath: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (trimmed.includes("/") || trimmed.includes("\\")) {
      setErr("Folder name cannot contain slashes.");
      return;
    }
    setCreating(true);
    setErr(null);
    try {
      const url = filePath(...currentPath, trimmed);
      const res = await fetch(url, { method: "MKCOL" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onCreated();
    } catch (e) {
      setErr(String(e));
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm bg-black/50 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl">
        <div className="px-5 py-4 border-b border-white/10">
          <span className="font-semibold text-sm">New Folder</span>
        </div>
        <div className="p-5">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") onClose(); }}
            placeholder="Folder name"
            className="w-full bg-white/8 border border-white/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-500 placeholder:text-neutral-600"
          />
          {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            <FolderPlus size={14} />
            {creating ? "Creating…" : "Create"}
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
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async (path: string[] = currentPath) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(listUrl(path));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const navigate = (segments: string[]) => {
    setCurrentPath(segments);
    fetchFiles(segments);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadProgress(`Uploading ${file.name}…`);
    try {
      const res = await fetch(filePath(...currentPath, file.name), {
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
          name={deleteTarget.name}
          isDir={deleteTarget.isDir}
          currentPath={currentPath}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); fetchFiles(); }}
        />
      )}
      {newFolderOpen && (
        <NewFolderModal
          currentPath={currentPath}
          onClose={() => setNewFolderOpen(false)}
          onCreated={() => { setNewFolderOpen(false); fetchFiles(); }}
        />
      )}

      <div
        className="min-h-screen flex flex-col pt-12"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {dragOver && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-blue-950/80 border-4 border-dashed border-blue-400 pointer-events-none">
            <p className="text-2xl font-semibold text-blue-300">Drop to upload</p>
          </div>
        )}

        <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-sm min-w-0 flex-1">
            <button
              onClick={() => navigate([])}
              className="flex items-center gap-1 text-neutral-400 hover:text-white transition-colors shrink-0"
            >
              <House size={14} />
              <span className="hidden sm:inline">Files</span>
            </button>
            {currentPath.map((segment, i) => (
              <span key={i} className="flex items-center gap-1 min-w-0">
                <ChevronRight size={14} className="text-neutral-600 shrink-0" />
                <button
                  onClick={() => navigate(currentPath.slice(0, i + 1))}
                  className={`truncate transition-colors ${
                    i === currentPath.length - 1
                      ? "text-white font-medium"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {segment}
                </button>
              </span>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fetchFiles()}
              disabled={loading}
              className="text-sm px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={() => setNewFolderOpen(true)}
              className="text-sm px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 transition-colors flex items-center gap-1.5"
            >
              <FolderPlus size={14} />
              <span className="hidden sm:inline">New Folder</span>
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
              <p className="text-sm">
                {currentPath.length > 0 ? "Empty folder." : "No files yet. Upload one or drop it here."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Size</th>
                    <th className="px-4 py-2.5 hidden sm:table-cell">Modified</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {files.map((f) => (
                    <tr key={f.name} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 font-mono text-neutral-200">
                          {f.isDir ? (
                            <FolderOpen size={16} className="text-yellow-500 shrink-0" />
                          ) : (
                            <File size={16} className="text-neutral-500 shrink-0" />
                          )}
                          {f.isDir ? (
                            <button
                              onClick={() => navigate([...currentPath, f.name])}
                              className="truncate max-w-xs hover:text-white text-yellow-400 transition-colors text-left"
                            >
                              {f.name}
                            </button>
                          ) : (
                            <span className="truncate max-w-xs">{f.name}</span>
                          )}
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
                              href={filePath(...currentPath, f.name)}
                              download={f.name}
                              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-neutral-300 transition-colors"
                            >
                              <Download size={12} />
                              Download
                            </a>
                          )}
                          <button
                            onClick={() => setDeleteTarget(f)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/8 hover:bg-red-900 text-neutral-300 hover:text-red-300 transition-colors"
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
