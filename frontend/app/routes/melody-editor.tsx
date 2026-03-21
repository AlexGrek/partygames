import { useState, useEffect, useRef } from "react";
import {
  Plus, Trash2, Play, Pause, Upload, Loader, Music, ListMusic, X, FolderInput,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface MelodyItem {
  title: string;
  artist: string;
  file: string;
  category: string;
}

// ── Constants ──────────────────────────────────────────────────────────────
const FILES_BASE = "/api/v1/files";
const GUESS_DIR = "guess";

// ── API ────────────────────────────────────────────────────────────────────
async function loadCategories(): Promise<string[]> {
  const res = await fetch("/api/v1/keys/melody::categories");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.value) ? data.value : [];
}

async function saveCategories(cats: string[]): Promise<void> {
  const res = await fetch("/api/v1/keys/melody::categories", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cats),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function loadItems(): Promise<MelodyItem[]> {
  const res = await fetch("/api/v1/keys/melody::items");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.value) ? data.value : [];
}

async function saveItems(items: MelodyItem[]): Promise<void> {
  const res = await fetch("/api/v1/keys/melody::items", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function ensureGuessDir(): Promise<void> {
  // 201 = created, 405 = already exists — both fine
  await fetch(`${FILES_BASE}/${GUESS_DIR}`, { method: "MKCOL" });
}

async function uploadAudio(file: File): Promise<string> {
  await ensureGuessDir();
  const res = await fetch(
    `${FILES_BASE}/${GUESS_DIR}/${encodeURIComponent(file.name)}`,
    { method: "PUT", body: file }
  );
  if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
  return `${GUESS_DIR}/${file.name}`;
}

async function deleteAudioFile(filePath: string): Promise<void> {
  const segments = filePath.split("/").map(encodeURIComponent);
  await fetch(`${FILES_BASE}/${segments.join("/")}`, { method: "DELETE" });
}

// ── Filename parsing ───────────────────────────────────────────────────────
function guessFromFilename(filename: string): { title: string; artist: string } {
  let name = filename.replace(/\.[^.]+$/, "");        // strip extension
  name = name.replace(/\s*\[[^\]]+\]\s*$/, "").trim(); // strip [youtube-id]
  const idx = name.indexOf(" - ");
  if (idx !== -1) {
    return { artist: name.slice(0, idx).trim(), title: name.slice(idx + 3).trim() };
  }
  return { title: name, artist: "" };
}

// ── AudioPreview ───────────────────────────────────────────────────────────
function isVideoFile(file: string): boolean {
  return /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(file);
}

function AudioPreview({ filePath }: { filePath: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLMediaElement | null>(null);

  function toggle() {
    if (!audioRef.current) {
      const media: HTMLMediaElement = isVideoFile(filePath)
        ? Object.assign(document.createElement("video"), { playsInline: true })
        : new Audio();
      media.src = `${FILES_BASE}/${filePath}`;
      audioRef.current = media;
      media.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  }

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  return (
    <button
      onClick={toggle}
      title={playing ? "Stop preview" : "Preview"}
      className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-lg transition-all ${
        playing
          ? "bg-purple-600/30 text-purple-300"
          : "bg-white/8 text-neutral-500 hover:bg-white/15 hover:text-white"
      }`}
    >
      {playing ? <Pause size={13} /> : <Play size={13} />}
    </button>
  );
}

// ── SongRow ────────────────────────────────────────────────────────────────
function SongRow({
  item,
  categories,
  onUpdate,
  onDelete,
}: {
  item: MelodyItem;
  categories: string[];
  onUpdate: (updated: MelodyItem) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editTitle, setEditTitle] = useState(item.title);
  const [editArtist, setEditArtist] = useState(item.artist);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moving, setMoving] = useState(false);

  async function handleMove(newCategory: string) {
    if (!newCategory || moving) return;
    setMoving(true);
    try {
      await onUpdate({ ...item, category: newCategory });
    } finally {
      setMoving(false);
    }
  }

  const otherCategories = categories.filter((c) => c !== item.category);

  const titleDirty = editTitle.trim() !== item.title;
  const artistDirty = editArtist.trim() !== item.artist;
  const isDirty = titleDirty || artistDirty;

  async function saveEdit() {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      await onUpdate({ ...item, title: editTitle.trim(), artist: editArtist.trim() });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  }

  const filename = item.file.split("/").pop() ?? item.file;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/3 border border-white/8 hover:bg-white/5 group transition-colors">
      <AudioPreview filePath={item.file} />

      {/* Editable title + artist */}
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur())}
          className="w-full bg-transparent text-sm text-white focus:outline-none focus:bg-white/8 rounded px-1 -mx-1 transition-colors placeholder-neutral-600"
          placeholder="Title"
        />
        <input
          value={editArtist}
          onChange={(e) => setEditArtist(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur())}
          className="w-full bg-transparent text-xs text-neutral-500 focus:outline-none focus:bg-white/8 rounded px-1 -mx-1 transition-colors placeholder-neutral-700"
          placeholder="Artist"
        />
      </div>

      {(saving || moving) && <Loader size={13} className="text-neutral-600 animate-spin shrink-0" />}

      {/* Move to category */}
      {otherCategories.length > 0 && (
        <div className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <select
            value=""
            onChange={(e) => { handleMove(e.target.value); e.target.value = ""; }}
            disabled={moving || saving}
            title="Move to another category"
            className="text-xs bg-neutral-900 border border-white/10 rounded-lg pl-2 pr-6 py-1 text-neutral-400 hover:text-white hover:border-white/25 cursor-pointer appearance-none outline-none transition-colors disabled:opacity-50"
          >
            <option value="" disabled>Move to…</option>
            {otherCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <FolderInput size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-600" />
        </div>
      )}

      {/* Filename badge */}
      <span
        className="hidden md:block text-xs text-neutral-700 font-mono truncate max-w-[120px] shrink-0"
        title={item.file}
      >
        {filename}
      </span>

      {/* Delete */}
      {confirming ? (
        <div className="flex gap-1 shrink-0">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-red-900/50 hover:bg-red-800 text-red-300 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader size={11} className="animate-spin" /> : <Trash2 size={11} />}
            Delete
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-xs px-2 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-neutral-500 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="text-neutral-700 hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

// ── AddSongForm ────────────────────────────────────────────────────────────
function AddSongForm({
  category,
  onAdd,
}: {
  category: string;
  onAdd: (item: MelodyItem) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canAdd = title.trim().length > 0 && artist.trim().length > 0 && file !== null && !uploading;

  async function handleAdd() {
    if (!canAdd || !file) return;
    setUploading(true);
    setError(null);
    try {
      const filePath = await uploadAudio(file);
      await onAdd({ title: title.trim(), artist: artist.trim(), file: filePath, category });
      setTitle("");
      setArtist("");
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-3 pt-4 border-t border-white/8 flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-600">Add Song</p>

      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Title"
          className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-white/25 transition-colors"
        />
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Artist"
          className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-white/25 transition-colors"
        />
      </div>

      <div className="flex gap-2 items-center">
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all truncate ${
            file
              ? "border-purple-500/40 bg-purple-900/20 text-purple-300"
              : "border-dashed border-white/15 bg-white/3 text-neutral-500 hover:border-white/25 hover:text-neutral-300"
          }`}
        >
          {file ? (
            <>
              <Music size={14} className="shrink-0" />
              <span className="truncate">{file.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="ml-auto shrink-0 text-neutral-500 hover:text-neutral-200"
              >
                <X size={13} />
              </button>
            </>
          ) : (
            <>
              <Upload size={14} className="shrink-0" />
              Choose audio file…
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            if (f) {
              const guess = guessFromFilename(f.name);
              if (!title.trim()) setTitle(guess.title);
              if (!artist.trim()) setArtist(guess.artist);
            }
          }}
        />

        <button
          onClick={handleAdd}
          disabled={!canAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-35 disabled:cursor-not-allowed text-white text-sm font-medium transition-all shrink-0"
        >
          {uploading ? (
            <><Loader size={14} className="animate-spin" /> Uploading…</>
          ) : (
            <><Plus size={14} /> Add</>
          )}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}

// ── CategoryTab ────────────────────────────────────────────────────────────
function CategoryTab({
  category,
  categories,
  items,
  onAdd,
  onUpdate,
  onDelete,
}: {
  category: string;
  categories: string[];
  items: MelodyItem[];
  onAdd: (item: MelodyItem) => Promise<void>;
  onUpdate: (old: MelodyItem, updated: MelodyItem) => Promise<void>;
  onDelete: (item: MelodyItem) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 ? (
        <p className="text-sm text-neutral-600 py-6 text-center">No songs in this category yet.</p>
      ) : (
        items.map((item) => (
          <SongRow
            key={item.file}
            item={item}
            categories={categories}
            onUpdate={(updated) => onUpdate(item, updated)}
            onDelete={() => onDelete(item)}
          />
        ))
      )}
      <AddSongForm category={category} onAdd={onAdd} />
    </div>
  );
}

// ── CategoriesTab ──────────────────────────────────────────────────────────
function CategoriesTab({
  categories,
  items,
  onSave,
}: {
  categories: string[];
  items: MelodyItem[];
  onSave: (cats: string[]) => Promise<void>;
}) {
  const [cats, setCats] = useState(categories);
  const [newCat, setNewCat] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function commit(next: string[]) {
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
      setCats(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function addCat() {
    const name = newCat.trim();
    if (!name || cats.includes(name)) return;
    setNewCat("");
    await commit([...cats, name]);
    inputRef.current?.focus();
  }

  function songCount(cat: string) {
    return items.filter((i) => i.category === cat).length;
  }

  return (
    <div className="flex flex-col gap-3">
      {cats.length === 0 && (
        <p className="text-sm text-neutral-600 py-4 text-center">No categories yet. Add one below.</p>
      )}

      {cats.map((cat) => {
        const count = songCount(cat);
        return (
          <div
            key={cat}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/3 border border-white/8"
          >
            <span className="flex-1 font-medium text-sm">{cat}</span>
            <span className="text-xs text-neutral-600 tabular-nums shrink-0">
              {count} {count === 1 ? "song" : "songs"}
            </span>
            <button
              onClick={() => commit(cats.filter((c) => c !== cat))}
              disabled={saving || count > 0}
              title={count > 0 ? "Remove all songs in this category first" : "Delete category"}
              className="text-neutral-700 hover:text-red-400 transition-colors disabled:opacity-25 disabled:cursor-not-allowed shrink-0"
            >
              <Trash2 size={15} />
            </button>
          </div>
        );
      })}

      {/* Add new category */}
      <div className="flex gap-2 pt-1">
        <input
          ref={inputRef}
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCat()}
          placeholder="New category name…"
          className="flex-1 bg-black/20 border border-dashed border-white/15 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-white/30 transition-colors"
        />
        <button
          onClick={addCat}
          disabled={!newCat.trim() || cats.includes(newCat.trim()) || saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/8 hover:bg-white/15 disabled:opacity-35 disabled:cursor-not-allowed text-sm font-medium transition-all shrink-0"
        >
          {saving ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}
          Add
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-start gap-3 px-5 py-3 rounded-xl bg-red-950/90 border border-red-500/40 shadow-2xl backdrop-blur-xl max-w-sm w-full">
      <p className="text-red-300 text-sm flex-1 font-mono leading-snug whitespace-pre-wrap">{message}</p>
      <button onClick={onClose} className="text-red-500/60 hover:text-red-300 transition-colors shrink-0 mt-0.5">
        <X size={15} />
      </button>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────
export default function MelodyEditor() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [items, setItems] = useState<MelodyItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>("__categories__");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  function showError(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    Promise.all([loadCategories(), loadItems()]).then(([cats, its]) => {
      setCategories(cats);
      setItems(its);
      setLoading(false);
    });
    return () => clearTimeout(toastTimer.current);
  }, []);

  async function handleSaveCategories(cats: string[]) {
    await saveCategories(cats);
    setCategories(cats);
    // If active tab was deleted, return to categories view
    if (!cats.includes(activeTab)) setActiveTab("__categories__");
  }

  async function handleAddSong(item: MelodyItem) {
    const next = [...items, item];
    try {
      await saveItems(next);
      setItems(next);
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e));
      throw e; // re-throw so AddSongForm shows inline error
    }
  }

  async function handleUpdateSong(old: MelodyItem, updated: MelodyItem) {
    const next = items.map((i) => (i.file === old.file ? updated : i));
    try {
      await saveItems(next);
      setItems(next);
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDeleteSong(item: MelodyItem) {
    const next = items.filter((i) => i.file !== item.file);
    try {
      await saveItems(next);
      setItems(next);
      deleteAudioFile(item.file).catch(() => {}); // best-effort
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e));
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-neutral-400">Loading…</span>
      </div>
    );
  }

  const categoryItems = activeTab !== "__categories__"
    ? items.filter((i) => i.category === activeTab)
    : [];

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🎶 Melody Editor</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-white/5 border border-white/8 overflow-x-auto">
        {categories.map((cat) => {
          const count = items.filter((i) => i.category === cat).length;
          const active = activeTab === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0"
              style={
                active
                  ? { background: "rgba(168,85,247,0.18)", color: "#c084fc", boxShadow: "0 0 12px rgba(168,85,247,0.2)" }
                  : { color: "#6b7280" }
              }
            >
              <span>{cat}</span>
              <span className="text-[10px] font-normal opacity-70">{count}</span>
            </button>
          );
        })}

        {/* Spacer to push Categories to the right */}
        <div className="flex-1" />

        <button
          onClick={() => setActiveTab("__categories__")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0"
          style={
            activeTab === "__categories__"
              ? { background: "rgba(99,102,241,0.18)", color: "#818cf8", boxShadow: "0 0 12px rgba(99,102,241,0.2)" }
              : { color: "#6b7280" }
          }
        >
          <ListMusic size={13} />
          Categories
        </button>
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
        {activeTab === "__categories__" ? (
          <CategoriesTab
            key={categories.join(",")}
            categories={categories}
            items={items}
            onSave={handleSaveCategories}
          />
        ) : (
          <CategoryTab
            key={activeTab}
            category={activeTab}
            categories={categories}
            items={categoryItems}
            onAdd={handleAddSong}
            onUpdate={handleUpdateSong}
            onDelete={handleDeleteSong}
          />
        )}
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
