/// <reference types="vite/client" />

declare global {
  interface Window {
    tend?: {
      loadMappings: () => Promise<unknown>;
      saveMappings: (mappings: unknown) => Promise<boolean>;
      openSetup: () => Promise<boolean>;
      checkCaddy: () => Promise<{ found: boolean; path?: string }>;
      downloadCaddy: () => Promise<{ ok: boolean; path?: string; error?: string }>;
      startService: () => Promise<{ ok: boolean; error?: string }>;
      stopService: () => Promise<{ ok: boolean; error?: string }>;
      serviceStatus: () => Promise<{ running: boolean }>;
      showWindow: () => Promise<boolean>;
      hideWindow: () => Promise<boolean>;
    };
  }
}

export {};
