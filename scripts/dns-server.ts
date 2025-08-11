// Lightweight DNS server using dns2 (TypeScript).
// - Responds to A/AAAA queries for domains defined in local mappings
// - Local mappings are read from the same location used by the Electron app
//   (app.getPath('userData')/mappings.json). You can override via TEND_MAPPINGS_PATH.
// - Matches both the exact root (e.g., project.test) and any subdomain
//   (e.g., api.project.test) and returns 127.0.0.1 / ::1

import { homedir } from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";

import { UDPServer } from "dns2";
import type { DNSRequest, DNSResponse, DNSAnswer } from "dns2";

const LOG_PREFIX = "[tend-dns]";

const HOST: string = process.env.TEND_DNS_HOST || "127.0.0.1";
const PORT: number = Number(process.env.TEND_DNS_PORT || 53);

// App name used by Electron for userData path. Must match main.js app.setName("Tend Devtools")
const APP_NAME = "Tend Devtools";

type Mapping = {
  id: string;
  appName: string;
  port: number;
};

function defaultMappingsPath(): string {
  const platform = process.platform;
  if (process.env.TEND_MAPPINGS_PATH) {
    return process.env.TEND_MAPPINGS_PATH;
  }
  if (platform === "darwin") {
    return path.join(
      homedir(),
      "Library",
      "Application Support",
      APP_NAME,
      "mappings.json"
    );
  }
  if (platform === "win32") {
    const base =
      process.env.APPDATA || path.join(homedir(), "AppData", "Roaming");
    return path.join(base, APP_NAME, "mappings.json");
  }
  // linux and others
  const xdg = process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config");
  return path.join(xdg, APP_NAME, "mappings.json");
}

const MAPPINGS_PATH = defaultMappingsPath();

let rootZones: Set<string> = new Set(); // e.g., "project.test"

async function loadMappings(): Promise<void> {
  try {
    const raw = await fs.readFile(MAPPINGS_PATH, "utf8");
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error("mappings is not an array");
    const next = new Set<string>();
    for (const item of data as Mapping[]) {
      if (!item || typeof item !== "object") continue;
      const name = String(item.appName || "")
        .trim()
        .toLowerCase();
      if (!name) continue;
      next.add(`${name}.test`);
    }
    rootZones = next;
    // ...existing code...
    console.log(
      `${LOG_PREFIX} Loaded ${rootZones.size} root zone(s) from ${MAPPINGS_PATH}`
    );
  } catch (err) {
    rootZones = new Set();
    const msg = err instanceof Error ? err.message : String(err);
    // ...existing code...
    console.warn(
      `${LOG_PREFIX} Failed to load mappings (${msg}). Using empty set.`
    );
  }
}

function watchMappings(): void {
  try {
    const dir = path.dirname(MAPPINGS_PATH);
    if (!fsSync.existsSync(dir)) return;
    if (!fsSync.existsSync(MAPPINGS_PATH)) return;

    let debounceTimer: NodeJS.Timeout | null = null;
    const triggerReload = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void loadMappings();
      }, 200);
    };

    fsSync.watch(MAPPINGS_PATH, { persistent: true }, triggerReload);
  } catch {
    // Non-fatal
  }
}

function nameMatches(name: string): boolean {
  for (const root of rootZones) {
    if (name === root) return true;
    if (name.endsWith("." + root)) return true;
  }
  return false;
}

export async function main(): Promise<unknown> {
  await loadMappings();
  watchMappings();

  const server = UDPServer({
    udp: { address: HOST, port: PORT },
    handle: (request: DNSRequest, send: (response: DNSResponse) => void) => {
      try {
        const [question] = (request.questions || []) as Array<{
          name: string;
          type: string | number;
        }>;
        const name = (question?.name || "").toLowerCase();
        const qtypeRaw = question?.type;
        const qtype =
          typeof qtypeRaw === "number"
            ? String(qtypeRaw)
            : (qtypeRaw || "").toString().toUpperCase();

        const match = nameMatches(name);
        const answers: DNSAnswer[] = [];

        if (match) {
          if (qtype === "AAAA") {
            answers.push({
              name,
              type: "AAAA",
              class: "IN",
              ttl: 1,
              address: "::1",
            });
          } else if (qtype === "A" || qtype === "ANY" || qtype === "1") {
            answers.push({
              name,
              type: "A",
              class: "IN",
              ttl: 1,
              address: "127.0.0.1",
            });
          }
        }

        send({
          id: request.id,
          type: "response",
          flags: request.flags,
          questions: request.questions,
          answers,
        });
      } catch {
        try {
          send({
            id: request.id,
            type: "response",
            questions: request.questions,
            answers: [],
          });
        } catch {
          // ignore
        }
      }
    },
  });

  server.on("listening", () => {
    // ...existing code...
    console.log(`${LOG_PREFIX} DNS listening on ${HOST}:${PORT}`);
    // ...existing code...
    console.log(`${LOG_PREFIX} Using mappings at: ${MAPPINGS_PATH}`);
    if (rootZones.size === 0) {
      // ...existing code...
      console.log(
        `${LOG_PREFIX} No mappings loaded. Add mappings in the Tend UI to enable responses.`
      );
    }
  });

  server.on("close", () => console.log(`${LOG_PREFIX} DNS stopped`));
  server.on("error", (e: unknown) =>
    console.error(`${LOG_PREFIX} DNS error:`, e)
  );

  return server;
}

// If executed directly: start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  // ...existing code...
  main().catch((e) => {
    // ...existing code...
    console.error(`${LOG_PREFIX} Fatal:`, e);
    process.exitCode = 1;
  });
}

export default main;
