import { useState, useEffect } from "react";
import { TrendingDown, TrendingUp, RefreshCw, Shuffle } from "lucide-react";

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

const LS_PREFIX = "croc-used-";

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

export default function Crocodile() {
  const [allWords, setAllWords] = useState<Record<number, string[]>>({});
  const [currentWord, setCurrentWord] = useState<string>("");
  const [currentLevel, setCurrentLevel] = useState<number>(3);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWords() {
      const result: Record<number, string[]> = {};
      for (let i = 1; i <= 5; i++) {
        try {
          const words = await fetchWords(i);
          result[i] = words.length > 0 ? words : FALLBACK_WORDS[i];
        } catch {
          result[i] = FALLBACK_WORDS[i];
        }
      }
      setAllWords(result);
      setLoading(false);
      pickWordFrom(3, result);
    }
    loadWords();
  }, []);

  function pickWordFrom(level: number, words: Record<number, string[]>) {
    const pool = words[level] ?? FALLBACK_WORDS[level];
    const used = getUsed(level);
    const available = pool.filter((w) => !used.has(w));
    const source = available.length > 0 ? available : pool;
    const word = source[Math.floor(Math.random() * source.length)] ?? "";
    markUsed(level, word);
    setCurrentWord(word);
    setCurrentLevel(level);
  }

  function pickWord(level: number) {
    pickWordFrom(level, allWords);
  }

  function handleReset() {
    clearUsed();
    pickWord(currentLevel);
  }

  const color = LEVEL_COLORS[currentLevel];
  const fillPercent = (currentLevel / 5) * 100;

  // Font size that guarantees the word fits any screen:
  // Russo One chars are ~0.6× wide as tall.
  // We want charCount * 0.6 * fontSize ≤ 90vw  →  fontSize ≤ 150vw / charCount
  // Also cap at 25vh so the word doesn't overflow vertically.
  const charCount = currentWord.length || 1;
  const dynVw = Math.floor(140 / charCount);
  const wordFontSize = `min(${dynVw}vw, 25vh)`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-neutral-400 text-xl">Загрузка...</span>
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
        reset
      </button>

      {/* Word — always fits the screen */}
      <div className="w-full text-center px-2">
        <span
          className="select-none leading-none block"
          style={{
            fontFamily: "'Russo One', sans-serif",
            fontSize: wordFontSize,
            color: "#ffffff",
            whiteSpace: "nowrap",
          }}
        >
          {currentWord}
        </span>
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
        {/* Easier */}
        <button
          onClick={() => pickWord(currentLevel - 1)}
          disabled={currentLevel <= 1}
          className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-all"
        >
          <TrendingDown size={24} />
          <span className="text-sm font-medium">Easier next</span>
        </button>

        {/* Harder */}
        <button
          onClick={() => pickWord(currentLevel + 1)}
          disabled={currentLevel >= 5}
          className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-all"
        >
          <TrendingUp size={24} />
          <span className="text-sm font-medium">Harder next</span>
        </button>

        {/* Same */}
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
          <span className="text-sm font-medium">Same next</span>
        </button>

        {/* Random */}
        <button
          onClick={() => pickWord(Math.ceil(Math.random() * 5))}
          className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border border-purple-500 text-purple-400 transition-all"
          style={{
            boxShadow: "0 0 16px rgba(168,85,247,0.3)",
            background: "rgba(168,85,247,0.08)",
          }}
        >
          <Shuffle size={24} />
          <span className="text-sm font-medium">Random next</span>
        </button>
      </div>
    </div>
  );
}
