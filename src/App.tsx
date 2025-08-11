import { useEffect, useMemo, useState, type FormEvent } from "react";

type Mapping = {
  id: string;
  appName: string; // e.g., "project" → project.test
  port: number; // e.g., 3000
};

const STORAGE_KEY = "tend.mappings.v1";

function App() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [appName, setAppName] = useState("");
  const [port, setPort] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setStorageMode] = useState<'disk' | 'browser'>('browser');
  const [, setLastSavedOk] = useState<boolean | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [serverRunning, setServerRunning] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Prefer Electron disk persistence via preload API; fallback to localStorage in web/preview
      if (window.tend?.loadMappings) {
        try {
          const loaded = (await window.tend.loadMappings()) as Mapping[];
          if (!cancelled && Array.isArray(loaded)) setMappings(loaded);
          if (!cancelled) setStorageMode('disk');
          if (!cancelled) setHydrated(true);
          return;
        } catch {
          // fallback
        }
      }
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Mapping[];
          if (!cancelled && Array.isArray(parsed)) setMappings(parsed);
        }
      } catch {
        // ignore malformed storage
      }
      if (!cancelled) {
        setHydrated(true);
        setStorageMode('browser');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      if (window.tend?.saveMappings) {
        try {
          const ok = await window.tend.saveMappings(mappings);
          setLastSavedOk(Boolean(ok));
          return;
        } catch {
          // fallback
        }
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
        setLastSavedOk(true);
      } catch {
        setLastSavedOk(false);
      }
    })();
  }, [mappings, hydrated]);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.tend?.serviceStatus?.();
        if (res) setServerRunning(Boolean(res.running));
      } catch {}
    })();
  }, []);

  const domainPreview = useMemo(() => {
    const cleaned = (appName || "").trim().toLowerCase();
    return cleaned ? `${cleaned}.test` : "";
  }, [appName]);

  function generateId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return (crypto as unknown as { randomUUID: () => string }).randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function resetForm() {
    setAppName("");
    setPort("");
    setEditingId(null);
    setError(null);
  }

  function validate(aName: string, pStr: string): string | null {
    const cleanedName = aName.trim().toLowerCase();
    if (!cleanedName) return "App name is required";
    if (!/^[a-z0-9-]+$/.test(cleanedName)) {
      return "App name can contain lowercase letters, numbers, and hyphens only";
    }
    const p = Number(pStr);
    if (!Number.isInteger(p) || p < 1 || p > 65535) {
      return "Port must be an integer between 1 and 65535";
    }
    const exists = mappings.some((m) => m.appName === cleanedName && m.id !== editingId);
    if (exists) return `${cleanedName}.test already exists`;
    return null;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const v = validate(appName, port);
    if (v) {
      setError(v);
      return;
    }
    const cleanedName = appName.trim().toLowerCase();
    const p = Number(port);

    if (editingId) {
      setMappings((prev) => prev.map((m) => (m.id === editingId ? { ...m, appName: cleanedName, port: p } : m)));
    } else {
      setMappings((prev) => [...prev, { id: generateId(), appName: cleanedName, port: p }]);
    }
    resetForm();
  }

  function handleEdit(id: string) {
    const target = mappings.find((m) => m.id === id);
    if (!target) return;
    setAppName(target.appName);
    setPort(String(target.port));
    setEditingId(id);
    setError(null);
  }

  function handleDelete(id: string) {
    setMappings((prev) => prev.filter((m) => m.id !== id));
    if (editingId === id) resetForm();
  }

  return (
    <main className="min-h-screen flex items-start justify-center bg-white text-gray-900 p-6">
      <div className="w-full max-w-3xl">
        <header className="text-center">
          <h1 className="text-5xl font-extrabold tracking-tight">Tend Devtools</h1>
          <p className="mt-3 text-base text-gray-600">
            Map local apps to friendly domains like <span className="font-mono">project.test</span> with
            subdomain support and local HTTPS.
          </p>
        </header>

        <section className="mt-8 rounded-2xl border border-gray-200 p-5">
          <h2 className="text-xl font-semibold">Create or edit mapping</h2>
          <form className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm text-gray-700">App name</span>
              <input
                type="text"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="project"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="mt-1 block text-xs text-gray-500">Domain → {domainPreview || ""}</span>
            </label>

            <label className="block">
              <span className="text-sm text-gray-700">Port</span>
              <input
                type="number"
                min={1}
                max={65535}
                placeholder="3000"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="mt-1 block text-xs text-gray-500">Target → localhost:{port || ""}</span>
            </label>

            <div className="self-end w-full md:w-auto">
              <div className="flex gap-2 md:justify-end">
                <button
                  type="submit"
                  className="h-[42px] flex-1 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 active:bg-blue-800"
                  aria-label={editingId ? "Save mapping" : "Add mapping"}
                >
                  {editingId ? "Save" : "Add"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="h-[42px] rounded-lg border border-gray-300 px-3 font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
              <div className="mt-1 text-xs invisible">helper</div>
            </div>
          </form>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Mappings</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={toggleBusy}
                onClick={async () => {
                  if (toggleBusy) return;
                  setToggleBusy(true);
                  try {
                    if (!serverRunning) {
                      const res = await window.tend?.startService?.();
                      if (res && !res.ok) alert(res.error || 'Failed to start');
                      if (res && res.ok) setServerRunning(true);
                    } else {
                      const res = await window.tend?.stopService?.();
                      if (res && !res.ok) alert(res.error || 'Failed to stop');
                      if (res && res.ok) setServerRunning(false);
                    }
                  } finally {
                    setToggleBusy(false);
                  }
                }}
                className={
                  serverRunning
                    ? "rounded-lg px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
                    : "rounded-lg px-3 py-1.5 text-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-60"
                }
              >
                {toggleBusy ? (serverRunning ? 'Stopping…' : 'Starting…') : (serverRunning ? 'Stop server' : 'Start server')}
              </button>
              <button
                type="button"
                onClick={() => window.tend?.openSetup?.()}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Setup dependencies
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-600">
            Status: <span className={serverRunning ? 'text-green-700' : 'text-red-700'}>
              {serverRunning ? 'Server running' : 'Server stopped'}
            </span>
          </p>
          {/* Debug status removed per user request */}
          {mappings.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">No mappings yet. Add your first one above.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
              {mappings.map((m) => (
                <li key={m.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3">
                  <div>
                    <div className="font-mono text-sm">
                      {m.appName}.test → localhost:{m.port}
                    </div>
                    <div className="text-xs text-gray-500">A record: 127.0.0.1 • Reverse proxy via Caddy</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(m.id)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="rounded-lg border border-red-300 text-red-700 px-3 py-1.5 text-sm hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
