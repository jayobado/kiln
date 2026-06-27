# kiln

A self-contained Deno full-stack server for the **lolo** stack: an on-the-fly TypeScript dev server with HMR, a static production build, a **bundled signals/real-DOM client** (`./client`), and a typed **BFF** (auth, procedures, RPC) — one package, no bundler, no `node_modules`.

> **Status:** Personal/experimental (v0.3.0). Reframed from a framework-agnostic build tool into an opinionated, batteries-included full-stack server: the dev server/build, a typed BFF (auth, upstream HTTP, procedures, RPC), and the bundled lolo client are all in place and wired together by end-to-end-typed RPC. API will change without notice.

## What this is

kiln is the **server and client in one package** for building real-DOM SPAs backed by a typed backend-for-frontend:

- **Dev server** — serves and transpiles TypeScript/TSX on the fly, with HMR. No build step in development.
- **Production build** — bundles to static files for any deployment target.
- **Bundled client** (`@jayobado/kiln/client`) — the lolo signals/real-DOM UI toolkit: reactive `signal`/`effect`/`computed`, a container/router/app system, `el.*`/`defineComponent` authoring, a declarative forms/tables DSL, async `useQuery`/`useMutation`, primitives, and hooks. (Vendored from the former standalone `@jayobado/lolo-ui`, now deprecated in favour of this.)
- **Typed BFF** — auth/sessions, an auth-aware upstream HTTP client, tRPC-style typed procedures, and an RPC endpoint, mounted ahead of static serving on kiln's own `@std/http` router. The client calls the BFF over **end-to-end-typed RPC** — define a procedure once, call it from the browser with full types, no Inertia and no separate API contract.

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

Server and client are subpaths of the same package — no second dependency. Server subpaths run on Deno; client subpaths are transpiled and served to the browser.

```ts
// server
import { serve }            from '@jayobado/kiln'
import { createAuth }       from '@jayobado/kiln/auth'
import { createProcedures } from '@jayobado/kiln/procedure'
import { createRpcHandler } from '@jayobado/kiln/rpc'

// client
import { signal, createApp } from '@jayobado/kiln/client'
import { createClient }      from '@jayobado/kiln/client/rpc'
```

**Server**

| Subpath | Contents |
| --- | --- |
| `@jayobado/kiln` | `serve`, `build`/`buildBundle`, `Router`, middleware, `Log` |
| `@jayobado/kiln/auth` | `createAuth` — sessions (cookie + store), `getSession`/`login`/`logout`, `require()` guard, credential relay, refresh |
| `@jayobado/kiln/upstream` | `createUpstream` — auth-aware HTTP client (`forSession`/`forRequest`) |
| `@jayobado/kiln/procedure` | `createProcedures` (tRPC-style typed procedures) + `createActionRouter` |
| `@jayobado/kiln/rpc` | `createRpcHandler` + `ok`/`redirect` outcome markers |
| `@jayobado/kiln/health` | `mountHealth` — `/health`, `/ready`, `/version` |
| `@jayobado/kiln/shutdown` | `onShutdown` / `runShutdown` registry |

**Client** (browser)

| Subpath | Contents |
| --- | --- |
| `@jayobado/kiln/client` | lolo core — signals, scope, container, router, app, `el.*`/`defineComponent`/`mount` |
| `@jayobado/kiln/client/dsl` | declarative forms + tables (`defineForm`/`renderForm`, `defineTable`/`renderTable`) |
| `@jayobado/kiln/client/query` | `useQuery` / `useMutation` (fetch-into-signals) |
| `@jayobado/kiln/client/rpc` | `createClient<AppRouter>`, `fieldErrors`, `RpcClientError` |
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

## Full-stack: the typed BFF + RPC

The core idea: **define a procedure once on the server, call it from the browser with full types** — no Inertia, no hand-written API contract, no codegen.

```ts
// server/router.ts  — the client imports only this file's *type*
import { createProcedures } from '@jayobado/kiln/procedure'
import { ok } from '@jayobado/kiln/rpc'

type Ctx = { session: { userId: string } | null }
const t = createProcedures<Ctx>()

export const appRouter = {
  orders: {
    list:   t.query(({ ctx }) => ctx /* … */ && []),
    create: t.input({ body: OrderSchema }).mutation(({ input }) => ok(/* … */)),
  },
}
export type AppRouter = typeof appRouter
```

```ts
// server.ts  — mount the RPC endpoint in serve()'s routes hook
import { serve } from '@jayobado/kiln'
import { createAuth, createMemoryStore } from '@jayobado/kiln/auth'
import { createRpcHandler } from '@jayobado/kiln/rpc'
import { appRouter } from './server/router.ts'

const auth = createAuth({ store: createMemoryStore() })
const rpc  = createRpcHandler({
  router:  appRouter,
  context: async (req) => ({ session: await auth.getSession(req) }),
})

await serve({
  host: 'localhost', port: 3000, fsRoot: './public',
  health: { version: '1.0.0' },
  routes: (router) => rpc.mount(router),   // POST /rpc/<dotted.path>
})
```

```ts
// client — a typed proxy from the exported router *type*
import { createClient, fieldErrors } from '@jayobado/kiln/client/rpc'
import type { AppRouter } from '../server/router.ts'

const rpc = createClient<AppRouter>({ url: '/rpc' })
const orders = await rpc.orders.list()            // input + output fully typed
try { await rpc.orders.create(form) }
catch (e) { errors.set(fieldErrors(e)) }          // 422 issues → { field: message }
```

- **Auth** is cookie-based on the Web `Request`/`Response` model: `auth.login(data)` / `auth.logout(req)` return a `Set-Cookie` string to attach; the RPC `context` builder reads the session once per call via `auth.getSession(req)`. Gate a procedure with a `.use()` guard that throws `ProcedureError('UNAUTHORIZED')`.
- **Validation** failures (Standard Schema on a procedure's input) come back as a 422 envelope; the client's `fieldErrors(e)` flattens them to `{ field: message }` for the forms DSL.
- A resolver can return `redirect(url)` or `ok(value, { flash })` for server-informed navigation + flash, surfaced by the client's `navigate`/`onFlash`.

See **[`example/`](example/)** for a complete working app (server + client + integration test).

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

  health: { version: '1.0.0' }, // mounts /health, /ready, /version

  routes: (router) => {         // API/BFF routes, mounted ahead of static serving
    rpc.mount(router)           // typed RPC endpoint
    router.use(auth.require())  // or guard/handle your own routes
  },

  middleware: [],               // additional middleware
})
```

The canonical request order serve() composes: built-in middleware → custom `middleware` → `health` → HMR → `routes` (your BFF: RPC, auth guards, …) → static + SPA fallback.

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
