import { useState, useEffect } from "react";
import { Save, ToggleLeft, ToggleRight, Plus, X, ArrowRight, Loader } from "lucide-react";

const LEVELS = [1, 2, 3, 4, 5] as const;
type Level = (typeof LEVELS)[number];

const LEVEL_LABELS: Record<Level, string> = {
  1: "Easy",
  2: "Level 2",
  3: "Medium",
  4: "Level 4",
  5: "Hard",
};

const LEVEL_COLORS: Record<Level, string> = {
  1: "#22c55e",
  2: "#84cc16",
  3: "#eab308",
  4: "#f97316",
  5: "#ef4444",
};

type SaveState = "idle" | "saving" | "ok" | "err";

// ── API helpers ──────────────────────────────────────────────────────────────

async function apiLoad(level: Level): Promise<string[]> {
  const res = await fetch(`/api/v1/keys/croc::words-level-${level}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.value) ? data.value : [];
}

async function apiSave(level: Level, words: string[]): Promise<void> {
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

function clean(words: string[]): string[] {
  return words.map((w) => w.trim()).filter(Boolean);
}

// ── Level editor (single tab content) ───────────────────────────────────────

interface LevelEditorProps {
  level: Level;
  words: string[];
  altMode: boolean;
  yamlText: string;
  saveState: SaveState;
  movingWord: string | null;
  onWordsChange: (words: string[]) => void;
  onYamlChange: (yaml: string) => void;
  onAltModeToggle: () => void;
  onSave: () => void;
  onMove: (word: string, toLevel: Level) => Promise<void>;
}

function LevelEditor({
  level, words, altMode, yamlText, saveState, movingWord,
  onWordsChange, onYamlChange, onAltModeToggle, onSave, onMove,
}: LevelEditorProps) {
  const color = LEVEL_COLORS[level];
  const wordCount = altMode ? parseYaml(yamlText).length : clean(words).length;

  function setWord(i: number, val: string) {
    onWordsChange(words.map((w, j) => (j === i ? val : w)));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-500">{wordCount} words</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onAltModeToggle}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            {altMode ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            {altMode ? "YAML" : "Form"}
          </button>
          <button
            onClick={onSave}
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

      {/* Content */}
      {altMode ? (
        <textarea
          value={yamlText}
          onChange={(e) => onYamlChange(e.target.value)}
          className="w-full h-72 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-neutral-200 resize-y focus:outline-none focus:border-white/25 transition-colors"
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
              {/* Move to level */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight size={12} className="text-neutral-600 shrink-0" />
                {LEVELS.filter((l) => l !== level).map((toLevel) => (
                  <button
                    key={toLevel}
                    onClick={() => onMove(word.trim(), toLevel)}
                    disabled={!word.trim() || movingWord === word}
                    title={`Move to ${LEVEL_LABELS[toLevel]}`}
                    className="w-5 h-5 rounded text-xs font-bold flex items-center justify-center transition-all disabled:opacity-30"
                    style={{
                      background: `${LEVEL_COLORS[toLevel]}25`,
                      color: LEVEL_COLORS[toLevel],
                      border: `1px solid ${LEVEL_COLORS[toLevel]}50`,
                    }}
                  >
                    {movingWord === word ? "…" : toLevel}
                  </button>
                ))}
              </div>
              <button
                onClick={() => onWordsChange(words.filter((_, j) => j !== i))}
                className="text-neutral-600 hover:text-neutral-300 transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={() => onWordsChange([...words, ""])}
            className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors self-start"
          >
            <Plus size={14} /> Add word
          </button>
        </div>
      )}
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

type AllWords = Record<Level, string[]>;
type AllYaml  = Record<Level, string>;
type AllBool  = Record<Level, boolean>;

function emptyRecord<T>(val: T): Record<Level, T> {
  return { 1: val, 2: val, 3: val, 4: val, 5: val } as Record<Level, T>;
}

export default function CrocEditor() {
  const [dbWords,    setDbWords]    = useState<AllWords>(emptyRecord([]));
  const [localWords, setLocalWords] = useState<AllWords>(emptyRecord([]));
  const [yamlText,   setYamlText]   = useState<AllYaml>(emptyRecord(""));
  const [altMode,    setAltMode]    = useState<AllBool>(emptyRecord(false));
  const [activeLevel, setActiveLevel] = useState<Level>(1);
  const [loading,    setLoading]    = useState(true);
  const [autoSaving, setAutoSaving] = useState(false);
  const [saveStates, setSaveStates] = useState<Record<Level, SaveState>>(emptyRecord("idle"));
  const [movingWord, setMovingWord] = useState<string | null>(null);

  function setSaveState(level: Level, state: SaveState) {
    setSaveStates((prev) => ({ ...prev, [level]: state }));
  }

  async function refreshAll() {
    const result = {} as AllWords;
    await Promise.all(LEVELS.map(async (l) => { result[l] = await apiLoad(l); }));
    setDbWords(result);
    setLocalWords(result);
    setYamlText(LEVELS.reduce((acc, l) => ({ ...acc, [l]: toYaml(result[l]) }), {} as AllYaml));
  }

  useEffect(() => {
    refreshAll().finally(() => setLoading(false));
  }, []);

  function getEffectiveWords(level: Level): string[] {
    return altMode[level]
      ? parseYaml(yamlText[level])
      : clean(localWords[level]);
  }

  function isDirty(level: Level): boolean {
    return JSON.stringify(getEffectiveWords(level)) !== JSON.stringify(dbWords[level]);
  }

  async function commitSave(level: Level): Promise<void> {
    const words = getEffectiveWords(level);
    await apiSave(level, words);
    setDbWords((prev) => ({ ...prev, [level]: words }));
    setLocalWords((prev) => ({ ...prev, [level]: words }));
    setYamlText((prev) => ({ ...prev, [level]: toYaml(words) }));
  }

  async function handleSave(level: Level) {
    setSaveState(level, "saving");
    try {
      await commitSave(level);
      setSaveState(level, "ok");
    } catch {
      setSaveState(level, "err");
    } finally {
      setTimeout(() => setSaveState(level, "idle"), 1800);
    }
  }

  async function handleTabSwitch(newLevel: Level) {
    if (newLevel === activeLevel) return;
    if (isDirty(activeLevel)) {
      setAutoSaving(true);
      try { await commitSave(activeLevel); } catch { /* best-effort */ }
      setAutoSaving(false);
    }
    setActiveLevel(newLevel);
  }

  function handleAltModeToggle(level: Level) {
    if (altMode[level]) {
      // YAML → form
      setLocalWords((prev) => ({ ...prev, [level]: parseYaml(yamlText[level]) }));
    } else {
      // form → YAML
      setYamlText((prev) => ({ ...prev, [level]: toYaml(clean(localWords[level])) }));
    }
    setAltMode((prev) => ({ ...prev, [level]: !prev[level] }));
  }

  async function handleMove(word: string, fromLevel: Level, toLevel: Level) {
    setMovingWord(word);
    try {
      const fromWords = clean(getEffectiveWords(fromLevel)).filter((w) => w !== word);
      const toWords = getEffectiveWords(toLevel);
      const toNext = toWords.includes(word) ? toWords : [...toWords, word];
      await Promise.all([apiSave(fromLevel, fromWords), apiSave(toLevel, toNext)]);
      await refreshAll();
    } finally {
      setMovingWord(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-neutral-400">Загрузка…</span>
      </div>
    );
  }

  const color = LEVEL_COLORS[activeLevel];

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">🐊 Croc Editor</h1>
        {autoSaving && (
          <span className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Loader size={12} className="animate-spin" /> auto-saving…
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-white/5 border border-white/8">
        {LEVELS.map((level) => {
          const active = level === activeLevel;
          const dirty = isDirty(level);
          const c = LEVEL_COLORS[level];
          return (
            <button
              key={level}
              onClick={() => handleTabSwitch(level)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-semibold transition-all relative"
              style={
                active
                  ? { background: `${c}20`, color: c, boxShadow: `0 0 12px ${c}30` }
                  : { color: "#6b7280" }
              }
            >
              <span>{LEVEL_LABELS[level]}</span>
              <span className="text-[10px] font-normal opacity-70">
                {getEffectiveWords(level).length}w
              </span>
              {dirty && !active && (
                <span
                  className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                  style={{ background: c }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Active editor */}
      <div
        className="rounded-2xl border bg-white/3 p-5"
        style={{ borderColor: `${color}40` }}
      >
        <LevelEditor
          key={activeLevel}
          level={activeLevel}
          words={localWords[activeLevel]}
          altMode={altMode[activeLevel]}
          yamlText={yamlText[activeLevel]}
          saveState={saveStates[activeLevel]}
          movingWord={movingWord}
          onWordsChange={(w) => setLocalWords((prev) => ({ ...prev, [activeLevel]: w }))}
          onYamlChange={(y) => setYamlText((prev) => ({ ...prev, [activeLevel]: y }))}
          onAltModeToggle={() => handleAltModeToggle(activeLevel)}
          onSave={() => handleSave(activeLevel)}
          onMove={(word, toLevel) => handleMove(word, activeLevel, toLevel)}
        />
      </div>
    </div>
  );
}
