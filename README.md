# kiln

A lightweight Deno server and build tool for TypeScript SPAs. Serves and transpiles TypeScript on the fly in development with HMR, builds to static files for any deployment target in production. No framework dependency — works with React, Vue, Solid, lolo-ui, or plain TypeScript.

## Requirements

- Deno 1.40+

## Compatibility

| Environment | Strategy | Notes |
|---|---|---|
| Local dev | `lazy` + HMR | Transpiles on request, live reloads on change |
| Deno Deploy | `eager` | Transpiles at startup, serves from memory |
| Cloudflare Pages | `build()` | Pre-bundle to `./dist`, deploy static files |
| Vercel | `build()` | Pre-bundle to `./dist`, deploy static files |
| Netlify | `build()` | Pre-bundle to `./dist`, deploy static files |
| VPS + Deno | `eager` | Transpiles at startup, serves from memory |

## Installation
```sh
deno add jsr:@jayobado/kiln
```

Or in `deno.json`:
```json
{
  "imports": {
    "@jayobado/kiln": "jsr:@jayobado/kiln@^0.1.8"
  }
}
```

---

## Quick start
```typescript
// server.ts
import { serve } from '@jayobado/kiln'

const isDev = Deno.env.get('ENV') !== 'production'

await serve({
  host:      'localhost',
  port:      3000,
  fsRoot:    './public',
  importMap: './deno.json',
  strategy:  isDev ? 'lazy' : 'eager',
  hmr:       isDev,
})
```
```json
{
  "tasks": {
    "dev":     "deno run --watch --allow-all server.ts",
    "start":   "ENV=production deno run --allow-all server.ts",
    "build":   "deno run --allow-all scripts/build.ts",
    "preview": "deno run --allow-all scripts/preview.ts"
  }
}
```
```bash
deno task dev
```

---

## `serve()`

Serves a TypeScript SPA from `fsRoot`. Intercepts `.ts` and `.tsx` requests and transpiles them server-side. Falls back to `index.html` for SPA client-side routes.
```typescript
await serve({
  host:    'localhost',
  port:    3000,

  // Source directory — default './public'
  fsRoot:  './public',

  // Path to deno.json or inline object
  // Required when using import aliases
  importMap: './deno.json',

  // GitHub token for private repo imports
  // Falls back to GITHUB_TOKEN env var
  githubToken: Deno.env.get('GITHUB_TOKEN'),

  // 'lazy'  — transpile on first request, cache result    (development)
  // 'eager' — transpile everything at startup, serve from cache (production)
  strategy: 'lazy',

  // Enable HMR — default true when strategy is 'lazy'
  hmr: true,

  // Compiler options — only needed for JSX frameworks
  compilerOptions: {
    jsx:             'react-jsx',
    jsxImportSource: 'react',
  },

  // Additional routes before the static handler
  routes: (router) => {
    router.get('/health', () =>
      Response.json({ ok: true })
    )
  },

  // Additional middleware
  middleware: [],
})
```

### Transpilation strategies

**Lazy — development**

Transpiles on the first request for each file, caches in memory. Subsequent requests return instantly. Import map aliases are resolved and rewritten server-side — the browser receives plain JavaScript with fully resolved paths.

**Eager — production**

Transpiles every `.ts` and `.tsx` file in `fsRoot` at startup before accepting requests. All files are in memory by the time the first request arrives.

### Import resolution

kiln reads your `deno.json` import map and `deno.lock` to resolve bare specifiers in transpiled output. JSR and npm dependencies are fetched, transpiled, and served automatically:

| Specifier | Resolved to | Served from |
|---|---|---|
| `jsr:@scope/pkg@^1.0.0` | `/jsr/@scope/pkg/1.0.3/mod.ts` | `https://jsr.io/...` |
| `npm:zod@^3.0.0` | `/npm/zod@3.0.0` | `https://esm.sh/...` |
| `./views/home.ts` | `./views/home.ts` | `fsRoot` |

Versions are resolved from `deno.lock` — no runtime version lookups. The browser never sees bare specifiers or JSR/npm URLs directly.

For example, with this import map:
```json
{
  "imports": {
    "@jayobado/lolo-ui": "jsr:@jayobado/lolo-ui@^0.1.5"
  }
}
```

A source file containing:
```typescript
import { signal } from '@jayobado/lolo-ui'
```

Is served to the browser as:
```javascript
import { signal } from '/jsr/@jayobado/lolo-ui/0.1.8/mod.ts'
```

kiln intercepts the `/jsr/` request, fetches the source from `jsr.io`, transpiles it, and caches the result. The entire dependency tree is resolved this way — no install step, no `node_modules`, no local copies.

### HMR

Hot module replacement is enabled automatically when `strategy` is `'lazy'`. A WebSocket endpoint is mounted at `/__hmr` and a client script is injected into every HTML response.

| Change | Behaviour |
|---|---|
| `.css` | Stylesheet reload — no page reload |
| `.ts` / `.tsx` | Cache invalidated → page reload |
| `.html` | Full page reload |
| Other assets | Full page reload |

Disable explicitly with `hmr: false`.

### Private dependencies

When your import map references private GitHub repos, kiln fetches them server-side using your `GITHUB_TOKEN`. The browser never sees the token.
```bash
export GITHUB_TOKEN="ghp_yourtoken"
```

## Environment configuration

Browser code cannot read `.env` files directly — environment variables are server-side only. kiln provides a unified pattern that works across every deployment target without changing your application code.

### How it works
```
Has Deno runtime?   →  /config endpoint  —  local dev, Deno Deploy, VPS
Static files only?  →  build-time inject —  Cloudflare Pages, Vercel, Netlify
```

Your browser code uses a single `getConfig()` function that handles both cases transparently:
```typescript
// public/config.ts
export interface AppConfig {
  apiUrl: string
}

let cached: AppConfig | null = null

export async function getConfig(): Promise<AppConfig> {
  if (cached) return cached

  // __env.ts is injected at build time for static deployments
  // In runtime mode this import fails and falls back to /config
  try {
    const mod = await import('./__env.ts')
    cached    = { apiUrl: mod.API_URL }
    return cached
  } catch {
    const res = await fetch('/config')
    if (!res.ok) throw new Error('Failed to load config')
    cached = await res.json()
    return cached!
  }
}
```

Usage in your app:
```typescript
import { getConfig } from './config.ts'

const { apiUrl } = await getConfig()
const res        = await fetch(`${apiUrl}/auth/me`, { credentials: 'include' })
```

### Runtime mode — local dev, Deno Deploy, VPS

`server.ts` writes `./public/__env.ts` at startup from the process environment and exposes a `/config` endpoint. The browser imports `__env.ts` directly — no network request needed.
```typescript
// server.ts
const apiUrl = Deno.env.get('API_URL') ?? 'http://localhost:3001'

// Write __env.ts so the browser can import it
await Deno.writeTextFile(
  './public/__env.ts',
  `export const API_URL = ${JSON.stringify(apiUrl)}\n`
)

await serve({
  // ...
  routes: (router) => {
    // Fallback for browsers that can't import __env.ts
    router.get('/config', () => Response.json({ apiUrl }))
  },
})
```

Set variables in your environment:
```bash
# Local — .env file
API_URL=http://localhost:3001
ENV=development

# Deno Deploy — dashboard environment variables
# VPS — systemd environment or Docker
API_URL=https://api.myapp.com
ENV=production
```

### Static mode — Cloudflare Pages, Vercel, Netlify

`scripts/build.ts` writes `./public/__env.ts` with the production value before bundling. The value is inlined into the JavaScript bundle — no server, no `/config` fetch needed at runtime.
```typescript
// scripts/build.ts
const apiUrl = Deno.env.get('API_URL')
if (!apiUrl) {
  console.error('API_URL is required')
  Deno.exit(1)
}

await Deno.writeTextFile(
  './public/__env.ts',
  `export const API_URL = ${JSON.stringify(apiUrl)}\n`
)

await build({ entry: './public/main.tsx', ... }, './public')

// Clean up — value is already bundled into dist/
await Deno.remove('./public/__env.ts').catch(() => {})
```

Set `API_URL` as an environment variable in your platform dashboard before deploying.

### `.gitignore`
```
public/__env.ts    # generated at runtime or build time — never commit
dist/
.env
```

### Behaviour by environment

| Environment | Strategy | How config is loaded |
|---|---|---|
| Local dev | Runtime | `server.ts` writes `__env.ts` from `.env` |
| Deno Deploy | Runtime | `server.ts` writes `__env.ts` from Deploy env vars |
| VPS + Deno | Runtime | `server.ts` writes `__env.ts` from system env vars |
| Cloudflare Pages | Static build | `build.ts` inlines `API_URL` into bundle |
| Vercel | Static build | `build.ts` inlines `API_URL` into bundle |
| Netlify | Static build | `build.ts` inlines `API_URL` into bundle |
---

## `build()`

Bundles your SPA into `./dist` for deployment to any static host. Unlike `serve()` which transpiles files individually, `build()` uses `@deno/emit`'s `bundle()` which fully resolves and inlines all dependencies into a single JavaScript file.
```typescript
// scripts/build.ts
import { build } from '@jayobado/kiln'

await build(
  {
    entry:     './public/main.ts',
    outDir:    './dist',
    importMap: './deno.json',
    minify:    true,
  },
  './public'
)
```

Output:
```
./dist/
├── index.html          ← script tag rewritten to reference bundle
├── main.a1b2c3d4.js    ← bundled + minified, content-hashed
├── styles.css          ← copied as-is
└── assets/
    └── logo.svg        ← copied as-is
```

### Preview before deploying
```typescript
// scripts/preview.ts
import { serve } from '@jayobado/kiln'

await serve({
  host:     'localhost',
  port:     3000,
  fsRoot:   './dist',
  strategy: 'eager',
  hmr:      false,
})
```

### `BundleOptions`

| Field | Type | Default | Description |
|---|---|---|---|
| `entry` | `string` | — | Entry point TypeScript file |
| `outDir` | `string` | `'./dist'` | Output directory |
| `importMap` | `string \| object` | — | Import map for alias resolution |
| `githubToken` | `string` | `GITHUB_TOKEN` env | Token for private repo imports |
| `compilerOptions` | `object` | — | TypeScript compiler options |
| `minify` | `boolean` | `false` | Minify output |

---

## Router
```typescript
await serve({
  routes: (router) => {
    // Simple route
    router.get('/health', () =>
      Response.json({ ok: true, ts: Date.now() })
    )

    // Named params
    router.get('/users/:id', (_req, params) =>
      Response.json({ id: params.id })
    )

    // POST with body
    router.post('/api/data', async (req) => {
      const body = await req.json()
      return Response.json({ received: body })
    })

    // All methods
    router.all('/catchall', (req) =>
      Response.json({ method: req.method })
    )
  },
})
```

---

## Middleware

All middleware is exported individually:
```typescript
import {
  requestId,       // X-Request-Id header per request
  securityHeaders, // X-Frame-Options, X-Content-Type-Options etc.
  accessLog,       // method, path, status, duration — writes to Log
  errorHandler,    // catches unhandled errors, returns 500
  cors,            // CORS headers
} from '@jayobado/kiln'
```

### CORS
```typescript
import { cors } from '@jayobado/kiln'

await serve({
  middleware: [
    cors({
      origins:       ['https://myapp.com'],
      methods:       ['GET', 'POST'],
      allowHeaders:  ['Content-Type', 'Authorization'],
      credentials:   true,
      maxAge:        7200,
    }),
  ],
})
```

### Custom middleware
```typescript
import type { Middleware } from '@jayobado/kiln'

const authMiddleware: Middleware = async (req, next) => {
  const token = req.headers.get('Authorization')
  if (!token) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }
  return next()
}

await serve({
  middleware: [authMiddleware],
})
```

---

## Logging

`Log` writes to `./logs/{level}_{YYYYMMDD}.log` and stdout/stderr simultaneously. A new file is created per level per day automatically.
```typescript
import { Log } from '@jayobado/kiln'

await Log.debug('Cache warmed')
await Log.info('Server running')
await Log.warn('Slow response')
await Log.error('Unhandled error')
```
```
logs/
├── debug_20260117.log
├── info_20260117.log
├── warn_20260117.log
└── error_20260117.log
```

---

## Compatible frameworks

kiln serves whatever is in `fsRoot` — completely framework-agnostic.

| Framework | `compilerOptions` needed | Notes |
|---|---|---|
| lolo-ui | No | Plain TypeScript, no JSX |
| vue-tools | No | Plain TypeScript, no JSX |
| Vue (h() only) | No | Plain TypeScript, no JSX |
| React | Yes | `jsx: 'react-jsx'`, `jsxImportSource: 'react'` |
| Solid | Yes | `jsx: 'react-jsx'`, `jsxImportSource: 'solid-js/h'` |
| Preact | Yes | `jsx: 'react-jsx'`, `jsxImportSource: 'preact'` |

---

## Deployment

### Deno Deploy

No build step needed. Push your repo and Deno Deploy runs `server.ts` directly.
```typescript
const isDeploy = Deno.env.get('DENO_DEPLOYMENT_ID') !== undefined

await serve({
  host:     '0.0.0.0',
  port:     parseInt(Deno.env.get('PORT') ?? '3000'),
  fsRoot:   './public',
  strategy: isDeploy ? 'eager' : 'lazy',
  hmr:      !isDeploy,
})
```

Set `GITHUB_TOKEN` in the Deno Deploy dashboard if you import from private repos.

### Cloudflare Pages
```toml
# wrangler.toml
name                   = "my-app"
pages_build_output_dir = "dist"

[build]
command = "deno task build"
```

### Vercel
```json
{
  "buildCommand":    "deno task build",
  "outputDirectory": "dist",
  "installCommand":  ""
}
```

### Netlify
```toml
[build]
  command = "deno task build"
  publish = "dist"
```

---

## Project structure
```
kiln/
├── mod.ts           # barrel export
├── types.ts         # Handler, Middleware, ServeOptions, BundleOptions
├── router.ts        # Router — URLPattern based
├── middleware.ts     # requestId, securityHeaders, accessLog, errorHandler, cors
├── transpile.ts     # createTranspileHandler, warmTranspileCache, invalidateCache, import rewriting
├── hmr.ts           # hmrHandler, broadcast, watchFs, hmrClientScript
├── bundle.ts        # build(), buildBundle()
├── factory.ts       # serve() — wires everything together
├── logger.ts        # Log — daily rotating file logger
└── deno.json
```

## License

MIT