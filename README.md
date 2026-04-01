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
    "@kiln": "jsr:@jayobado/kiln@^0.1.0"
  }
}
```

---

## Quick start
```typescript
// server.ts
import { serve } from '@kiln'

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
  // Required when using import aliases (@lolo-ui, @myapp etc.)
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

Transpiles on the first request for each file, caches in memory. Subsequent requests return instantly. Import aliases and private GitHub repos are resolved server-side — the browser never needs auth tokens.

**Eager — production**

Transpiles every `.ts` and `.tsx` file at startup before accepting requests. All files are in memory by the time the first request arrives.

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

---

## `build()`

Bundles your SPA into `./dist` for deployment to any static host.
```typescript
// scripts/build.ts
import { build } from '@kiln'

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
import { serve } from '@kiln'

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
} from '@kiln'
```

### CORS
```typescript
import { cors } from '@kiln'

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
import type { Middleware } from '@kiln'

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
import { Log } from '@kiln'

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
| vue-ui | No | Plain TypeScript, no JSX |
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
├── middleware.ts    # requestId, securityHeaders, accessLog, errorHandler, cors
├── transpile.ts     # createTranspileHandler, warmTranspileCache, invalidateCache
├── hmr.ts           # hmrHandler, broadcast, watchFs, hmrClientScript
├── bundle.ts        # build(), buildBundle()
├── logger.ts        # Log — daily rotating file logger
└── deno.json
```

## License

MIT