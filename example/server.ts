// A minimal full-stack kiln app: dev server + transpile + HMR, a typed BFF
// (auth + RPC), health endpoints, and the lolo client served from ./public.
//
//   deno run -A --config example/deno.json example/server.ts

import { serve } from '@jayobado/kiln'
import { createAuth, createMemoryStore } from '@jayobado/kiln/auth'
import { createRpcHandler } from '@jayobado/kiln/rpc'
import { appRouter, type Ctx, type Session } from './router.ts'

const auth = createAuth<Session>({
	store: createMemoryStore<Session>(),
	cookie: { secure: false }, // localhost / http during dev
})

// One context build per RPC call: read the session, hand it to the procedures.
const rpc = createRpcHandler<Ctx>({
	router: appRouter,
	context: async (req): Promise<Ctx> => ({ session: await auth.getSession(req) }),
})

const isDev = Deno.env.get('ENV') !== 'production'

await serve({
	host: 'localhost',
	port: 3000,
	fsRoot: './example/public',
	importMap: './example/deno.json',
	strategy: isDev ? 'lazy' : 'eager',
	hmr: isDev,
	health: { version: '0.3.0' },

	routes: (router) => {
		// The typed RPC endpoint the client calls.
		rpc.mount(router)

		// A demo login that mints a session and sets the cookie.
		router.post('/login', async () => {
			const { setCookie } = await auth.login({ userId: 'u1', name: 'Ada', accessToken: 'tok' })
			return new Response(JSON.stringify({ ok: true }), {
				headers: { 'Content-Type': 'application/json', 'Set-Cookie': setCookie },
			})
		})
	},
})
