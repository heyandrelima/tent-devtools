import { useState } from "react";
import ThemeToggle from "../components/ThemeToggle";

export default function SetupWindow() {
  const [result, setResult] = useState<null | {
    found: boolean;
    path?: string;
  }>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadResult, setDownloadResult] = useState<null | {
    ok: boolean;
    path?: string;
    error?: string;
  }>(null);

  async function handleCheckCaddy() {
    try {
      setChecking(true);
      const res = await window.tend?.checkCaddy?.();
      if (res) setResult(res as { found: boolean; path?: string });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-600/20 dark:from-blue-500/10 dark:to-purple-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-indigo-400/20 to-pink-600/20 dark:from-indigo-500/10 dark:to-pink-600/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-cyan-400/10 to-blue-600/10 dark:from-cyan-500/5 dark:to-blue-600/5 rounded-full blur-3xl"></div>
      </div>

      <main className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <header className="text-center mb-8 relative">
            {/* Theme toggle positioned absolutely in top-right */}
            <div className="absolute top-0 right-0">
              <ThemeToggle size="md" />
            </div>
            
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl mb-6 shadow-lg">
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
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 dark:from-slate-100 dark:via-blue-100 dark:to-indigo-100 bg-clip-text text-transparent mb-4">
              Setup Dependencies
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
              Check required tools and set up what's needed for Tend Devtools to
              work properly.
            </p>
          </header>

          {/* Setup Section */}
          <section className="backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-3xl border border-white/20 dark:border-slate-700/20 shadow-2xl p-8">
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200">
                Caddy Web Server
              </h2>
            </div>

            {/* Check Caddy Section */}
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-slate-600"
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
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      Check Local Installation
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckCaddy}
                    disabled={checking}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transform hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:transform-none"
                  >
                    {checking ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-slate-400/30 dark:border-slate-500/30 border-t-slate-600 dark:border-t-slate-400 rounded-full animate-spin"></div>
                        Checking…
                      </div>
                    ) : (
                      "Check Caddy"
                    )}
                  </button>
                </div>

                {result && (
                  <div
                    className={`p-4 rounded-xl border ${
                      result.found
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                        : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {result.found ? (
                        <svg
                          className="w-4 h-4 text-emerald-600"
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
                      ) : (
                        <svg
                          className="w-4 h-4 text-red-600"
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
                      )}
                      <span
                        className={`text-sm font-medium ${
                          result.found ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                        }`}
                      >
                        {result.found ? (
                          <>
                            Found caddy at{" "}
                            <span className="font-mono bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded-md">
                              {result.path}
                            </span>
                          </>
                        ) : (
                          "Local caddy binary not found"
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Download Caddy Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-slate-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                    </div>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      Download Latest Version
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setDownloading(true);
                      setDownloadResult(null);
                      try {
                        const res = await window.tend?.downloadCaddy?.();
                        if (res)
                          setDownloadResult(
                            res as {
                              ok: boolean;
                              path?: string;
                              error?: string;
                            }
                          );
                        if (res && res.ok)
                          setResult({ found: true, path: res.path });
                      } finally {
                        setDownloading(false);
                      }
                    }}
                    disabled={downloading}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-60 disabled:transform-none"
                  >
                    {downloading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Downloading…
                      </div>
                    ) : (
                      "Download Caddy"
                    )}
                  </button>
                </div>

                {downloadResult && (
                  <div
                    className={`p-4 rounded-xl border ${
                      downloadResult.ok
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                        : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {downloadResult.ok ? (
                        <svg
                          className="w-4 h-4 text-emerald-600"
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
                      ) : (
                        <svg
                          className="w-4 h-4 text-red-600"
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
                      )}
                      <span
                        className={`text-sm font-medium ${
                          downloadResult.ok
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-red-700 dark:text-red-400"
                        }`}
                      >
                        {downloadResult.ok ? (
                          <>
                            Downloaded to{" "}
                            <span className="font-mono bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded-md">
                              {downloadResult.path}
                            </span>
                          </>
                        ) : (
                          <>
                            Download failed
                            {downloadResult.error
                              ? `: ${downloadResult.error}`
                              : ""}
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Status Summary */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    result?.found ? "bg-emerald-500" : "bg-red-500"
                  }`}
                ></div>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Status:{" "}
                  <span
                    className={`font-medium ${
                      result?.found ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                    }`}
                  >
                    {result?.found ? "Ready to use" : "Setup required"}
                  </span>
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
