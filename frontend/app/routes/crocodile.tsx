import { useState, useEffect } from "react";

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-neutral-400 text-xl">Загрузка...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative px-6">
      {/* Reset button */}
      <button
        onClick={handleReset}
        className="absolute top-20 right-4 text-xs text-neutral-500 hover:text-neutral-300 border border-neutral-700 hover:border-neutral-500 px-2 py-1 rounded transition-colors"
      >
        reset
      </button>

      {/* Word */}
      <div className="text-center mb-10 px-4">
        <span
          className="select-none leading-none"
          style={{
            fontFamily: "'Russo One', sans-serif",
            fontSize: "clamp(3rem, 15vw, 9rem)",
            color: "#ffffff",
          }}
        >
          {currentWord}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-sm mb-12">
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

      {/* Buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={() => pickWord(currentLevel - 1)}
          disabled={currentLevel <= 1}
          className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-neutral-300 hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-all"
        >
          Easier next
        </button>

        <button
          onClick={() => pickWord(currentLevel)}
          className="px-4 py-2 rounded-xl border text-sm font-medium transition-all"
          style={{
            borderColor: color,
            color: color,
            boxShadow: `0 0 12px ${color}50`,
          }}
        >
          Same next
        </button>

        <button
          onClick={() => pickWord(Math.ceil(Math.random() * 5))}
          className="px-4 py-2 rounded-xl border border-purple-500 text-sm font-medium text-purple-400 transition-all"
          style={{ boxShadow: "0 0 12px rgba(168,85,247,0.35)" }}
        >
          Random next
        </button>

        <button
          onClick={() => pickWord(currentLevel + 1)}
          disabled={currentLevel >= 5}
          className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-neutral-300 hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-all"
        >
          Harder next
        </button>
      </div>
    </div>
  );
}
