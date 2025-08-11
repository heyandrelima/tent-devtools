import { useState } from 'react';

export default function SetupWindow() {
  const [result, setResult] = useState<null | { found: boolean; path?: string }>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadResult, setDownloadResult] = useState<null | { ok: boolean; path?: string; error?: string }>(null);

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
    <main className="min-h-screen flex items-center justify-center bg-white text-gray-900 p-6">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Setup dependencies</h1>
        <p className="mt-3 text-sm text-gray-600">
          This will check required tools and set up what’s needed for Tend Devtools.
        </p>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleCheckCaddy}
            disabled={checking}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {checking ? 'Checking…' : 'Check local caddy binary'}
          </button>
        </div>

        {result && (
          <p className="mt-3 text-sm">
            {result.found ? (
              <span className="text-green-700">Found caddy at <span className="font-mono">{result.path}</span></span>
            ) : (
              <span className="text-red-700">Local caddy binary not found</span>
            )}
          </p>
        )}

        <div className="mt-6">
          <button
            type="button"
            onClick={async () => {
              setDownloading(true);
              setDownloadResult(null);
              try {
                const res = await window.tend?.downloadCaddy?.();
                if (res) setDownloadResult(res as { ok: boolean; path?: string; error?: string });
                if (res && res.ok) setResult({ found: true, path: res.path });
              } finally {
                setDownloading(false);
              }
            }}
            disabled={downloading}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {downloading ? 'Downloading…' : 'Download latest caddy'}
          </button>
        </div>

        {downloadResult && (
          <p className="mt-3 text-sm">
            {downloadResult.ok ? (
              <span className="text-green-700">Downloaded to <span className="font-mono">{downloadResult.path}</span></span>
            ) : (
              <span className="text-red-700">Download failed{downloadResult.error ? `: ${downloadResult.error}` : ''}</span>
            )}
          </p>
        )}
      </div>
    </main>
  );
}


