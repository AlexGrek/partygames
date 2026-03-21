import { useState, useEffect, useCallback } from "react";

const API = "/api/v1";

export default function DbViewer() {
  const [keys, setKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [value, setValue] = useState<unknown>(null);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [loadingValue, setLoadingValue] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoadingKeys(true);
    setError(null);
    try {
      const res = await fetch(`${API}/keys`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const selectKey = async (key: string) => {
    setSelectedKey(key);
    setValue(null);
    setLoadingValue(true);
    setError(null);
    try {
      const res = await fetch(`${API}/keys/${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setValue(data.value);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingValue(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">DB Viewer</h1>
        <button
          onClick={fetchKeys}
          className="text-sm px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors"
        >
          Refresh
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Key list */}
        <aside className="w-72 border-r border-neutral-800 flex flex-col overflow-hidden">
          <div className="px-4 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-800">
            Keys {!loadingKeys && `(${keys.length})`}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingKeys ? (
              <div className="p-4 text-sm text-neutral-500">Loading…</div>
            ) : keys.length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">No keys found.</div>
            ) : (
              keys.map((key) => (
                <button
                  key={key}
                  onClick={() => selectKey(key)}
                  className={`w-full text-left px-4 py-2.5 text-sm font-mono truncate transition-colors ${
                    selectedKey === key
                      ? "bg-neutral-700 text-white"
                      : "text-neutral-300 hover:bg-neutral-800"
                  }`}
                >
                  {key}
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Value panel */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {selectedKey ? (
            <>
              <div className="px-5 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-800 font-mono">
                {selectedKey}
              </div>
              <div className="flex-1 overflow-auto p-5">
                {loadingValue ? (
                  <span className="text-sm text-neutral-500">Loading…</span>
                ) : error ? (
                  <span className="text-sm text-red-400">{error}</span>
                ) : (
                  <pre className="text-sm text-green-300 font-mono whitespace-pre-wrap break-all">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-neutral-600">
              Select a key to view its value.
            </div>
          )}

          {error && !loadingValue && !selectedKey && (
            <div className="p-4 text-sm text-red-400">{error}</div>
          )}
        </main>
      </div>
    </div>
  );
}
