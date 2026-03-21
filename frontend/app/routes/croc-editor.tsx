import { useState, useEffect, useRef } from "react";
import { Save, ToggleLeft, ToggleRight, X, MoveRight, Loader } from "lucide-react";

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

// ── Move dropdown ─────────────────────────────────────────────────────────────

function MoveDropdown({
  word,
  fromLevel,
  moving,
  onMove,
}: {
  word: string;
  fromLevel: Level;
  moving: boolean;
  onMove: (toLevel: Level) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={moving}
        title="Move to category"
        className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/10 transition-all disabled:opacity-30"
      >
        <MoveRight size={15} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 flex flex-col gap-0.5 p-1 rounded-xl bg-black/80 border border-white/10 shadow-2xl backdrop-blur-xl min-w-[110px]">
          {LEVELS.filter((l) => l !== fromLevel).map((toLevel) => (
            <button
              key={toLevel}
              onClick={() => { setOpen(false); onMove(toLevel); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/10 text-left"
              style={{ color: LEVEL_COLORS[toLevel] }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: LEVEL_COLORS[toLevel] }}
              />
              {LEVEL_LABELS[toLevel]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Level editor ─────────────────────────────────────────────────────────────

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
  onAddWord: (word: string) => void;
  onMove: (word: string, toLevel: Level) => Promise<void>;
}

function LevelEditor({
  level, words, altMode, yamlText, saveState, movingWord,
  onWordsChange, onYamlChange, onAltModeToggle, onSave, onAddWord, onMove,
}: LevelEditorProps) {
  const color = LEVEL_COLORS[level];
  const [newWord, setNewWord] = useState("");
  const newWordRef = useRef<HTMLInputElement>(null);
  const wordCount = altMode ? parseYaml(yamlText).length : clean(words).length;

  useEffect(() => {
    if (!altMode) newWordRef.current?.focus();
  }, [altMode]);

  function setWord(i: number, val: string) {
    onWordsChange(words.map((w, j) => (j === i ? val : w)));
  }

  function pushNewWord() {
    const w = newWord.trim();
    if (!w) return;
    setNewWord("");
    onAddWord(w); // auto-saves
  }

  function handleNewWordKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); pushNewWord(); }
  }

  function handleYamlKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart, selectionEnd, value } = el;
    const insert = "\n- ";
    onYamlChange(value.slice(0, selectionStart) + insert + value.slice(selectionEnd));
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = selectionStart + insert.length;
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-base text-neutral-400">{wordCount} words</span>
        <div className="flex items-center gap-3">
          <button
            onClick={onAltModeToggle}
            className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            {altMode ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            {altMode ? "YAML" : "Form"}
          </button>
          <button
            onClick={onSave}
            disabled={saveState === "saving"}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            style={{
              background: saveState === "ok" ? "#22c55e20" : saveState === "err" ? "#ef444420" : `${color}20`,
              color: saveState === "ok" ? "#22c55e" : saveState === "err" ? "#ef4444" : color,
              border: `1px solid ${saveState === "ok" ? "#22c55e50" : saveState === "err" ? "#ef444450" : `${color}50`}`,
            }}
          >
            <Save size={15} />
            {saveState === "saving" ? "Saving…" : saveState === "ok" ? "Saved!" : saveState === "err" ? "Error" : "Save"}
          </button>
        </div>
      </div>

      {/* Content */}
      {altMode ? (
        <textarea
          value={yamlText}
          onChange={(e) => onYamlChange(e.target.value)}
          onKeyDown={handleYamlKey}
          className="w-full h-80 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-base font-mono text-neutral-200 resize-y focus:outline-none focus:border-white/25 transition-colors leading-relaxed"
          placeholder={"- слово\n- другое слово"}
          spellCheck={false}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {words.map((word, i) => (
            <div key={i} className="flex items-center gap-2 group">
              <span className="text-sm text-neutral-600 w-6 text-right shrink-0">{i + 1}</span>
              <input
                type="text"
                value={word}
                onChange={(e) => setWord(i, e.target.value)}
                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-base text-neutral-200 focus:outline-none focus:border-white/25 transition-colors"
              />
              <MoveDropdown
                word={word}
                fromLevel={level}
                moving={movingWord === word}
                onMove={(toLevel) => onMove(word.trim(), toLevel)}
              />
              <button
                onClick={() => onWordsChange(words.filter((_, j) => j !== i))}
                className="text-neutral-700 hover:text-neutral-300 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          ))}

          {/* Always-on new word input */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-neutral-700 w-6 text-right shrink-0">{words.length + 1}</span>
            <input
              ref={newWordRef}
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={handleNewWordKey}
              className="flex-1 bg-black/20 border border-dashed border-white/15 rounded-lg px-3 py-2 text-base text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-white/30 transition-colors"
              placeholder="новое слово… (Enter)"
            />
            {/* spacer to align with move+delete buttons */}
            <div className="w-[60px] shrink-0" />
          </div>
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
    return altMode[level] ? parseYaml(yamlText[level]) : clean(localWords[level]);
  }

  function isDirty(level: Level): boolean {
    return JSON.stringify(getEffectiveWords(level)) !== JSON.stringify(dbWords[level]);
  }

  async function commitSave(level: Level, words?: string[]): Promise<void> {
    const w = words ?? getEffectiveWords(level);
    await apiSave(level, w);
    setDbWords((prev) => ({ ...prev, [level]: w }));
    setLocalWords((prev) => ({ ...prev, [level]: w }));
    setYamlText((prev) => ({ ...prev, [level]: toYaml(w) }));
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

  // Add word + auto-save atomically
  async function handleAddWord(level: Level, word: string) {
    const next = [...clean(localWords[level]), word];
    setLocalWords((prev) => ({ ...prev, [level]: next }));
    setSaveState(level, "saving");
    try {
      await commitSave(level, next);
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
      setLocalWords((prev) => ({ ...prev, [level]: parseYaml(yamlText[level]) }));
    } else {
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
          onAddWord={(word) => handleAddWord(activeLevel, word)}
          onMove={(word, toLevel) => handleMove(word, activeLevel, toLevel)}
        />
      </div>
    </div>
  );
}
