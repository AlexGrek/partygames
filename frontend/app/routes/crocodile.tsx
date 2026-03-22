import { useState, useEffect, useRef, useCallback } from "react";
import {
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Shuffle,
  BookOpen,
  X,
} from "lucide-react";

const FALLBACK_WORDS: Record<number, string[]> = {
  1: ["кот", "дом"],
  2: ["школа", "рыба"],
  3: ["телефон", "автобус"],
  4: ["президент", "ресторан"],
  5: ["правительство", "достопримечательность"],
};

const LEVEL_COLORS: Record<number, string> = {
  1: "#22c55e",
  2: "#84cc16",
  3: "#eab308",
  4: "#f97316",
  5: "#ef4444",
};

const LEVEL_NAMES: Record<number, string> = {
  1: "Легко",
  2: "Нормально",
  3: "Важко",
  4: "Дуже важко",
  5: "Пекло",
};

const LEVEL_DESC: Record<number, string> = {
  1: "3–4 літери",
  2: "5–6 літер",
  3: "7–8 літер",
  4: "9–10 літер",
  5: "11+ літер",
};

const LS_PREFIX = "croc-used-";
const LETTER_DELAY = 0.07; // seconds between each letter reveal
const TIMER_START_DELAY = 3000; // ms after last letter before timer starts

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getUsed(level: number): Set<string> {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${level}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markUsed(level: number, word: string) {
  const used = getUsed(level);
  used.add(word);
  localStorage.setItem(`${LS_PREFIX}${level}`, JSON.stringify([...used]));
}

function clearUsed() {
  for (let i = 1; i <= 5; i++) {
    localStorage.removeItem(`${LS_PREFIX}${i}`);
  }
}

async function fetchWords(level: number): Promise<string[]> {
  const res = await fetch(`/api/v1/keys/croc::words-level-${level}`);
  if (!res.ok) throw new Error("not found");
  const data = await res.json();
  const words: string[] = data.value;
  return Array.isArray(words) ? words : [];
}

const DEFAULT_CAPABILITY = "llm.huihui_ai/qwen3.5-abliterated:2B";
const DEFAULT_REQUEST = `Поясни значення слова "{word}"`;
const DEFAULT_SYSTEM =
  "Ти - дуже розумний помічник з почуттям гумору, який може допомогти пояснити значення слів українською мовою. Ти відповідаєш коротко, але чітко.";
const OFFLOADMQ_API = "/api/v1/offloadmq";
const DB_API = "/api/v1/keys";

type ExplainStatus = "idle" | "loading" | "done" | "error";

async function fetchStringKey(key: string, fallback: string): Promise<string> {
  try {
    const res = await fetch(`${DB_API}/${encodeURIComponent(key)}`);
    if (!res.ok) return fallback;
    const data = await res.json();
    return typeof data.value === "string" ? data.value : fallback;
  } catch {
    return fallback;
  }
}

export default function Crocodile() {
  const [allWords, setAllWords] = useState<Record<number, string[]>>({});
  const [currentWord, setCurrentWord] = useState<string>("");
  const [currentLevel, setCurrentLevel] = useState<number>(2);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"start" | "game">("start");
  const [startExiting, setStartExiting] = useState(false);
  // key increments on each new word to reset CSS animations
  const [wordKey, setWordKey] = useState(0);
  // elapsed seconds shown above the word (null = not started yet)
  const [elapsed, setElapsed] = useState<number | null>(null);

  const [explainStatus, setExplainStatus] = useState<ExplainStatus>("idle");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const explainConfigRef = useRef<{
    capability: string;
    request: string;
    system: string;
  } | null>(null);

  const timerStartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function loadWords() {
      const [result, capability, request, system] = await Promise.all([
        (async () => {
          const r: Record<number, string[]> = {};
          for (let i = 1; i <= 5; i++) {
            try {
              const words = await fetchWords(i);
              r[i] = words.length > 0 ? words : FALLBACK_WORDS[i];
            } catch {
              r[i] = FALLBACK_WORDS[i];
            }
          }
          return r;
        })(),
        fetchStringKey("croc::explain-capability", DEFAULT_CAPABILITY),
        fetchStringKey("croc::explain-request", DEFAULT_REQUEST),
        fetchStringKey("croc::explain-system-prompt", DEFAULT_SYSTEM),
      ]);
      explainConfigRef.current = { capability, request, system };
      setAllWords(result);
      setLoading(false);
    }
    loadWords();
    return () => {
      clearTimeout(timerStartRef.current!);
      clearInterval(intervalRef.current!);
    };
  }, []);

  function startTimerFor(word: string) {
    clearTimeout(timerStartRef.current!);
    clearInterval(intervalRef.current!);
    setElapsed(null);

    const revealDuration = word.length * LETTER_DELAY * 1000;
    const delay = revealDuration + TIMER_START_DELAY;

    timerStartRef.current = setTimeout(() => {
      const startTime = Date.now();
      setElapsed(0);
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }, delay);
  }

  const explainWord = useCallback(async (word: string) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setExplainStatus("loading");
    setExplanation(null);
    setExplainError(null);

    try {
      // 1. Check cache in DB
      const cacheKey = `croc::explanation::${word}`;
      const cacheRes = await fetch(
        `${DB_API}/${encodeURIComponent(cacheKey)}`,
        {
          signal: ctrl.signal,
        },
      );
      if (cacheRes.ok) {
        const cached = await cacheRes.json();
        if (typeof cached.value === "string" && cached.value) {
          setExplanation(cached.value);
          setExplainStatus("done");
          return;
        }
      }

      // 2. Ask LLM via OffloadMQ
      const cfg = explainConfigRef.current ?? {
        capability: DEFAULT_CAPABILITY,
        request: DEFAULT_REQUEST,
        system: DEFAULT_SYSTEM,
      };
      const prompt = cfg.request.replace("{word}", word);
      const requestBody = {
        capability: cfg.capability,
        payload: { prompt, system: cfg.system },
        urgent: true,
      };
      console.log(
        "[explain] sending to OffloadMQ:\n" +
          JSON.stringify(requestBody, null, 2),
      );

      const res = await fetch(`${OFFLOADMQ_API}/api/task/submit_blocking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => `HTTP ${res.status}`);
        console.error("[explain] HTTP error:", res.status, text);
        throw new Error(text);
      }

      const data = await res.json();
      console.log("[explain] response:", JSON.stringify(data, null, 2));
      const text: string =
        data?.result?.message?.content ??
        data?.result?.response ??
        data?.result?.stdout ??
        "";
      if (!text) throw new Error("Empty response from LLM");

      setExplanation(text);
      setExplainStatus("done");

      // 3. Cache result in DB
      await fetch(`${DB_API}/${encodeURIComponent(cacheKey)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(text),
      }).catch(() => {});
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setExplainError(String(e));
      setExplainStatus("error");
    }
  }, []);

  function cancelExplain() {
    abortRef.current?.abort();
    setExplainStatus("idle");
    setExplanation(null);
    setExplainError(null);
  }

  function pickWordFrom(level: number, words: Record<number, string[]>) {
    const pool = words[level] ?? FALLBACK_WORDS[level];
    const used = getUsed(level);
    let available = pool.filter((w) => !used.has(w));
    if (available.length === 0) {
      localStorage.removeItem(`${LS_PREFIX}${level}`);
      available = [...pool];
    }
    const word = shuffle(available)[0] ?? "";
    markUsed(level, word);
    setCurrentWord(word);
    setCurrentLevel(level);
    setWordKey((k) => k + 1);
    startTimerFor(word);
    // Reset explanation for the new word
    abortRef.current?.abort();
    setExplainStatus("idle");
    setExplanation(null);
    setExplainError(null);
  }

  function pickWord(level: number) {
    pickWordFrom(level, allWords);
  }

  function handleReset() {
    clearUsed();
    pickWord(currentLevel);
  }

  function handleLevelStart(level: number) {
    setStartExiting(true);
    setTimeout(() => {
      pickWordFrom(level, allWords);
      setPhase("game");
      setStartExiting(false);
    }, 380);
  }

  const color = LEVEL_COLORS[currentLevel];
  const fillPercent = (currentLevel / 5) * 100;
  const charCount = currentWord.length || 1;
  const dynVw = Math.floor(110 / charCount);
  const wordFontSize = `min(${dynVw}vw, 18vh)`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span
          style={{
            fontFamily: "'Russo One', sans-serif",
            fontSize: "4rem",
            animation: "floatCroc 2s ease-in-out infinite",
            display: "inline-block",
          }}
        >
          🐊
        </span>
      </div>
    );
  }

  if (phase === "start") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4 gap-10"
        style={{
          animation: startExiting
            ? "fadeOutScale 0.38s ease forwards"
            : undefined,
        }}
      >
        {/* Title */}
        <div className="flex flex-col items-center gap-3">
          <span
            style={{
              fontSize: "min(22vw, 6rem)",
              animation: "floatCroc 3s ease-in-out infinite",
              display: "inline-block",
            }}
          >
            🐊
          </span>
          <h1
            style={{
              fontFamily: "'Russo One', sans-serif",
              fontSize: "min(15vw, 4.5rem)",
              letterSpacing: "0.05em",
              animation: "glowPulse 3s ease-in-out infinite",
              color: "#22c55e",
            }}
          >
            CrocoDildo
          </h1>
          <p className="text-neutral-400 text-sm text-center max-w-xs">
            Пояснюй слово без слів — команда вгадує!
          </p>
        </div>

        {/* Level cards */}
        <div className="flex flex-col gap-3 w-full max-w-sm">
          {([1, 2, 3, 4, 5] as const).map((lvl, i) => {
            const c = LEVEL_COLORS[lvl];
            return (
              <button
                key={lvl}
                onClick={() => handleLevelStart(lvl)}
                style={{
                  animation: `slideInUp 0.45s cubic-bezier(0.22,1,0.36,1) both`,
                  animationDelay: `${i * 0.07}s`,
                  borderColor: `${c}55`,
                  background: `${c}0d`,
                  boxShadow: `0 0 0 0 ${c}00`,
                  transition:
                    "box-shadow 0.2s, background 0.2s, transform 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    `0 0 24px ${c}40`;
                  (e.currentTarget as HTMLButtonElement).style.background =
                    `${c}22`;
                  (e.currentTarget as HTMLButtonElement).style.transform =
                    "scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    `0 0 0 0 ${c}00`;
                  (e.currentTarget as HTMLButtonElement).style.background =
                    `${c}0d`;
                  (e.currentTarget as HTMLButtonElement).style.transform =
                    "scale(1)";
                }}
                className="flex items-center justify-between px-5 py-4 rounded-2xl border text-left"
              >
                <div className="flex items-center gap-4">
                  {/* color dot */}
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: c, boxShadow: `0 0 8px ${c}` }}
                  />
                  <div>
                    <div
                      className="font-bold text-base leading-tight"
                      style={{
                        color: c,
                        fontFamily: "'Russo One', sans-serif",
                      }}
                    >
                      {LEVEL_NAMES[lvl]}
                    </div>
                    <div className="text-neutral-500 text-xs mt-0.5">
                      {LEVEL_DESC[lvl]}
                    </div>
                  </div>
                </div>
                <div
                  className="text-xs font-mono font-bold px-2 py-1 rounded-lg"
                  style={{ color: c, background: `${c}22` }}
                >
                  {lvl}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative px-4 gap-8">
      {/* Reset button */}
      <button
        onClick={handleReset}
        className="absolute top-20 right-4 text-xs text-neutral-500 hover:text-neutral-300 border border-neutral-700 hover:border-neutral-500 px-2 py-1 rounded transition-colors"
      >
        скинути
      </button>

      {/* Back to start */}
      <button
        onClick={() => setPhase("start")}
        className="absolute top-20 left-4 text-xs text-neutral-500 hover:text-neutral-300 border border-neutral-700 hover:border-neutral-500 px-2 py-1 rounded transition-colors"
      >
        ← рівень
      </button>

      {/* Timer — breathes at 00:00 during grace period, then counts up */}
      <div className="h-8 flex items-center justify-center">
        <span
          className="font-mono tabular-nums text-sm"
          style={{
            color: "rgba(255,255,255,0.25)",
          }}
        >
          {elapsed === null
            ? "00:00"
            : `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`}
        </span>
      </div>

      {/* Word — letters revealed one-by-one via CSS animation */}
      <div className="w-full text-center px-2" key={wordKey}>
        <span
          className="select-none leading-none"
          style={{
            fontFamily: "'Russo One', sans-serif",
            fontSize: wordFontSize,
            whiteSpace: "nowrap",
            display: "inline-block",
          }}
        >
          {currentWord.split("").map((char, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: 0,
                animation: `letterReveal 0.3s ease forwards`,
                animationDelay: `${i * LETTER_DELAY}s`,
              }}
            >
              {char === " " ? "\u00A0" : char}
            </span>
          ))}
        </span>
      </div>

      {/* Explain section */}
      <div className="w-full max-w-sm flex flex-col items-center gap-3">
        {explainStatus === "idle" && (
          <button
            onClick={() => explainWord(currentWord)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-neutral-400 hover:text-neutral-200 text-sm transition-all"
          >
            <BookOpen size={15} />
            Пояснити слово (це довго)
          </button>
        )}

        {explainStatus === "loading" && (
          <div className="w-full flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-neutral-500 text-sm">
              <span
                style={{
                  display: "inline-block",
                  width: 16,
                  height: 16,
                  border: "2px solid",
                  borderColor: `${color}40`,
                  borderTopColor: color,
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              Думаю…
              <button
                onClick={cancelExplain}
                className="ml-1 flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
              >
                <X size={12} />
                скасувати
              </button>
            </div>
            {/* shimmer placeholder lines */}
            <div className="w-full rounded-xl bg-white/4 border border-white/8 p-4 flex flex-col gap-2">
              {[100, 85, 92, 60].map((w, i) => (
                <div
                  key={i}
                  className="h-2.5 rounded-full"
                  style={{
                    width: `${w}%`,
                    background:
                      "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 75%)",
                    backgroundSize: "200% 100%",
                    animation: `shimmer 1.5s ease-in-out infinite`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {(explainStatus === "done" || explainStatus === "error") && (
          <div className="w-full rounded-xl bg-white/4 border border-white/10 p-4 relative">
            <button
              onClick={cancelExplain}
              className="absolute top-3 right-3 text-neutral-600 hover:text-neutral-400 transition-colors"
            >
              <X size={14} />
            </button>
            {explainStatus === "done" ? (
              <p className="text-sm text-neutral-200 leading-relaxed pr-5 whitespace-pre-wrap">
                {explanation}
              </p>
            ) : (
              <p className="text-sm text-red-400">{explainError}</p>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-sm">
        <div className="h-px bg-white/10 rounded-full overflow-visible relative">
          <div
            className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
            style={{
              width: `${fillPercent}%`,
              backgroundColor: color,
              boxShadow: `0 0 6px 2px ${color}`,
            }}
          />
        </div>
      </div>

      {/* 2×2 button grid */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        <button
          onClick={() => pickWord(currentLevel - 1)}
          disabled={currentLevel <= 1}
          className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-all"
        >
          <TrendingDown size={24} />
          <span className="text-sm font-medium">Легше</span>
        </button>

        <button
          onClick={() => pickWord(currentLevel + 1)}
          disabled={currentLevel >= 5}
          className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-all"
        >
          <TrendingUp size={24} />
          <span className="text-sm font-medium">Складніше</span>
        </button>

        <button
          onClick={() => pickWord(currentLevel)}
          className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border text-sm font-medium transition-all"
          style={{
            borderColor: color,
            color: color,
            boxShadow: `0 0 16px ${color}40`,
            background: `${color}10`,
          }}
        >
          <RefreshCw size={24} />
          <span className="text-sm font-medium">Цей самий рівень</span>
        </button>

        <button
          onClick={() => pickWord(Math.ceil(Math.random() * 5))}
          className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border border-purple-500 text-purple-400 transition-all"
          style={{
            boxShadow: "0 0 16px rgba(168,85,247,0.3)",
            background: "rgba(168,85,247,0.08)",
          }}
        >
          <Shuffle size={24} />
          <span className="text-sm font-medium">Випадковий рівень</span>
        </button>
      </div>
    </div>
  );
}
