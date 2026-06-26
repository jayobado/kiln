# kiln example — a full-stack app in one package

A minimal but complete kiln app: the dev server + transpile + HMR, a typed BFF
(auth + RPC), health endpoints, and the lolo client — talking to its backend
over **end-to-end-typed RPC**, no separate API contract.

```
example/
  router.ts            shared procedures; the client imports only its *type*
  server.ts            serve() wiring: auth + rpc.mount + health + static
  deno.json            import map pointing @jayobado/kiln/* at the local source
  public/
    index.html
    app.ts             the lolo client; calls procedures via createClient<AppRouter>
  example_test.ts      the composed loop as an integration test
```

## Run it

```sh
deno run -A --config example/deno.json example/server.ts
# → http://localhost:3000
```

(In a real project you'd add the import map to your own `deno.json` and depend on
`jsr:@jayobado/kiln`; the local import map here just points at the source.)

## The shape

The one idea: **define a procedure once, call it type-safely from the browser.**

```ts
// router.ts — server
export const appRouter = {
  greet: t.input({ body: NameInput }).query(({ input }) => ({ message: `Hello, ${input.body.name}!` })),
  me:    authed.query(({ ctx }) => ({ id: ctx.session.userId, name: ctx.session.name })),
}
export type AppRouter = typeof appRouter
```

```ts
// app.ts — client (imports only the *type* of appRouter)
const rpc = createClient<AppRouter>({ url: '/rpc' })
const { message } = await rpc.greet({ name: 'world' })  // input + output fully typed
const me = await rpc.me()                                // 401 until a session cookie is set
```

Auth is cookie-based: a login endpoint mints a session and returns a `Set-Cookie`;
the RPC handler's context builder reads it once per call (`auth.getSession(req)`)
and hands the session to the procedures. Validation failures come back as a 422
envelope that the client's `fieldErrors(e)` turns into `{ field: message }` for the
form layer.

## What it verifies

`example_test.ts` drives the composed BFF through a real `Router` over a cookie
jar: public query works, the auth-gated query 401s, login sets the cookie, then
the same cookie unlocks `me` and `notes.create`. Run it:

```sh
deno test -A --config example/deno.json example/example_test.ts
```
