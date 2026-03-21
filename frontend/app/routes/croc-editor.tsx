import { useState, useEffect } from "react";
import { Save, ToggleLeft, ToggleRight, Plus, X } from "lucide-react";

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

// Minimal YAML list parser: handles "- word" lines, ignores blanks/comments
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

function LevelEditor({ level }: { level: Level }) {
  const [words, setWords] = useState<string[]>([]);
  const [yaml, setYaml] = useState("");
  const [altMode, setAltMode] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const color = LEVEL_COLORS[level];

  useEffect(() => {
    loadLevel(level).then((w) => {
      setWords(w);
      setYaml(toYaml(w));
    });
  }, [level]);

  function toggleMode() {
    if (altMode) {
      // YAML → form: parse and sync
      const parsed = parseYaml(yaml);
      setWords(parsed);
    } else {
      // form → YAML: render current words
      setYaml(toYaml(words));
    }
    setAltMode((v) => !v);
  }

  function setWord(i: number, val: string) {
    setWords((ws) => ws.map((w, j) => (j === i ? val : w)));
  }

  function addWord() {
    setWords((ws) => [...ws, ""]);
  }

  function removeWord(i: number) {
    setWords((ws) => ws.filter((_, j) => j !== i));
  }

  async function handleSave() {
    setSaveState("saving");
    try {
      const finalWords = altMode
        ? parseYaml(yaml).filter(Boolean)
        : words.map((w) => w.trim()).filter(Boolean);
      await saveLevel(level, finalWords);
      // sync back
      setWords(finalWords);
      setYaml(toYaml(finalWords));
      setSaveState("ok");
    } catch {
      setSaveState("err");
    } finally {
      setTimeout(() => setSaveState("idle"), 1800);
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
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-neutral-600 w-5 text-right shrink-0">{i + 1}</span>
                <input
                  type="text"
                  value={word}
                  onChange={(e) => setWord(i, e.target.value)}
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-white/25 transition-colors"
                  placeholder="слово…"
                />
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

export default function CrocEditor() {
  return (
    <div className="min-h-screen pt-20 pb-12 px-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">🐊 Croc Editor</h1>
      <p className="text-sm text-neutral-500 mb-8">Edit word lists for each difficulty level.</p>
      <div className="flex flex-col gap-6">
        {LEVELS.map((level) => (
          <LevelEditor key={level} level={level} />
        ))}
      </div>
    </div>
  );
}
