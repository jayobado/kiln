// End-to-end integration: the composed BFF (auth + RPC) driven through a real
// Router exactly as serve() wires it, exercised by the typed client over a
// cookie jar. Proves the full loop no single unit test covers.

import { assertEquals } from '@std/assert'
import { Router } from '@jayobado/kiln'
import { createAuth, createMemoryStore } from '@jayobado/kiln/auth'
import { createRpcHandler } from '@jayobado/kiln/rpc'
import { createClient, type RpcClientError } from '@jayobado/kiln/client/rpc'
import { type AppRouter, appRouter, type Ctx, type Session } from './router.ts'

const fakeInfo = {
	remoteAddr: { transport: 'tcp', hostname: '127.0.0.1', port: 0 },
	completed: Promise.resolve(),
} as unknown as Deno.ServeHandlerInfo

function buildRouter(): Router {
	const auth = createAuth<Session>({ store: createMemoryStore<Session>(), cookie: { secure: false } })
	const rpc = createRpcHandler<Ctx>({
		router: appRouter,
		context: async (req): Promise<Ctx> => ({ session: await auth.getSession(req) }),
	})
	const router = new Router()
	rpc.mount(router)
	router.post('/login', async () => {
		const { setCookie } = await auth.login({ userId: 'u1', name: 'Ada', accessToken: 'tok' })
		return new Response(JSON.stringify({ ok: true }), {
			headers: { 'Content-Type': 'application/json', 'Set-Cookie': setCookie },
		})
	})
	return router
}

Deno.test('full loop: public greet → gated 401 → login → authed me + note', async () => {
	const router = buildRouter()

	// A client with a cookie jar over the in-process Router.
	let cookie = ''
	const rpc = createClient<AppRouter>({
		url: 'http://x/rpc',
		fetch: (input, init) => {
			const headers = new Headers(init.headers)
			if (cookie) headers.set('Cookie', cookie)
			return router.handle(new Request(input, { ...init, headers }), fakeInfo)
		},
	})

	// 1. Public query works with no session.
	assertEquals(await rpc.greet({ name: 'world' }), { message: 'Hello, world!' })

	// 2. Auth-gated query → 401 before login.
	let status = 0
	try {
		await rpc.me()
	} catch (e) {
		status = (e as RpcClientError).status
	}
	assertEquals(status, 401)

	// 3. Log in — capture the session cookie.
	const loginRes = await router.handle(new Request('http://x/login', { method: 'POST' }), fakeInfo)
	cookie = (loginRes.headers.get('Set-Cookie') ?? '').split(';')[0]
	await loginRes.body?.cancel()

	// 4. Same cookie now unlocks the gated procedures.
	assertEquals(await rpc.me(), { id: 'u1', name: 'Ada' })
	assertEquals(await rpc.notes.create({ text: 'hi' }), { author: 'Ada', text: 'hi' })
})
