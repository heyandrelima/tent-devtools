### Tend Devtools

Tools to streamline your local development environment with human-friendly domains.

## What it does

- **Local DNS server (Node + dns2)**: Resolve custom domains like `project.test` and subdomains such as `api.project.test` to your machine.
- **Local web server (Caddy)**: Terminate TLS locally (`tls internal`) and reverse‑proxy custom domains to your running apps (for example, `project.test` → `localhost:3000`).
- **Subdomain support**: Map multiple subdomains to different local ports for multi‑service apps.

## Why

- **Human‑readable URLs** for microservices and apps.
- **Cookie and CORS parity** across subdomains in dev.
- **Automatic local HTTPS** using Caddy’s internal CA.

## Prerequisites

- macOS (tested), admin privileges for binding DNS on port 53
- Node.js 18+
- pnpm
- Caddy (`brew install caddy`)

## Quickstart (UI)

The UI is built with Vite + React + Electron.

```bash
pnpm install
pnpm dev
```

This starts the Vite dev server and launches the Electron wrapper.

## Local DNS setup (Node + dns2)

Tend Devtools uses a lightweight Node DNS server so that domains ending in `.test` resolve to `127.0.0.1`.

1) Install dependency

```bash
pnpm add dns2
```

2) Create a DNS server script (example)

Create `scripts/dns-server.ts` (or `.js`) with a minimal responder using `dns2`:

```ts
import { UDPServer } from 'dns2';

const HOST = '127.0.0.1';
const PORT = 53; // requires sudo on macOS

const server = UDPServer({
  udp: { address: HOST, port: PORT },
  handle: (request, send) => {
    const [question] = request.questions;
    const name = question?.name.toLowerCase();
    const isTestDomain = name.endsWith('.test');
    const answerIp = isTestDomain ? '127.0.0.1' : '0.0.0.0';

    send({
      id: request.id,
      type: 'response',
      questions: request.questions,
      answers: isTestDomain
        ? [{
            name,
            type: 'A',
            class: 'IN',
            ttl: 1,
            address: answerIp,
          }]
        : [],
    });
  },
});

server.on('listening', () => console.log(`DNS listening on ${HOST}:${PORT}`));
server.on('close', () => console.log('DNS stopped'));
```

Run it (requires sudo to bind port 53 on macOS):

```bash
sudo node scripts/dns-server.js
```

3) Tell macOS to use your local DNS for `.test`

Create the resolver file:

```bash
sudo mkdir -p /etc/resolver
echo 'nameserver 127.0.0.1' | sudo tee /etc/resolver/test >/dev/null
```

Verify DNS resolution:

```bash
dig +short project.test @127.0.0.1
# 127.0.0.1
```

If macOS caches an old result, flush DNS:

```bash
sudo killall -HUP mDNSResponder
```

## Local web server (Caddy) setup

Use Caddy to terminate TLS locally and reverse‑proxy custom domains to your apps.

1) Install Caddy

```bash
brew install caddy
```

2) Create a Caddyfile

Create `public/caddy/Caddyfile` with mappings. Example:

```caddyfile
# Root domain → React app on :3000
project.test {
  tls internal
  reverse_proxy localhost:3000
}

# Subdomain → API on :3001
api.project.test {
  tls internal
  reverse_proxy localhost:3001
}

# Wildcard for any other subdomain → :3002
*.project.test {
  tls internal
  reverse_proxy localhost:3002
}
```

3) Run Caddy

```bash
caddy run --config public/caddy/Caddyfile
```

Visit `https://project.test` to see your app via Caddy with a locally trusted certificate. If trust fails, try:

```bash
sudo caddy trust
```

## Example mapping

- `project.test` → `http://localhost:3000`
- `api.project.test` → `http://localhost:3001`
- `admin.project.test` → `http://localhost:3002`

You can add more site blocks to the Caddyfile for additional services.

## Development scripts

- `pnpm dev`: Run the Vite dev server and Electron shell
- `pnpm build`: Build the UI bundle and Electron app
- `pnpm lint`: Lint the codebase

Consider adding scripts to manage DNS/Caddy, for example:

```json
{
  "scripts": {
    "dns": "sudo node scripts/dns-server.js",
    "caddy": "caddy run --config public/caddy/Caddyfile"
  }
}
```

## Notes and tips

- The `.test` TLD is reserved for testing and safe to use locally.
- Running a DNS server on port 53 requires elevated privileges on macOS.
- Caddy’s `tls internal` issues and trusts a local CA; Keychain access may prompt on first run.

## Roadmap

- UI to add/remove domain → port mappings
- Tray app to start/stop DNS and Caddy
- Cross‑platform setup helpers (Windows/Linux)

## License

TBD
