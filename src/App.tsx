import { useEffect, useMemo, useState, type FormEvent } from "react";
import ThemeToggle from "./components/ThemeToggle";
import { useTheme } from "./contexts/ThemeContext";

type Mapping = {
  id: string;
  appName: string; // e.g., "project" → project.test
  port: number; // e.g., 3000
};

const STORAGE_KEY = "tend.mappings.v1";

function App() {
  const { theme } = useTheme();
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [appName, setAppName] = useState("");
  const [port, setPort] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setStorageMode] = useState<"disk" | "browser">("browser");
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
          if (!cancelled) setStorageMode("disk");
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
        setStorageMode("browser");
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
    const exists = mappings.some(
      (m) => m.appName === cleanedName && m.id !== editingId
    );
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
      setMappings((prev) =>
        prev.map((m) =>
          m.id === editingId ? { ...m, appName: cleanedName, port: p } : m
        )
      );
    } else {
      setMappings((prev) => [
        ...prev,
        { id: generateId(), appName: cleanedName, port: p },
      ]);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-600/20 dark:from-blue-500/10 dark:to-purple-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-indigo-400/20 to-pink-600/20 dark:from-indigo-500/10 dark:to-pink-600/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-cyan-400/10 to-blue-600/10 dark:from-cyan-500/5 dark:to-blue-600/5 rounded-full blur-3xl"></div>
      </div>

      <main className="relative z-10 min-h-screen flex items-start justify-center p-6">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <header className="text-center mb-12 relative">
            {/* Theme toggle positioned absolutely in top-right */}
            <div className="absolute top-0 right-0">
              <ThemeToggle size="md" />
            </div>
            

            

            
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl mb-6 shadow-lg">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 dark:from-slate-100 dark:via-blue-100 dark:to-indigo-100 bg-clip-text text-transparent mb-4">
              Tend Devtools
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Map local apps to friendly domains like{" "}
              <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md text-slate-800 dark:text-slate-200">
                project.test
              </span>{" "}
              with subdomain support and local HTTPS.
            </p>
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-slate-500 dark:text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              <span>App runs in system tray - close window to minimize</span>
            </div>
          </header>

          {/* Form Section */}
          <section className="backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-3xl border border-white/20 dark:border-slate-700/20 shadow-2xl p-8 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200">
                {editingId ? "Edit Mapping" : "Create New Mapping"}
              </h2>
            </div>

            <form
              className="flex flex-col md:flex-row gap-4"
              onSubmit={handleSubmit}
            >
              <div className="flex-1 space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  App Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    placeholder="project"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm border border-slate-200 dark:border-slate-600 rounded-xl font-mono text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <span className="text-xs text-slate-400 dark:text-slate-500">.test</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Domain:{" "}
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {domainPreview || "..."}
                  </span>
                </p>
              </div>

              <div className="w-24 min-w-48 space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Port
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    placeholder="3000"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="w-full pl-20 pr-4 py-3 bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm border border-slate-200 dark:border-slate-600 rounded-xl font-mono text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200"
                  />
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <span className="text-xs text-slate-400 dark:text-slate-500">localhost:</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Target:{" "}
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    localhost:{port || "..."}
                  </span>
                </p>
              </div>

              <div className="w-auto space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 invisible">
                  Actions
                </label>
                <div className="flex gap-3 justify-end">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
                    aria-label={editingId ? "Save" : "Add"}
                  >
                    {editingId ? "Save" : "Add"}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-6 py-3 bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-white dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500 transform hover:scale-105 transition-all duration-200"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <div className="h-5"></div>
              </div>
            </form>

            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              </div>
            )}
          </section>

          {/* Mappings Section */}
          <section className="backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-3xl border border-white/20 dark:border-slate-700/20 shadow-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200">
                  Domain Mappings
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={toggleBusy}
                  onClick={async () => {
                    if (toggleBusy) return;
                    setToggleBusy(true);
                    try {
                      if (!serverRunning) {
                        const res = await window.tend?.startService?.();
                        if (res && !res.ok)
                          alert(res.error || "Failed to start");
                        if (res && res.ok) setServerRunning(true);
                      } else {
                        const res = await window.tend?.stopService?.();
                        if (res && !res.ok)
                          alert(res.error || "Failed to stop");
                        if (res && res.ok) setServerRunning(false);
                      }
                    } finally {
                      setToggleBusy(false);
                    }
                  }}
                  className={`px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200 transform hover:scale-105 ${
                    serverRunning
                      ? "bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-lg"
                      : "bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700 shadow-lg"
                  } disabled:opacity-60 disabled:transform-none`}
                >
                  {toggleBusy ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      {serverRunning ? "Stopping…" : "Starting…"}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          serverRunning ? "bg-white" : "bg-white"
                        }`}
                      ></div>
                      {serverRunning ? "Stop Server" : "Start Server"}
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => window.tend?.openSetup?.()}
                  className="px-4 py-2 bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-white dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500 transform hover:scale-105 transition-all duration-200"
                >
                  Setup Dependencies
                </button>

                <button
                  type="button"
                  onClick={() => window.tend?.hideWindow?.()}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transform hover:scale-105 transition-all duration-200"
                  title="Minimize to system tray"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-6">
              <div
                className={`w-3 h-3 rounded-full ${
                  serverRunning ? "bg-emerald-500" : "bg-red-500"
                }`}
              ></div>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Server Status:{" "}
                <span
                  className={`font-medium ${
                    serverRunning ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                  }`}
                >
                  {serverRunning ? "Running" : "Stopped"}
                </span>
              </span>
            </div>

            {mappings.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-slate-400 dark:text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <p className="text-slate-500 dark:text-slate-400 mb-2">No mappings yet</p>
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  Create your first domain mapping above to get started
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {mappings.map((m) => (
                  <div
                    key={m.id}
                    className="group bg-white/60 dark:bg-slate-700/60 backdrop-blur-sm border border-slate-200 dark:border-slate-600 rounded-2xl p-6 hover:bg-white/80 dark:hover:bg-slate-700/80 hover:border-slate-300 dark:hover:border-slate-500 transition-all duration-200"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                          <div className="font-mono text-lg font-medium text-slate-800 dark:text-slate-200">
                            {m.appName}.test
                          </div>
                          <svg
                            className="w-4 h-4 text-slate-400 dark:text-slate-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 8l4 4m0 0l-4 4m4-4H3"
                            />
                          </svg>
                          <div className="font-mono text-lg font-medium text-slate-800 dark:text-slate-200">
                            localhost:{m.port}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            A Record: 127.0.0.1
                          </span>
                          <span className="flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                              />
                            </svg>
                            Reverse proxy via Caddy
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(m.id)}
                          className="px-4 py-2 bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-500 transform hover:scale-105 transition-all duration-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-medium rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transform hover:scale-105 transition-all duration-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
