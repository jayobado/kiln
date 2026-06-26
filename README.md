# kiln

A self-contained Deno full-stack server for the **lolo** stack: an on-the-fly TypeScript dev server with HMR, a static production build, a **bundled signals/real-DOM client** (`./client`), and a typed **BFF** (auth, procedures, RPC) — one package, no bundler, no `node_modules`.

> **Status:** Personal/experimental (v0.3.0). Being reframed from a framework-agnostic build tool into an opinionated, batteries-included full-stack server. The server (serve/transpile/HMR/build) and the bundled client are in place; the BFF layer (auth, upstream HTTP, typed procedures, RPC) is landing incrementally. API will change without notice.

## What this is

kiln is the **server and client in one package** for building real-DOM SPAs backed by a typed backend-for-frontend:

- **Dev server** — serves and transpiles TypeScript/TSX on the fly, with HMR. No build step in development.
- **Production build** — bundles to static files for any deployment target.
- **Bundled client** (`@jayobado/kiln/client`) — the lolo signals/real-DOM UI toolkit: reactive `signal`/`effect`/`computed`, a container/router/app system, `el.*`/`defineComponent` authoring, a declarative forms/tables DSL, async `useQuery`/`useMutation`, primitives, and hooks. (Vendored from the former standalone `@jayobado/lolo-ui`, now deprecated in favour of this.)
- **BFF** *(in progress)* — typed procedures + RPC, auth/sessions, and an auth-aware upstream HTTP client, mounted ahead of static serving on kiln's own `@std/http` router. The client calls the BFF over **end-to-end typed RPC** — no Inertia, no separate API contract.

It is **opinionated and self-contained**: kiln is the toolchain *and* the UI framework *and* the BFF. For a Vue/Inertia stack instead, see the parallel [`@jayobado/hono-ui`](https://jsr.io/@jayobado/hono-ui).

## Requirements

- Deno 1.40+

## Compatibility

| Environment | Strategy | Notes |
|---|---|---|
| Local dev | `lazy` + HMR | Transpiles on request, live reloads on change |
| Deno Deploy | `eager` | Transpiles at startup, serves from memory |
| Cloudflare Pages / Vercel / Netlify | `build()` | Pre-bundle to `./dist`, deploy static files |
| VPS + Deno | `eager` | Transpiles at startup, serves from memory |

## Installation

```sh
deno add jsr:@jayobado/kiln
```

Or in `deno.json`:

```jsonc
{
  "imports": {
    "@jayobado/kiln": "jsr:@jayobado/kiln@^0.3.0"
  }
}
```

The client is a subpath of the same package — no second dependency:

```ts
import { signal, defineContainer, createApp, h } from '@jayobado/kiln/client'
import { defineForm, renderForm }                 from '@jayobado/kiln/client/dsl'
import { useQuery, useMutation }                   from '@jayobado/kiln/client/query'
```

| Subpath | Contents |
| --- | --- |
| `@jayobado/kiln` | server: `serve`, `build`/`buildBundle`, `Router`, middleware, `Log` |
| `@jayobado/kiln/client` | lolo core — signals, scope, container, router, app, `el.*`/`defineComponent`/`mount` |
| `@jayobado/kiln/client/dsl` | declarative forms + tables (`defineForm`/`renderForm`, `defineTable`/`renderTable`) |
| `@jayobado/kiln/client/query` | `useQuery` / `useMutation` (fetch-into-signals) |
| `@jayobado/kiln/client/primitives` | click-outside, clipboard, debounce, focus-trap, media-query, pagination, portal, scroll-lock, selection, toast, tooltip, … |
| `@jayobado/kiln/client/hooks` | dropdown, modal |

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
    "dev":   "deno run --watch --allow-all server.ts",
    "start": "ENV=production deno run --allow-all server.ts",
    "build": "deno run --allow-all scripts/build.ts"
  }
}
```

```bash
deno task dev
```

Your client pages import from `@jayobado/kiln/client`; kiln resolves that subpath, transpiles it, and serves it to the browser — no install, no `node_modules`.

## `serve()`

Serves a TypeScript SPA from `fsRoot`. Intercepts `.ts`/`.tsx` requests and transpiles them server-side. Falls back to `index.html` for SPA client-side routes. Project routes registered via the `routes` hook mount **before** the static handler — the seam the BFF builds on.

```typescript
await serve({
  host:    'localhost',
  port:    3000,

  fsRoot:  './public',          // source directory — default './public'
  importMap: './deno.json',     // path to deno.json or inline object

  githubToken: Deno.env.get('GITHUB_TOKEN'),  // for private repo imports

  strategy: 'lazy',             // 'lazy' (dev) | 'eager' (prod)
  hmr: true,                    // default true when strategy is 'lazy'

  routes: (router) => {         // API/BFF routes, mounted ahead of static serving
    router.get('/health', () => Response.json({ ok: true }))
  },

  middleware: [],               // additional middleware
})
```

### Transpilation strategies

**Lazy — development.** Transpiles on the first request for each file, caches in memory. Import map aliases are resolved and rewritten server-side — the browser receives plain JavaScript with fully resolved paths.

**Eager — production.** Transpiles every `.ts`/`.tsx` file in `fsRoot` at startup before accepting requests.

### Import resolution

kiln reads your `deno.json` import map and `deno.lock` to resolve bare specifiers in transpiled output. JSR and npm dependencies are fetched, transpiled, and served automatically:

| Specifier | Resolved to | Served from |
|---|---|---|
| `jsr:@scope/pkg@^1.0.0` | `/jsr/@scope/pkg/1.0.3/mod.ts` | `https://jsr.io/...` |
| `npm:zod@^3.0.0` | `/npm/zod@3.0.0` | `https://esm.sh/...` |
| `./views/home.ts` | `./views/home.ts` | `fsRoot` |

Versions are resolved from `deno.lock` — no runtime version lookups. The browser never sees bare specifiers or JSR/npm URLs directly. The entire dependency tree is resolved this way — no install step, no `node_modules`, no local copies.

### Caching

Versioned dependency paths (`/jsr/...`, `/npm/...`) are served `Cache-Control: public, max-age=31536000, immutable` — the content at a versioned URL never changes. Local files are served `no-cache` so HMR and development reloads work correctly.

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

## License

MIT
