import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, globalShortcut } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import https from "node:https";
import os from "node:os";
import { spawn, exec } from "node:child_process";
import { pipeline } from "node:stream";
import { promisify } from "node:util";
import dns2 from "dns2";
const { UDPServer } = dns2;

const streamPipeline = promisify(pipeline);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure a stable app identity (affects userData path)
app.setName("Tend Devtools");
if (process.platform === "win32") {
  app.setAppUserModelId("com.tend.devtools");
}

function getMappingsPath() {
  return path.join(app.getPath("userData"), "mappings.json");
}

function getCaddyConfigPath() {
  return path.join(app.getPath("userData"), "caddy", "Caddyfile");
}

function getCaddyHomePath() {
  return path.join(app.getPath('userData'), 'caddy_home');
}

async function ensureDirForFile(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function computeRootZonesFromMappings(mappings) {
  const set = new Set();
  for (const m of Array.isArray(mappings) ? mappings : []) {
    const name = String(m?.appName || "").trim().toLowerCase();
    if (!name) continue;
    set.add(`${name}.test`);
  }
  return set;
}

async function readMappingsFromDisk() {
  try {
    const raw = await fs.readFile(getMappingsPath(), "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeCaddyfileFromMappings(mappings, options = {}) {
  const cfgPath = getCaddyConfigPath();
  await ensureDirForFile(cfgPath);
  const lines = [];
  // Global options
  lines.push('{');
  lines.push('  local_certs');
  lines.push('  admin localhost:2019');
  if (options && options.storageRoot) {
    const rootEscaped = String(options.storageRoot).replaceAll('\\', '/');
    lines.push('  storage file_system {');
    lines.push(`    root "${rootEscaped}"`);
    lines.push('  }');
  }
  lines.push('}');
  lines.push('');
  for (const m of Array.isArray(mappings) ? mappings : []) {
    const name = String(m?.appName || "").trim().toLowerCase();
    const port = Number(m?.port);
    if (!name || !Number.isFinite(port)) continue;
    const root = `${name}.test`;
    lines.push(`${root} {`);
    lines.push(`  reverse_proxy localhost:${port}`);
    lines.push(`  log {`);
    lines.push(`    output stdout`);
    lines.push(`    level INFO`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');
    lines.push(`*.${root} {`);
    lines.push(`  reverse_proxy localhost:${port}`);
    lines.push(`  log {`);
    lines.push(`    output stdout`);
    lines.push(`    level INFO`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push("");
  }
  const content = lines.join("\n");
  await fs.writeFile(cfgPath, content, "utf8");
  return cfgPath;
}

async function locateCaddyBinary() {
  try {
    const candidateBase = [
      path.join(app.getPath('userData'), 'bin'),
      __dirname,
      process.resourcesPath || __dirname,
      process.cwd(),
    ];
    const filename = process.platform === 'win32' ? 'caddy.exe' : 'caddy';
    for (const base of candidateBase) {
      let candidate = path.join(base, filename);
      try {
        const stat = await fs.stat(candidate);
        if (stat.isFile()) return candidate;
      } catch {}
      candidate = path.join(base, 'public', filename === 'caddy' ? 'caddy' : 'caddy.exe');
      try {
        const stat = await fs.stat(candidate);
        if (stat.isFile()) return candidate;
      } catch {}
    }
    return null;
  } catch {
    return null;
  }
}

let serviceState = {
  running: false,
  caddy: /** @type {import('node:child_process').ChildProcess | null} */ (null),
  dns: /** @type {any} */ (null),
  rootZones: /** @type {Set<string>} */ (new Set()),
  mappingsWatcher: /** @type {import('node:fs').FSWatcher | null} */ (null),
};

let tray = /** @type {Tray | null} */ (null);
let mainWindow = /** @type {BrowserWindow | null} */ (null);

// Use an unprivileged DNS port to avoid sudo and mDNS conflicts
const DNS_PORT = 15353;
const RESOLVER_DIR = process.platform === 'darwin' ? '/etc/resolver' : '';
const RESOLVER_FILE = process.platform === 'darwin' ? path.join(RESOLVER_DIR, 'test') : '';

function nameMatches(rootZones, fqdn) {
  for (const root of rootZones) {
    if (fqdn === root) return true;
    if (fqdn.endsWith('.' + root)) return true;
  }
  return false;
}

async function checkPortAvailable(port) {
  const net = await import('node:net');
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(port, '127.0.0.1', () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    server.on('error', (error) => {
      if (error && /** @type any */(error).code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use.`));
      } else {
        reject(error);
      }
    });
  });
}

function forwardDNSQuery(request, send) {
  const client = new dns2.DnsClient();
  const q = request.questions && request.questions[0];
  if (!q) {
    const response = dns2.Packet.createResponseFromRequest(request);
    send(response);
    return;
  }
  client
    .query(q.name, q.type)
    .then((result) => {
      const response = dns2.Packet.createResponseFromRequest(request);
      response.answers = result.answers;
      send(response);
    })
    .catch(() => {
      const response = dns2.Packet.createResponseFromRequest(request);
      send(response);
    });
}

async function startDnsServer() {
  const mappings = await readMappingsFromDisk();
  serviceState.rootZones = computeRootZonesFromMappings(mappings);

  await checkPortAvailable(DNS_PORT);

  const server = dns2.createServer({
    udp: true,
    tcp: false,
    handle: (request, send) => {
      try {
        const [question] = request.questions || [];
        const name = (question?.name || '').toLowerCase();
        if (name && nameMatches(serviceState.rootZones, name)) {
          const response = dns2.Packet.createResponseFromRequest(request);
          response.answers.push({
            name,
            type: dns2.Packet.TYPE.A,
            class: dns2.Packet.CLASS.IN,
            ttl: 300,
            address: '127.0.0.1',
          });
          send(response);
          return;
        }
        forwardDNSQuery(request, send);
      } catch {
        const response = dns2.Packet.createResponseFromRequest(request);
        send(response);
      }
    },
  });

  await new Promise((resolve, reject) => {
    server.listen({ udp: { port: DNS_PORT, address: '127.0.0.1' } });
    server.on('listening', () => { console.log(`[tend-dns] DNS listening on 127.0.0.1:${DNS_PORT}`); resolve(); });
    server.on('error', (e) => {
      if (e && /** @type any */(e).code === 'EADDRINUSE') {
        reject(new Error(`Port ${DNS_PORT} is already in use.`));
      } else {
        reject(e);
      }
    });
  });

  // Watch mappings for updates and refresh root zones
  try {
    const mp = getMappingsPath();
    if (fsSync.existsSync(mp)) {
      serviceState.mappingsWatcher = fsSync.watch(mp, { persistent: true }, async () => {
        const updated = await readMappingsFromDisk();
        serviceState.rootZones = computeRootZonesFromMappings(updated);
        // Regenerate Caddyfile so --watch picks up changes
        try {
          await writeCaddyfileFromMappings(updated, { storageRoot: getCaddyHomePath() });
        } catch {}
        console.log('[tend-dns] reloaded mappings');
      });
    }
  } catch {}

  serviceState.dns = server;
}

async function stopDnsServer() {
  try {
    if (serviceState.mappingsWatcher) {
      serviceState.mappingsWatcher.close();
      serviceState.mappingsWatcher = null;
    }
  } catch {}
  try {
    if (serviceState.dns && typeof serviceState.dns.close === 'function') {
      serviceState.dns.close();
    }
  } catch {}
  serviceState.dns = null;
  serviceState.rootZones = new Set();
}

async function updateSystemDNS() {
  if (process.platform !== 'darwin') return;
  // Ensure /etc/resolver/test points to our local DNS on DNS_PORT
  try {
    await new Promise((resolve, reject) => {
      exec('mkdir -p /etc/resolver', (err) => (err ? reject(err) : resolve()))
    });
  } catch {}
  const content = `nameserver 127.0.0.1\nport ${DNS_PORT}\n`;
  await new Promise((resolve) => {
    exec(`echo "${content.replace(/\n/g, '\\n')}" | tee ${RESOLVER_FILE} >/dev/null`, () => resolve());
  });
}

async function cleanupSystemDNS() {
  if (process.platform !== 'darwin') return;
  await new Promise((resolve) => {
    exec(`rm -f ${RESOLVER_FILE}`, () => resolve());
  });
}

async function startCaddyWithMappings() {
  const mappings = await readMappingsFromDisk();
  const caddyHome = getCaddyHomePath();
  try { await fs.mkdir(caddyHome, { recursive: true }); } catch {}
  const cfgPath = await writeCaddyfileFromMappings(mappings, { storageRoot: caddyHome });
  const caddyBin = await locateCaddyBinary();
  if (!caddyBin) {
    throw new Error('Caddy binary not found. Use the setup window to download it.');
  }
  const env = { ...process.env, CADDY_HOME: caddyHome, XDG_DATA_HOME: caddyHome, CADDY_DATA_DIR: caddyHome, CADDY_APP_DATA_DIR: caddyHome };
  const ps = spawn(caddyBin, ['run', '--config', cfgPath, '--watch'], { stdio: ['ignore', 'pipe', 'pipe'], cwd: path.dirname(cfgPath), env });
  ps.stdout.on('data', (d) => { console.log(`[caddy] ${String(d).trim()}`); });
  ps.stderr.on('data', (d) => { console.log(`[caddy] ${String(d).trim()}`); });
  ps.on('exit', (code) => { console.log(`[caddy] exited with code ${code}`); });
  serviceState.caddy = ps;
}

async function stopCaddy() {
  const ps = serviceState.caddy;
  if (!ps) return;
  try {
    ps.kill();
  } catch {}
  serviceState.caddy = null;
}

function openSetupWindow() {
  const win = new BrowserWindow({
    width: 560,
    height: 420,
    title: "Setup dependencies",
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL("http://localhost:5173/setup.html");
  } else {
    win.loadFile(path.join(__dirname, "dist", "setup.html"));
  }
}

function createTray() {
  // Create tray icons
  const greenIcon = nativeImage.createFromPath(path.join(__dirname, 'public', 'tray-icon-green.svg'));
  const redIcon = nativeImage.createFromPath(path.join(__dirname, 'public', 'tray-icon-red.svg'));
  
  // Resize icons to appropriate size for system tray
  const iconSize = process.platform === 'darwin' ? 16 : 32;
  const resizedGreenIcon = greenIcon.resize({ width: iconSize, height: iconSize });
  const resizedRedIcon = redIcon.resize({ width: iconSize, height: iconSize });
  
  // Create tray with initial red icon (server stopped)
  tray = new Tray(resizedRedIcon);
  
  updateTrayMenu();
  
  tray.setToolTip('Tend Devtools - Server Stopped');
  
  // Handle tray click (show window)
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Tend Devtools',
      enabled: false,
    },
    {
      label: `Server: ${serviceState.running ? 'Running' : 'Stopped'}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Show Window',
      accelerator: process.platform === 'darwin' ? 'Cmd+Shift+T' : 'Ctrl+Shift+T',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: serviceState.running ? 'Stop Server' : 'Start Server',
      click: async () => {
        try {
          if (serviceState.running) {
            await stopService();
          } else {
            await startService();
          }
        } catch (error) {
          console.error('Failed to toggle service from tray:', error);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);
  
  tray.setContextMenu(contextMenu);
}

function updateTrayIcon(isRunning) {
  if (!tray) return;
  
  const greenIcon = nativeImage.createFromPath(path.join(__dirname, 'public', 'tray-icon-green.svg'));
  const redIcon = nativeImage.createFromPath(path.join(__dirname, 'public', 'tray-icon-red.svg'));
  
  const iconSize = process.platform === 'darwin' ? 16 : 32;
  const resizedGreenIcon = greenIcon.resize({ width: iconSize, height: iconSize });
  const resizedRedIcon = redIcon.resize({ width: iconSize, height: iconSize });
  
  tray.setImage(isRunning ? resizedGreenIcon : resizedRedIcon);
  tray.setToolTip(`Tend Devtools - Server ${isRunning ? 'Running' : 'Stopped'}`);
  updateTrayMenu();
}

async function startService() {
  if (serviceState.running) return { ok: true };
  try {
    await startDnsServer();
    await startCaddyWithMappings();
    await updateSystemDNS();
    serviceState.running = true;
    updateTrayIcon(true);
    return { ok: true };
  } catch (e) {
    // Attempt partial cleanup
    try { await stopCaddy(); } catch {}
    try { await stopDnsServer(); } catch {}
    serviceState.running = false;
    updateTrayIcon(false);
    return { ok: false, error: String(e) };
  }
}

async function stopService() {
  try {
    await stopCaddy();
    await stopDnsServer();
    await cleanupSystemDNS();
    serviceState.running = false;
    updateTrayIcon(false);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow = win;

  // Always use the development URL during development
  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL("http://localhost:5173/");
  } else {
    // In production, load the built files from the dist directory
    win.loadFile(path.join(__dirname, "dist", "index.html"));
  }
  
  // Handle window close - minimize to tray instead of quitting
  win.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      win.hide();
    }
  });
};

app.whenReady().then(() => {
  ipcMain.handle("mappings:load", async () => {
    try {
      const p = getMappingsPath();
      const file = await fs.readFile(p, "utf8");
      const data = JSON.parse(file);
      if (Array.isArray(data)) {
        return data;
      }
      return [];
    } catch {
      return [];
    }
  });

  ipcMain.handle("mappings:save", async (_evt, mappings) => {
    try {
      const content = JSON.stringify(Array.isArray(mappings) ? mappings : [], null, 2);
      const targetPath = getMappingsPath();
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content, "utf8");
      // Update Caddy config on save; Caddy runs with --watch and reloads automatically.
      // Also refresh in-memory DNS zones immediately so changes apply without restart.
      try {
        const current = Array.isArray(mappings) ? mappings : [];
        await writeCaddyfileFromMappings(current, { storageRoot: getCaddyHomePath() });
        serviceState.rootZones = computeRootZonesFromMappings(current);
      } catch {}
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("window:openSetup", async () => {
    openSetupWindow();
    return true;
  });

  ipcMain.handle("deps:checkCaddy", async () => {
    try {
      const candidateBase = [
        path.join(app.getPath('userData'), 'bin'),
        __dirname,
        process.resourcesPath || __dirname,
        process.cwd(),
      ];
      const filename = process.platform === 'win32' ? 'caddy.exe' : 'caddy';
      for (const base of candidateBase) {
        // check direct path in bin
        let candidate = path.join(base, filename);
        try {
          const stat = await fs.stat(candidate);
          if (stat.isFile()) {
            return { found: true, path: candidate };
          }
        } catch {}
        // check public/caddy fallback
        candidate = path.join(base, 'public', filename === 'caddy' ? 'caddy' : 'caddy.exe');
        try {
          const stat = await fs.stat(candidate);
          if (stat.isFile()) {
            return { found: true, path: candidate };
          }
        } catch {}
      }
      return { found: false };
    } catch {
      return { found: false };
    }
  });

  ipcMain.handle("deps:downloadCaddy", async () => {
    function mapPlatform() {
      const p = process.platform;
      if (p === 'darwin') return 'darwin';
      if (p === 'linux') return 'linux';
      if (p === 'win32') return 'windows';
      return null;
    }
    function mapArch() {
      const a = process.arch;
      if (a === 'x64') return 'amd64';
      if (a === 'arm64') return 'arm64';
      return null;
    }

    const osName = mapPlatform();
    const arch = mapArch();
    if (!osName || !arch) {
      return { ok: false, error: `Unsupported platform ${process.platform}/${process.arch}` };
    }

    const url = `https://caddyserver.com/api/download?os=${osName}&arch=${arch}&id=caddy`;
    const userBin = path.join(app.getPath('userData'), 'bin');
    const isWindows = osName === 'windows';
    const archivePath = path.join(os.tmpdir(), `caddy_download_${Date.now()}.${isWindows ? 'zip' : 'tar.gz'}`);

    async function download(toPath) {
      return new Promise((resolve) => {
        function doGet(currentUrl, redirectsLeft = 5) {
          https.get(currentUrl, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
              res.resume();
              doGet(res.headers.location, redirectsLeft - 1);
              return;
            }
            if (res.statusCode !== 200) {
              resolve({ ok: false, error: `HTTP ${res.statusCode}` });
              res.resume();
              return;
            }
            const fileStream = fsSync.createWriteStream(toPath);
            streamPipeline(res, fileStream).then(() => resolve({ ok: true })).catch((err) => resolve({ ok: false, error: String(err) }));
          }).on('error', (err) => resolve({ ok: false, error: String(err) }));
        }
        doGet(url);
      });
    }

    async function readHeaderBytes(filePath, length = 4) {
      try {
        const fd = await fs.open(filePath, 'r');
        const buf = Buffer.alloc(length);
        await fd.read(buf, 0, length, 0);
        await fd.close();
        return buf;
      } catch {
        return null;
      }
    }

    try {
      await fs.mkdir(userBin, { recursive: true });
      const dl = await download(archivePath);
      if (!dl.ok) {
        return { ok: false, error: `Download failed: ${dl.error}` };
      }

      // Determine if archive or plain binary by header
      const header = await readHeaderBytes(archivePath);
      const looksZip = header && header[0] === 0x50 && header[1] === 0x4b; // PK
      const looksGzip = header && header[0] === 0x1f && header[1] === 0x8b; // GZIP

      if (isWindows) {
        if (!looksZip) {
          // Might already be the binary
          const finalPath = path.join(userBin, 'caddy.exe');
          await fs.copyFile(archivePath, finalPath);
          return { ok: true, path: finalPath };
        }
        const destDir = path.join(userBin, `caddy_extract_${Date.now()}`);
        await fs.mkdir(destDir, { recursive: true });
        const exitCode = await new Promise((resolve) => {
          const ps = spawn('powershell', ['-NoProfile', '-Command', `Expand-Archive -Path "${archivePath}" -DestinationPath "${destDir}" -Force`], { windowsHide: true });
          ps.on('exit', (code) => resolve(code ?? 0));
          ps.on('error', () => resolve(1));
        });
        if (exitCode !== 0) {
          // Fallback: try using tar if available
          const altExit = await new Promise((resolve) => {
            const ps = spawn('tar', ['-xzf', archivePath, '-C', destDir]);
            ps.on('exit', (code) => resolve(code ?? 0));
            ps.on('error', () => resolve(1));
          });
          if (altExit !== 0) {
            return { ok: false, error: 'Extraction failed (zip/tar returned error)' };
          }
        }
        // try common locations
        const candidate = path.join(destDir, 'caddy.exe');
        try {
          await fs.copyFile(candidate, path.join(userBin, 'caddy.exe'));
          return { ok: true, path: path.join(userBin, 'caddy.exe') };
        } catch (e) {
          // search recursively
          async function findExe(dir) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const d of entries) {
              const full = path.join(dir, d.name);
              if (d.isFile() && d.name.toLowerCase() === 'caddy.exe') return full;
              if (d.isDirectory()) {
                const inner = await findExe(full);
                if (inner) return inner;
              }
            }
            return null;
          }
          const located = await findExe(destDir);
          if (located) {
            await fs.copyFile(located, path.join(userBin, 'caddy.exe'));
            return { ok: true, path: path.join(userBin, 'caddy.exe') };
          }
          return { ok: false, error: 'Extraction failed (caddy.exe not found)' };
        }
      } else {
        if (!looksGzip) {
          // Might already be the binary
          const finalPath = path.join(userBin, 'caddy');
          await fs.copyFile(archivePath, finalPath);
          await fs.chmod(finalPath, 0o755);
          return { ok: true, path: finalPath };
        }
        const destDir = path.join(userBin, `caddy_extract_${Date.now()}`);
        await fs.mkdir(destDir, { recursive: true });
        const exitCode = await new Promise((resolve) => {
          const ps = spawn('tar', ['-xzf', archivePath, '-C', destDir]);
          ps.on('exit', (code) => resolve(code ?? 0));
          ps.on('error', () => resolve(1));
        });
        if (exitCode !== 0) {
          return { ok: false, error: 'Extraction failed (tar returned error)' };
        }
        // Find 'caddy' binary in destDir
        async function findFile(dir) {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const d of entries) {
            const full = path.join(dir, d.name);
            if (d.isFile() && (d.name === 'caddy' || d.name.startsWith('caddy_'))) return full;
            if (d.isDirectory()) {
              const inner = await findFile(full);
              if (inner) return inner;
            }
          }
          return null;
        }
        const found = await findFile(destDir);
        if (!found) {
          return { ok: false, error: 'Extraction failed (caddy not found)' };
        }
        const targetName = path.basename(found).startsWith('caddy_') ? 'caddy' : path.basename(found);
        const finalPath = path.join(userBin, targetName);
        await fs.copyFile(found, finalPath);
        await fs.chmod(finalPath, 0o755);
        return { ok: true, path: finalPath };
      }
    } catch (e) {
      return { ok: false, error: String(e) };
    } finally {
      try { await fs.unlink(archivePath); } catch {}
    }
  });

  ipcMain.handle('service:start', async () => {
    return await startService();
  });

  ipcMain.handle('service:stop', async () => {
    return await stopService();
  });

  ipcMain.handle('service:status', async () => {
    return { running: serviceState.running };
  });

  ipcMain.handle('tray:showWindow', async () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
    return true;
  });

  ipcMain.handle('tray:hideWindow', async () => {
    if (mainWindow) {
      mainWindow.hide();
    }
    return true;
  });

  createWindow();
  createTray();
  
  // Register global shortcut for showing/hiding window
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
});

app.on("window-all-closed", () => {
  // Don't quit the app when all windows are closed
  // The app will continue running in the system tray
});

app.on('before-quit', async () => {
  app.isQuiting = true;
  try { await stopCaddy(); } catch {}
  try { await stopDnsServer(); } catch {}
  if (tray) {
    tray.destroy();
  }
  globalShortcut.unregisterAll();
});
