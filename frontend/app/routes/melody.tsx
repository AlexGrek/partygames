import { useState, useEffect, useRef } from "react";
import { Eye, Shuffle, SkipForward } from "lucide-react";

interface MelodyItem {
  title: string;
  artist: string;
  file: string;
  category: string;
}

type Phase = "idle" | "playing" | "revealed";

const LS_KEY = "melody-used";

function getUsed(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markUsed(file: string) {
  const used = getUsed();
  used.add(file);
  localStorage.setItem(LS_KEY, JSON.stringify([...used]));
}

function fileUrl(file: string): string {
  const path = file.startsWith("/") ? file.slice(1) : file;
  return `/api/v1/files/${path}`;
}

// ── Category tabs ──────────────────────────────────────────────────────────
function CategoryTabs({
  categories,
  active,
  onChange,
}: {
  categories: string[];
  active: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {["all", ...categories].map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
            active === c
              ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/40"
              : "bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10 hover:text-white"
          }`}
        >
          {c === "all" ? "🎵 All" : c}
        </button>
      ))}
    </div>
  );
}

// ── Timer ──────────────────────────────────────────────────────────────────
function Timer({ elapsed, frozen }: { elapsed: number; frozen: boolean }) {
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <span
      className="font-mono tabular-nums text-3xl font-bold text-purple-300"
      style={{
        textShadow: !frozen ? "0 0 16px rgba(168,85,247,0.6)" : undefined,
        opacity: frozen ? 0.6 : 1,
      }}
    >
      {mm}:{ss}
    </span>
  );
}

// ── Reveal card ────────────────────────────────────────────────────────────
function SongReveal({ item }: { item: MelodyItem }) {
  return (
    <div
      className="w-full flex flex-col items-center gap-2 py-8 px-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-purple-500/30 shadow-2xl"
      style={{ animation: "fadeUp 0.4s ease forwards" }}
    >
      <span className="text-5xl mb-1">🎵</span>
      <p
        className="text-2xl font-bold text-white text-center leading-tight"
        style={{ fontFamily: "'Syne', sans-serif" }}
      >
        {item.title}
      </p>
      <p className="text-base text-neutral-400 text-center">{item.artist}</p>
      {item.category && (
        <span className="mt-2 text-xs uppercase tracking-widest text-purple-400 bg-purple-900/30 px-3 py-1 rounded-full border border-purple-800/40">
          {item.category}
        </span>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function MelodyGame() {
  const [categories, setCategories] = useState<string[]>([]);
  const [items, setItems] = useState<MelodyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [current, setCurrent] = useState<MelodyItem | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [songKey, setSongKey] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function load() {
      const [cats, its] = await Promise.all([
        fetch("/api/v1/keys/melody::categories")
          .then((r) => r.json())
          .then((d) => (Array.isArray(d.value) ? d.value : []))
          .catch(() => []),
        fetch("/api/v1/keys/melody::items")
          .then((r) => r.json())
          .then((d) => (Array.isArray(d.value) ? d.value : []))
          .catch(() => []),
      ]);
      setCategories(cats);
      setItems(its);
      setLoading(false);
    }
    load();
  }, []);

  // Timer: starts/resets on each new song, stops on reveal
  useEffect(() => {
    clearInterval(intervalRef.current!);
    if (phase === "playing") {
      setElapsed(0);
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => clearInterval(intervalRef.current!);
  }, [phase, songKey]);

  function pickSong() {
    const pool =
      selectedCategory === "all"
        ? items
        : items.filter((i) => i.category === selectedCategory);
    if (pool.length === 0) return;
    const used = getUsed();
    const available = pool.filter((i) => !used.has(i.file));
    const source = available.length > 0 ? available : pool;
    const item = source[Math.floor(Math.random() * source.length)];
    markUsed(item.file);
    setCurrent(item);
    setPhase("playing");
    setSongKey((k) => k + 1);
  }

  function reveal() {
    clearInterval(intervalRef.current!);
    setPhase("revealed");
  }

  function handleCategoryChange(c: string) {
    setSelectedCategory(c);
    if (phase !== "idle") {
      setPhase("idle");
      setCurrent(null);
    }
  }

  const filteredCount =
    selectedCategory === "all"
      ? items.length
      : items.filter((i) => i.category === selectedCategory).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-neutral-400 text-xl">Loading…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4 py-12">
      {/* Header */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-7xl">🎶</span>
        <h1
          className="text-4xl font-bold tracking-tight"
          style={{ fontFamily: "'Syne', sans-serif" }}
        >
          Guess the Melody
        </h1>
        {items.length === 0 && (
          <p className="text-neutral-500 text-sm mt-1">
            No songs found. Add items to{" "}
            <span className="font-mono text-neutral-400">melody::items</span>{" "}
            in the DB.
          </p>
        )}
      </div>

      {/* Category tabs */}
      {categories.length > 0 && (
        <CategoryTabs
          categories={categories}
          active={selectedCategory}
          onChange={handleCategoryChange}
        />
      )}

      {/* Game area */}
      <div className="w-full max-w-md flex flex-col items-center gap-5">
        {/* Timer row */}
        <div className="h-10 flex items-center justify-center">
          {phase !== "idle" && (
            <Timer elapsed={elapsed} frozen={phase === "revealed"} />
          )}
        </div>

        {/* Reveal card or placeholder */}
        {phase === "revealed" && current ? (
          <SongReveal key={songKey} item={current} />
        ) : (
          <div className="w-full h-32 rounded-3xl bg-white/3 border border-white/8 flex items-center justify-center">
            {phase === "playing" ? (
              <span
                className="text-5xl select-none"
                style={{ animation: "breathe 1.2s ease-in-out infinite" }}
              >
                🎵
              </span>
            ) : (
              <span className="text-neutral-600 text-sm">
                {filteredCount > 0
                  ? "Pick a song to start"
                  : "No songs in this category"}
              </span>
            )}
          </div>
        )}

        {/* Audio player */}
        {current && phase !== "idle" && (
          <audio
            key={songKey}
            src={fileUrl(current.file)}
            autoPlay
            controls
            className="w-full rounded-xl"
            style={{ colorScheme: "dark" }}
          />
        )}

        {/* Action buttons */}
        <div className="flex gap-3 w-full">
          {phase === "idle" && (
            <button
              onClick={pickSong}
              disabled={filteredCount === 0}
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-lg transition-all shadow-lg shadow-purple-900/40"
            >
              <Shuffle size={20} />
              Pick a Song
            </button>
          )}

          {phase === "playing" && (
            <>
              <button
                onClick={reveal}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border border-purple-500 text-purple-300 font-semibold text-lg transition-all"
                style={{
                  background: "rgba(168,85,247,0.1)",
                  boxShadow: "0 0 20px rgba(168,85,247,0.25)",
                }}
              >
                <Eye size={20} />
                Reveal Answer
              </button>
              <button
                onClick={pickSong}
                title="Skip to next song"
                className="py-4 px-5 rounded-2xl bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <SkipForward size={20} />
              </button>
            </>
          )}

          {phase === "revealed" && (
            <button
              onClick={pickSong}
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-lg transition-all shadow-lg shadow-purple-900/40"
            >
              <Shuffle size={20} />
              Next Song
            </button>
          )}
        </div>

        {/* Reset used songs */}
        {phase === "idle" && items.length > 0 && (
          <button
            onClick={() => localStorage.removeItem(LS_KEY)}
            className="text-xs text-neutral-700 hover:text-neutral-400 transition-colors"
          >
            reset played songs
          </button>
        )}
      </div>
    </div>
  );
}
