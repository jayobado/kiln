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

### Caching

Versioned dependency paths (`/jsr/...`, `/npm/...`) are served with `Cache-Control: public, max-age=31536000, immutable` — the content at a versioned URL never changes, so browsers and CDNs can cache them indefinitely. Local files are served with `no-cache` so HMR and development reloads work correctly.

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