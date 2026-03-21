import { useState, useEffect, useRef, useCallback } from "react";
import { RotateCcw, Square } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface MelodyItem {
  title: string;
  artist: string;
  file: string;
  category: string;
}

type PlayPhase = "grace" | "playing" | "open-guess" | "stopping";

// ── Constants ──────────────────────────────────────────────────────────────
const GRACE_SECONDS = 3;
const STOP_DELAY_MS = 3000;
const VOLUME_FLASH_MS = 600;
const DEFAULT_FIRST_GUESS_DELAY = 15;
const LS_GUESSED = "melody-guessed";

// ── LocalStorage helpers ───────────────────────────────────────────────────
function getGuessed(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_GUESSED);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markGuessed(file: string) {
  const s = getGuessed();
  s.add(file);
  localStorage.setItem(LS_GUESSED, JSON.stringify([...s]));
}

function clearGuessed() {
  localStorage.removeItem(LS_GUESSED);
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fileUrl(file: string): string {
  const path = file.startsWith("/") ? file.slice(1) : file;
  return `/api/v1/files/${path}`;
}

function pickRandom(pool: MelodyItem[]): MelodyItem | null {
  if (pool.length === 0) return null;
  const guessed = getGuessed();
  const available = pool.filter((i) => !guessed.has(i.file));
  const source = available.length > 0 ? available : pool;
  return source[Math.floor(Math.random() * source.length)];
}

// Gradually dip volume to 0 then back to 1 over VOLUME_FLASH_MS
function flashVolume(audio: HTMLAudioElement) {
  const start = Date.now();
  const half = VOLUME_FLASH_MS / 2;
  function tick() {
    const elapsed = Date.now() - start;
    if (elapsed >= VOLUME_FLASH_MS) {
      audio.volume = 1;
      return;
    }
    audio.volume =
      elapsed < half
        ? 1 - elapsed / half // 1 → 0
        : (elapsed - half) / half; // 0 → 1
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ── Category Screen ────────────────────────────────────────────────────────
function CategoryScreen({
  categories,
  items,
  refreshKey,
  onPick,
  onReset,
}: {
  categories: string[];
  items: MelodyItem[];
  refreshKey: number;
  onPick: (category: string) => void;
  onReset: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);

  // refreshKey forces re-read of localStorage when returning from play
  const guessed = getGuessed(); // eslint-disable-line react-hooks/exhaustive-deps
  void refreshKey; // consumed as dep via prop

  function remaining(cat: string): number {
    return items.filter((i) => i.category === cat && !guessed.has(i.file)).length;
  }

  function total(cat: string): number {
    return items.filter((i) => i.category === cat).length;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-10 px-4 py-12">
      <div className="flex flex-col items-center gap-2">
        <span className="text-7xl">🎶</span>
        <h1
          className="text-4xl font-bold tracking-tight"
          style={{ fontFamily: "'Syne', sans-serif" }}
        >
          Guess the Melody
        </h1>
      </div>

      {categories.length === 0 ? (
        <p className="text-neutral-500 text-sm text-center">
          No categories found. Add data to{" "}
          <span className="font-mono text-neutral-400">melody::categories</span>.
        </p>
      ) : (
        <div className="w-full max-w-sm flex flex-col gap-3">
          {categories.map((cat) => {
            const rem = remaining(cat);
            const tot = total(cat);
            const empty = rem === 0;
            return (
              <button
                key={cat}
                onClick={() => onPick(cat)}
                disabled={empty}
                className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl border transition-all ${
                  empty
                    ? "opacity-35 cursor-not-allowed bg-white/3 border-white/8"
                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 active:scale-[0.98]"
                }`}
              >
                <span className="text-lg font-semibold">{cat}</span>
                <span
                  className={`text-sm font-mono tabular-nums ${
                    empty ? "text-neutral-600" : "text-purple-400"
                  }`}
                >
                  {rem}/{tot}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col items-center gap-2 mt-2">
        {confirmReset ? (
          <div className="flex gap-2 items-center flex-wrap justify-center">
            <span className="text-sm text-neutral-400">Reset all progress?</span>
            <button
              onClick={() => {
                clearGuessed();
                onReset();
                setConfirmReset(false);
              }}
              className="text-sm px-3 py-1 rounded-lg bg-red-800 hover:bg-red-700 text-white transition-colors"
            >
              Yes, reset
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="text-sm px-3 py-1 rounded-lg bg-white/8 hover:bg-white/15 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="flex items-center gap-1.5 text-xs text-neutral-700 hover:text-neutral-400 transition-colors"
          >
            <RotateCcw size={12} />
            Reset progress
          </button>
        )}
      </div>
    </div>
  );
}

// ── Play Screen ────────────────────────────────────────────────────────────
function PlayScreen({
  song,
  firstGuessDelay,
  onDone,
}: {
  song: MelodyItem;
  firstGuessDelay: number;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<PlayPhase>("grace");
  const [graceCount, setGraceCount] = useState(GRACE_SECONDS);
  const [elapsed, setElapsed] = useState(0);
  const [stoppingCount, setStoppingCount] = useState(3);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; });

  // Create audio and start preloading during grace period
  useEffect(() => {
    const audio = new Audio(fileUrl(song.file));
    audio.volume = 1;
    audio.preload = "auto";
    audio.load();
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [song.file]);

  // Grace countdown → start playing
  useEffect(() => {
    if (phase !== "grace") return;
    setGraceCount(GRACE_SECONDS);
    let count = GRACE_SECONDS;
    const id = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(id);
        audioRef.current?.play().catch(() => {});
        setPhase("playing");
      } else {
        setGraceCount(count);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Elapsed timer: runs during playing and open-guess
  useEffect(() => {
    if (phase === "playing") setElapsed(0);
    if (phase !== "playing" && phase !== "open-guess") return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Trigger open-guess after firstGuessDelay
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setTimeout(() => {
      if (audioRef.current) flashVolume(audioRef.current);
      setPhase("open-guess");
    }, firstGuessDelay * 1000);
    return () => clearTimeout(id);
  }, [phase, firstGuessDelay]);

  // Stopping: pause audio, show reveal, return after 3s
  useEffect(() => {
    if (phase !== "stopping") return;
    audioRef.current?.pause();
    setStoppingCount(3);
    let count = 3;
    const id = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(id);
        onDoneRef.current();
      } else {
        setStoppingCount(count);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  function handleStop() {
    markGuessed(song.file);
    setPhase("stopping");
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const isOpenGuess = phase === "open-guess";
  const isStopping = phase === "stopping";
  const isGrace = phase === "grace";

  return (
    <div className="relative min-h-screen">
      {/* Amber overlay — fades in at open-guess */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(234,179,8,0.35) 0%, rgba(161,98,7,0.18) 55%, transparent 75%)",
          opacity: isOpenGuess || isStopping ? 1 : 0,
          transition: "opacity 0.6s ease",
          zIndex: 0,
        }}
      />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center gap-8 px-4 py-12">
        {/* Category label */}
        <span className="text-xs uppercase tracking-widest text-neutral-600 font-semibold">
          {song.category}
        </span>

        {/* Grace period */}
        {isGrace && (
          <div className="flex flex-col items-center gap-4">
            <span
              className="text-[20vw] font-bold text-purple-300 tabular-nums leading-none select-none"
              style={{
                fontFamily: "'Syne', sans-serif",
                textShadow: "0 0 40px rgba(168,85,247,0.6)",
              }}
            >
              {graceCount}
            </span>
            <p className="text-neutral-400 text-lg">Get ready…</p>
          </div>
        )}

        {/* Playing / open-guess / stopping */}
        {!isGrace && (
          <>
            {/* Open-guess banner */}
            {(isOpenGuess || isStopping) && (
              <div
                className="flex flex-col items-center gap-1"
                style={{ animation: "fadeUp 0.4s ease forwards" }}
              >
                <span className="text-4xl">🎯</span>
                <p className="text-yellow-300 font-bold text-xl tracking-wide">
                  Everyone guesses!
                </p>
              </div>
            )}

            {/* Timer */}
            <span
              className="font-mono tabular-nums text-7xl font-bold leading-none select-none"
              style={{
                color: isOpenGuess || isStopping ? "#fbbf24" : "#c084fc",
                textShadow:
                  isOpenGuess || isStopping
                    ? "0 0 32px rgba(251,191,36,0.55)"
                    : "0 0 24px rgba(192,132,252,0.5)",
              }}
            >
              {mm}:{ss}
            </span>

            {/* Song reveal (stopping only) */}
            {isStopping && (
              <div
                className="flex flex-col items-center gap-2 py-6 px-10 rounded-3xl bg-white/5 border border-yellow-500/25 backdrop-blur-xl shadow-2xl"
                style={{ animation: "fadeUp 0.4s ease forwards" }}
              >
                <span className="text-4xl">🎵</span>
                <p
                  className="text-2xl font-bold text-white text-center leading-tight"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  {song.title}
                </p>
                <p className="text-neutral-400 text-center">{song.artist}</p>
                <p className="mt-3 text-neutral-500 text-sm tabular-nums">
                  Back in {stoppingCount}…
                </p>
              </div>
            )}

            {/* Stop button */}
            {!isStopping && (
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-10 py-4 rounded-2xl font-semibold text-lg transition-all active:scale-95"
                style={{
                  color: "#fca5a5",
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.45)",
                  boxShadow: "0 0 24px rgba(239,68,68,0.2)",
                }}
              >
                <Square size={20} fill="currentColor" />
                Guessed!
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────
export default function MelodyGame() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [items, setItems] = useState<MelodyItem[]>([]);
  const [firstGuessDelay, setFirstGuessDelay] = useState(DEFAULT_FIRST_GUESS_DELAY);
  const [currentSong, setCurrentSong] = useState<MelodyItem | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/keys/melody::categories")
        .then((r) => r.json())
        .catch(() => ({})),
      fetch("/api/v1/keys/melody::items")
        .then((r) => r.json())
        .catch(() => ({})),
      fetch("/api/v1/keys/melody::first-guess-delay")
        .then((r) => r.json())
        .catch(() => ({})),
    ]).then(([catsData, itemsData, delayData]) => {
      setCategories(Array.isArray(catsData.value) ? catsData.value : []);
      setItems(Array.isArray(itemsData.value) ? itemsData.value : []);
      setFirstGuessDelay(
        typeof delayData.value === "number" ? delayData.value : DEFAULT_FIRST_GUESS_DELAY
      );
      setLoading(false);
    });
  }, []);

  const handlePickCategory = useCallback(
    (category: string) => {
      const pool = items.filter((i) => i.category === category);
      const song = pickRandom(pool);
      if (song) setCurrentSong(song);
    },
    [items]
  );

  const handleDone = useCallback(() => {
    setCurrentSong(null);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleReset = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-neutral-400 text-xl">Loading…</span>
      </div>
    );
  }

  if (currentSong) {
    return (
      <PlayScreen
        key={currentSong.file}
        song={currentSong}
        firstGuessDelay={firstGuessDelay}
        onDone={handleDone}
      />
    );
  }

  return (
    <CategoryScreen
      categories={categories}
      items={items}
      refreshKey={refreshKey}
      onPick={handlePickCategory}
      onReset={handleReset}
    />
  );
}
