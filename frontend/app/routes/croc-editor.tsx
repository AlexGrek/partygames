import { useState, useEffect } from "react";
import { Save, ToggleLeft, ToggleRight, Plus, X, ArrowRight } from "lucide-react";

const LEVELS = [1, 2, 3, 4, 5] as const;
type Level = (typeof LEVELS)[number];

const LEVEL_LABELS: Record<Level, string> = {
  1: "Level 1 — Easy",
  2: "Level 2",
  3: "Level 3 — Medium",
  4: "Level 4",
  5: "Level 5 — Hard",
};

const LEVEL_COLORS: Record<Level, string> = {
  1: "#22c55e",
  2: "#84cc16",
  3: "#eab308",
  4: "#f97316",
  5: "#ef4444",
};

type SaveState = "idle" | "saving" | "ok" | "err";

async function loadLevel(level: Level): Promise<string[]> {
  const res = await fetch(`/api/v1/keys/croc::words-level-${level}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.value) ? data.value : [];
}

async function saveLevel(level: Level, words: string[]): Promise<void> {
  const res = await fetch(`/api/v1/keys/croc::words-level-${level}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(words),
  });
  if (!res.ok) throw new Error("save failed");
}

function parseYaml(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim())
    .filter(Boolean);
}

function toYaml(words: string[]): string {
  return words.map((w) => `- ${w}`).join("\n");
}

// ── Per-level editor ────────────────────────────────────────────────────────

interface LevelEditorProps {
  level: Level;
  words: string[];
  onChange: (level: Level, words: string[]) => void;
  onMove: (word: string, fromLevel: Level, toLevel: Level) => Promise<void>;
  onSave: (level: Level) => Promise<void>;
}

function LevelEditor({ level, words, onChange, onMove, onSave }: LevelEditorProps) {
  const [altMode, setAltMode] = useState(false);
  const [yaml, setYaml] = useState(() => toYaml(words));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [movingWord, setMovingWord] = useState<string | null>(null);
  const color = LEVEL_COLORS[level];

  // Keep yaml in sync when words change externally (e.g. after a move refresh)
  useEffect(() => {
    if (!altMode) setYaml(toYaml(words));
  }, [words, altMode]);

  function toggleMode() {
    if (altMode) {
      onChange(level, parseYaml(yaml));
    } else {
      setYaml(toYaml(words));
    }
    setAltMode((v) => !v);
  }

  function setWord(i: number, val: string) {
    const next = words.map((w, j) => (j === i ? val : w));
    onChange(level, next);
  }

  function addWord() {
    onChange(level, [...words, ""]);
  }

  function removeWord(i: number) {
    onChange(level, words.filter((_, j) => j !== i));
  }

  async function handleSave() {
    if (altMode) onChange(level, parseYaml(yaml));
    setSaveState("saving");
    try {
      await onSave(level);
      setSaveState("ok");
    } catch {
      setSaveState("err");
    } finally {
      setTimeout(() => setSaveState("idle"), 1800);
    }
  }

  async function handleMove(word: string, toLevel: Level) {
    setMovingWord(word);
    try {
      await onMove(word, level, toLevel);
    } finally {
      setMovingWord(null);
    }
  }

  return (
    <div
      className="rounded-2xl border bg-white/3 overflow-hidden"
      style={{ borderColor: `${color}40` }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: `${color}30`, background: `${color}0d` }}
      >
        <span className="text-sm font-semibold" style={{ color }}>
          {LEVEL_LABELS[level]}
          <span className="ml-2 text-neutral-500 font-normal">
            {altMode ? parseYaml(yaml).filter(Boolean).length : words.filter((w) => w.trim()).length} words
          </span>
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMode}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            {altMode ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            {altMode ? "YAML" : "Form"}
          </button>
          <button
            onClick={handleSave}
            disabled={saveState === "saving"}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
            style={{
              background: saveState === "ok" ? "#22c55e20" : saveState === "err" ? "#ef444420" : `${color}20`,
              color: saveState === "ok" ? "#22c55e" : saveState === "err" ? "#ef4444" : color,
              border: `1px solid ${saveState === "ok" ? "#22c55e50" : saveState === "err" ? "#ef444450" : `${color}50`}`,
            }}
          >
            <Save size={13} />
            {saveState === "saving" ? "Saving…" : saveState === "ok" ? "Saved!" : saveState === "err" ? "Error" : "Save"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {altMode ? (
          <textarea
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            className="w-full h-48 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-neutral-200 resize-y focus:outline-none focus:border-white/25 transition-colors"
            placeholder={"- слово\n- другое слово"}
            spellCheck={false}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {words.map((word, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <span className="text-xs text-neutral-600 w-5 text-right shrink-0">{i + 1}</span>
                <input
                  type="text"
                  value={word}
                  onChange={(e) => setWord(i, e.target.value)}
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-white/25 transition-colors"
                  placeholder="слово…"
                />
                {/* Move to level buttons */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight size={12} className="text-neutral-600 shrink-0" />
                  {LEVELS.filter((l) => l !== level).map((toLevel) => (
                    <button
                      key={toLevel}
                      onClick={() => handleMove(word.trim(), toLevel)}
                      disabled={!word.trim() || movingWord === word}
                      title={`Move to ${LEVEL_LABELS[toLevel]}`}
                      className="w-5 h-5 rounded text-xs font-bold flex items-center justify-center transition-all disabled:opacity-30"
                      style={{
                        background: `${LEVEL_COLORS[toLevel]}25`,
                        color: LEVEL_COLORS[toLevel],
                        border: `1px solid ${LEVEL_COLORS[toLevel]}50`,
                      }}
                    >
                      {toLevel}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => removeWord(i)}
                  className="text-neutral-600 hover:text-neutral-300 transition-colors shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={addWord}
              className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors self-start"
            >
              <Plus size={14} /> Add word
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Root page ────────────────────────────────────────────────────────────────

export default function CrocEditor() {
  const [allWords, setAllWords] = useState<Record<Level, string[]>>({
    1: [], 2: [], 3: [], 4: [], 5: [],
  });
  const [loading, setLoading] = useState(true);

  async function refreshAll() {
    const result = {} as Record<Level, string[]>;
    await Promise.all(LEVELS.map(async (l) => { result[l] = await loadLevel(l); }));
    setAllWords(result);
  }

  useEffect(() => {
    refreshAll().finally(() => setLoading(false));
  }, []);

  function handleChange(level: Level, words: string[]) {
    setAllWords((prev) => ({ ...prev, [level]: words }));
  }

  async function handleSave(level: Level) {
    const clean = allWords[level].map((w) => w.trim()).filter(Boolean);
    await saveLevel(level, clean);
    setAllWords((prev) => ({ ...prev, [level]: clean }));
  }

  async function handleMove(word: string, fromLevel: Level, toLevel: Level) {
    // 1. Save current state of both levels first
    const fromClean = allWords[fromLevel].map((w) => w.trim()).filter(Boolean);
    const toClean = allWords[toLevel].map((w) => w.trim()).filter(Boolean);

    // 2. Remove from source, add to target
    const nextFrom = fromClean.filter((w) => w !== word);
    const nextTo = toClean.includes(word) ? toClean : [...toClean, word];

    await Promise.all([
      saveLevel(fromLevel, nextFrom),
      saveLevel(toLevel, nextTo),
    ]);

    // 3. Refresh from DB
    await refreshAll();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-neutral-400">Загрузка…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">🐊 Croc Editor</h1>
      <p className="text-sm text-neutral-500 mb-8">Edit word lists for each difficulty level.</p>
      <div className="flex flex-col gap-6">
        {LEVELS.map((level) => (
          <LevelEditor
            key={level}
            level={level}
            words={allWords[level]}
            onChange={handleChange}
            onMove={handleMove}
            onSave={handleSave}
          />
        ))}
      </div>
    </div>
  );
}
