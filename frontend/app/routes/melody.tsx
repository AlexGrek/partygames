import { useState, useEffect, useRef, useCallback } from "react";
import { RotateCcw, Square } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

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
const STOP_DELAY_MS = 6000;
const VOLUME_FLASH_MS = 1000;
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

function isVideoFile(file: string): boolean {
  return /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(file);
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

// ── Animation variants ─────────────────────────────────────────────────────
const screenVariants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
  exit:    { opacity: 0, y: -16, transition: { duration: 0.25, ease: "easeIn" as const } },
};

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4 } },
  exit:    { opacity: 0, transition: { duration: 0.2 } },
};

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
    <motion.div
      key="category"
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen flex flex-col items-center justify-center gap-10 px-4 py-12"
    >
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
          {categories.map((cat, idx) => {
            const rem = remaining(cat);
            const tot = total(cat);
            const empty = rem === 0;
            return (
              <motion.button
                key={cat}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.06, duration: 0.3 } }}
                onClick={() => onPick(cat)}
                disabled={empty}
                whileTap={empty ? undefined : { scale: 0.97 }}
                className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl border transition-colors ${
                  empty
                    ? "opacity-35 cursor-not-allowed bg-white/3 border-white/8"
                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
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
              </motion.button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col items-center gap-2 mt-2">
        <AnimatePresence mode="wait">
          {confirmReset ? (
            <motion.div
              key="confirm"
              variants={fadeUp}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex gap-2 items-center flex-wrap justify-center"
            >
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
            </motion.div>
          ) : (
            <motion.button
              key="reset-btn"
              variants={fadeIn}
              initial="initial"
              animate="animate"
              exit="exit"
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-1.5 text-xs text-neutral-700 hover:text-neutral-400 transition-colors"
            >
              <RotateCcw size={12} />
              Reset progress
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Progress Bar ───────────────────────────────────────────────────────────
function ProgressBar({
  firstGuessDelay,
  active,
  color,
}: {
  firstGuessDelay: number;
  active: boolean; // true while "playing", false (width stays at 0) after
  color: string;
}) {
  const [width, setWidth] = useState(100);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active || startedRef.current) return;
    // One rAF to let the 100% render first, then animate to 0
    const id = requestAnimationFrame(() => {
      startedRef.current = true;
      setWidth(0);
    });
    return () => cancelAnimationFrame(id);
  }, [active]);

  return (
    <div className="w-full max-w-sm">
      <div className="h-px bg-white/10 rounded-full overflow-visible relative">
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{
            width: `${width}%`,
            backgroundColor: color,
            boxShadow: `0 0 6px 2px ${color}`,
            transition: active && !startedRef.current
              ? "none"
              : `width ${firstGuessDelay}s linear`,
          }}
        />
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
  const [stoppingCount, setStoppingCount] = useState(6);
  const audioRef = useRef<HTMLMediaElement | null>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; });

  // Create media element and start preloading during grace period
  useEffect(() => {
    const media: HTMLMediaElement = isVideoFile(song.file)
      ? Object.assign(document.createElement("video"), { playsInline: true })
      : new Audio();
    media.src = fileUrl(song.file);
    media.volume = 1;
    media.preload = "auto";
    media.load();
    audioRef.current = media;
    return () => {
      media.pause();
      media.src = "";
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
    setStoppingCount(6);
    let count = 6;
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
  const isPlaying = phase === "playing";

  const accentColor = isOpenGuess || isStopping ? "#fbbf24" : "#c084fc";

  return (
    <motion.div
      key="play"
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="relative min-h-screen"
    >
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
        <AnimatePresence mode="wait">
          {isGrace && (
            <motion.div
              key="grace"
              variants={fadeIn}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex flex-col items-center gap-4"
            >
              <motion.span
                key={graceCount}
                initial={{ scale: 1.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, transition: { duration: 0.3 } }}
                exit={{ scale: 0.7, opacity: 0, transition: { duration: 0.2 } }}
                className="text-[20vw] font-bold text-purple-300 tabular-nums leading-none select-none"
                style={{
                  fontFamily: "'Syne', sans-serif",
                  textShadow: "0 0 40px rgba(168,85,247,0.6)",
                }}
              >
                {graceCount}
              </motion.span>
              <p className="text-neutral-400 text-lg">Get ready…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Playing / open-guess / stopping */}
        <AnimatePresence>
          {!isGrace && (
            <motion.div
              key="active"
              variants={fadeIn}
              initial="initial"
              animate="animate"
              className="flex flex-col items-center gap-8 w-full max-w-sm"
            >
              {/* Timer */}
              <motion.span
                className="font-mono tabular-nums text-7xl font-bold leading-none select-none"
                animate={{
                  color: accentColor,
                  textShadow:
                    isOpenGuess || isStopping
                      ? "0 0 32px rgba(251,191,36,0.55)"
                      : "0 0 24px rgba(192,132,252,0.5)",
                }}
                transition={{ duration: 0.6 }}
              >
                {mm}:{ss}
              </motion.span>

              {/* Progress bar → "Everyone guesses!" crossfade — fixed height to prevent layout shift */}
              <div className="w-full flex items-center justify-center h-5">
                <AnimatePresence mode="wait">
                  {isPlaying ? (
                    <motion.div
                      key="progress"
                      variants={fadeIn}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="w-full"
                    >
                      <ProgressBar
                        firstGuessDelay={firstGuessDelay}
                        active={isPlaying}
                        color={accentColor}
                      />
                    </motion.div>
                  ) : (
                    <motion.p
                      key="banner"
                      variants={fadeUp}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="text-yellow-300 font-bold text-sm tracking-widest uppercase"
                    >
                      Everyone guesses!
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Song reveal (stopping only) */}
              <AnimatePresence>
                {isStopping && (
                  <motion.div
                    key="reveal"
                    variants={fadeUp}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col items-center gap-2 py-6 px-10 rounded-3xl bg-white/5 border border-yellow-500/25 backdrop-blur-xl shadow-2xl w-full"
                  >
                    <span className="text-4xl">🎵</span>
                    <p
                      className="text-2xl font-bold text-white text-center leading-tight"
                      style={{ fontFamily: "'Syne', sans-serif" }}
                    >
                      {song.title}
                    </p>
                    <p className="text-neutral-400 text-center">{song.artist}</p>
                    <div className="mt-3 flex items-center gap-3">
                      <p className="text-neutral-500 text-sm tabular-nums">
                        Next in {stoppingCount}…
                      </p>
                      <button
                        onClick={() => onDoneRef.current()}
                        className="text-sm px-3 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-neutral-300 transition-colors"
                      >
                        Next →
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Stop button */}
              <AnimatePresence>
                {!isStopping && (
                  <motion.button
                    key="stop-btn"
                    variants={fadeIn}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    onClick={handleStop}
                    whileTap={{ scale: 0.94 }}
                    className="flex items-center gap-2 px-10 py-4 rounded-2xl font-semibold text-lg transition-colors"
                    style={{
                      color: "#fca5a5",
                      background: "rgba(239,68,68,0.15)",
                      border: "1px solid rgba(239,68,68,0.45)",
                      boxShadow: "0 0 24px rgba(239,68,68,0.2)",
                    }}
                  >
                    <Square size={20} fill="currentColor" />
                    Guessed!
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
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

  return (
    <AnimatePresence mode="wait">
      {currentSong ? (
        <PlayScreen
          key={currentSong.file}
          song={currentSong}
          firstGuessDelay={firstGuessDelay}
          onDone={handleDone}
        />
      ) : (
        <CategoryScreen
          key="category-screen"
          categories={categories}
          items={items}
          refreshKey={refreshKey}
          onPick={handlePickCategory}
          onReset={handleReset}
        />
      )}
    </AnimatePresence>
  );
}
