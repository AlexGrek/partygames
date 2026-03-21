import { useState } from "react";
import { Play, RotateCcw, ExternalLink } from "lucide-react";

const API = "/api/v1/offloadmq";
const SERVER_URL = "https://offloadmq.alexgr.space";

type TaskStatus = "idle" | "running" | "done" | "error";

interface TaskResult {
  status: string;
  output: unknown;
  log?: string;
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

async function submitBlocking(
  capability: string,
  payload: unknown
): Promise<TaskResult> {
  const res = await fetch(`${API}/api/task/submit_blocking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ capability, payload, urgent: true }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(text);
  }
  return res.json();
}

// ── Output box ────────────────────────────────────────────────────────────────

function OutputBox({
  status,
  result,
  error,
}: {
  status: TaskStatus;
  result: TaskResult | null;
  error: string | null;
}) {
  if (status === "idle") return null;
  if (status === "running") {
    return (
      <div className="mt-3 rounded-lg bg-black/40 border border-white/10 px-4 py-3 text-sm text-neutral-400 animate-pulse">
        Running…
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="mt-3 rounded-lg bg-red-950/40 border border-red-700/30 px-4 py-3 text-sm text-red-300 font-mono whitespace-pre-wrap break-all">
        {error}
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-lg bg-black/40 border border-white/10 px-4 py-3 text-sm font-mono whitespace-pre-wrap break-all text-green-300 max-h-64 overflow-y-auto">
      {JSON.stringify(result?.output ?? result, null, 2)}
      {result?.log && (
        <div className="mt-2 border-t border-white/10 pt-2 text-neutral-400">
          {result.log}
        </div>
      )}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white/4 border border-white/10 p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/10 text-neutral-400">
          {badge}
        </span>
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function RunButton({
  running,
  onClick,
}: {
  running: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={running}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors text-sm font-medium self-start"
    >
      <Play size={13} />
      {running ? "Running…" : "Run"}
    </button>
  );
}

// ── Debug Echo ────────────────────────────────────────────────────────────────

function EchoPanel() {
  const [msg, setMsg] = useState("hello from partygames");
  const [status, setStatus] = useState<TaskStatus>("idle");
  const [result, setResult] = useState<TaskResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setStatus("running");
    setResult(null);
    setError(null);
    try {
      const r = await submitBlocking("debug.echo", { message: msg });
      setResult(r);
      setStatus("done");
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  };

  return (
    <Section title="Debug Echo" badge="debug.echo">
      <p className="text-xs text-neutral-500">
        Echoes the payload back. Use to verify the connection is working.
      </p>
      <div className="flex gap-2 items-center">
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="message"
          className="flex-1 bg-white/8 border border-white/15 rounded-lg px-3 py-1.5 text-sm font-mono outline-none focus:border-neutral-500 transition-colors"
        />
        <RunButton running={status === "running"} onClick={run} />
      </div>
      <OutputBox status={status} result={result} error={error} />
    </Section>
  );
}

// ── Shell Runner ──────────────────────────────────────────────────────────────

function ShellPanel() {
  const [cmd, setCmd] = useState("echo $HOSTNAME && uptime");
  const [status, setStatus] = useState<TaskStatus>("idle");
  const [result, setResult] = useState<TaskResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setStatus("running");
    setResult(null);
    setError(null);
    try {
      const r = await submitBlocking("shell.bash", { command: cmd });
      setResult(r);
      setStatus("done");
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  };

  return (
    <Section title="Shell Runner" badge="shell.bash">
      <p className="text-xs text-neutral-500">
        Execute a bash script on the remote agent.
      </p>
      <textarea
        value={cmd}
        onChange={(e) => setCmd(e.target.value)}
        rows={4}
        spellCheck={false}
        className="bg-white/8 border border-white/15 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-neutral-500 transition-colors resize-y"
      />
      <RunButton running={status === "running"} onClick={run} />
      <OutputBox status={status} result={result} error={error} />
    </Section>
  );
}

// ── Docker Runner ─────────────────────────────────────────────────────────────

function DockerPanel() {
  const [image, setImage] = useState("python:3.12-slim");
  const [command, setCommand] = useState(
    "python -c \"import sys; print('Python', sys.version)\""
  );
  const [timeout, setTimeout_] = useState("30");
  const [status, setStatus] = useState<TaskStatus>("idle");
  const [result, setResult] = useState<TaskResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setStatus("running");
    setResult(null);
    setError(null);
    try {
      const r = await submitBlocking("docker.any", {
        image,
        command,
        timeout: parseInt(timeout, 10) || 30,
      });
      setResult(r);
      setStatus("done");
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  };

  return (
    <Section title="Docker Runner" badge="docker.any">
      <p className="text-xs text-neutral-500">
        Run any Docker container on the remote agent with automatic cleanup.
      </p>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">Image</label>
          <input
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="python:3.12-slim"
            className="bg-white/8 border border-white/15 rounded-lg px-3 py-1.5 text-sm font-mono outline-none focus:border-neutral-500 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">Timeout (s)</label>
          <input
            value={timeout}
            onChange={(e) => setTimeout_(e.target.value)}
            className="w-20 bg-white/8 border border-white/15 rounded-lg px-3 py-1.5 text-sm font-mono outline-none focus:border-neutral-500 transition-colors"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Command</label>
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          className="bg-white/8 border border-white/15 rounded-lg px-3 py-1.5 text-sm font-mono outline-none focus:border-neutral-500 transition-colors"
        />
      </div>
      <RunButton running={status === "running"} onClick={run} />
      <OutputBox status={status} result={result} error={error} />
    </Section>
  );
}

// ── LLM Runner ────────────────────────────────────────────────────────────────

function LLMPanel() {
  const [model, setModel] = useState("mistral:7b");
  const [prompt, setPrompt] = useState("Tell me a one-sentence fun fact.");
  const [system, setSystem] = useState("");
  const [status, setStatus] = useState<TaskStatus>("idle");
  const [result, setResult] = useState<TaskResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setStatus("running");
    setResult(null);
    setError(null);
    try {
      const payload: Record<string, unknown> = { model, prompt, max_tokens: 256 };
      if (system.trim()) payload.system = system.trim();
      const r = await submitBlocking(`llm.${model}`, payload);
      setResult(r);
      setStatus("done");
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  };

  return (
    <Section title="LLM Inference" badge="llm.*">
      <p className="text-xs text-neutral-500">
        Run Ollama LLM inference on the remote agent.
      </p>
      <div className="flex gap-2">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs text-neutral-500">Model</label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="mistral:7b"
            className="bg-white/8 border border-white/15 rounded-lg px-3 py-1.5 text-sm font-mono outline-none focus:border-neutral-500 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs text-neutral-500">System prompt (optional)</label>
          <input
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            placeholder="You are a helpful assistant."
            className="bg-white/8 border border-white/15 rounded-lg px-3 py-1.5 text-sm font-mono outline-none focus:border-neutral-500 transition-colors"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          spellCheck={false}
          className="bg-white/8 border border-white/15 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-neutral-500 transition-colors resize-y"
        />
      </div>
      <RunButton running={status === "running"} onClick={run} />
      <OutputBox status={status} result={result} error={error} />
    </Section>
  );
}

// ── Storage Panel ─────────────────────────────────────────────────────────────

interface Bucket {
  bucket_uid: string;
  created_at: string;
  file_count: number;
  used_bytes: number;
}

function StoragePanel() {
  const [buckets, setBuckets] = useState<Bucket[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/storage/buckets`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBuckets(data.buckets ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const createBucket = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${API}/api/storage/bucket/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const deleteBucket = async (uid: string) => {
    try {
      await fetch(`${API}/api/storage/bucket/${uid}`, { method: "DELETE" });
      setBuckets((prev) => prev?.filter((b) => b.bucket_uid !== uid) ?? null);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <Section title="Storage Buckets" badge="/api/storage">
      <p className="text-xs text-neutral-500">
        Temporary file buckets for staging task inputs/outputs (24h TTL, 1 GiB each).
      </p>
      <div className="flex gap-2">
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 disabled:opacity-50 transition-colors text-sm"
        >
          <RotateCcw size={13} />
          {loading ? "Loading…" : "List buckets"}
        </button>
        <button
          onClick={createBucket}
          disabled={creating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors text-sm"
        >
          {creating ? "Creating…" : "+ New bucket"}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {buckets !== null && (
        <div className="flex flex-col gap-1">
          {buckets.length === 0 ? (
            <p className="text-xs text-neutral-500">No buckets.</p>
          ) : (
            buckets.map((b) => (
              <div
                key={b.bucket_uid}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/30 border border-white/8 text-xs font-mono"
              >
                <span className="text-neutral-300 truncate mr-4">{b.bucket_uid}</span>
                <span className="text-neutral-500 shrink-0 mr-4">
                  {b.file_count} file{b.file_count !== 1 ? "s" : ""} ·{" "}
                  {(b.used_bytes / 1024).toFixed(1)} KB
                </span>
                <button
                  onClick={() => deleteBucket(b.bucket_uid)}
                  className="text-red-500 hover:text-red-300 transition-colors shrink-0"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </Section>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function OffloadMQ() {
  return (
    <div className="min-h-screen flex flex-col pt-12">
      <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">OffloadMQ</h1>
          <span className="text-xs text-neutral-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
            integration
          </span>
        </div>
        <a
          href={SERVER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ExternalLink size={12} />
          {SERVER_URL}
        </a>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          <EchoPanel />
          <ShellPanel />
          <DockerPanel />
          <LLMPanel />
          <StoragePanel />
        </div>
      </div>
    </div>
  );
}
