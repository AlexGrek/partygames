import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Save, ToggleLeft, ToggleRight, X, MoveRight, Loader, Wand2, ShieldCheck } from "lucide-react";

const LEVELS = [1, 2, 3, 4, 5] as const;
type Level = (typeof LEVELS)[number];
type ActiveTab = Level | "checkup";

const LEVEL_LABELS: Record<Level, string> = {
  1: "Easy",
  2: "Normal",
  3: "Interesting",
  4: "Complicated",
  5: "Impossible",
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
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}${body ? `\n${body}` : ""}`);
  }
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

function isYamlValid(text: string): boolean {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.length === 0 || lines.every((l) => l.startsWith("- "));
}

function needsCapFix(word: string): boolean {
  if (!word) return false;
  return !/^\p{Lu}/u.test(word);
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// ── Move dropdown ─────────────────────────────────────────────────────────────

function MoveDropdown({ word, fromLevel, moving, onMove }: {
  word: string; fromLevel: Level; moving: boolean;
  onMove: (toLevel: Level) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={moving || !word.trim()}
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
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: LEVEL_COLORS[toLevel] }} />
              {LEVEL_LABELS[toLevel]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Level editor ─────────────────────────────────────────────────────────────

interface LevelEditorHandle {
  getEffectiveWords: () => string[];
}

interface LevelEditorProps {
  level: Level;
  initialWords: string[];
  saveState: SaveState;
  movingWord: string | null;
  onSave: (words: string[]) => void;
  onAddWord: (words: string[]) => void;
  onMove: (word: string, toLevel: Level) => Promise<void>;
}

const LevelEditor = forwardRef<LevelEditorHandle, LevelEditorProps>(
  function LevelEditor({ level, initialWords, saveState, movingWord, onSave, onAddWord, onMove }, ref) {
    const color = LEVEL_COLORS[level];
    const [words, setWords] = useState(initialWords);
    const [altMode, setAltMode] = useState(false);
    const [yaml, setYaml] = useState(() => toYaml(initialWords));
    const [newWord, setNewWord] = useState("");
    const newWordRef = useRef<HTMLInputElement>(null);

    const getterRef = useRef<() => string[]>(() => initialWords);
    getterRef.current = () => (altMode ? parseYaml(yaml) : clean(words));

    useImperativeHandle(ref, () => ({
      getEffectiveWords: () => getterRef.current(),
    }), []);

    const effectiveWords = altMode ? parseYaml(yaml) : clean(words);
    const isDirty = JSON.stringify(effectiveWords) !== JSON.stringify(initialWords);

    const [yamlValid, setYamlValid] = useState(true);
    useEffect(() => {
      if (!altMode) return;
      const t = setTimeout(() => setYamlValid(isYamlValid(yaml)), 400);
      return () => clearTimeout(t);
    }, [yaml, altMode]);

    useEffect(() => {
      if (!altMode) newWordRef.current?.focus();
    }, [altMode]);

    function setWord(i: number, val: string) {
      setWords((ws) => ws.map((w, j) => (j === i ? val : w)));
    }

    function toggleMode() {
      if (altMode) setWords(parseYaml(yaml));
      else setYaml(toYaml(clean(words)));
      setAltMode((v) => !v);
    }

    function pushNewWord() {
      const w = newWord.trim();
      if (!w) return;
      const next = [...clean(words), w];
      setWords(next);
      setNewWord("");
      onAddWord(next);
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
      setYaml(value.slice(0, selectionStart) + insert + value.slice(selectionEnd));
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = selectionStart + insert.length;
      });
    }

    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <span className="text-base text-neutral-400">{effectiveWords.length} words</span>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleMode}
              className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              {altMode ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              {altMode ? "YAML" : "Form"}
            </button>
            <button
              onClick={() => onSave(getterRef.current())}
              disabled={!isDirty || saveState === "saving"}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-30"
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

        {altMode ? (
          <textarea
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            onKeyDown={handleYamlKey}
            className="w-full h-80 bg-black/30 rounded-xl px-4 py-3 text-base font-mono text-neutral-200 resize-y focus:outline-none transition-colors leading-relaxed"
            style={{
              border: `1px solid ${yamlValid ? "rgba(255,255,255,0.1)" : "rgba(239,68,68,0.6)"}`,
              boxShadow: yamlValid ? undefined : "0 0 0 1px rgba(239,68,68,0.2)",
            }}
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
                  onClick={() => setWords((ws) => ws.filter((_, j) => j !== i))}
                  className="text-neutral-700 hover:text-neutral-300 transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
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
              <div className="w-[60px] shrink-0" />
            </div>
          </div>
        )}
      </div>
    );
  }
);

// ── Checkup panel ─────────────────────────────────────────────────────────────

function CheckupPanel({ dbWords, onRemoveFromLevel, onAutoFix }: {
  dbWords: AllWords;
  onRemoveFromLevel: (word: string, level: Level) => Promise<void>;
  onAutoFix: () => Promise<void>;
}) {
  const [fixing, setFixing] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  // Duplicates: word → levels it appears in
  const wordToLevels: Record<string, Level[]> = {};
  for (const level of LEVELS) {
    for (const word of dbWords[level]) {
      if (!wordToLevels[word]) wordToLevels[word] = [];
      wordToLevels[word].push(level);
    }
  }
  const duplicates = Object.entries(wordToLevels)
    .filter(([, levels]) => levels.length >= 2)
    .map(([word, levels]) => ({ word, levels: levels as Level[] }))
    .sort((a, b) => a.word.localeCompare(b.word));

  // Capitalization issues
  const capIssues: { word: string; level: Level; fixed: string }[] = [];
  for (const level of LEVELS) {
    for (const word of dbWords[level]) {
      if (needsCapFix(word)) capIssues.push({ word, level, fixed: capitalize(word) });
    }
  }

  async function handleRemove(word: string, level: Level) {
    setRemoving(`${word}-${level}`);
    try { await onRemoveFromLevel(word, level); } finally { setRemoving(null); }
  }

  async function handleAutoFix() {
    setFixing(true);
    try { await onAutoFix(); } finally { setFixing(false); }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Duplicates */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 mb-3">Duplicates</h2>
        {duplicates.length === 0 ? (
          <p className="text-sm text-green-500 flex items-center gap-2"><ShieldCheck size={15} /> No duplicates found</p>
        ) : (
          <div className="flex flex-col gap-2">
            {duplicates.map(({ word, levels }) => (
              <div key={word} className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-2.5">
                <span className="text-base text-neutral-200 flex-1 font-medium">{word}</span>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {levels.map((level) => (
                    <button
                      key={level}
                      onClick={() => handleRemove(word, level)}
                      disabled={removing === `${word}-${level}`}
                      title={`Remove from ${LEVEL_LABELS[level]}`}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all hover:brightness-125 disabled:opacity-30"
                      style={{
                        background: `${LEVEL_COLORS[level]}20`,
                        color: LEVEL_COLORS[level],
                        border: `1px solid ${LEVEL_COLORS[level]}40`,
                      }}
                    >
                      {removing === `${word}-${level}`
                        ? <Loader size={11} className="animate-spin" />
                        : <X size={11} />}
                      {LEVEL_LABELS[level]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Capitalization */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Capitalization</h2>
          {capIssues.length > 0 && (
            <button
              onClick={handleAutoFix}
              disabled={fixing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/15 bg-white/5 text-neutral-300 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40"
            >
              {fixing ? <Loader size={12} className="animate-spin" /> : <Wand2 size={12} />}
              Auto fix all
            </button>
          )}
        </div>
        {capIssues.length === 0 ? (
          <p className="text-sm text-green-500 flex items-center gap-2"><ShieldCheck size={15} /> All words start with a capital letter</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {capIssues.map(({ word, level, fixed }, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-2.5">
                <span
                  className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
                  style={{ background: `${LEVEL_COLORS[level]}20`, color: LEVEL_COLORS[level] }}
                >
                  {LEVEL_LABELS[level]}
                </span>
                <span className="text-base text-neutral-500 line-through flex-1">{word}</span>
                <span className="text-base text-neutral-200">→ {fixed}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, detail }: { message: string; detail: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-red-950/90 border border-red-500/40 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-sm w-full">
      <p className="text-red-300 text-sm font-medium">{message}</p>
      <p className="text-red-500/80 text-xs mt-1 font-mono leading-snug whitespace-pre-wrap">{detail}</p>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

type AllWords = Record<Level, string[]>;

export default function CrocEditor() {
  const [dbWords, setDbWords] = useState<AllWords>({ 1: [], 2: [], 3: [], 4: [], 5: [] });
  const [activeTab, setActiveTab] = useState<ActiveTab>(1);
  const [loading, setLoading] = useState(true);
  const [autoSaving, setAutoSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [movingWord, setMovingWord] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<{ message: string; detail: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const editorRef = useRef<LevelEditorHandle>(null);

  function showToast(message: string, err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    setToast({ message, detail });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  async function refreshAll() {
    const result = {} as AllWords;
    await Promise.all(LEVELS.map(async (l) => { result[l] = await apiLoad(l); }));
    setDbWords(result);
  }

  useEffect(() => {
    refreshAll().finally(() => setLoading(false));
    return () => clearTimeout(toastTimer.current);
  }, []);

  async function commitSave(level: Level, words: string[]) {
    await apiSave(level, words);
    setDbWords((prev) => ({ ...prev, [level]: words }));
  }

  async function handleSave(words: string[]) {
    if (activeTab === "checkup") return;
    setSaveState("saving");
    try {
      await commitSave(activeTab, words);
      setSaveState("ok");
    } catch (err) {
      setSaveState("err");
      showToast("Failed to save", err);
    } finally {
      setTimeout(() => setSaveState("idle"), 1800);
    }
  }

  async function handleAddWord(words: string[]) {
    if (activeTab === "checkup") return;
    setSaveState("saving");
    try {
      await commitSave(activeTab, words);
      setSaveState("ok");
    } catch (err) {
      setSaveState("err");
      showToast("Failed to save", err);
    } finally {
      setTimeout(() => setSaveState("idle"), 1800);
    }
  }

  async function handleTabSwitch(newTab: ActiveTab) {
    if (newTab === activeTab) return;
    // Auto-save current level editor before leaving (if it's a level tab)
    if (activeTab !== "checkup" && editorRef.current) {
      const words = editorRef.current.getEffectiveWords();
      const dirty = JSON.stringify(words) !== JSON.stringify(dbWords[activeTab]);
      if (dirty) {
        setAutoSaving(true);
        try {
          await commitSave(activeTab, words);
        } catch (err) {
          showToast(`Changes to "${LEVEL_LABELS[activeTab]}" lost`, err);
        } finally {
          setAutoSaving(false);
        }
      }
    }
    setSaveState("idle");
    setActiveTab(newTab);
  }

  async function handleMove(word: string, fromLevel: Level, toLevel: Level) {
    setMovingWord(word);
    try {
      const fromWords = clean(editorRef.current?.getEffectiveWords() ?? dbWords[fromLevel]).filter((w) => w !== word);
      const toWords = dbWords[toLevel];
      const toNext = toWords.includes(word) ? toWords : [...toWords, word];
      await Promise.all([apiSave(fromLevel, fromWords), apiSave(toLevel, toNext)]);
      await refreshAll();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast("Move failed", err);
    } finally {
      setMovingWord(null);
    }
  }

  async function handleRemoveFromLevel(word: string, level: Level) {
    const words = dbWords[level].filter((w) => w !== word);
    try {
      await commitSave(level, words);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast("Remove failed", err);
    }
  }

  async function handleAutoFix() {
    for (const level of LEVELS) {
      const words = dbWords[level];
      const fixed = words.map((w) => needsCapFix(w) ? capitalize(w) : w);
      if (JSON.stringify(fixed) !== JSON.stringify(words)) {
        try {
          await commitSave(level, fixed);
        } catch (err) {
          showToast(`Failed to fix ${LEVEL_LABELS[level]}`, err);
          return;
        }
      }
    }
    setRefreshKey((k) => k + 1);
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
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">🐊 Croc Editor</h1>
        {autoSaving && (
          <span className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Loader size={12} className="animate-spin" /> saving…
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-white/5 border border-white/8">
        {LEVELS.map((level) => {
          const active = level === activeTab;
          const c = LEVEL_COLORS[level];
          return (
            <button
              key={level}
              onClick={() => handleTabSwitch(level)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-semibold transition-all"
              style={active ? { background: `${c}20`, color: c, boxShadow: `0 0 12px ${c}30` } : { color: "#6b7280" }}
            >
              <span>{LEVEL_LABELS[level]}</span>
              <span className="text-[10px] font-normal opacity-70">{dbWords[level].length}w</span>
            </button>
          );
        })}
        {/* Checkup tab */}
        <button
          onClick={() => handleTabSwitch("checkup")}
          className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-semibold transition-all"
          style={
            activeTab === "checkup"
              ? { background: "rgba(99,102,241,0.15)", color: "#818cf8", boxShadow: "0 0 12px rgba(99,102,241,0.2)" }
              : { color: "#6b7280" }
          }
        >
          <ShieldCheck size={14} />
          <span>Checkup</span>
        </button>
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
        {activeTab === "checkup" ? (
          <CheckupPanel
            key={refreshKey}
            dbWords={dbWords}
            onRemoveFromLevel={handleRemoveFromLevel}
            onAutoFix={handleAutoFix}
          />
        ) : (
          <LevelEditor
            key={`${activeTab}-${refreshKey}`}
            ref={editorRef}
            level={activeTab}
            initialWords={dbWords[activeTab]}
            saveState={saveState}
            movingWord={movingWord}
            onSave={handleSave}
            onAddWord={handleAddWord}
            onMove={(word, toLevel) => handleMove(word, activeTab, toLevel)}
          />
        )}
      </div>

      {toast && <Toast message={toast.message} detail={toast.detail} />}
    </div>
  );
}
